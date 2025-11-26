"""Step 9: Validate Korean translations in sentences.

Validates:
    - Empty translations
    - English words mixed in Korean
    - Reference patterns in Korean (e.g., "(창세기 1:1)")
    - Length ratio issues
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from config import VERSION_OUTPUT_DIR
from utils import log

# Input file
INPUT_PATH = VERSION_OUTPUT_DIR / "final_sentences_korean.json"

# Patterns for validation
ENGLISH_WORD_PATTERN = re.compile(r'[a-zA-Z]{3,}')
KOREAN_REF_PATTERN = re.compile(r'\([가-힣]+\s*\d+:\d+\)')
ENGLISH_REF_PATTERN = re.compile(r'\([A-Za-z]+\s*\d+:\d+\)')


def load_sentences() -> dict:
    """Load translated sentences file."""
    log(f"Loading from {INPUT_PATH}")
    if not INPUT_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {INPUT_PATH}")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_translations(data: dict) -> dict:
    """Validate all translations and return issues."""
    sentences = data["sentences"]
    total = len(sentences)

    log(f"Validating {total} translations...")

    issues = {
        "empty": [],
        "has_english": [],
        "has_reference": [],
        "too_short": [],
        "ratio_issues": []
    }

    for sid, s in sentences.items():
        korean = s.get("korean", "")
        english = s.get("text", "")
        ref = s.get("ref", "")

        # 1. Empty check
        if not korean:
            issues["empty"].append({
                "id": sid,
                "ref": ref,
                "english": english[:80]
            })
            continue

        # 2. English words in Korean
        english_match = ENGLISH_WORD_PATTERN.search(korean)
        if english_match:
            issues["has_english"].append({
                "id": sid,
                "ref": ref,
                "korean": korean[:100],
                "english_word": english_match.group()
            })

        # 3. Reference in Korean translation
        if KOREAN_REF_PATTERN.search(korean) or ENGLISH_REF_PATTERN.search(korean):
            issues["has_reference"].append({
                "id": sid,
                "ref": ref,
                "korean": korean[:100]
            })

        # 4. Too short (Korean < 5 chars when English > 20 chars)
        if len(korean) < 5 and len(english) > 20:
            issues["too_short"].append({
                "id": sid,
                "ref": ref,
                "english": english,
                "korean": korean
            })

        # 5. Length ratio (Korean should be ~0.3-2x English length)
        ratio = len(korean) / max(len(english), 1)
        if ratio < 0.15 or ratio > 3:
            issues["ratio_issues"].append({
                "id": sid,
                "ref": ref,
                "english_len": len(english),
                "korean_len": len(korean),
                "ratio": round(ratio, 2)
            })

    return {
        "total": total,
        "issues": issues
    }


def print_report(results: dict) -> None:
    """Print validation report."""
    print("\n" + "=" * 60)
    print("TRANSLATION VALIDATION REPORT")
    print("=" * 60)

    print(f"\nTotal sentences: {results['total']}")

    issues = results["issues"]

    # Summary
    print("\n--- Summary ---")
    print(f"Empty translations: {len(issues['empty'])}")
    print(f"Has English words: {len(issues['has_english'])}")
    print(f"Has reference in Korean: {len(issues['has_reference'])}")
    print(f"Too short: {len(issues['too_short'])}")
    print(f"Ratio issues: {len(issues['ratio_issues'])}")

    # Details
    if issues["empty"]:
        print(f"\n--- Empty Translations (first 10) ---")
        for item in issues["empty"][:10]:
            print(f"  [{item['ref']}] {item['english'][:60]}...")

    if issues["has_english"]:
        print(f"\n--- Has English Words (all) ---")
        for item in issues["has_english"]:
            print(f"  [{item['ref']}] '{item['english_word']}' in: {item['korean'][:60]}...")

    if issues["has_reference"]:
        print(f"\n--- Has Reference in Korean (first 10) ---")
        for item in issues["has_reference"][:10]:
            print(f"  [{item['ref']}] {item['korean'][:60]}...")

    if issues["too_short"]:
        print(f"\n--- Too Short (all) ---")
        for item in issues["too_short"]:
            print(f"  [{item['ref']}] EN({len(item['english'])}): {item['english'][:40]}...")
            print(f"              KO({len(item['korean'])}): {item['korean']}")

    # Final status
    total_issues = (
        len(issues["empty"]) +
        len(issues["has_english"]) +
        len(issues["has_reference"])
    )

    print("\n" + "=" * 60)
    if total_issues == 0:
        print("✅ All validations passed!")
    else:
        print(f"⚠️  Found {total_issues} issues to review")
    print("=" * 60)

    return total_issues


def fix_issues(data: dict, issues: dict) -> tuple[dict, int]:
    """Fix common issues automatically.

    Fixes:
        - Remove reference patterns from Korean translations

    Returns:
        Updated data and count of fixes made
    """
    fix_count = 0

    # Fix references in Korean
    ref_pattern = re.compile(r'\s*\([가-힣0-9a-zA-Z\s]+\d+:\d+\)\s*')

    for item in issues["has_reference"]:
        sid = item["id"]
        if sid in data["sentences"]:
            korean = data["sentences"][sid]["korean"]
            new_korean = ref_pattern.sub('', korean).strip()
            if new_korean != korean:
                data["sentences"][sid]["korean"] = new_korean
                fix_count += 1

    return data, fix_count


def main():
    parser = argparse.ArgumentParser(description="Validate Korean translations")
    parser.add_argument(
        "--fix", "-f",
        action="store_true",
        help="Automatically fix common issues (remove references)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Step 9: Validate Translations")
    print("=" * 60)

    data = load_sentences()
    results = validate_translations(data)
    total_issues = print_report(results)

    # Auto-fix if requested
    if args.fix and results["issues"]["has_reference"]:
        print("\n--- Auto-fixing ---")
        data, fix_count = fix_issues(data, results["issues"])

        if fix_count > 0:
            # Save fixed data
            with open(INPUT_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            log(f"Fixed {fix_count} issues and saved to {INPUT_PATH}")

            # Re-validate
            print("\n--- Re-validation ---")
            results = validate_translations(data)
            print_report(results)


if __name__ == "__main__":
    main()
