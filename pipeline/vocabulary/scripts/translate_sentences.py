"""Step 8: Add Korean translations to sentences.

Maps English sentences to Korean Bible verses from Korean_Bible.json.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from config import VERSION_OUTPUT_DIR, VERSION_NAME, SOURCE_DATA_DIR, FINAL_SENTENCES_PATH
from utils import log

# Input/Output files
INPUT_PATH = VERSION_OUTPUT_DIR / "step5_sentences.json"
OUTPUT_PATH = FINAL_SENTENCES_PATH  # Uses version-tagged filename from config
KOREAN_BIBLE_PATH = SOURCE_DATA_DIR / "Korean_Bible.json"


def load_sentences() -> dict:
    """Load sentences file."""
    log(f"Loading sentences from {INPUT_PATH}")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_korean_bible() -> dict:
    """Load Korean Bible file."""
    log(f"Loading Korean Bible from {KOREAN_BIBLE_PATH}")
    if not KOREAN_BIBLE_PATH.exists():
        raise FileNotFoundError(f"Korean Bible not found: {KOREAN_BIBLE_PATH}")
    with open(KOREAN_BIBLE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_reference(ref: str) -> tuple[str, str, str] | None:
    """Parse reference string to (book, chapter, verse).

    Examples:
        'Psalms 18:1' -> ('Psalms', '18', '1')
        '1 Samuel 1:1' -> ('1 Samuel', '1', '1')
    """
    try:
        # Find the last space before chapter:verse
        # e.g., "1 Samuel 1:1" -> book="1 Samuel", rest="1:1"
        last_space = ref.rfind(' ')
        if last_space == -1:
            return None

        book = ref[:last_space]
        chapter_verse = ref[last_space + 1:]

        if ':' not in chapter_verse:
            return None

        chapter, verse = chapter_verse.split(':')
        return (book, chapter, verse)
    except Exception:
        return None


def normalize_book_name(book: str) -> str:
    """Normalize book name to match Korean Bible keys."""
    # ESV uses singular, Korean Bible uses plural for some books
    book_mapping = {
        "Psalm": "Psalms",
        "Song of Solomon": "Song of Songs",
    }
    return book_mapping.get(book, book)


def map_sentences_to_korean(data: dict, korean_bible: dict, limit: int | None = None) -> dict:
    """Map English sentences to Korean Bible verses."""
    sentences_dict = data["sentences"]

    # Apply limit if specified
    if limit:
        sentences_list = list(sentences_dict.items())[:limit]
        sentences_dict = dict(sentences_list)
        log(f"Test mode: processing first {limit} sentences only")

    total_sentences = len(sentences_dict)
    log(f"Total sentences to process: {total_sentences}")

    start_time = time.time()

    updated_sentences = {}
    success_count = 0
    not_found = []

    for sent_id, sent_data in sentences_dict.items():
        ref = sent_data.get("ref", "")
        parsed = parse_reference(ref)

        korean_text = ""
        chapter_num = None
        verse_num = None

        if parsed:
            book, chapter, verse = parsed
            book = normalize_book_name(book)  # Normalize book name
            chapter_num = int(chapter)
            verse_num = int(verse)
            # Look up in Korean Bible
            if book in korean_bible:
                if chapter in korean_bible[book]:
                    if verse in korean_bible[book][chapter]:
                        korean_text = korean_bible[book][chapter][verse]
                        success_count += 1

        if not korean_text:
            not_found.append(ref)

        updated_sentences[sent_id] = {
            **sent_data,
            "chapter": chapter_num or sent_data.get("chapter"),
            "verse": verse_num or sent_data.get("verse"),
            "korean": korean_text
        }

    elapsed = time.time() - start_time
    log(f"Processing complete: {success_count}/{total_sentences} sentences ({success_count*100//max(total_sentences, 1)}%)")
    log(f"Total time: {elapsed:.1f}s")

    if not_found and len(not_found) <= 10:
        log(f"Not found: {not_found}", "WARN")
    elif not_found:
        log(f"Not found: {len(not_found)} sentences", "WARN")

    return {
        "metadata": {
            **data["metadata"],
            "korean_translations_added": True,
            "translations_count": success_count,
            "translation_source": "Korean_Bible.json",
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
    parser = argparse.ArgumentParser(description="Add Korean translations to sentences")
    parser.add_argument(
        "--test", "-t",
        type=int,
        metavar="N",
        help="Test mode: process only first N sentences"
    )
    args = parser.parse_args()

    print("=" * 60)
    print(f"Step 8: Map Korean Sentences ({VERSION_NAME})")
    print(f"Source: {KOREAN_BIBLE_PATH.name}")
    if args.test:
        print(f"TEST MODE: {args.test} sentences only")
    print("=" * 60)

    data = load_sentences()
    korean_bible = load_korean_bible()
    updated = map_sentences_to_korean(data, korean_bible, limit=args.test)

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
