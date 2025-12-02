#!/usr/bin/env python3
"""
Add Korean translations to Hebrew vocabulary.

Translates:
- definition_english → definition_korean
- pronunciation → korean_pronunciation

Requirements:
    - Z.AI API credentials in .env file (for --api mode)
    - Or droid/claude CLI installed
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import concurrent.futures
from datetime import datetime
from pathlib import Path

try:
    from zai import ZaiClient
    ZAI_SDK_AVAILABLE = True
except ImportError:
    ZAI_SDK_AVAILABLE = False

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "output" / "hebrew"
INPUT_PATH = OUTPUT_DIR / "vocabulary_hebrew.json"
OUTPUT_PATH = OUTPUT_DIR / "final_vocabulary_hebrew.json"
FAILED_WORDS_PATH = OUTPUT_DIR / "failed_words.json"

# Processing configuration
BATCH_SIZE = 30  # Words per request (smaller for Hebrew due to longer definitions)
MAX_WORKERS_API = 5
API_TIMEOUT = 300  # 5 minutes

# Load environment variables
def load_env():
    """Load environment variables from .env file."""
    env_path = PROJECT_DIR / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())

load_env()

# API Configuration
API_BASE = os.environ.get("ZAI_API_BASE", "https://api.z.ai/api/coding/paas/v4")
API_KEY = os.environ.get("ZAI_API_KEY", "")
API_MODEL = os.environ.get("ZAI_MODEL", "glm-4.6")

# Global SDK client
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


def load_vocabulary() -> dict:
    """Load Hebrew vocabulary."""
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


def create_prompt(words: list[dict]) -> str:
    """Create prompt for translating Hebrew words to Korean."""
    words_info = []
    for w in words:
        words_info.append({
            "strongs": w["strongs"],
            "word": w["word"],
            "pronunciation": w["pronunciation"],
            "definition": w["definition_english"]
        })

    words_json = json.dumps(words_info, ensure_ascii=False, indent=2)

    return f"""You are a Biblical Hebrew vocabulary translator. Translate the following Hebrew words to Korean.

For each word, provide:
1. korean_pronunciation: How to pronounce the Hebrew word in Korean (based on the English pronunciation guide)
2. definition_korean: Translate the English definition faithfully into Korean. Keep the full meaning, not just a summary.

Input words:
{words_json}

