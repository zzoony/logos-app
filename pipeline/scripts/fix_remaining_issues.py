#!/usr/bin/env python3
"""남은 9개 단어의 IPA/한글 발음 수정"""

import json
from config import VERSION_OUTPUT_DIR

# 수동 수정 데이터
FIXES = {
    "learn": {
        "ipa_pronunciation": "[lɜːrn]",
        "korean_pronunciation": "런"
    },
    "swallow": {
        "ipa_pronunciation": "[ˈswɑːloʊ]",
        "korean_pronunciation": "스왈로우"
    },
    "unsatisfied": {
        "ipa_pronunciation": "[ˌʌnˈsætəsfaɪd]",
        "korean_pronunciation": "언새티스파이드"
    },
    "dweller": {
        "ipa_pronunciation": "[ˈdwelər]",
        "korean_pronunciation": "드웰러"
    },
    "mash": {
        "ipa_pronunciation": "[mæʃ]",
        "korean_pronunciation": "매시"
    },
    "weld": {
        "ipa_pronunciation": "[weld]",
        "korean_pronunciation": "웰드"
    },
    "compass": {
        "ipa_pronunciation": "[ˈkʌmpəs]",
        "korean_pronunciation": "컴퍼스"
    },
    "trudge": {
        "ipa_pronunciation": "[trʌdʒ]",
        "korean_pronunciation": "트러지"
    },
    "tidings": {
        "ipa_pronunciation": "[ˈtaɪdɪŋz]",
        "korean_pronunciation": "타이딩즈"
    }
}

def main():
    vocab_path = VERSION_OUTPUT_DIR / "final_vocabulary.json"

    with open(vocab_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    fixed_count = 0
    for word_data in data['words']:
        word = word_data['word']
        if word in FIXES:
            for key, value in FIXES[word].items():
                word_data[key] = value
            fixed_count += 1
            print(f"수정: {word}")
            print(f"  IPA: {word_data['ipa_pronunciation']}")
            print(f"  한글: {word_data['korean_pronunciation']}")

    with open(vocab_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n총 {fixed_count}개 단어 수정 완료")

if __name__ == "__main__":
    main()
