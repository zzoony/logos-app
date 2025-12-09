# Vocabulary Pipeline 코드 아키텍처

이 문서는 vocabulary 파이프라인의 코드 구조와 각 모듈의 역할을 설명합니다.

## 디렉토리 구조

```
pipeline/vocabulary/
├── run_pipeline.py          # 파이프라인 실행 진입점
├── configs/                  # 버전별 설정 파일
│   ├── niv.json
│   ├── esv.json
│   ├── kjv.json
│   ├── easy.json
│   └── hebrew.json
├── scripts/                  # 핵심 처리 스크립트
│   ├── config.py             # 설정 관리
│   ├── utils.py              # 공통 유틸리티
│   ├── word_forms.py         # 영어 형태론 (불규칙 동사 등)
│   ├── llm_client.py         # LLM API/CLI 클라이언트
│   ├── extract_words.py      # Step 1: 단어 추출
│   ├── filter_stopwords.py   # Step 2: 불용어 필터링
│   ├── filter_proper_nouns.py # Step 3: 고유명사 필터링
│   ├── finalize.py           # Step 4: 최종 정리
│   ├── extract_sentences.py  # Step 5: 예문 추출
│   └── add_definitions.py    # Step 6: 정의 추가
├── data/                     # 버전별 데이터 파일
│   ├── niv/
│   ├── esv/
│   ├── kjv/
│   ├── easy/
│   └── common/
└── output/                   # 처리 결과
    ├── niv/
    ├── esv/
    ├── kjv/
    ├── easy/
    └── hebrew/
```

## 파이프라인 실행 흐름

```
[run_pipeline.py]
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: extract_words.py                                   │
│  - 성경 JSON에서 단어 추출                                   │
│  - 텍스트 정제 (특수문자, 소유격 제거)                        │
│  - 표제어화 (lemmatization)                                 │
│  - 출력: step1_raw_words.json                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: filter_stopwords.py                                │
│  - 불용어 (the, a, is 등) 제거                              │
│  - 버전별 stopwords.txt 사용                                 │
│  - 출력: step2_filtered_stopwords.json                      │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: filter_proper_nouns.py                             │
│  - 고유명사 (인명, 지명) 제거                                │
│  - 대문자로 시작하는 단어 분석                               │
│  - protected_words.txt로 보호할 단어 지정                    │
│  - 출력: step3_filtered_proper_nouns.json                   │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: finalize.py                                        │
│  - 최소 길이/빈도 필터 적용                                  │
│  - 빈도순 순위 부여                                         │
│  - 출력: step4_vocabulary.json                              │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (--with-sentences 옵션 시)
┌─────────────────────────────────────────────────────────────┐
│  Step 5: extract_sentences.py                               │
│  - 각 단어가 포함된 성경 구절 검색                           │
│  - 역색인 구축으로 빠른 검색                                 │
│  - 다양한 책에서 예문 선택                                   │
│  - 출력: step5_vocabulary_with_sentences.json               │
│         step5_sentences.json                                │
└─────────────────────────────────────────────────────────────┘
    │
    ▼ (별도 실행)
┌─────────────────────────────────────────────────────────────┐
│  Step 6: add_definitions.py                                 │
│  - LLM으로 발음/한국어 정의 생성                             │
│  - 병렬 처리로 속도 향상                                     │
│  - 출력: final_vocabulary_{version}.json                    │
└─────────────────────────────────────────────────────────────┘
```

## 핵심 모듈 설명

### config.py - 설정 관리

버전별 설정을 로드하고 경로를 관리합니다.

```python
# 환경 변수로 버전 지정
VERSION = os.environ.get("BIBLE_VERSION", "niv")

# 버전별 설정 로드 (configs/{version}.json)
_config = load_version_config(VERSION)

# 주요 경로 변수
BIBLE_JSON_PATH      # 원본 성경 JSON
VERSION_OUTPUT_DIR   # 버전별 출력 디렉토리
STOPWORDS_PATH       # 불용어 파일
```

### word_forms.py - 영어 형태론

불규칙 동사와 단어 변형을 관리합니다.

