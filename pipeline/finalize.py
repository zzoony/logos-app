"""Step 4: Finalize vocabulary - apply final filters and add rankings."""

import json
from datetime import datetime

from config import (
    FILTERED_PROPER_NOUNS_PATH,
    FINAL_OUTPUT_PATH,
    MIN_WORD_LENGTH,
    MIN_FREQUENCY,
)


def load_filtered_words() -> dict:
    """Load words from previous step."""
    with open(FILTERED_PROPER_NOUNS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def apply_final_filters(words: list) -> list:
    """Apply final filters: min length, min frequency, etc."""
    filtered = []
    removed_short = 0
    removed_low_freq = 0
    removed_numeric = 0

    for item in words:
        word = item["word"]
        count = item["count"]

        # Skip words that are only numbers
        if word.isdigit():
            removed_numeric += 1
            continue

        # Skip short words
        if len(word) < MIN_WORD_LENGTH:
            removed_short += 1
            continue

        # Skip low frequency words
        if count < MIN_FREQUENCY:
            removed_low_freq += 1
            continue

        filtered.append(item)

    print(f"Removed {removed_numeric} numeric entries")
    print(f"Removed {removed_short} words shorter than {MIN_WORD_LENGTH} chars")
    print(f"Removed {removed_low_freq} words with frequency < {MIN_FREQUENCY}")
    print(f"Final word count: {len(filtered)}")

    return filtered


def add_rankings(words: list) -> list:
    """Add frequency rank to each word."""
    for rank, item in enumerate(words, start=1):
        item["rank"] = rank
    return words


def save_output(words: list) -> None:
    """Save final vocabulary to JSON."""
    output = {
        "metadata": {
            "source": "NIV Bible",
            "extraction_date": datetime.now().strftime("%Y-%m-%d"),
            "total_unique_words": len(words),
            "total_occurrences": sum(item["count"] for item in words),
            "filters_applied": [
                "stopwords",
                "proper_nouns",
                f"min_length_{MIN_WORD_LENGTH}",
                f"min_frequency_{MIN_FREQUENCY}",
            ],
        },
        "words": words,
    }

    with open(FINAL_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nSaved to {FINAL_OUTPUT_PATH}")


def main():
    print("=== Step 4: Finalize Vocabulary ===")

    data = load_filtered_words()
    words = data["words"]

    # Apply final filters
    filtered = apply_final_filters(words)

    # Add rankings
    ranked = add_rankings(filtered)

    # Save output
    save_output(ranked)

    # Show statistics
    print("\n=== Final Statistics ===")
    print(f"Total unique words: {len(ranked)}")
    print(f"Total occurrences: {sum(item['count'] for item in ranked)}")

    print("\nTop 30 Bible vocabulary words:")
    for item in ranked[:30]:
        print(f"  {item['rank']:3}. {item['word']}: {item['count']}")


if __name__ == "__main__":
    main()
