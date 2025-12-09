"""Step 3: Filter proper nouns (names, places) from word list."""

import json
import re

from config import (
    BIBLE_JSON_PATH,
    FILTERED_STOPWORDS_PATH,
    FILTERED_PROPER_NOUNS_PATH,
    PROPER_NOUNS_PATH,
    PROTECTED_WORDS_PATH,
)


def load_protected_words() -> set:
    """Load protected words from version-specific file."""
    protected_words = set()

    if not PROTECTED_WORDS_PATH.exists():
        print(f"Warning: Protected words file not found: {PROTECTED_WORDS_PATH}")
        return protected_words

    with open(PROTECTED_WORDS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith("#"):
                protected_words.add(line.lower())

    print(f"Loaded {len(protected_words)} protected words from {PROTECTED_WORDS_PATH}")
    return protected_words


def load_filtered_words() -> dict:
    """Load words from previous step."""
    with open(FILTERED_STOPWORDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_bible() -> dict:
    """Load original Bible for capitalization analysis."""
    with open(BIBLE_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_proper_nouns_list() -> set:
    """Load known proper nouns from file."""
    proper_nouns = set()

    if not PROPER_NOUNS_PATH.exists():
        print(f"Warning: Proper nouns file not found: {PROPER_NOUNS_PATH}")
        return proper_nouns

    with open(PROPER_NOUNS_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if line and not line.startswith("#"):
                proper_nouns.add(line.lower())

    return proper_nouns


def find_proper_nouns_in_bible(bible: dict) -> set:
    """Find words that appear capitalized mid-sentence."""
    proper_noun_candidates = set()

    for book, chapters in bible.items():
        for chapter_num, verses in chapters.items():
            for verse_num, text in verses.items():
                # Split into sentences (roughly)
                sentences = re.split(r"[.!?]", text)

                for sentence in sentences:
                    words = sentence.split()
                    # Skip first word of sentence (always capitalized)
                    for word in words[1:]:
                        # Clean the word
                        clean_word = re.sub(r"[^\w']", "", word)
                        if clean_word and clean_word[0].isupper():
                            proper_noun_candidates.add(clean_word.lower())

    return proper_noun_candidates


def filter_proper_nouns(data: dict, proper_nouns: set) -> list:
    """Filter out proper nouns from word list."""
    filtered = []
    removed = []

    for item in data["words"]:
        word = item["word"]
        if word not in proper_nouns:
            filtered.append(item)
        else:
            removed.append(word)

    print(f"Removed {len(removed)} proper nouns")
    print(f"Remaining words: {len(filtered)}")

    if removed[:20]:
        print(f"\nSample removed proper nouns: {removed[:20]}")

    return filtered


def save_output(filtered_words: list, original_metadata: dict) -> None:
    """Save filtered words to JSON."""
    # Recalculate total_occurrences from actual word counts
    total_occurrences = sum(item["count"] for item in filtered_words)

    output = {
        "metadata": {
            **original_metadata,
            "step": "filtered_proper_nouns",
            "proper_nouns_removed": original_metadata["total_unique_words"] - len(filtered_words),
            "total_unique_words": len(filtered_words),
            "total_occurrences": total_occurrences,
        },
        "words": filtered_words,
    }

    with open(FILTERED_PROPER_NOUNS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Saved to {FILTERED_PROPER_NOUNS_PATH}")


def main():
    print("=== Step 3: Filter Proper Nouns ===")

    # Load protected words from file
    protected_words = load_protected_words()

    # Load data
    data = load_filtered_words()

    # Build proper nouns set
    print("Analyzing Bible for proper nouns...")
    bible = load_bible()
    detected_proper_nouns = find_proper_nouns_in_bible(bible)
    print(f"Detected {len(detected_proper_nouns)} potential proper nouns from capitalization")

    known_proper_nouns = load_proper_nouns_list()
    print(f"Loaded {len(known_proper_nouns)} known proper nouns from list")

    # Combine both sets, but exclude protected words
    all_proper_nouns = (detected_proper_nouns | known_proper_nouns) - protected_words
    print(f"Protected words kept: {len(protected_words)}")
    print(f"Total proper nouns to filter: {len(all_proper_nouns)}")

    # Filter
    filtered = filter_proper_nouns(data, all_proper_nouns)
    save_output(filtered, data["metadata"])

    # Show top 20 remaining words
    print("\nTop 20 words after proper noun removal:")
    for item in filtered[:20]:
        print(f"  {item['word']}: {item['count']}")


if __name__ == "__main__":
    main()
