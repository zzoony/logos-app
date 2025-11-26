"""Retry missing translations in sentences_korean.json."""

from __future__ import annotations

import json
import subprocess
import time
import concurrent.futures
from datetime import datetime
from pathlib import Path

from config import VERSION_OUTPUT_DIR
from utils import log
from translation_utils import create_translation_prompt, extract_json_from_response

# Input/Output files
INPUT_PATH = VERSION_OUTPUT_DIR / "final_sentences_korean.json"

# Processing configuration
BATCH_SIZE = 20  # Smaller batch for better success rate
MAX_WORKERS = 5  # Fewer workers to reduce timeouts
CLAUDE_MODEL = "haiku"
CLAUDE_TIMEOUT = 180  # Longer timeout


def process_batch(batch_info: tuple) -> tuple[int, dict, list]:
    """Process a batch of sentences with Claude CLI."""
    batch_index, sentences = batch_info

    prompt = create_translation_prompt(sentences)

    try:
        result = subprocess.run(
            ["claude", "--model", CLAUDE_MODEL, "--print"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=CLAUDE_TIMEOUT
        )

        if result.returncode != 0:
            return (batch_index, {}, [s[0] for s in sentences])

        translations = extract_json_from_response(result.stdout)

        if not translations:
            return (batch_index, {}, [s[0] for s in sentences])

        results = {}
        failed = []
        for i, (sent_id, _, _) in enumerate(sentences):
            trans = next((t for t in translations if t.get("id") == i + 1), None)
            if trans and trans.get("korean"):
                results[sent_id] = trans["korean"]
            else:
                failed.append(sent_id)

        return (batch_index, results, failed)

    except subprocess.TimeoutExpired:
        log(f"Batch {batch_index} timed out", "WARN")
        return (batch_index, {}, [s[0] for s in sentences])
    except Exception:
        log(f"Batch {batch_index} failed", "WARN")
        return (batch_index, {}, [s[0] for s in sentences])


def main():
    print("=" * 60)
    print("Retry Missing Translations")
    print("=" * 60)

    # Load current data
    log(f"Loading from {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Find missing translations
    missing_ids = [sid for sid, s in data['sentences'].items() if not s.get('korean')]
    log(f"Found {len(missing_ids)} missing translations")

    if not missing_ids:
        log("No missing translations!")
        return

    # Build sentences list
    sentences_list = [
        (sid, data['sentences'][sid]['text'], data['sentences'][sid]['ref'])
        for sid in missing_ids
    ]

    # Create batches
    batches = []
    for i in range(0, len(sentences_list), BATCH_SIZE):
        batch = sentences_list[i:i + BATCH_SIZE]
        batches.append((len(batches), batch))

    total_batches = len(batches)
    log(f"Created {total_batches} batches (size: {BATCH_SIZE})")

    # Process with retries
    max_retries = 3
    all_translations = {}

    for retry_round in range(max_retries):
        if not batches:
            break

        log(f"Round {retry_round + 1}/{max_retries}: Processing {len(batches)} batches...")
        print("-" * 60)

        completed = 0
        start_time = time.time()
        round_translations = {}
        failed_ids = []

        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_batch, batch): batch[0] for batch in batches}

            for future in concurrent.futures.as_completed(futures):
                try:
                    idx, results, failed = future.result()
                    round_translations.update(results)
                    failed_ids.extend(failed)

                    completed += 1
                    log(f"Batch {idx + 1}/{len(batches)}: {len(results)} ok, {len(failed)} fail | Progress: {completed}/{len(batches)}")

                except Exception as e:
                    log(f"Error: {e}", "ERROR")

        all_translations.update(round_translations)

        # Prepare failed batches for next round
        if failed_ids:
            log(f"Round {retry_round + 1} complete: {len(round_translations)} translated, {len(failed_ids)} failed")
            sentences_list = [
                (sid, data['sentences'][sid]['text'], data['sentences'][sid]['ref'])
                for sid in failed_ids
            ]
            batches = []
            for i in range(0, len(sentences_list), BATCH_SIZE):
                batch = sentences_list[i:i + BATCH_SIZE]
                batches.append((len(batches), batch))
        else:
            log(f"Round {retry_round + 1} complete: All translated!")
            batches = []

        print("-" * 60)
        time.sleep(2)  # Brief pause between rounds

    # Update data
    log("Updating translations...")
    updated_count = 0
    for sid, korean in all_translations.items():
        if sid in data['sentences']:
            data['sentences'][sid]['korean'] = korean
            updated_count += 1

    # Count final stats
    total = len(data['sentences'])
    with_korean = sum(1 for s in data['sentences'].values() if s.get('korean'))

    log(f"Updated {updated_count} translations")
    log(f"Final: {with_korean}/{total} ({with_korean*100/total:.1f}%)")

    # Save
    data['metadata']['translations_count'] = with_korean
    data['metadata']['processing_date'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(INPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    log(f"Saved to {INPUT_PATH}")

    # Show remaining missing
    still_missing = [sid for sid, s in data['sentences'].items() if not s.get('korean')]
    if still_missing:
        log(f"Still missing: {len(still_missing)}", "WARN")
        print("Missing IDs:", still_missing[:20])


if __name__ == "__main__":
    main()