```python
# 불규칙 동사 데이터
IRREGULAR_VERBS = {
    "be": ["was", "were", "been", ...],
    "go": ["goes", "went", "gone", ...],
    ...
}

# 주요 함수
get_base_form(word)      # 활용형 → 기본형 (rode → ride)
get_word_variants(word)  # 기본형 → 모든 활용형 (ride → rides, rode, ...)
```

### llm_client.py - LLM 클라이언트

정의 생성을 위한 LLM 호출을 추상화합니다.

```python
# 지원 백엔드
# 1. droid CLI (기본)
# 2. claude CLI
# 3. Z.AI API

# 설정
configure(use_api=False, cli_tool="droid", model="glm-4.6")

# 사용
definitions = generate_definitions(["word1", "word2", ...])
```

### utils.py - 공통 유틸리티

```python
log(message, level)       # 타임스탬프 로그
load_json(path)           # JSON 로드
save_json(path, data)     # JSON 저장
load_text_list(path)      # 텍스트 파일 → set
```

## 버전별 설정 파일 형식

`configs/{version}.json`:

```json
{
  "name": "New International Version",
  "language": "en",
  "source_file": "NIV_Bible.json",
  "data_dir": "niv",
  "stopwords_file": "stopwords.txt",
  "protected_words_file": "protected_words.txt",
  "proper_nouns_file": "proper_nouns.txt",
  "min_word_length": 2,
  "min_frequency": 1
}
```

## 실행 방법

### 기본 실행 (Step 1-4)

```bash
cd pipeline/vocabulary
python run_pipeline.py --version niv
```

### 예문 포함 (Step 1-5)

```bash
python run_pipeline.py --version niv --with-sentences
```

### 정의 추가 (Step 6)

```bash
cd scripts
python add_definitions.py              # droid CLI 사용
python add_definitions.py --api        # Z.AI API 사용
python add_definitions.py --cli claude # claude CLI 사용
python add_definitions.py --test 10    # 테스트 (10개만)
```

### 모든 버전 처리

```bash
for v in niv esv kjv easy; do
  python run_pipeline.py --version $v --with-sentences
done
```

## 출력 파일 형식

### step4_vocabulary.json

```json
{
  "metadata": {
    "source": "New International Version",
    "total_unique_words": 5000,
    "filters_applied": ["stopwords", "proper_nouns", ...]
  },
  "words": [
    {"word": "lord", "count": 7000, "rank": 1},
    {"word": "god", "count": 4500, "rank": 2},
    ...
  ]
}
```

### final_vocabulary_{version}.json

```json
{
  "metadata": {
    "source": "New International Version",
    "definitions_added": true,
    "definitions_count": 4800
  },
  "words": [
    {
      "id": 0,
      "word": "lord",
      "count": 7000,
      "rank": 1,
      "ipa_pronunciation": "[lɔːrd]",
      "korean_pronunciation": "로드",
      "definition_korean": "주님, 영주",
      "sentence_ids": ["genesis-1-1", "genesis-1-2"]
    },
    ...
  ]
}
```

## 데이터 흐름도

```
source-data/NIV_Bible.json
         │
         ▼
    [extract_words]
         │
         ▼
  data/niv/stopwords.txt ──► [filter_stopwords]
                                    │
                                    ▼
  data/niv/proper_nouns.txt ──► [filter_proper_nouns]
  data/niv/protected_words.txt      │
                                    ▼
                             [finalize]
                                    │
                                    ▼
                           [extract_sentences]
                                    │
                                    ▼
                           [add_definitions]
                                    │
                                    ▼
                    output/niv/final_vocabulary_niv.json
```

## 확장 가이드

### 새 성경 버전 추가

1. `source-data/`에 JSON 파일 추가
2. `configs/`에 설정 파일 생성
3. `data/{version}/`에 불용어/고유명사 파일 추가
4. 파이프라인 실행

### 새 필터 단계 추가

1. `scripts/`에 새 스크립트 생성
2. `run_pipeline.py`의 steps 목록에 추가
3. config.py에 필요한 경로 추가
