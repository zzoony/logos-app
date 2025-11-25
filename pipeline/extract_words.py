"""Step 1: Extract words from NIV Bible JSON."""

import json
import re
from collections import Counter
from pathlib import Path

from config import BIBLE_JSON_PATH, RAW_WORDS_PATH, OUTPUT_DIR


def load_bible() -> dict:
    """Load NIV Bible JSON file."""
    with open(BIBLE_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def clean_text(text: str) -> str:
    """Clean text by removing punctuation and normalizing."""
    # Replace special unicode characters with ASCII equivalents
    text = text.replace("\u201c", '"').replace("\u201d", '"')  # " "
    text = text.replace("\u2018", "'").replace("\u2019", "'")  # ' '
    text = text.replace("\u2014", " ")  # em dash —
    text = text.replace("\u2013", " ")  # en dash –

    # Remove possessive 's and s' (king's -> king, peoples' -> peoples)
    text = re.sub(r"'s\b", "", text)
    text = re.sub(r"s'\b", "s", text)

    # Remove contractions (don't -> dont, I'll -> Ill, etc.)
    text = re.sub(r"'", "", text)

    # Remove punctuation
    text = re.sub(r"[^\w\s]", " ", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text)

    return text.lower().strip()


def extract_words(bible: dict) -> Counter:
    """Extract all words from Bible text."""
    word_counts = Counter()
    verse_count = 0

    for book, chapters in bible.items():
        for chapter_num, verses in chapters.items():
            for verse_num, text in verses.items():
                verse_count += 1
                cleaned = clean_text(text)
                words = cleaned.split()
                word_counts.update(words)

    print(f"Processed {verse_count} verses")
    print(f"Found {len(word_counts)} unique words")
    print(f"Total word occurrences: {sum(word_counts.values())}")

    return word_counts


def save_output(word_counts: Counter) -> None:
    """Save word counts to JSON."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    output = {
        "metadata": {
            "step": "raw_extraction",
            "total_unique_words": len(word_counts),
            "total_occurrences": sum(word_counts.values()),
        },
        "words": [
            {"word": word, "count": count}
            for word, count in word_counts.most_common()
        ],
    }

    with open(RAW_WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved to {RAW_WORDS_PATH}")


def main():
    print("=== Step 1: Extract Words ===")
    bible = load_bible()
    word_counts = extract_words(bible)
    save_output(word_counts)

    # Show top 20 words
    print("\nTop 20 words:")
    for word, count in word_counts.most_common(20):
        print(f"  {word}: {count}")


if __name__ == "__main__":
    main()
