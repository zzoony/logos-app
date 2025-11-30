#!/usr/bin/env python3
"""
final_vocabulary.json의 이슈를 수정하는 스크립트
- 한글 발음에서 대괄호 제거
- IPA 형식 오류 수정
- 빈 필드는 별도 처리 필요
"""

import json
import re
from pathlib import Path
from config import VERSION_OUTPUT_DIR

def fix_korean_pronunciation(korean: str) -> str:
    """한글 발음에서 대괄호 제거"""
    if not korean:
        return korean
    # 대괄호 제거
    korean = korean.strip('[]')
    return korean

def fix_ipa(ipa: str) -> str:
    """IPA 형식 오류 수정"""
    if not ipa:
        return ipa
    # 앞의 콜론 제거
    if ipa.startswith(':'):
        ipa = ipa[1:]
    return ipa

def has_english(text: str) -> bool:
    """영어 문자 포함 여부"""
    return bool(re.search(r'[a-zA-Z]', text))

def main():
    vocab_path = VERSION_OUTPUT_DIR / "final_vocabulary.json"

    with open(vocab_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    words = data['words']

    fixed_korean = 0
    fixed_ipa = 0
    needs_regeneration = []

    for word in words:
        # 한글 발음 수정 (대괄호 제거)
        korean = word.get('korean_pronunciation', '')
        if korean and ('[' in korean or ']' in korean):
            word['korean_pronunciation'] = fix_korean_pronunciation(korean)
            fixed_korean += 1

        # 한글 발음에 영어 포함된 경우
        korean = word.get('korean_pronunciation', '')
        if korean and has_english(korean):
            needs_regeneration.append({
                'word': word['word'],
                'issue': 'korean_has_english',
                'current': korean
            })

        # IPA 형식 수정
        ipa = word.get('ipa_pronunciation', '')
        if ipa and ipa.startswith(':'):
            word['ipa_pronunciation'] = fix_ipa(ipa)
            fixed_ipa += 1

        # 빈 IPA
        if not word.get('ipa_pronunciation'):
            needs_regeneration.append({
                'word': word['word'],
                'issue': 'empty_ipa',
                'current': ''
            })

        # 빈 한글 발음
        if not word.get('korean_pronunciation'):
            needs_regeneration.append({
                'word': word['word'],
                'issue': 'empty_korean',
                'current': ''
            })

    # 저장
    with open(vocab_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"수정 완료:")
    print(f"  - 한글 발음 대괄호 제거: {fixed_korean}개")
    print(f"  - IPA 형식 수정: {fixed_ipa}개")
    print(f"\n재생성 필요한 항목: {len(needs_regeneration)}개")

    if needs_regeneration:
        print("\n재생성 필요 단어 목록:")
        for item in needs_regeneration:
            print(f"  - {item['word']}: {item['issue']} (현재: '{item['current']}')")

        # 재생성 필요 목록 저장
        regen_path = VERSION_OUTPUT_DIR / "needs_regeneration.json"
        with open(regen_path, 'w', encoding='utf-8') as f:
            json.dump(needs_regeneration, f, ensure_ascii=False, indent=2)
        print(f"\n재생성 목록 저장: {regen_path}")

if __name__ == "__main__":
    main()
