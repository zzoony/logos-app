"""Step 6: Add pronunciation and Korean definitions to vocabulary.

Requirements:
    - droid CLI or claude CLI must be installed and available in PATH
    - Or Z.AI API credentials in .env file (for --api mode)
"""

from __future__ import annotations

import argparse
import json
import subprocess
import re
import time
import os
import urllib.request
import urllib.error
import concurrent.futures
from datetime import datetime
from pathlib import Path

try:
    from zai import ZaiClient
    ZAI_SDK_AVAILABLE = True
except ImportError:
    ZAI_SDK_AVAILABLE = False

from config import VERSION_OUTPUT_DIR, VERSION_NAME, FINAL_VOCABULARY_PATH

# Load environment variables from .env file
def load_env():
    """Load environment variables from .env file."""
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# Input/Output files
INPUT_PATH = VERSION_OUTPUT_DIR / "step5_vocabulary_with_sentences.json"
OUTPUT_PATH = FINAL_VOCABULARY_PATH  # Uses version-tagged filename from config
FAILED_WORDS_PATH = VERSION_OUTPUT_DIR / "failed_words.json"

# Processing configuration
BATCH_SIZE = 50  # Words per request
MAX_WORKERS_CLI = 10  # Parallel requests for CLI
MAX_WORKERS_API = 5   # Optimal for API (server-side bottleneck with more)
DEFAULT_CLI = "droid"
DEFAULT_MODEL = "glm-4.6"
CLI_TIMEOUT = 120  # seconds

# Global variables for CLI configuration (set by main)
CLI_TOOL = DEFAULT_CLI
CLI_MODEL = DEFAULT_MODEL
USE_API = False  # Use API instead of CLI

# API Configuration (from environment)
API_BASE = os.environ.get("ZAI_API_BASE", "https://api.z.ai/api/coding/paas/v4")
API_KEY = os.environ.get("ZAI_API_KEY", "")
API_MODEL = os.environ.get("ZAI_MODEL", "glm-4.6")
API_TIMEOUT = 120  # seconds
API_BATCH_SIZE = 50  # Words per API request (same as CLI)

# Global SDK client (initialized lazily)
_zai_client = None

def get_zai_client():
    """Get or create ZAI SDK client."""
    global _zai_client
    if _zai_client is None and ZAI_SDK_AVAILABLE:
        _zai_client = ZaiClient(
            api_key=API_KEY,
            base_url=f"{API_BASE}/",
            timeout=float(API_TIMEOUT),
            max_retries=2
        )
    return _zai_client


def log(message: str, level: str = "INFO") -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def get_cli_command() -> list[str]:
    """Get CLI command based on the tool type."""
    if CLI_TOOL == "droid":
        return ["droid", "exec", "-o", "text", "-m", CLI_MODEL]
    else:
        # Default: claude CLI
        return [CLI_TOOL, "--model", CLI_MODEL, "--print"]


def load_vocabulary() -> dict:
    """Load vocabulary with sentences."""
    log(f"Loading vocabulary from {INPUT_PATH}")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_existing_vocabulary() -> dict | None:
    """Load existing final vocabulary if exists."""
    if OUTPUT_PATH.exists():
        with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def get_missing_definitions(vocabulary: dict) -> list[str]:
    """Get words that are missing definitions from existing vocabulary."""
    missing = []
    for word_data in vocabulary.get("words", []):
        if not word_data.get("definition_korean"):
            missing.append(word_data["word"])
    return missing


