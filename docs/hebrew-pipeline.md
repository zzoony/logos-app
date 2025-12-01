# Hebrew Bible Vocabulary Pipeline

히브리어 성경(구약)에서 단어를 추출하여 단어장을 만드는 파이프라인 문서.

## Overview

영어 성경 파이프라인과 달리, 히브리어는 **Strong's Concordance** 번호 체계를 활용하여 더 정확한 어휘 분석이 가능합니다.

### 영어 vs 히브리어 파이프라인 비교

| 항목 | 영어 | 히브리어 |
|------|------|----------|
| 단어 ID | lemma (spaCy) | Strong's 번호 |
| 발음 | AI 생성 | 사전 + 규칙 변환 |
| 뜻 | AI 생성 | 사전 → AI 번역 |
| Lemmatization | 필요 (spaCy) | 불필요 (Strong's) |

## Data Sources

### 1. Hebrew Bible JSON

```
pipeline/source-data/Hebrew_Bible.json
```

**구조:**
```json
{
  "Genesis": [           // 책
    [                    // 장 (배열)
      [                  // 절 (배열)
        ["ב/ראשית", "Hb/H7225", "HR/Ncfsa"],  // [히브리어, Strong's, 문법태그]
        ["ברא", "H1254", "HVqp3ms"],
        ...
      ]
    ]
  ]
}
```

**단어 배열 형식:**
- `[0]`: 히브리어 텍스트 (형태소 `/`로 분리)
- `[1]`: Strong's 번호 (예: `H1254`, `Hb/H7225`)
- `[2]`: 문법 태그 (예: `HVqp3ms`)

### 2. Strong's Hebrew Dictionary

```
pipeline/source-data/strongs/hebrew/strongs-hebrew-dictionary.js
```

GitHub: [openscriptures/strongs](https://github.com/openscriptures/strongs)

**구조:**
```javascript
{
  "H430": {
    "lemma": "אֱלֹהִים",           // 히브리어 (니쿠드 포함)
    "xlit": "ʼĕlôhîym",           // 학술적 음역
    "pron": "el-o-heem'",         // 발음 가이드
    "derivation": "plural of H433", // 어원
    "strongs_def": "gods...",     // Strong's 정의
    "kjv_def": "angels, God..."   // KJV 번역어
  }
}
```

## Pipeline Steps

### Step 1: 단어 추출 및 사전 매핑

```bash
cd pipeline/scripts
python3 hebrew_pipeline.py
```

**처리 내용:**
1. Hebrew_Bible.json에서 Strong's 번호 추출
2. 빈도수 계산
3. 고유명사 필터링 (문법 태그 `HNp` 제외)
4. 기능어 필터링 (전치사, 접속사, 관사 등)
5. Strong's 사전과 매핑 (발음, 뜻)
6. 예문(구절) 매핑

**출력 파일:**
- `output/hebrew/vocabulary_hebrew.json` - 기본 단어장
- `output/hebrew/sentences_hebrew.json` - 예문

**필터링되는 문법 태그:**
| 태그 | 의미 |
|------|------|
| HNp | 고유명사 (Proper noun) |
| HR | 전치사 (Preposition) |
| HC | 접속사 (Conjunction) |
| HTd | 정관사 (Definite article) |
| HTo | 목적격 표지 (Object marker) |

### Step 2: 한글 번역 추가

```bash
cd pipeline/scripts
python3 hebrew_add_korean.py
```

**옵션:**
```bash
python3 hebrew_add_korean.py --test 30   # 테스트 (30개만)
python3 hebrew_add_korean.py --retry     # 실패한 단어만 재시도
```

**처리 내용:**
1. `definition_english` → `definition_korean` (AI 번역)
2. `pronunciation` → `korean_pronunciation` (AI 생성)

**API 설정:**
```bash
# pipeline/.env
ZAI_API_KEY=your_api_key
ZAI_API_BASE=https://api.z.ai/api/coding/paas/v4
ZAI_MODEL=glm-4.6
```

**설정값:**
- `BATCH_SIZE`: 30 (배치당 단어 수)
- `MAX_WORKERS_API`: 5 (동시 요청 수)
- `API_TIMEOUT`: 300초

**출력 파일:**
- `output/hebrew/final_vocabulary_hebrew.json`

### Step 3: IPA 발음 추가

```bash
cd pipeline/scripts
python3 hebrew_add_ipa.py
```

**처리 내용:**
- `transliteration` (학술 음역) → `ipa_pronunciation` (IPA)

**변환 규칙:**

| Transliteration | IPA | 설명 |
|-----------------|-----|------|
| ʼ | ʔ | Aleph (글로탈 스톱) |
| ʻ | ʕ | Ayin (인두음) |
| â, ā | ɑː | 긴 a (Qamets) |
| ê, ē | eː | 긴 e (Tsere) |
| î, ī | iː | 긴 i |
| ô, ō | oː | 긴 o (Holem) |
| û, ū | uː | 긴 u (Shureq) |
| ă | ə | 쉐바/짧은 a |
| sh | ʃ | Shin |
| th | θ | Tav (spirant) |
| y | j | Yod |
| r | ʁ | Resh (목젖음) |

**예시:**
- `ʼĕlôhîym` → `[ʔɛloːhiːm]`
- `ʼăsher` → `[ʔəʃeʁ]`

## Output Format

### final_vocabulary_hebrew.json

```json
{
  "metadata": {
    "source": "Hebrew Bible (WLC)",
    "language": "he",
    "total_unique_words": 6650,
    "total_occurrences": 246923,
    "strongs_dictionary_used": true,
    "korean_translations_added": true,
    "ipa_added": true
  },
  "words": [
    {
      "strongs": "H430",
      "word": "אֱלֹהִים",
      "transliteration": "ʼĕlôhîym",
      "pronunciation": "el-o-heem'",
      "ipa_pronunciation": "[ʔɛloːhiːm]",
      "korean_pronunciation": "엘로힘",
      "count": 2606,
      "rank": 11,
      "definition_english": "gods in the ordinary sense...",
      "definition_korean": "일반적인 의미로는 '신들'...",
      "kjv_usage": "angels, God, gods...",
      "derivation": "plural of H433",
      "tags": ["HNcmpa"],
      "sentence_ids": ["Genesis-1-1", ...]
    }
  ]
}
```

### sentences_hebrew.json

```json
{
  "metadata": {
    "source": "Hebrew Bible (WLC)",
    "total_sentences": 23145
  },
  "sentences": {
    "genesis-1-1": {
      "text": "בראשית ברא אלהים את השמים ואת הארץ",
      "ref": "Genesis 1:1",
      "book": "Genesis",
      "chapter": 1,
      "verse": 1
    }
  }
}
```

## Statistics

| 항목 | 수치 |
|------|------|
| 총 Strong's 번호 | 8,640개 |
| 고유명사 제외 | -1,963개 |
| 기능어 제외 | -27개 |
| **최종 단어** | **6,650개** |
| 예문 (구절) | 23,145개 |

## Quick Start

```bash
# 1. Strong's 사전 클론 (최초 1회)
git clone https://github.com/openscriptures/strongs.git pipeline/source-data/strongs

# 2. 히브리어 성경 파일 배치
cp Hebrew_Bible.json pipeline/source-data/

# 3. 파이프라인 실행
cd pipeline/scripts
python3 hebrew_pipeline.py      # Step 1: 추출 및 매핑
python3 hebrew_add_korean.py    # Step 2: 한글 번역 (API 필요)
python3 hebrew_add_ipa.py       # Step 3: IPA 변환

# 4. 결과 확인
ls -la ../output/hebrew/
```

## Troubleshooting

### API Timeout 에러

```bash
# timeout 설정 늘리기 (hebrew_add_korean.py)
API_TIMEOUT = 300  # 5분

# 실패한 단어만 재시도
python3 hebrew_add_korean.py --retry
```

### 번역 누락

```bash
# 현재 번역 상태 확인
python3 -c "
import json
with open('../output/hebrew/final_vocabulary_hebrew.json') as f:
    data = json.load(f)
translated = sum(1 for w in data['words'] if w.get('definition_korean'))
print(f'번역 완료: {translated}/{len(data[\"words\"])}')
"
```

## Related Files

- `pipeline/configs/hebrew.json` - 설정 파일
- `pipeline/scripts/hebrew_pipeline.py` - 메인 파이프라인
- `pipeline/scripts/hebrew_add_korean.py` - 한글 번역
- `pipeline/scripts/hebrew_add_ipa.py` - IPA 변환
