"""Step 1: Extract words from Bible JSON.

Extracts and lemmatizes words from Bible text, counting frequencies.
"""

from __future__ import annotations

import json
import re
from collections import Counter

from nltk.stem import WordNetLemmatizer

from config import BIBLE_JSON_PATH, RAW_WORDS_PATH, VERSION_OUTPUT_DIR
from word_forms import get_base_form

lemmatizer = WordNetLemmatizer()


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


def is_numeric_word(word: str) -> bool:
    """Check if word is a number, ordinal, or fraction (should be excluded)."""
    import re
    # Pure numbers
    if word.isdigit():
        return True
    # Ordinals: 1st, 2nd, 3rd, 4th, 14th, etc.
    if re.match(r'^\d+(st|nd|rd|th)$', word):
        return True
    # Fractions with special characters: 12½, 2½, etc.
    if re.search(r'\d+[½¼¾⅓⅔⅛⅜⅝⅞]', word):
        return True
    # Roman numerals (common ones)
    if re.match(r'^[ivxlcdm]+$', word) and len(word) <= 4:
        # Check if it's actually a roman numeral pattern
        if re.match(r'^(i{1,3}|iv|v|vi{0,3}|ix|x{1,3}|xl|l|lx{0,3}|xc|c{1,3}|cd|d|dc{0,3}|cm|m{1,3})$', word):
            return True
    return False


def lemmatize_word(word: str) -> str:
    """Convert word to its base form (lemma).

    Uses irregular verb lookup first, then WordNet lemmatizer.
    """
    # Check irregular verbs first (from word_forms module)
    base = get_base_form(word)
    if base:
        return base

    # Get both noun and verb lemmas from WordNet
    noun_lemma = lemmatizer.lemmatize(word, pos='n')
    verb_lemma = lemmatizer.lemmatize(word, pos='v')

    # Prefer verb lemma for irregular verbs (was->be, has->have)
    if verb_lemma != word and len(verb_lemma) > 1:
        if noun_lemma == word or len(noun_lemma) <= 2:
            return verb_lemma

    # Otherwise prefer noun lemma for plurals (sons->son)
    if noun_lemma != word:
        return noun_lemma

    return verb_lemma


def extract_words(bible: dict) -> Counter:
    """Extract all words from Bible text."""
    word_counts = Counter()
    verse_count = 0
    numeric_words_skipped = 0

    for book, chapters in bible.items():
        for chapter_num, verses in chapters.items():
            for verse_num, text in verses.items():
                verse_count += 1
                cleaned = clean_text(text)
                words = cleaned.split()
                # Filter and lemmatize each word before counting
                for w in words:
                    # Skip numeric words (ordinals, fractions, etc.)
                    if is_numeric_word(w):
                        numeric_words_skipped += 1
                        continue
                    lemmatized = lemmatize_word(w)
                    word_counts[lemmatized] += 1

    print(f"Processed {verse_count} verses")
    print(f"Found {len(word_counts)} unique words")
    print(f"Total word occurrences: {sum(word_counts.values())}")
    print(f"Numeric words skipped: {numeric_words_skipped}")

    return word_counts


def save_output(word_counts: Counter) -> None:
    """Save word counts to JSON."""
    VERSION_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