def save_failed_words(words: list[str]) -> None:
    """Save failed words to file for later retry."""
    with open(FAILED_WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump({"failed_words": words, "count": len(words)}, f, indent=2)
    log(f"Saved {len(words)} failed words to {FAILED_WORDS_PATH}")


def create_prompt(words: list[str]) -> str:
    """Create prompt for generating definitions."""
    words_str = ", ".join(words)
    return f"""You are a Bible vocabulary assistant. Generate pronunciation and Korean definition for each English word.

Words: {words_str}

Respond in JSON array format ONLY (no explanation, no markdown):
[
  {{
    "word": "word",
    "ipa_pronunciation": "[IPA]",
    "korean_pronunciation": "한글 발음",
    "definition_korean": "한국어 뜻 (간결하게)"
  }}
]"""


def extract_json_from_response(response: str) -> list:
    """Extract JSON array from response."""
    match = re.search(r'\[[\s\S]*\]', response)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def process_batch(batch_info: tuple) -> tuple[int, list, list]:
    """Process a batch of words with CLI.

    Returns: (batch_index, results, failed_words)
    """
    batch_index, words = batch_info

    prompt = create_prompt(words)

    try:
        result = subprocess.run(
            get_cli_command(),
            input=prompt,
            capture_output=True,
            text=True,
            timeout=CLI_TIMEOUT
        )

        if result.returncode != 0:
            return (batch_index, [], words)

        definitions = extract_json_from_response(result.stdout)

        if not definitions:
            return (batch_index, [], words)

        # Create lookup dict
        def_dict = {d["word"]: d for d in definitions}

        # Match results to original words
        results = []
        failed = []
        for word in words:
            if word in def_dict:
                results.append(def_dict[word])
            else:
                failed.append(word)

        return (batch_index, results, failed)

    except subprocess.TimeoutExpired:
        log(f"Batch {batch_index} timed out after {CLI_TIMEOUT}s", "WARN")
        return (batch_index, [], words)
    except Exception:
        log(f"Batch {batch_index} failed with unexpected error", "WARN")
        return (batch_index, [], words)


def process_batch_api(batch_info: tuple) -> tuple[int, list, list]:
    """Process a batch of words with Z.AI API.

    Returns: (batch_index, results, failed_words)
    """
    batch_index, words = batch_info

    prompt = create_prompt(words)

    # Build API request
    url = f"{API_BASE}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    data = {
        "model": API_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3
    }

    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as response:
            result = json.loads(response.read().decode("utf-8"))

        # Extract content from API response
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        definitions = extract_json_from_response(content)

        if not definitions:
            return (batch_index, [], words)

        # Create lookup dict
        def_dict = {d["word"]: d for d in definitions}

        # Match results to original words
        results = []
        failed = []
        for word in words:
            if word in def_dict:
                results.append(def_dict[word])
            else:
                failed.append(word)

        return (batch_index, results, failed)

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        log(f"Batch {batch_index} HTTP error {e.code}: {error_body[:200]}", "WARN")
        return (batch_index, [], words)
    except urllib.error.URLError as e:
        log(f"Batch {batch_index} URL error: {e.reason}", "WARN")
        return (batch_index, [], words)
    except TimeoutError:
        log(f"Batch {batch_index} timed out after {API_TIMEOUT}s", "WARN")
        return (batch_index, [], words)
    except Exception as e:
        log(f"Batch {batch_index} failed: {e}", "WARN")
        return (batch_index, [], words)


def process_batch_sdk(batch_info: tuple) -> tuple[int, list, list]:
    """Process a batch of words with Z.AI SDK.

    Returns: (batch_index, results, failed_words)
    """
    batch_index, words = batch_info
    prompt = create_prompt(words)
    client = get_zai_client()

    if client is None:
        log(f"Batch {batch_index}: SDK not available, falling back to urllib", "WARN")
        return process_batch_api(batch_info)

    try:
        response = client.chat.completions.create(
            model=API_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            extra_body={"thinking": {"type": "disabled"}}  # Disable reasoning for faster response
        )

        # Validate API response structure
        if not response.choices:
            return (batch_index, [], words)
        content = response.choices[0].message.content or ""
        definitions = extract_json_from_response(content)

        if not definitions:
            return (batch_index, [], words)

        # Create lookup dict
        def_dict = {d["word"]: d for d in definitions}

        # Match results to original words
        results = []
        failed = []
        for word in words:
            if word in def_dict:
                results.append(def_dict[word])
            else:
                failed.append(word)

        return (batch_index, results, failed)

    except Exception as e:
        log(f"Batch {batch_index} SDK error: {e}", "WARN")
        return (batch_index, [], words)


