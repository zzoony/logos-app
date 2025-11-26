"""Validate generated definitions (IPA and Korean pronunciation)."""

import json
import re
import subprocess
import time
from datetime import datetime
from pathlib import Path

from config import VERSION_OUTPUT_DIR

# Input file
INPUT_PATH = VERSION_OUTPUT_DIR / "bible_vocabulary_final.json"

# Validation patterns
HEBREW_PATTERN = re.compile(r'[א-ת]')
# Greek pattern excluding IPA symbols: θ (theta, U+03B8) and ð (eth, U+00F0)
GREEK_PATTERN = re.compile(r'[Α-Ωαβγδεζηικλμνξοπρςστυφχψωἀ-ῼ]')

# Original language phoneme patterns in Korean
ORIGINAL_LANG_KOREAN_PATTERNS = [
    '여호와', '엘로힘', '아도나이', '샬롬', '할렐루야', '호산나', '아멘',
    '크리스토스', '예슈아', '로고스', '아가페', '카리스',
    '베레시트', '바라', '샤마임', '루아흐', '테홈'
]

# IPA patterns that suggest original language
ORIGINAL_LANG_IPA_PATTERNS = [
    r'jəhˈwɑː', r'jehoˈva', r'jɑːhweɪ',  # YHWH
    r'ɛloˈhim', r'eloˈhim',  # Elohim
    r'ʃaˈlom',  # Shalom
    r'ˈloɡos',  # Logos
    r'aˈɡape',  # Agape
]

# Valid IPA characters (simplified)
VALID_IPA_CHARS = set('abcdefghijklmnopqrstuvwxyzæɑɒʌəɛɜɪɔʊʉðŋθʃʒʤʧˈˌːˑ̃[]/()')


def log(message: str, level: str = "INFO") -> None:
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def load_vocabulary() -> dict:
    """Load vocabulary file."""
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def check_ipa_format(ipa: str) -> list[str]:
    """Check IPA format issues."""
    issues = []

    if not ipa:
        issues.append("IPA가 비어있음")
        return issues

    # Check for Hebrew/Greek characters
    if HEBREW_PATTERN.search(ipa):
        issues.append("IPA에 히브리어 문자 포함")
    if GREEK_PATTERN.search(ipa):
        issues.append("IPA에 그리스어 문자 포함")

    # Check for original language patterns
    for pattern in ORIGINAL_LANG_IPA_PATTERNS:
        if re.search(pattern, ipa, re.IGNORECASE):
            issues.append(f"IPA에 원어 패턴 포함: {pattern}")
            break

    # Check if starts with bracket or slash
    if not (ipa.startswith('[') or ipa.startswith('/') or ipa.startswith('ˈ')):
        issues.append("IPA가 [, /, ˈ로 시작하지 않음")

    return issues


def check_korean_pronunciation(korean: str) -> list[str]:
    """Check Korean pronunciation issues."""
    issues = []

    if not korean:
        issues.append("한글 발음이 비어있음")
        return issues

    # Check for Hebrew/Greek characters
    if HEBREW_PATTERN.search(korean):
        issues.append("한글 발음에 히브리어 문자 포함")
    if GREEK_PATTERN.search(korean):
        issues.append("한글 발음에 그리스어 문자 포함")

    # Check for original language patterns
    for pattern in ORIGINAL_LANG_KOREAN_PATTERNS:
        if pattern in korean:
            issues.append(f"한글 발음에 원어 패턴 포함: {pattern}")
            break

    # Check if contains English
    if re.search(r'[a-zA-Z]', korean):
        issues.append("한글 발음에 영어 포함")

    # Check if only Korean characters
    if not re.match(r'^[가-힣\s]+$', korean):
        # Allow some special cases
        if not re.match(r'^[가-힣\s\-]+$', korean):
            issues.append("한글 발음에 특수문자 포함")

    return issues


def check_definition(definition: str) -> list[str]:
    """Check Korean definition issues."""
    issues = []

    if not definition:
        issues.append("한국어 뜻이 비어있음")
        return issues

    if len(definition) < 1:
        issues.append("한국어 뜻이 너무 짧음")

    return issues


def validate_with_api(word: str, ipa: str) -> dict:
    """Validate IPA against Free Dictionary API."""
    try:
        import urllib.request
        import urllib.error

        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())

            if data and isinstance(data, list):
                # Extract all phonetics
                api_ipas = []
                for entry in data:
                    if 'phonetics' in entry:
                        for phonetic in entry['phonetics']:
                            if 'text' in phonetic and phonetic['text']:
                                api_ipas.append(phonetic['text'])
                    if 'phonetic' in entry and entry['phonetic']:
                        api_ipas.append(entry['phonetic'])

                if api_ipas:
                    # Normalize for comparison
                    def normalize_ipa(s):
                        return re.sub(r'[\[\]/ˈˌː\s]', '', s.lower())

                    norm_ipa = normalize_ipa(ipa)
                    norm_apis = [normalize_ipa(a) for a in api_ipas]

                    # Check if any match
                    match = any(norm_ipa == a or norm_ipa in a or a in norm_ipa for a in norm_apis)

                    return {
                        "found": True,
                        "match": match,
                        "api_ipa": api_ipas[0] if api_ipas else None,
                        "our_ipa": ipa
                    }

        return {"found": False, "match": None}

    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"found": False, "match": None, "error": "단어 없음"}
        return {"found": False, "match": None, "error": str(e)}
    except Exception as e:
        return {"found": False, "match": None, "error": str(e)}


