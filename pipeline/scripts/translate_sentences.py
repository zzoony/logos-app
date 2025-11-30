"""Step 8: Add Korean translations to sentences.

Requirements:
    - Claude CLI or droid CLI must be installed and available in PATH
      - Claude: https://docs.anthropic.com/en/docs/claude-cli
      - droid: use --cli droid option
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import concurrent.futures
from datetime import datetime
from pathlib import Path

from config import VERSION_OUTPUT_DIR, VERSION_NAME
from utils import log
from translation_utils import create_translation_prompt, extract_json_from_response

# Input/Output files
INPUT_PATH = VERSION_OUTPUT_DIR / "step5_sentences.json"
OUTPUT_PATH = VERSION_OUTPUT_DIR / "final_sentences_korean.json"

# Processing configuration
BATCH_SIZE = 30  # Sentences per Claude request (smaller than words due to longer text)
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


def load_sentences() -> dict:
    """Load sentences file."""
    log(f"Loading sentences from {INPUT_PATH}")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def process_batch(batch_info: tuple) -> tuple[int, dict, list]:
    """Process a batch of sentences with Claude CLI.

    Returns: (batch_index, results_dict, failed_ids)
    """
    batch_index, sentences = batch_info

    prompt = create_translation_prompt(sentences)

    try:
        result = subprocess.run(
            get_cli_command(),
            input=prompt,
            capture_output=True,
            text=True,
            timeout=CLI_TIMEOUT
        )

        if result.returncode != 0:
            log(f"Batch {batch_index} failed with return code {result.returncode}", "WARN")
            return (batch_index, {}, [s[0] for s in sentences])

        translations = extract_json_from_response(result.stdout)

        if not translations:
            log(f"Batch {batch_index} returned no valid JSON", "WARN")
            return (batch_index, {}, [s[0] for s in sentences])

        # Map translations back to sentence IDs
        results = {}
        failed = []
        for i, (sent_id, _, _) in enumerate(sentences):
            # Find matching translation by index
            trans = next((t for t in translations if t.get("id") == i + 1), None)
            if trans and trans.get("korean"):
                results[sent_id] = trans["korean"]
            else:
                failed.append(sent_id)

        return (batch_index, results, failed)

    except subprocess.TimeoutExpired:
        log(f"Batch {batch_index} timed out after {CLI_TIMEOUT}s", "WARN")
        return (batch_index, {}, [s[0] for s in sentences])
    except Exception:
        log(f"Batch {batch_index} failed with unexpected error", "WARN")
        return (batch_index, {}, [s[0] for s in sentences])


def translate_sentences(data: dict, limit: int | None = None) -> dict:
    """Add Korean translations to all sentences."""
    sentences_dict = data["sentences"]

    # Convert to list of (id, text, ref) tuples
    sentences_list = [
        (sent_id, sent_data["text"], sent_data["ref"])
        for sent_id, sent_data in sentences_dict.items()
    ]

    # Apply limit if specified
    if limit:
        sentences_list = sentences_list[:limit]
        log(f"Test mode: processing first {limit} sentences only")

    total_sentences = len(sentences_list)

    log(f"Total sentences to process: {total_sentences}")
    log(f"Batch size: {BATCH_SIZE}, Max workers: {MAX_WORKERS}")

    # Create batches
    batches = []
    for i in range(0, len(sentences_list), BATCH_SIZE):
        batch_sentences = sentences_list[i:i + BATCH_SIZE]
        batches.append((len(batches), batch_sentences))

    total_batches = len(batches)
    log(f"Created {total_batches} batches")

    # Process batches in parallel
    all_translations = {}
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
                all_translations.update(results)
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

    # Retry failed sentences if any
    if all_failed:
        log(f"Retrying {len(all_failed)} failed sentences...")

        # Rebuild failed sentences list
        failed_sentences = [
            (sent_id, sentences_dict[sent_id]["text"], sentences_dict[sent_id]["ref"])
            for sent_id in all_failed
            if sent_id in sentences_dict
        ]

        retry_batches = []
        for i in range(0, len(failed_sentences), BATCH_SIZE):
            batch_sentences = failed_sentences[i:i + BATCH_SIZE]
            retry_batches.append((len(retry_batches), batch_sentences))

        retry_failed = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = list(executor.map(process_batch, retry_batches))
            for _, results, failed in futures:
                all_translations.update(results)
                retry_failed.extend(failed)

        if retry_failed:
            log(f"Still failed after retry: {len(retry_failed)} sentences", "WARN")

    # Build set of processed sentence IDs for limit mode
    processed_ids = {s[0] for s in sentences_list} if limit else None

    # Merge translations into sentences
    log("Merging translations into sentences...")
    updated_sentences = {}
    success_count = 0

    for sent_id, sent_data in sentences_dict.items():
        if limit and sent_id not in processed_ids:
            continue

        if sent_id in all_translations:
            updated_sentences[sent_id] = {
                **sent_data,
                "korean": all_translations[sent_id]
            }
            success_count += 1
        else:
            updated_sentences[sent_id] = {
                **sent_data,
                "korean": ""
            }

    elapsed_total = time.time() - start_time
    log(f"Processing complete: {success_count}/{len(updated_sentences)} sentences ({success_count*100//max(len(updated_sentences), 1)}%)")
    log(f"Total time: {elapsed_total:.1f}s")

    return {
        "metadata": {
            **data["metadata"],
            "korean_translations_added": True,
            "translations_count": success_count,
            "processing_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "sentences": updated_sentences
    }


def save_output(data: dict, output_path: Path | None = None) -> None:
    """Save translated sentences to JSON."""
    path = output_path or OUTPUT_PATH
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    log(f"Saved to {path}")


def main():
    global CLI_TOOL, CLI_MODEL

    parser = argparse.ArgumentParser(description="Add Korean translations to sentences")
    parser.add_argument(
        "--test", "-t",
        type=int,
        metavar="N",
        help="Test mode: process only first N sentences"
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
    print(f"Step 8: Translate Sentences ({VERSION_NAME})")
    print(f"CLI: {CLI_TOOL}, Model: {CLI_MODEL}")
    if args.test:
        print(f"TEST MODE: {args.test} sentences only")
    print("=" * 60)

    data = load_sentences()
    updated = translate_sentences(data, limit=args.test)

    # Use different output file for test mode
    if args.test:
        output_path = VERSION_OUTPUT_DIR / "sentences_korean_test.json"
    else:
        output_path = OUTPUT_PATH

    save_output(updated, output_path)

    # Show sample results
    print("\n=== Sample Results ===")
    sample_count = 0
    for sent_id, sent_data in updated["sentences"].items():
        if sent_data.get("korean"):
            print(f"\n{sent_data['ref']}:")
            print(f"  EN: {sent_data['text']}")
            print(f"  KO: {sent_data['korean']}")
            sample_count += 1
            if sample_count >= 5:
                break


if __name__ == "__main__":
    main()