def add_definitions(vocabulary: dict, limit: int | None = None, retry_missing: bool = False) -> dict:
    """Add definitions to all vocabulary words."""
    words_data = vocabulary["words"]

    # If retry mode, only process words missing definitions
    if retry_missing:
        existing = load_existing_vocabulary()
        if existing:
            missing_words = set(get_missing_definitions(existing))
            log(f"Retry mode: {len(missing_words)} words missing definitions")
            words_data = [w for w in words_data if w["word"] in missing_words]
        else:
            log("No existing vocabulary found, processing all words")

    # Apply limit if specified
    if limit:
        words_data = words_data[:limit]
        log(f"Test mode: processing first {limit} words only")

    total_words = len(words_data)

    if total_words == 0:
        log("No words to process!")
        return vocabulary

    # Select worker count and batch size based on mode
    max_workers = MAX_WORKERS_API if USE_API else MAX_WORKERS_CLI
    batch_size = API_BATCH_SIZE if USE_API else BATCH_SIZE

    log(f"Total words to process: {total_words}")
    log(f"Batch size: {batch_size}, Max workers: {max_workers}")

    # Extract just the words for processing
    word_list = [w["word"] for w in words_data]

    # Create batches
    batches = []
    for i in range(0, len(word_list), batch_size):
        batch_words = word_list[i:i + batch_size]
        batches.append((len(batches), batch_words))

    total_batches = len(batches)
    log(f"Created {total_batches} batches")

    # Process batches in parallel
    all_definitions = {}
    all_failed = []
    completed = 0
    start_time = time.time()

    # Select batch processor (SDK > urllib API > CLI)
    if USE_API:
        if ZAI_SDK_AVAILABLE:
            batch_processor = process_batch_sdk
            log("Using Z.AI SDK for API calls")
        else:
            batch_processor = process_batch_api
            log("SDK not available, using urllib")
    else:
        batch_processor = process_batch

    log("Starting parallel processing...")
    print("-" * 60)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(batch_processor, batch): batch[0] for batch in batches}

        for future in concurrent.futures.as_completed(futures):
            batch_idx = futures[future]
            try:
                idx, results, failed = future.result()

                # Store results
                for r in results:
                    all_definitions[r["word"]] = r
                all_failed.extend(failed)

                completed += 1
                elapsed = time.time() - start_time
                avg_time = elapsed / completed
                remaining = (total_batches - completed) * avg_time

                success_count = len(results)
                fail_count = len(failed)

                log(
                    f"Batch {idx + 1}/{total_batches} done: "
                    f"{success_count} ok, {fail_count} fail | "
                    f"Progress: {completed}/{total_batches} ({completed*100//total_batches}%) | "
                    f"ETA: {remaining:.0f}s"
                )

            except Exception as e:
                log(f"Batch {batch_idx + 1} error: {e}", "ERROR")

    print("-" * 60)

    # Retry failed words if any
    if all_failed:
        log(f"Retrying {len(all_failed)} failed words...")
        retry_batches = []
        for i in range(0, len(all_failed), batch_size):
            batch_words = all_failed[i:i + batch_size]
            retry_batches.append((len(retry_batches), batch_words))

        retry_failed = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = list(executor.map(batch_processor, retry_batches))
            for _, results, failed in futures:
                for r in results:
                    all_definitions[r["word"]] = r
                retry_failed.extend(failed)

        if retry_failed:
            log(f"Still failed after retry: {len(retry_failed)} words", "WARN")
            save_failed_words(retry_failed)

    # Merge definitions into vocabulary (with existing if retry mode)
    log("Merging definitions into vocabulary...")

    # If retry mode, load existing vocabulary and merge
    if retry_missing:
        existing = load_existing_vocabulary()
        if existing:
            # Build dict of existing definitions
            existing_defs = {w["word"]: w for w in existing["words"]}
            # Update with new definitions
            for word, defn in all_definitions.items():
                if word in existing_defs:
                    existing_defs[word].update({
                        "ipa_pronunciation": defn.get("ipa_pronunciation", ""),
                        "korean_pronunciation": defn.get("korean_pronunciation", ""),
                        "definition_korean": defn.get("definition_korean", "")
                    })
            # Count successes
            success_count = sum(1 for w in existing_defs.values() if w.get("definition_korean"))
            updated_words = list(existing_defs.values())

            return {
                "metadata": {
                    **existing["metadata"],
                    "definitions_count": success_count,
                    "processing_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                },
                "words": updated_words
            }

    # Normal mode: process all words
    updated_words = []
    success_count = 0

    for word_data in vocabulary["words"]:
        word = word_data["word"]
        if word in all_definitions:
            updated_word = {
                **word_data,
                "ipa_pronunciation": all_definitions[word].get("ipa_pronunciation", ""),
                "korean_pronunciation": all_definitions[word].get("korean_pronunciation", ""),
                "definition_korean": all_definitions[word].get("definition_korean", "")
            }
            success_count += 1
        else:
            updated_word = {
                **word_data,
                "ipa_pronunciation": "",
                "korean_pronunciation": "",
                "definition_korean": ""
            }
        updated_words.append(updated_word)

    elapsed_total = time.time() - start_time
    log(f"Processing complete: {success_count}/{total_words} words ({success_count*100//total_words}%)")
    log(f"Total time: {elapsed_total:.1f}s")

    return {
        "metadata": {
            **vocabulary["metadata"],
            "definitions_added": True,
            "definitions_count": success_count,
            "processing_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "words": updated_words
    }


def save_output(vocabulary: dict, output_path: Path | None = None) -> None:
    """Save final vocabulary to JSON with unique IDs."""
    path = output_path or OUTPUT_PATH

    # Add unique ID to each word (0-indexed)
    for idx, word_data in enumerate(vocabulary.get("words", [])):
        word_data["id"] = idx

    # Update metadata
    vocabulary["metadata"]["has_id"] = True

    with open(path, "w", encoding="utf-8") as f:
        json.dump(vocabulary, f, indent=2, ensure_ascii=False)
    log(f"Saved to {path} (with {len(vocabulary.get('words', []))} word IDs)")


def main():
    global CLI_TOOL, CLI_MODEL, USE_API

    parser = argparse.ArgumentParser(description="Add definitions to vocabulary")
    parser.add_argument(
        "--test", "-t",
        type=int,
        metavar="N",
        help="Test mode: process only first N words"
    )
    parser.add_argument(
        "--retry",
        action="store_true",
        help="Retry only words missing definitions from existing output"
    )
    parser.add_argument(
        "--api",
        action="store_true",
        help="Use Z.AI API instead of CLI (requires .env with API credentials)"
    )
    parser.add_argument(
        "--cli",
        type=str,
        default=DEFAULT_CLI,
        choices=["claude", "droid"],
        help=f"CLI tool to use (default: {DEFAULT_CLI})"
    )
    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Model to use (default: {DEFAULT_MODEL})"
    )
    args = parser.parse_args()

    # Set global configuration
    CLI_TOOL = args.cli
    CLI_MODEL = args.model
    USE_API = args.api

    # Validate API credentials if using API mode
    if USE_API and not API_KEY:
        print("ERROR: --api requires ZAI_API_KEY in .env file")
        return

    print("=" * 60)
    print(f"Step 6: Add Definitions ({VERSION_NAME})")
    if USE_API:
        print(f"Mode: API ({API_BASE})")
        print(f"Model: {API_MODEL}")
    else:
        print(f"Mode: CLI ({CLI_TOOL})")
        print(f"Model: {CLI_MODEL}")
    if args.retry:
        print("RETRY MODE: Processing only missing definitions")
    if args.test:
        print(f"TEST MODE: {args.test} words only")
    print("=" * 60)

    vocabulary = load_vocabulary()
    updated = add_definitions(vocabulary, limit=args.test, retry_missing=args.retry)

    # Use different output file for test mode
    if args.test:
        output_path = VERSION_OUTPUT_DIR / "bible_vocabulary_final_test.json"
    else:
        output_path = OUTPUT_PATH

    save_output(updated, output_path)

    # Show sample results
    print("\n=== Sample Results ===")
    for word_data in updated["words"][:5]:
        print(f"\n{word_data['word']}:")
        print(f"  발음: {word_data.get('ipa_pronunciation', 'N/A')}")
        print(f"  한글: {word_data.get('korean_pronunciation', 'N/A')}")
        print(f"  뜻: {word_data.get('definition_korean', 'N/A')}")


if __name__ == "__main__":
    main()