Respond in JSON array format ONLY (no explanation, no markdown):
[
  {{
    "strongs": "H123",
    "korean_pronunciation": "한글 발음",
    "definition_korean": "한국어 뜻"
  }}
]"""


def parse_response(response_text: str) -> list[dict]:
    """Parse JSON response from AI."""
    # Try to find JSON array in response
    text = response_text.strip()

    # Remove markdown code blocks if present
    if "```json" in text:
        match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1)
    elif "```" in text:
        match = re.search(r"```\s*([\s\S]*?)\s*```", text)
        if match:
            text = match.group(1)

    # Find JSON array
    start = text.find("[")
    end = text.rfind("]") + 1
    if start >= 0 and end > start:
        text = text[start:end]

    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        log(f"JSON parse error: {e}", "ERROR")
        return []


def process_batch_api(words: list[dict], batch_num: int, total_batches: int) -> list[dict]:
    """Process a batch of words using Z.AI API."""
    client = get_zai_client()
    if not client:
        log("Z.AI SDK not available", "ERROR")
        return []

    prompt = create_prompt(words)

    try:
        response = client.chat.completions.create(
            model=API_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            extra_body={"enable_thinking": False}
        )

        content = response.choices[0].message.content
        results = parse_response(content)

        if results:
            log(f"Batch {batch_num}/{total_batches}: {len(results)} words translated")
        else:
            log(f"Batch {batch_num}/{total_batches}: Failed to parse response", "WARN")

        return results

    except Exception as e:
        log(f"Batch {batch_num}/{total_batches} error: {e}", "ERROR")
        return []


def process_all_words(vocabulary: dict, retry_mode: bool = False, test_count: int = 0) -> dict:
    """Process all words and add Korean translations."""
    words = vocabulary.get("words", [])

    # Check for existing translations in retry mode
    if retry_mode:
        existing = load_existing_vocabulary()
        if existing:
            # Create lookup for existing translations
            existing_lookup = {}
            for w in existing.get("words", []):
                if w.get("definition_korean"):
                    existing_lookup[w["strongs"]] = w

            # Filter to only words without translations
            words_to_process = [w for w in words if w["strongs"] not in existing_lookup]
            log(f"Retry mode: {len(words_to_process)} words need translation")

            # Merge existing translations
            for w in words:
                if w["strongs"] in existing_lookup:
                    w["korean_pronunciation"] = existing_lookup[w["strongs"]].get("korean_pronunciation", "")
                    w["definition_korean"] = existing_lookup[w["strongs"]].get("definition_korean", "")
        else:
            words_to_process = words
    else:
        words_to_process = words

    # Test mode: limit words
    if test_count > 0:
        words_to_process = words_to_process[:test_count]
        log(f"Test mode: processing {test_count} words")

    if not words_to_process:
        log("No words to process")
        return vocabulary

    # Create batches
    batches = []
    for i in range(0, len(words_to_process), BATCH_SIZE):
        batches.append(words_to_process[i:i + BATCH_SIZE])

    log(f"Processing {len(words_to_process)} words in {len(batches)} batches")

    # Process batches in parallel
    all_results = []
    failed_strongs = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS_API) as executor:
        futures = {
            executor.submit(process_batch_api, batch, i + 1, len(batches)): batch
            for i, batch in enumerate(batches)
        }

        for future in concurrent.futures.as_completed(futures):
            batch = futures[future]
            try:
                results = future.result()
                if results:
                    all_results.extend(results)
                else:
                    # Mark batch as failed
                    for w in batch:
                        failed_strongs.append(w["strongs"])
            except Exception as e:
                log(f"Batch processing error: {e}", "ERROR")
                for w in batch:
                    failed_strongs.append(w["strongs"])

    # Create lookup for results
    results_lookup = {r["strongs"]: r for r in all_results}

    # Apply translations to vocabulary
    translated_count = 0
    for w in words:
        if w["strongs"] in results_lookup:
            r = results_lookup[w["strongs"]]
            w["korean_pronunciation"] = r.get("korean_pronunciation", "")
            w["definition_korean"] = r.get("definition_korean", "")
            translated_count += 1

    log(f"Applied {translated_count} translations")

    # Save failed words
    if failed_strongs:
        with open(FAILED_WORDS_PATH, "w", encoding="utf-8") as f:
            json.dump({"failed_strongs": failed_strongs, "count": len(failed_strongs)}, f, indent=2)
        log(f"Saved {len(failed_strongs)} failed words to {FAILED_WORDS_PATH}")

    # Update metadata
    vocabulary["metadata"]["korean_translations_added"] = True
    vocabulary["metadata"]["translations_count"] = translated_count
    vocabulary["metadata"]["processing_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return vocabulary


def save_vocabulary(vocabulary: dict) -> None:
    """Save final vocabulary."""
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(vocabulary, f, ensure_ascii=False, indent=2)
    log(f"Saved vocabulary to {OUTPUT_PATH}")


def main():
    parser = argparse.ArgumentParser(description="Add Korean translations to Hebrew vocabulary")
    parser.add_argument("--api", action="store_true", help="Use Z.AI API (default)")
    parser.add_argument("--retry", action="store_true", help="Only process words without translations")
    parser.add_argument("--test", type=int, default=0, help="Test with N words only")
    args = parser.parse_args()

    if not ZAI_SDK_AVAILABLE:
        log("Z.AI SDK not installed. Run: pip install zai-sdk", "ERROR")
        return

    if not API_KEY:
        log("ZAI_API_KEY not set in .env file", "ERROR")
        return

    log("=" * 60)
    log("Hebrew Vocabulary Korean Translation")
    log("=" * 60)

    vocabulary = load_vocabulary()
    log(f"Loaded {len(vocabulary.get('words', []))} words")

    vocabulary = process_all_words(vocabulary, retry_mode=args.retry, test_count=args.test)

    save_vocabulary(vocabulary)

    log("=" * 60)
    log("Complete!")
    log("=" * 60)


if __name__ == "__main__":
    main()
