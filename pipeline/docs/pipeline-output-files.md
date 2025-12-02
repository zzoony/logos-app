# Pipeline Output Files

파이프라인 실행 결과로 생성되는 파일들에 대한 설명입니다.

## 디렉토리 구조

```
pipeline/
├── configs/
│   └── {version}.json          # 버전별 설정 파일
├── data/
│   ├── common/
│   │   └── bible_proper_nouns.txt  # 공통 고유명사 목록 (참조용)
│   └── {version}/
│       ├── stopwords.txt          # 버전별 불용어
│       ├── protected_words.txt    # 버전별 보호단어
│       └── proper_nouns.txt       # 버전별 고유명사
├── output/
│   └── {version}/                 # 버전별 출력 폴더
│       ├── step1_raw_words.json
│       ├── step2_filtered_stopwords.json
│       ├── step3_filtered_proper_nouns.json
│       ├── step4_vocabulary.json
│       ├── step5_vocabulary_with_sentences.json
│       ├── step5_sentences.json
│       ├── final_vocabulary.json        # 발음/뜻 포함 최종 단어장
│       └── final_sentences_korean.json  # 예문 + 한글 번역
└── source-data/
    └── {VERSION}_Bible.json       # 원본 성경 데이터
```

## 파이프라인 흐름

```
{VERSION}_Bible.json (예: NIV_Bible.json)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: extract_words.py                                    │
│ - 성경 텍스트에서 단어 추출                                    │
│ - 유니코드 정규화 (따옴표, em dash 등)                         │
│ - 소유격/축약형 제거 (king's → king, don't → dont)            │
│ - Lemmatization 적용 (sons → son, walked → walk)            │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/step1_raw_words.json (9,641 words)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: filter_stopwords.py                                 │
│ - 불용어(stopwords) 제거                                     │
│ - data/{version}/stopwords.txt 파일 사용                     │
│ - 관사, 대명사, 전치사, 접속사, be/have/do 동사 등            │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/step2_filtered_stopwords.json (9,471 words)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: filter_proper_nouns.py                              │
│ - 고유명사 제거 (인명, 지명)                                  │
│ - data/{version}/proper_nouns.txt + 대문자 패턴 분석         │
│ - data/{version}/protected_words.txt로 보호단어 유지         │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/step3_filtered_proper_nouns.json (6,625 words)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: finalize.py                                         │
│ - 숫자만 있는 항목 제거                                       │
│ - 2글자 미만 단어 제거                                        │
│ - 빈도 2회 미만 단어 제거                                     │
│ - 빈도순 정렬 및 순위(rank) 부여                              │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/step4_vocabulary.json (4,930 words)
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: extract_sentences.py (선택사항)                      │
│ - 각 단어에 대한 예문 추출 (2-5개)                            │
│ - 다양한 성경 책에서 추출하여 다양성 확보                      │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/step5_sentences.json
   output/{version}/step5_vocabulary_with_sentences.json
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: add_definitions.py                                  │
│ - Claude Haiku를 이용한 발음/뜻 자동 생성                     │
│ - IPA 발음기호, 한글 발음, 한국어 뜻 추가                      │
│ - 배치 처리 (50개/요청) + 병렬 처리 (10개 동시)               │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/final_vocabulary.json ← 최종 단어장
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 7: validate_definitions.py (검증)                      │
│ - IPA 발음기호 형식 검증                                      │
│ - 한글 발음 검증 (원어 혼입 감지)                             │
│ - 한국어 뜻 검증                                             │
│ - Free Dictionary API로 IPA 정확도 샘플 검증 (선택)          │
└─────────────────────────────────────────────────────────────┘
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 8: translate_sentences.py                              │
│ - Claude Haiku를 이용한 예문 한글 번역                        │
│ - 배치 처리 + 병렬 처리                                       │
└─────────────────────────────────────────────────────────────┘
      ↓
   output/{version}/final_sentences_korean.json ← 최종 예문
      ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 9: validate_translations.py (검증)                     │
│ - 빈 번역 검출                                               │
│ - 영어 단어 포함 여부                                        │
│ - 참조 패턴 포함 여부 (예: "(창세기 1:1)")                    │
│ - 길이 비율 이상 검출                                        │
└─────────────────────────────────────────────────────────────┘
```

## 사용법

```bash
# 기본 실행 (NIV)
python3 run_pipeline.py

# 버전 지정
python3 run_pipeline.py --version niv
python3 run_pipeline.py --version esv

# 문장 추출 포함
python3 run_pipeline.py --version niv --with-sentences

# 발음/뜻 생성 (Step 6)
cd pipeline/scripts
python3 add_definitions.py                    # 전체 실행
python3 add_definitions.py --test 100         # 테스트 (100개만)

# 검증 (Step 7)
python3 validate_definitions.py               # 기본 검증 (API 샘플 50개)
python3 validate_definitions.py --api-sample 0   # API 검증 없이 빠른 검증
python3 validate_definitions.py --api-sample 100 # API 샘플 100개로 검증

# 예문 번역 (Step 8)
python3 translate_sentences.py                # 전체 실행
python3 translate_sentences.py --test 100     # 테스트 (100개만)

# 번역 검증 (Step 9)
python3 validate_translations.py              # 번역 품질 검증
python3 validate_translations.py --fix        # 참조 패턴 자동 수정

# 번역 재시도 (실패분)
python3 retry_missing_translations.py         # 실패한 번역 재시도
```