def validate_vocabulary(vocabulary: dict, api_sample_size: int = 50) -> dict:
    """Validate all vocabulary entries."""
    words = vocabulary["words"]
    total = len(words)

    log(f"Validating {total} words...")

    results = {
        "total": total,
        "ipa_issues": [],
        "korean_issues": [],
        "definition_issues": [],
        "empty_fields": [],
        "api_mismatches": []
    }

    # Phase 1: Pattern-based validation (fast)
    log("Phase 1: Pattern-based validation...")

    for word_data in words:
        word = word_data["word"]
        ipa = word_data.get("ipa_pronunciation", "")
        korean = word_data.get("korean_pronunciation", "")
        definition = word_data.get("definition_korean", "")

        # Check IPA
        ipa_issues = check_ipa_format(ipa)
        if ipa_issues:
            results["ipa_issues"].append({
                "word": word,
                "ipa": ipa,
                "issues": ipa_issues
            })

        # Check Korean pronunciation
        korean_issues = check_korean_pronunciation(korean)
        if korean_issues:
            results["korean_issues"].append({
                "word": word,
                "korean": korean,
                "issues": korean_issues
            })

        # Check definition
        def_issues = check_definition(definition)
        if def_issues:
            results["definition_issues"].append({
                "word": word,
                "definition": definition,
                "issues": def_issues
            })

        # Track empty fields
        if not ipa or not korean or not definition:
            results["empty_fields"].append({
                "word": word,
                "empty": [
                    f for f, v in [
                        ("ipa", ipa), ("korean", korean), ("definition", definition)
                    ] if not v
                ]
            })

    log(f"  IPA issues: {len(results['ipa_issues'])}")
    log(f"  Korean issues: {len(results['korean_issues'])}")
    log(f"  Definition issues: {len(results['definition_issues'])}")
    log(f"  Empty fields: {len(results['empty_fields'])}")

    # Phase 2: API validation (sample)
    if api_sample_size > 0:
        log(f"Phase 2: API validation (sampling {api_sample_size} words)...")

        import random
        sample_indices = random.sample(range(len(words)), min(api_sample_size, len(words)))

        for i, idx in enumerate(sample_indices):
            word_data = words[idx]
            word = word_data["word"]
            ipa = word_data.get("ipa_pronunciation", "")

            if not ipa:
                continue

            result = validate_with_api(word, ipa)

            if result.get("found") and not result.get("match"):
                results["api_mismatches"].append({
                    "word": word,
                    "our_ipa": ipa,
                    "api_ipa": result.get("api_ipa")
                })

            if (i + 1) % 10 == 0:
                log(f"  API checked: {i + 1}/{api_sample_size}")

            time.sleep(0.2)  # Rate limiting

        log(f"  API mismatches: {len(results['api_mismatches'])}")

    return results


def print_report(results: dict) -> None:
    """Print validation report."""
    print("\n" + "=" * 60)
    print("VALIDATION REPORT")
    print("=" * 60)

    print(f"\nTotal words: {results['total']}")

    # Summary
    print("\n--- Summary ---")
    print(f"IPA issues: {len(results['ipa_issues'])}")
    print(f"Korean pronunciation issues: {len(results['korean_issues'])}")
    print(f"Definition issues: {len(results['definition_issues'])}")
    print(f"Empty fields: {len(results['empty_fields'])}")
    print(f"API mismatches: {len(results['api_mismatches'])}")

    # Details
    if results['ipa_issues']:
        print("\n--- IPA Issues (first 10) ---")
        for item in results['ipa_issues'][:10]:
            print(f"  {item['word']}: {item['ipa']}")
            for issue in item['issues']:
                print(f"    - {issue}")

    if results['korean_issues']:
        print("\n--- Korean Pronunciation Issues (first 10) ---")
        for item in results['korean_issues'][:10]:
            print(f"  {item['word']}: {item['korean']}")
            for issue in item['issues']:
                print(f"    - {issue}")

    if results['empty_fields']:
        print("\n--- Empty Fields (first 10) ---")
        for item in results['empty_fields'][:10]:
            print(f"  {item['word']}: missing {', '.join(item['empty'])}")

    if results['api_mismatches']:
        print("\n--- API Mismatches ---")
        for item in results['api_mismatches']:
            print(f"  {item['word']}:")
            print(f"    Ours: {item['our_ipa']}")
            print(f"    API:  {item['api_ipa']}")

    # Final status
    total_issues = (
        len(results['ipa_issues']) +
        len(results['korean_issues']) +
        len(results['definition_issues']) +
        len(results['empty_fields'])
    )

    print("\n" + "=" * 60)
    if total_issues == 0:
        print("✅ All validations passed!")
    else:
        print(f"⚠️  Found {total_issues} issues to review")
    print("=" * 60)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Validate vocabulary definitions")
    parser.add_argument(
        "--api-sample", "-a",
        type=int,
        default=50,
        help="Number of words to validate against API (0 to skip)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Vocabulary Validation")
    print("=" * 60)

    vocabulary = load_vocabulary()
    results = validate_vocabulary(vocabulary, api_sample_size=args.api_sample)
    print_report(results)


if __name__ == "__main__":
    main()
