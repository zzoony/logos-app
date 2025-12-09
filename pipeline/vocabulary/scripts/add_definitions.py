"""Step 6: Add pronunciation and Korean definitions to vocabulary.

Uses LLM (droid CLI, claude CLI, or Z.AI API) to generate definitions.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import time
from datetime import datetime
from pathlib import Path

import llm_client
from config import VERSION_OUTPUT_DIR, VERSION_NAME, FINAL_VOCABULARY_PATH
from utils import log, load_json, save_json

# Processing configuration
BATCH_SIZE = 50
MAX_WORKERS_CLI = 40
MAX_WORKERS_API = 5

# File paths
INPUT_PATH = VERSION_OUTPUT_DIR / "step5_vocabulary_with_sentences.json"
OUTPUT_PATH = FINAL_VOCABULARY_PATH
FAILED_WORDS_PATH = VERSION_OUTPUT_DIR / "failed_words.json"


def load_vocabulary() -> dict:
    """Load vocabulary with sentences."""
    log(f"Loading vocabulary from {INPUT_PATH}")
    return load_json(INPUT_PATH)


def load_existing_vocabulary() -> dict | None:
    """Load existing final vocabulary if exists."""
    if OUTPUT_PATH.exists():
        return load_json(OUTPUT_PATH)
    return None


def get_missing_definitions(vocabulary: dict) -> list[str]:
    """Get words that are missing definitions."""
    return [
        w["word"] for w in vocabulary.get("words", [])
        if not w.get("definition_korean")
    ]


def save_failed_words(words: list[str]) -> None:
    """Save failed words to file for later retry."""
    save_json(FAILED_WORDS_PATH, {"failed_words": words, "count": len(words)})
    log(f"Saved {len(words)} failed words to {FAILED_WORDS_PATH}")


def process_batch(batch_info: tuple[int, list[str]]) -> tuple[int, list, list]:
    """Process a batch of words.

    Returns: (batch_index, results, failed_words)
    """
    batch_index, words = batch_info
    definitions = llm_client.generate_definitions(words)

    if not definitions:
        return (batch_index, [], words)

    # Match results to original words
    def_dict = {d["word"]: d for d in definitions}
    results = []
    failed = []

    for word in words:
        if word in def_dict:
            results.append(def_dict[word])
        else:
            failed.append(word)

    return (batch_index, results, failed)


def add_definitions(
    vocabulary: dict,
    limit: int | None = None,
    retry_missing: bool = False,
    use_api: bool = False
) -> dict:
    """Add definitions to all vocabulary words."""
    words_data = vocabulary["words"]

    # Retry mode: only process words missing definitions
    if retry_missing:
        existing = load_existing_vocabulary()
        if existing:
            missing_words = set(get_missing_definitions(existing))
            log(f"Retry mode: {len(missing_words)} words missing definitions")
            words_data = [w for w in words_data if w["word"] in missing_words]

    # Apply limit
    if limit:
        words_data = words_data[:limit]
        log(f"Test mode: processing first {limit} words only")

    total_words = len(words_data)
    if total_words == 0:
        log("No words to process!")
        return vocabulary

    max_workers = MAX_WORKERS_API if use_api else MAX_WORKERS_CLI
    log(f"Total words: {total_words}, Batch size: {BATCH_SIZE}, Workers: {max_workers}")

    # Create batches
    word_list = [w["word"] for w in words_data]
    batches = [
        (i, word_list[j:j + BATCH_SIZE])
        for i, j in enumerate(range(0, len(word_list), BATCH_SIZE))
    ]

    # Process batches in parallel
    all_definitions = {}
    all_failed = []
    completed = 0
    start_time = time.time()

    log("Starting parallel processing...")
    print("-" * 60)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_batch, batch): batch[0] for batch in batches}

        for future in concurrent.futures.as_completed(futures):
            try:
                idx, results, failed = future.result()

                for r in results:
                    all_definitions[r["word"]] = r
                all_failed.extend(failed)

                completed += 1
                elapsed = time.time() - start_time
                remaining = (len(batches) - completed) * (elapsed / completed)

                log(
                    f"Batch {idx + 1}/{len(batches)}: "
                    f"{len(results)} ok, {len(failed)} fail | "
                    f"Progress: {completed}/{len(batches)} ({completed*100//len(batches)}%) | "
                    f"ETA: {remaining:.0f}s"
                )
            except Exception as e:
                log(f"Batch error: {e}", "ERROR")

    print("-" * 60)

    # Retry failed words
    if all_failed:
        log(f"Retrying {len(all_failed)} failed words...")
        retry_batches = [
            (i, all_failed[j:j + BATCH_SIZE])
            for i, j in enumerate(range(0, len(all_failed), BATCH_SIZE))
        ]

        retry_failed = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            for _, results, failed in executor.map(process_batch, retry_batches):
                for r in results:
                    all_definitions[r["word"]] = r
                retry_failed.extend(failed)

        if retry_failed:
            log(f"Still failed: {len(retry_failed)} words", "WARN")
            save_failed_words(retry_failed)

    # Merge definitions
    log("Merging definitions into vocabulary...")

    if retry_missing:
        existing = load_existing_vocabulary()
        if existing:
            existing_defs = {w["word"]: w for w in existing["words"]}
            for word, defn in all_definitions.items():
                if word in existing_defs:
                    existing_defs[word].update({
                        "ipa_pronunciation": defn.get("ipa_pronunciation", ""),
                        "korean_pronunciation": defn.get("korean_pronunciation", ""),
                        "definition_korean": defn.get("definition_korean", "")
                    })
            success_count = sum(1 for w in existing_defs.values() if w.get("definition_korean"))
            return {
                "metadata": {
                    **existing["metadata"],
                    "definitions_count": success_count,
                    "processing_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                },
                "words": list(existing_defs.values())
            }

    # Normal mode
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
    log(f"Complete: {success_count}/{total_words} ({success_count*100//total_words}%)")
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
    """Save final vocabulary with unique IDs."""
    path = output_path or OUTPUT_PATH

    # Add unique ID to each word
    for idx, word_data in enumerate(vocabulary.get("words", [])):
        word_data["id"] = idx

    vocabulary["metadata"]["has_id"] = True
    save_json(path, vocabulary)
    log(f"Saved to {path} ({len(vocabulary.get('words', []))} words)")


def main():
    parser = argparse.ArgumentParser(description="Add definitions to vocabulary")
    parser.add_argument("--test", "-t", type=int, metavar="N",
                        help="Test mode: process only first N words")
    parser.add_argument("--retry", action="store_true",
                        help="Retry only words missing definitions")
    parser.add_argument("--api", action="store_true",
                        help="Use Z.AI API instead of CLI")
    parser.add_argument("--cli", type=str, choices=["claude", "droid"],
                        help="CLI tool to use (default: droid)")
    parser.add_argument("--model", type=str, default="glm-4.6",
                        help="Model to use")
    args = parser.parse_args()

    # Configure LLM client
    use_api = args.api
    cli_tool = args.cli or "droid"
    model = args.model
    if args.cli == "claude" and model == "glm-4.6":
        model = "haiku"

    llm_client.configure(use_api=use_api, cli_tool=cli_tool, model=model)

    print("=" * 60)
    print(f"Step 6: Add Definitions ({VERSION_NAME})")
    print(f"Mode: {'API' if use_api else f'CLI ({cli_tool})'}")
    print(f"Model: {model}")
    if args.retry:
        print("RETRY MODE: Processing only missing definitions")
    if args.test:
        print(f"TEST MODE: {args.test} words only")
    print("=" * 60)

    vocabulary = load_vocabulary()
    updated = add_definitions(vocabulary, limit=args.test, retry_missing=args.retry, use_api=use_api)

    output_path = VERSION_OUTPUT_DIR / "bible_vocabulary_final_test.json" if args.test else OUTPUT_PATH
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
