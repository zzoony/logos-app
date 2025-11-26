"""Step 5: Extract example sentences for each word."""

import json
import re
from collections import defaultdict

from config import (
    BIBLE_JSON_PATH,
    FINAL_OUTPUT_PATH,
    OUTPUT_DIR,
)

# Output files
SENTENCES_PATH = OUTPUT_DIR / "sentences.json"
VOCABULARY_WITH_SENTENCES_PATH = OUTPUT_DIR / "bible_vocabulary_with_sentences.json"

# Configuration
MIN_SENTENCES_PER_WORD = 2
MAX_SENTENCES_PER_WORD = 5
MAX_SENTENCE_LENGTH = 200  # Skip very long verses
MIN_SENTENCE_LENGTH = 30   # Skip very short verses


def load_bible() -> dict:
    """Load NIV Bible JSON file."""
    try:
        with open(BIBLE_JSON_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Bible file not found: {BIBLE_JSON_PATH}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in Bible file: {e}")


def load_vocabulary() -> dict:
    """Load processed vocabulary."""
    try:
        with open(FINAL_OUTPUT_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Vocabulary file not found: {FINAL_OUTPUT_PATH}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in vocabulary file: {e}")


def generate_sentence_id(book: str, chapter: str, verse: str) -> str:
    """Generate a unique sentence ID."""
    book_short = book.lower().replace(" ", "-")
    return f"{book_short}-{chapter}-{verse}"


def get_word_variants(word: str) -> set:
    """Generate common word variants (plurals, verb forms, etc.).

    Uses improved English morphology rules to avoid invalid forms.
    """
    variants = {word}

    # Skip very short words
    if len(word) < 2:
        return variants

    # Plural forms (improved rules)
    if not word.endswith("s"):
        if word.endswith(("s", "x", "z", "ch", "sh")):
            variants.add(word + "es")
        elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
            variants.add(word[:-1] + "ies")
        else:
            variants.add(word + "s")

    # Past tense (-ed) forms
    if not word.endswith("ed"):
        if word.endswith("e"):
            variants.add(word + "d")
        elif word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
            variants.add(word[:-1] + "ied")
        else:
            variants.add(word + "ed")

    # Progressive (-ing) forms
    if not word.endswith("ing"):
        if word.endswith("e") and not word.endswith("ee"):
            variants.add(word[:-1] + "ing")
        elif word.endswith("ie"):
            variants.add(word[:-2] + "ying")
        else:
            variants.add(word + "ing")

    return variants


def extract_words_from_text(text: str) -> set:
    """Extract all words from text."""
    # Remove punctuation and split
    words = re.findall(r"\b[a-zA-Z]+\b", text.lower())
    return set(words)


def build_inverted_index(bible: dict, vocabulary_words: set) -> tuple[dict, dict]:
    """Build inverted index: word -> list of sentence_ids.

    Also builds all_sentences dict with sentence metadata.
    Much faster than searching each sentence for each word.
    """
    print("Building inverted index...")

    # Get all word variants we need to search for
    all_variants = {}  # variant -> original word
    for word in vocabulary_words:
        for variant in get_word_variants(word):
            if variant not in all_variants:
                all_variants[variant] = word
            # If variant maps to itself, prefer that
            if variant == word:
                all_variants[variant] = word

    print(f"  Vocabulary words: {len(vocabulary_words)}")
    print(f"  Total variants to search: {len(all_variants)}")

    # word -> [(sentence_id, length, book), ...]
    word_to_sentences = defaultdict(list)
    all_sentences = {}

    for book, chapters in bible.items():
        for chapter_num, verses in chapters.items():
            for verse_num, text in verses.items():
                length = len(text)

                # Skip very long or short sentences
                if length > MAX_SENTENCE_LENGTH or length < MIN_SENTENCE_LENGTH:
                    continue

                sentence_id = generate_sentence_id(book, chapter_num, verse_num)

                # Store sentence data
                all_sentences[sentence_id] = {
                    "text": text,
                    "ref": f"{book} {chapter_num}:{verse_num}",
                    "book": book,
                    "length": length,
                }

                # Extract words from this sentence
                sentence_words = extract_words_from_text(text)

                # Check which vocabulary words appear in this sentence
                for sent_word in sentence_words:
                    if sent_word in all_variants:
                        original_word = all_variants[sent_word]
                        word_to_sentences[original_word].append({
                            "id": sentence_id,
                            "length": length,
                            "book": book,
                        })

    print(f"  Sentences indexed: {len(all_sentences)}")
    print(f"  Words with matches: {len(word_to_sentences)}")

    return word_to_sentences, all_sentences


def select_sentences_for_word(candidates: list, used_sentences: set) -> list:
    """Select best sentences from candidates."""
    if not candidates:
        return []

    # Sort by: prefer unused, then shorter sentences
    candidates.sort(key=lambda x: (x["id"] in used_sentences, x["length"]))

    # Select diverse sentences (try to pick from different books)
    selected = []
    selected_books = set()

    # First pass: pick from different books
    for candidate in candidates:
        if len(selected) >= MAX_SENTENCES_PER_WORD:
            break
        if candidate["book"] not in selected_books:
            selected.append(candidate["id"])
            selected_books.add(candidate["book"])

    # Second pass: fill remaining slots
    for candidate in candidates:
        if len(selected) >= MAX_SENTENCES_PER_WORD:
            break
        if candidate["id"] not in selected:
            selected.append(candidate["id"])

    return selected


def extract_sentences(vocabulary: dict, bible: dict) -> tuple[dict, dict]:
    """Extract sentences for all vocabulary words."""
    words = vocabulary["words"]
    vocabulary_words = {w["word"] for w in words}

    # Build inverted index (this is the fast part)
    word_to_sentences, all_sentences = build_inverted_index(bible, vocabulary_words)

    print(f"\nSelecting sentences for {len(words)} words...")

    # Track which sentences are used
    used_sentences = set()
    output_sentences = {}
    updated_words = []

    words_with_sentences = 0
    words_without_sentences = 0

    for i, word_data in enumerate(words):
        word = word_data["word"]
        candidates = word_to_sentences.get(word, [])

        # Select best sentences
        sentence_ids = select_sentences_for_word(candidates, used_sentences)

        if len(sentence_ids) >= MIN_SENTENCES_PER_WORD:
            words_with_sentences += 1

            # Add sentences to output
            for sid in sentence_ids:
                if sid not in output_sentences:
                    output_sentences[sid] = {
                        "text": all_sentences[sid]["text"],
                        "ref": all_sentences[sid]["ref"],
                        "book": all_sentences[sid]["book"],
                    }
                used_sentences.add(sid)

            updated_word = {**word_data, "sentence_ids": sentence_ids}
        else:
            words_without_sentences += 1
            updated_word = {**word_data, "sentence_ids": []}

        updated_words.append(updated_word)

        if (i + 1) % 1000 == 0:
            print(f"  Processed {i + 1}/{len(words)} words...")

    print(f"\nWords with sentences: {words_with_sentences}")
    print(f"Words without enough sentences: {words_without_sentences}")
    print(f"Total unique sentences used: {len(output_sentences)}")

    updated_vocabulary = {
        "metadata": {
            **vocabulary["metadata"],
            "sentences_extracted": True,
            "total_sentences": len(output_sentences),
        },
        "words": updated_words,
    }

    return output_sentences, updated_vocabulary


def save_outputs(sentences: dict, vocabulary: dict) -> None:
    """Save sentences and updated vocabulary to JSON files."""
    sentences_output = {
        "metadata": {
            "total_sentences": len(sentences),
            "source": "NIV Bible",
        },
        "sentences": sentences,
    }

    with open(SENTENCES_PATH, "w", encoding="utf-8") as f:
        json.dump(sentences_output, f, indent=2, ensure_ascii=False)
    print(f"\nSaved sentences to {SENTENCES_PATH}")

    with open(VOCABULARY_WITH_SENTENCES_PATH, "w", encoding="utf-8") as f:
        json.dump(vocabulary, f, indent=2, ensure_ascii=False)
    print(f"Saved vocabulary with sentences to {VOCABULARY_WITH_SENTENCES_PATH}")


def main():
    print("=== Step 5: Extract Sentences ===\n")

    bible = load_bible()
    vocabulary = load_vocabulary()

    sentences, updated_vocabulary = extract_sentences(vocabulary, bible)
    save_outputs(sentences, updated_vocabulary)

    # Show examples
    print("\n=== Sample Output ===")
    sample_words = updated_vocabulary["words"][:3]
    for word_data in sample_words:
        word = word_data["word"]
        sentence_ids = word_data.get("sentence_ids", [])
        print(f"\n{word} (sentences: {len(sentence_ids)})")
        for sid in sentence_ids[:2]:
            if sid in sentences:
                print(f"  - [{sentences[sid]['ref']}] {sentences[sid]['text'][:80]}...")


if __name__ == "__main__":
    main()
