"""Step 6: Add pronunciation and Korean definitions to vocabulary.

Requirements:
    - Claude CLI or droid CLI must be installed and available in PATH
      - Claude: https://docs.anthropic.com/en/docs/claude-cli
      - droid: use --cli droid option
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import re
import time
import concurrent.futures
from datetime import datetime
from pathlib import Path

from config import VERSION_OUTPUT_DIR, VERSION_NAME

# Input/Output files
INPUT_PATH = VERSION_OUTPUT_DIR / "step5_vocabulary_with_sentences.json"
OUTPUT_PATH = VERSION_OUTPUT_DIR / "final_vocabulary.json"

# Processing configuration
BATCH_SIZE = 50  # Words per Claude request
MAX_WORKERS = 10  # Parallel requests
DEFAULT_CLI = "claude"
DEFAULT_MODEL = "haiku"
DROID_DEFAULT_MODEL = "glm-4.6"
CLI_TIMEOUT = 120  # seconds

# Global variables for CLI configuration (set by main)
CLI_TOOL = DEFAULT_CLI
CLI_MODEL = DEFAULT_MODEL


def get_cli_command() -> list[str]:
    """Get CLI command based on the tool type."""
    if CLI_TOOL == "droid":
        return ["droid", "exec", "-o", "text", "-m", CLI_MODEL]
    else:
        # Default: claude CLI
        return [CLI_TOOL, "--model", CLI_MODEL, "--print"]


def log(message: str, level: str = "INFO") -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def load_vocabulary() -> dict:
    """Load vocabulary with sentences."""
    log(f"Loading vocabulary from {INPUT_PATH}")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def create_prompt(words: list[str]) -> str:
    """Create prompt for Claude to generate definitions."""
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
    """Extract JSON array from Claude response."""
    # Try to find JSON array in response
    match = re.search(r'\[[\s\S]*\]', response)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def process_batch(batch_info: tuple) -> tuple[int, list, list]:
    """Process a batch of words with Claude CLI.

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


def add_definitions(vocabulary: dict, limit: int | None = None) -> dict:
    """Add definitions to all vocabulary words."""
    words_data = vocabulary["words"]

    # Apply limit if specified
    if limit:
        words_data = words_data[:limit]
        log(f"Test mode: processing first {limit} words only")

    total_words = len(words_data)

    log(f"Total words to process: {total_words}")
    log(f"Batch size: {BATCH_SIZE}, Max workers: {MAX_WORKERS}")

    # Extract just the words for processing
    word_list = [w["word"] for w in words_data]

    # Create batches
    batches = []
    for i in range(0, len(word_list), BATCH_SIZE):
        batch_words = word_list[i:i + BATCH_SIZE]
        batches.append((len(batches), batch_words))

    total_batches = len(batches)
    log(f"Created {total_batches} batches")

    # Process batches in parallel
    all_definitions = {}
    all_failed = []
    completed = 0
    start_time = time.time()

    log("Starting parallel processing...")
    print("-" * 60)

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_batch, batch): batch[0] for batch in batches}

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
        for i in range(0, len(all_failed), BATCH_SIZE):
            batch_words = all_failed[i:i + BATCH_SIZE]
            retry_batches.append((len(retry_batches), batch_words))

        retry_failed = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = list(executor.map(process_batch, retry_batches))
            for _, results, failed in futures:
                for r in results:
                    all_definitions[r["word"]] = r
                retry_failed.extend(failed)

        if retry_failed:
            log(f"Still failed after retry: {len(retry_failed)} words", "WARN")

    # Merge definitions into vocabulary
    log("Merging definitions into vocabulary...")
    updated_words = []
    success_count = 0

    for word_data in words_data:
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
    """Save final vocabulary to JSON."""
    path = output_path or OUTPUT_PATH
    with open(path, "w", encoding="utf-8") as f:
        json.dump(vocabulary, f, indent=2, ensure_ascii=False)
    log(f"Saved to {path}")


def main():
    global CLI_TOOL, CLI_MODEL

    parser = argparse.ArgumentParser(description="Add definitions to vocabulary")
    parser.add_argument(
        "--test", "-t",
        type=int,
        metavar="N",
        help="Test mode: process only first N words"
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

    # Set global CLI configuration
    CLI_TOOL = args.cli
    # Use droid default model if cli is droid and model not explicitly set
    if args.cli == "droid" and args.model == DEFAULT_MODEL:
        CLI_MODEL = DROID_DEFAULT_MODEL
    else:
        CLI_MODEL = args.model

    print("=" * 60)
    print(f"Step 6: Add Definitions ({VERSION_NAME})")
    print(f"CLI: {CLI_TOOL}, Model: {CLI_MODEL}")
    if args.test:
        print(f"TEST MODE: {args.test} words only")
    print("=" * 60)

    vocabulary = load_vocabulary()
    updated = add_definitions(vocabulary, limit=args.test)

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
