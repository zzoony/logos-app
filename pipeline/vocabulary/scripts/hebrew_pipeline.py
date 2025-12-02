#!/usr/bin/env python3
"""
Hebrew Bible Vocabulary Pipeline

Extracts vocabulary from Hebrew Bible JSON with Strong's numbers,
maps to Strong's dictionary for definitions and pronunciations.

Steps:
1. Extract unique Strong's numbers and count frequencies
2. Filter out proper nouns and function words (using grammar tags)
3. Map to Strong's dictionary (lemma, pronunciation, definition)
4. Extract example sentences
5. (Optional) Translate definitions to Korean via AI
"""

import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent  # pipeline/vocabulary
PIPELINE_ROOT = PROJECT_DIR.parent  # pipeline (shared resources)
SOURCE_DATA_DIR = PIPELINE_ROOT / "source-data"  # Shared across vocabulary/sentence
OUTPUT_DIR = PROJECT_DIR / "output" / "hebrew"
CONFIG_FILE = PROJECT_DIR / "configs" / "hebrew.json"

# Grammar tag patterns for filtering
# HNp = Proper noun (고유명사)
# HR = Preposition (전치사)
# HC = Conjunction (접속사)
# HTd = Definite article (정관사)
# HTo = Object marker (목적격 표지)
# HTr = Relative particle (관계사)
FILTER_TAGS = {'HNp'}  # 고유명사만 제외
FUNCTION_WORD_TAGS = {'HR', 'HC', 'HTd', 'HTo', 'HTr', 'HD', 'HTi', 'HTe', 'HTa', 'HTm'}


