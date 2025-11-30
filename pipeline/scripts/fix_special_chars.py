#!/usr/bin/env python3
"""한글 발음에서 특수문자 제거"""

import json
import re
from config import VERSION_OUTPUT_DIR

def clean_korean(korean: str) -> str:
    """한글 발음에서 _와 - 제거"""
    if not korean:
        return korean
    # _ 제거
    korean = korean.replace('_', '')
    # - 제거
    korean = korean.replace('-', '')
    return korean

def main():
    vocab_path = VERSION_OUTPUT_DIR / "final_vocabulary.json"

    with open(vocab_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    fixed_count = 0
    for word_data in data['words']:
        korean = word_data.get('korean_pronunciation', '')
        if korean and ('_' in korean or '-' in korean):
            cleaned = clean_korean(korean)
            word_data['korean_pronunciation'] = cleaned
            fixed_count += 1
            print(f"{word_data['word']}: '{korean}' → '{cleaned}'")

    with open(vocab_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n총 {fixed_count}개 수정 완료")

if __name__ == "__main__":
    main()
