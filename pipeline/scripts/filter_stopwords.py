"""Step 2: Filter stopwords from extracted words."""

import json

from config import RAW_WORDS_PATH, FILTERED_STOPWORDS_PATH

# English stopwords commonly found in Bible text
STOPWORDS = {
    # Articles
    "a", "an", "the",

    # Be verbs
    "is", "am", "are", "was", "were", "be", "been", "being",

    # Have verbs
    "have", "has", "had", "having",

    # Do verbs
    "do", "does", "did", "doing", "done",

    # Modal verbs
    "will", "would", "shall", "should", "can", "could", "may", "might", "must",

    # Personal pronouns (including lemmatized forms like "u" from "us")
    "i", "me", "my", "mine", "myself",
    "you", "your", "yours", "yourself", "yourselves",
    "he", "him", "his", "himself",
    "she", "her", "hers", "herself",
    "it", "its", "itself",
    "we", "us", "u", "our", "ours", "ourselves",
    "they", "them", "their", "theirs", "themselves",

    # Demonstratives
    "this", "that", "these", "those",

    # Interrogatives/Relatives
    "who", "whom", "whose", "which", "what", "where", "when", "why", "how",

    # Prepositions
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "up", "down",
    "into", "onto", "upon", "out", "off", "over", "under", "through", "between",
    "among", "before", "after", "above", "below", "about", "against", "during",
    "without", "within", "along", "across", "behind", "beyond", "toward", "towards",
    "around", "near", "beside", "besides",

    # Conjunctions
    "and", "or", "but", "nor", "so", "yet", "for", "if", "because", "although",
    "though", "unless", "while", "whereas", "as", "than", "whether", "once",
    "since", "until", "till", "whenever", "wherever",

    # Common verbs
    "go", "went", "gone", "going", "goes",
    "come", "came", "comes", "coming",
    "get", "got", "gets", "getting",
    "make", "made", "makes", "making",
    "take", "took", "taken", "takes", "taking",
    "give", "gave", "given", "gives", "giving",
    "say", "said", "says", "saying",
    "see", "saw", "seen", "sees", "seeing",
    "know", "knew", "known", "knows", "knowing",
    "let", "lets", "put", "set",

    # Other common words
    "not", "no", "yes", "all", "any", "some", "every", "each", "both", "few",
    "more", "most", "other", "another", "such", "only", "own", "same", "also",
    "very", "just", "even", "too", "much", "many", "now", "then", "here", "there",
    "still", "already", "again", "always", "never", "ever", "often",
    "one", "two", "first", "second", "new", "old", "great", "good", "well",
    "way", "thing", "things", "time", "times", "day", "days", "year", "years",
    "man", "men", "woman", "women", "people", "person",
    "being", "nothing", "something", "everything", "anything",
}


def load_raw_words() -> dict:
    """Load raw words from previous step."""
    with open(RAW_WORDS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def filter_stopwords(data: dict) -> list:
    """Filter out stopwords from word list."""
    filtered = []
    removed_count = 0

    for item in data["words"]:
        word = item["word"]
        if word not in STOPWORDS:
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
    data = load_raw_words()
    filtered = filter_stopwords(data)
    save_output(filtered, data["metadata"])

    # Show top 20 remaining words
    print("\nTop 20 words after stopword removal:")
    for item in filtered[:20]:
        print(f"  {item['word']}: {item['count']}")


if __name__ == "__main__":
    main()