def load_config():
    """Load Hebrew pipeline configuration."""
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_hebrew_bible(config):
    """Load Hebrew Bible JSON."""
    source_file = SOURCE_DATA_DIR / config['source_file']
    print(f"Loading Hebrew Bible from {source_file}...")
    with open(source_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_strongs_dictionary(config):
    """Load Strong's Hebrew dictionary."""
    dict_file = SOURCE_DATA_DIR / config['strongs_dictionary']
    print(f"Loading Strong's dictionary from {dict_file}...")

    with open(dict_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract JSON from JavaScript variable
    match = re.search(r'var strongsHebrewDictionary = ({.*})', content, re.DOTALL)
    if not match:
        raise ValueError("Could not parse Strong's dictionary")

    return json.loads(match.group(1))


def extract_words(bible_data):
    """
    Extract words with Strong's numbers from Hebrew Bible.

    Returns:
        dict: {strongs_number: {count, tags, locations}}
    """
    print("Extracting words...")
    words = defaultdict(lambda: {'count': 0, 'tags': set(), 'locations': []})

    for book, chapters in bible_data.items():
        for chapter_idx, chapter in enumerate(chapters, 1):
            for verse_idx, verse in enumerate(chapter, 1):
                for word_data in verse:
                    # word_data = [hebrew_text, strongs_codes, grammar_tags]
                    _hebrew_text, strongs_codes, grammar_tags = word_data

                    # Parse Strong's numbers (may have prefixes like Hb/H7225)
                    for code in strongs_codes.split('/'):
                        if code.startswith('H') and len(code) > 1 and code[1:].isdigit():
                            strongs_num = code
                            words[strongs_num]['count'] += 1
                            words[strongs_num]['tags'].add(grammar_tags.split('/')[-1])  # Main tag

                            # Store first few locations as examples
                            if len(words[strongs_num]['locations']) < 10:
                                location = f"{book}-{chapter_idx}-{verse_idx}"
                                if location not in words[strongs_num]['locations']:
                                    words[strongs_num]['locations'].append(location)

    # Convert sets to lists for JSON serialization
    for strongs_num in words:
        words[strongs_num]['tags'] = list(words[strongs_num]['tags'])

    print(f"  Found {len(words)} unique Strong's numbers")
    return dict(words)


def filter_words(words_data, include_function_words=False):
    """
    Filter out proper nouns and optionally function words.

    Args:
        words_data: dict from extract_words
        include_function_words: if False, filter out prepositions, conjunctions, etc.

    Returns:
        filtered dict
    """
    print("Filtering words...")
    filtered = {}

    proper_noun_count = 0
    function_word_count = 0

    for strongs_num, data in words_data.items():
        tags = set(data['tags'])

        # Filter proper nouns
        if tags & FILTER_TAGS:
            proper_noun_count += 1
            continue

        # Optionally filter function words
        if not include_function_words and tags <= FUNCTION_WORD_TAGS:
            # All tags are function word tags
            function_word_count += 1
            continue

        filtered[strongs_num] = data

    print(f"  Filtered out {proper_noun_count} proper nouns")
    print(f"  Filtered out {function_word_count} function words")
    print(f"  Remaining: {len(filtered)} words")

    return filtered


def map_to_dictionary(words_data, strongs_dict):
    """
    Map extracted words to Strong's dictionary entries.

    Returns:
        list of word entries with dictionary data
    """
    print("Mapping to Strong's dictionary...")
    vocabulary = []
    not_found = []

    for strongs_num, data in words_data.items():
        if strongs_num not in strongs_dict:
            not_found.append(strongs_num)
            continue

        entry = strongs_dict[strongs_num]

        vocab_entry = {
            'strongs': strongs_num,
            'word': entry.get('lemma', ''),
            'transliteration': entry.get('xlit', ''),
            'pronunciation': entry.get('pron', ''),
            'count': data['count'],
            'definition_english': entry.get('strongs_def', ''),
            'kjv_usage': entry.get('kjv_def', ''),
            'derivation': entry.get('derivation', ''),
            'tags': data['tags'],
            'locations': data['locations']
        }
        vocabulary.append(vocab_entry)

    if not_found:
        print(f"  Warning: {len(not_found)} Strong's numbers not found in dictionary")

    # Sort by frequency (descending)
    vocabulary.sort(key=lambda x: x['count'], reverse=True)

    # Add rank
    for rank, entry in enumerate(vocabulary, 1):
        entry['rank'] = rank

    print(f"  Mapped {len(vocabulary)} words")
    return vocabulary


def create_sentence_mapping(bible_data):
    """
    Create a mapping of sentence IDs to text for example sentences.

    Returns:
        dict: {sentence_id: {text, ref, book, chapter, verse}}
    """
    print("Creating sentence mapping...")
    sentences = {}

    for book, chapters in bible_data.items():
        for chapter_idx, chapter in enumerate(chapters, 1):
            for verse_idx, verse in enumerate(chapter, 1):
                # Reconstruct verse text from words
                words = [word_data[0].replace('/', '') for word_data in verse]
                text = ' '.join(words)

                sentence_id = f"{book.lower().replace(' ', '-')}-{chapter_idx}-{verse_idx}"
                sentences[sentence_id] = {
                    'text': text,
                    'ref': f"{book} {chapter_idx}:{verse_idx}",
                    'book': book,
                    'chapter': chapter_idx,
                    'verse': verse_idx
                }

    print(f"  Created {len(sentences)} sentence entries")
    return sentences


def save_output(vocabulary, sentences, config):
    """Save pipeline output to JSON files."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Vocabulary file
    vocab_output = {
        'metadata': {
            'source': config['name'],
            'language': config['language'],
            'extraction_date': datetime.now().strftime('%Y-%m-%d'),
            'total_unique_words': len(vocabulary),
            'total_occurrences': sum(w['count'] for w in vocabulary),
            'strongs_dictionary_used': True
        },
        'words': vocabulary
    }

    vocab_file = OUTPUT_DIR / "vocabulary_hebrew.json"
    with open(vocab_file, 'w', encoding='utf-8') as f:
        json.dump(vocab_output, f, ensure_ascii=False, indent=2)
    print(f"Saved vocabulary to {vocab_file}")

    # Sentences file
    sentences_output = {
        'metadata': {
            'source': config['name'],
            'total_sentences': len(sentences)
        },
        'sentences': sentences
    }

    sentences_file = OUTPUT_DIR / "sentences_hebrew.json"
    with open(sentences_file, 'w', encoding='utf-8') as f:
        json.dump(sentences_output, f, ensure_ascii=False, indent=2)
    print(f"Saved sentences to {sentences_file}")


def main():
    """Run the Hebrew vocabulary pipeline."""
    print("=" * 60)
    print("Hebrew Bible Vocabulary Pipeline")
    print("=" * 60)

    # Load data
    config = load_config()
    bible_data = load_hebrew_bible(config)
    strongs_dict = load_strongs_dictionary(config)

    # Process
    words_data = extract_words(bible_data)
    filtered_words = filter_words(words_data, include_function_words=False)
    vocabulary = map_to_dictionary(filtered_words, strongs_dict)
    sentences = create_sentence_mapping(bible_data)

    # Update vocabulary with sentence_ids (normalized location format)
    for entry in vocabulary:
        entry['sentence_ids'] = entry.pop('locations')

    # Save output
    save_output(vocabulary, sentences, config)

    print("=" * 60)
    print("Pipeline complete!")
    print(f"  Total vocabulary: {len(vocabulary)} words")
    print(f"  Total sentences: {len(sentences)}")
    print("=" * 60)


if __name__ == '__main__':
    main()