## 파일 설명

### 1. `step1_raw_words.json`
- **생성**: `extract_words.py`
- **내용**: 성경에서 추출한 모든 단어 (lemmatization 적용 후)
- **용도**: 원본 추출 결과 확인, 디버깅

### 2. `step2_filtered_stopwords.json`
- **생성**: `filter_stopwords.py`
- **내용**: 불용어 제거 후 남은 단어
- **제거 대상**: a, an, the, is, are, was, I, you, he, in, on, to, and, or, but 등

### 3. `step3_filtered_proper_nouns.json`
- **생성**: `filter_proper_nouns.py`
- **내용**: 고유명사 제거 후 남은 단어
- **제거 대상**: Israel, Jesus, David, Moses, Jerusalem, Egypt 등
- **보호 대상**: lord, god, king, son, father, temple, covenant 등

### 4. `step4_vocabulary.json`
- **생성**: `finalize.py`
- **내용**: 기본 단어장 데이터
- **특징**: 빈도순 정렬, 순위(rank) 포함

### 5. `step5_sentences.json`
- **생성**: `extract_sentences.py`
- **내용**: 예문으로 사용할 성경 구절들
- **구조**: sentence_id → {text, ref, book, chapter, verse}

### 6. `step5_vocabulary_with_sentences.json`
- **생성**: `extract_sentences.py`
- **내용**: 단어장 + 예문 ID 매핑

### 7. `final_vocabulary.json` (최종 단어장)
- **생성**: `add_definitions.py`
- **내용**: 발음기호, 한글 발음, 한국어 뜻이 포함된 최종 단어장

### 8. `final_sentences_korean.json` (최종 예문)
- **생성**: `translate_sentences.py`
- **내용**: 영어 예문 + 한글 번역

#### final_vocabulary.json 형식
```json
{
  "metadata": {
    "source": "New International Version",
    "total_unique_words": 4930,
    "definitions_added": true
  },
  "words": [
    {
      "word": "lord",
      "count": 7864,
      "rank": 1,
      "sentence_ids": ["psalms-18-1", "..."],
      "ipa_pronunciation": "[lɔːrd]",
      "korean_pronunciation": "로드",
      "definition_korean": "주인, 영주, 주님"
    }
  ]
}
```

#### final_sentences_korean.json 형식
```json
{
  "metadata": {
    "source": "New International Version",
    "total_sentences": 15177,
    "korean_translations_added": true
  },
  "sentences": {
    "psalms-18-1": {
      "text": "I love you, LORD, my strength.",
      "ref": "Psalms 18:1",
      "book": "Psalms",
      "chapter": 18,
      "verse": 1,
      "korean": "여호와 나의 힘이여 내가 주를 사랑하나이다."
    }
  }
}
```

## 검증 (validate_definitions.py)

발음과 뜻 생성 후 품질을 검증합니다.

### 검증 항목

| 항목 | 설명 |
|------|------|
| **IPA 형식** | `[` 또는 `/`로 시작하는지, 원어(히브리어/그리스어) 혼입 여부 |
| **한글 발음** | 영어/특수문자 혼입 여부, 원어 패턴 감지 |
| **한국어 뜻** | 비어있거나 너무 짧은지 |
| **API 검증** | Free Dictionary API로 IPA 정확도 샘플 검증 |

### 검증 출력 예시

```
============================================================
VALIDATION REPORT
============================================================

Total words: 4930

--- Summary ---
IPA issues: 0
Korean pronunciation issues: 0
Definition issues: 0
Empty fields: 0
API mismatches: 2

============================================================
✅ All validations passed!
============================================================
```

## 단어 수 변화 (NIV 기준)

| 단계 | 파일 | 단어 수 | 변화 |
|------|------|---------|------|
| Step 1 | step1_raw_words.json | 9,641 | - |
| Step 2 | step2_filtered_stopwords.json | 9,471 | -170 |
| Step 3 | step3_filtered_proper_nouns.json | 6,625 | -2,846 |
| Step 4 | step4_vocabulary.json | 4,930 | -1,695 |
| Step 5 | step5_sentences.json | 15,177 예문 | - |
| Step 6 | final_vocabulary.json | 4,930 | +발음/뜻 |
| Step 8 | final_sentences_korean.json | 15,177 | +한글 번역 |

## 설정 파일

### `configs/{version}.json`

```json
{
  "version": "niv",
  "name": "New International Version",
  "language": "en",
  "source_file": "NIV_Bible.json",
  "data_dir": "niv",
  "stopwords_file": "stopwords.txt",
  "protected_words_file": "protected_words.txt",
  "proper_nouns_file": "proper_nouns.txt",
  "min_word_length": 2,
  "min_frequency": 2
}
```

## 참고

- `output/` 폴더는 `.gitignore`에 포함되어 GitHub에 업로드되지 않습니다.
- 파이프라인을 다시 실행하면 파일들이 덮어씌워집니다.
- 중간 파일들은 디버깅 및 검증 목적으로 유지됩니다.
- 새 버전 추가 시: `configs/{version}.json`과 `data/{version}/` 폴더 생성 필요
- 발음/뜻 생성 후에는 반드시 `validate_definitions.py`로 검증하세요.
