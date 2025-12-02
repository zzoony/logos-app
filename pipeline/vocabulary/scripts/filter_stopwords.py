"""Step 2: Filter stopwords from extracted words."""

import json

from config import RAW_WORDS_PATH, FILTERED_STOPWORDS_PATH, STOPWORDS_PATH


def load_stopwords() -> set:
    """Load stopwords from version-specific file."""
    stopwords = set()

    if not STOPWORDS_PATH.exists():
        print(f"Warning: Stopwords file not found: {STOPWORDS_PATH}")
        return stopwords

    with open(STOPWORDS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith("#"):
                stopwords.add(line.lower())

    print(f"Loaded {len(stopwords)} stopwords from {STOPWORDS_PATH}")
    return stopwords


def load_raw_words() -> dict:
    """Load raw words from previous step."""
    with open(RAW_WORDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def filter_stopwords(data: dict, stopwords: set) -> list:
    """Filter out stopwords from word list."""
    filtered = []
    removed_count = 0

    for item in data["words"]:
        word = item["word"]
        if word not in stopwords:
            filtered.append(item)
        else:
            removed_count += 1

    print(f"Removed {removed_count} stopwords")
    print(f"Remaining words: {len(filtered)}")

    return filtered


def save_output(filtered_words: list, original_metadata: dict) -> None:
    """Save filtered words to JSON."""
    output = {
        "metadata": {
            **original_metadata,
            "step": "filtered_stopwords",
            "stopwords_removed": original_metadata["total_unique_words"] - len(filtered_words),
            "total_unique_words": len(filtered_words),
        },
        "words": filtered_words,
    }

    with open(FILTERED_STOPWORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved to {FILTERED_STOPWORDS_PATH}")


def main():
    print("=== Step 2: Filter Stopwords ===")
    stopwords = load_stopwords()
    data = load_raw_words()
    filtered = filter_stopwords(data, stopwords)
    save_output(filtered, data["metadata"])

    # Show top 20 remaining words
    print("\nTop 20 words after stopword removal:")
    for item in filtered[:20]:
        print(f"  {item['word']}: {item['count']}")


if __name__ == "__main__":
    main()
