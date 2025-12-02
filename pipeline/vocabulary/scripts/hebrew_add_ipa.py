#!/usr/bin/env python3
"""
Add IPA pronunciation to Hebrew vocabulary.

Converts academic transliteration to IPA notation.
"""

import json
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_DIR / "output" / "hebrew"
INPUT_PATH = OUTPUT_DIR / "final_vocabulary_hebrew.json"
OUTPUT_PATH = OUTPUT_DIR / "final_vocabulary_hebrew.json"  # Overwrite


def log(message: str, level: str = "INFO") -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


# Transliteration to IPA mapping
# Based on SBL Hebrew transliteration standard
TRANSLIT_TO_IPA = {
    # Gutturals
    'ʼ': 'ʔ',      # Aleph - glottal stop
    'ʻ': 'ʕ',      # Ayin - voiced pharyngeal fricative

    # Consonants (digraphs first - order matters)
    'sh': 'ʃ',     # Shin
    'th': 'θ',     # Tav (spirant)
    'ts': 'ts',    # Tsade
    'ch': 'χ',     # Chet
    'kh': 'x',     # Kaph (spirant)
    'ph': 'f',     # Pe (spirant)
    'gh': 'ɣ',     # Gimel (spirant)
    'dh': 'ð',     # Dalet (spirant)
    'bh': 'v',     # Bet (spirant)

    # Simple consonants
    'b': 'b',
    'd': 'd',
    'g': 'ɡ',
    'h': 'h',
    'k': 'k',
    'l': 'l',
    'm': 'm',
    'n': 'n',
    'p': 'p',
    'q': 'q',
    'r': 'ʁ',      # Hebrew resh (uvular)
    's': 's',
    't': 't',
    'v': 'v',
    'w': 'w',
    'y': 'j',
    'z': 'z',

    # Long vowels (with macron or circumflex)
    'â': 'ɑː',     # Qamets
    'ā': 'ɑː',
    'ê': 'eː',     # Tsere
    'ē': 'eː',
    'î': 'iː',     # Hireq yod
    'ī': 'iː',
    'ô': 'oː',     # Holem
    'ō': 'oː',
    'û': 'uː',     # Shureq
    'ū': 'uː',

    # Short vowels (with breve or no mark)
    'ă': 'ə',      # Hatef patah / Sheva
    'ĕ': 'ɛ',      # Hatef segol
    'ŏ': 'ɔ',      # Hatef qamets
    'a': 'a',      # Patah
    'e': 'e',      # Segol
    'i': 'i',      # Hireq
    'o': 'o',      # Qamets hatuf
    'u': 'u',      # Qibbuts
}


def transliteration_to_ipa(translit: str) -> str:
    """
    Convert academic transliteration to IPA.

    Args:
        translit: Academic transliteration (e.g., 'ʼĕlôhîym')

    Returns:
        IPA notation (e.g., 'ʔɛloːhiːm')
    """
    if not translit:
        return ''

    result = translit.lower()

    # First, handle digraphs
    for digraph in ['sh', 'th', 'ts', 'ch', 'kh', 'ph', 'gh', 'dh', 'bh']:
        if digraph in result:
            result = result.replace(digraph, TRANSLIT_TO_IPA.get(digraph, digraph))

    # Then handle single characters
    output = []
    i = 0
    while i < len(result):
        char = result[i]

        # Check for mapped character
        if char in TRANSLIT_TO_IPA:
            output.append(TRANSLIT_TO_IPA[char])
        else:
            # Keep unmapped characters as-is
            output.append(char)

        i += 1

    ipa = ''.join(output)

    # Clean up: remove hyphens and apostrophes used in pronunciation guides
    ipa = ipa.replace('-', '').replace("'", '')

    return f'[{ipa}]'


def process_vocabulary():
    """Add IPA to all vocabulary entries."""
    log(f"Loading vocabulary from {INPUT_PATH}")

    with open(INPUT_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    words = data['words']
    log(f"Processing {len(words)} words")

    converted = 0
    for word in words:
        translit = word.get('transliteration', '')
        if translit:
            ipa = transliteration_to_ipa(translit)
            word['ipa_pronunciation'] = ipa
            converted += 1

    # Update metadata
    data['metadata']['ipa_added'] = True
    data['metadata']['ipa_count'] = converted
    data['metadata']['ipa_processing_date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Save
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    log(f"Added IPA to {converted} words")
    log(f"Saved to {OUTPUT_PATH}")

    # Show samples
    print("\n=== 샘플 (Top 10) ===")
    for w in words[:10]:
        print(f"{w['strongs']:6} | {w['word']:10} | {w['transliteration']:15} → {w.get('ipa_pronunciation', 'N/A')}")


def main():
    log("=" * 60)
    log("Hebrew IPA Conversion")
    log("=" * 60)

    process_vocabulary()

    log("=" * 60)
    log("Complete!")
    log("=" * 60)


if __name__ == '__main__':
    main()
