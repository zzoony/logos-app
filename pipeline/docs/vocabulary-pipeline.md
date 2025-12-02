# Vocabulary Pipeline

성경 텍스트에서 단어를 추출하고 정의/발음을 추가하는 파이프라인.

## Quick Start

```bash
cd pipeline/vocabulary
pip install -r requirements.txt
python run_pipeline.py                    # 기본 실행 (NIV)
python run_pipeline.py --version niv      # 버전 지정
python run_pipeline.py --with-sentences   # 예문 추출 포함 (Step 5)
```

## Pipeline Steps (9단계)

| Step | Script | Output | 설명 |
|------|--------|--------|------|
| 1 | extract_words.py | step1_raw_words.json | 단어 추출, Lemmatization |
| 2 | filter_stopwords.py | step2_filtered_stopwords.json | 불용어 제거 |
| 3 | filter_proper_nouns.py | step3_filtered_proper_nouns.json | 고유명사 제거 |
| 4 | finalize.py | step4_vocabulary.json | 최소 길이/빈도 필터, 순위 부여 |
| 5 | extract_sentences.py | step5_vocabulary_with_sentences.json, step5_sentences.json | 예문 추출 |
| 6 | add_definitions.py | final_vocabulary.json | 발음/뜻 생성 (Z.AI SDK) |
| 7 | validate_definitions.py | - | 단어 정의 검증 |
| 8 | translate_sentences.py | final_sentences_korean.json | 예문 한글 번역 (Korean_Bible.json) |
| 9 | validate_translations.py | - | 번역 품질 검증 |

## Commands

### Run Individual Steps
```bash
cd pipeline/vocabulary/scripts
python extract_words.py        # Step 1: 단어 추출 + Lemmatization
python filter_stopwords.py     # Step 2: 불용어 제거
python filter_proper_nouns.py  # Step 3: 고유명사 제거
python finalize.py             # Step 4: 최종 처리
python extract_sentences.py    # Step 5: 예문 추출 (선택)
```

### Add Definitions (Step 6)

3가지 모드 지원: **API (기본)**, **Claude CLI**, **droid exec**

#### 모드 1: Z.AI API (기본, 권장)
```bash
# SDK 설치
pip install zai-sdk==0.0.4.3

# 환경 변수 설정
cd pipeline/vocabulary
cp .env.example .env
# .env 파일 편집:
# ZAI_API_KEY=your_api_key_here
# ZAI_API_BASE=https://api.z.ai/api/coding/paas/v4
# ZAI_MODEL=glm-4.6

# 실행 (기본 모드)
cd scripts
python add_definitions.py                    # 전체 실행
python add_definitions.py --test 100         # 테스트 (100개만)
python add_definitions.py --retry            # 실패한 단어만 재시도
```
- **API 키 발급**: https://z.ai/manage-apikey
- **Rate Limits**: 동시 5개 요청 제한

#### 모드 2: Claude CLI
```bash
python add_definitions.py --cli claude                        # 기본 모델
python add_definitions.py --cli claude --model claude-3-opus  # 모델 지정
```
- **요구사항**: claude CLI 설치 필요

#### 모드 3: droid exec
```bash
python add_definitions.py --cli droid                         # 기본 모델 (Claude Opus)
python add_definitions.py --cli droid --model glm-4.6         # GLM-4.6 사용
```
- **요구사항**: droid CLI 설치 필요 (https://docs.factory.ai/cli)
- **참고**: `--skip-permissions-unsafe` 옵션 자동 적용

#### 성능 비교

| 모드 | 60단어 처리 시간 | 비고 |
|------|-----------------|------|
| Z.AI API | ~8초 | 5개 병렬, thinking 비활성화 |
| droid exec | ~97초 | 20개 병렬 테스트 기준 |
| Claude CLI | ~60초 | 10개 병렬 |

**권장**: API 모드가 가장 빠르고 효율적 (약 10배 빠름)

### Validate Definitions (Step 7)
```bash
cd pipeline/vocabulary/scripts
python validate_definitions.py                # 기본 검증 (API 샘플 50개)
python validate_definitions.py --api-sample 0 # API 검증 없이 빠른 검증
```

### Translate Sentences (Step 8)
```bash
cd pipeline/vocabulary/scripts
python translate_sentences.py              # 전체 실행
python translate_sentences.py --test 100   # 테스트 (100개만)
```
- **데이터 소스**: `source-data/Korean_Bible.json`에서 한글 번역 매핑
- **처리 방식**: 영어 성경 구절 참조(예: "Psalms 18:1")를 파싱하여 한글 성경에서 해당 구절 조회

### Validate Translations (Step 9)
```bash
cd pipeline/vocabulary/scripts
python validate_translations.py            # 번역 품질 검증
python validate_translations.py --fix      # 참조 패턴 자동 수정
```
**검증 항목**: 빈 번역, 영어 단어 포함, 참조 패턴 포함 (예: "(창세기 1:1)"), 길이 비율 이상

### Retry Missing Translations
```bash
cd pipeline/vocabulary/scripts
python retry_missing_translations.py       # 실패한 번역 재시도 (최대 3회)
```

## Configuration

### scripts/config.py
- `VERSION`: 처리할 성경 버전 (기본: "niv")
- `MIN_WORD_LENGTH`: 최소 단어 길이 (기본: 2)
- `MIN_FREQUENCY`: 최소 출현 빈도 (기본: 1, 1회 등장 단어도 포함)

### scripts/extract_sentences.py
- `MIN_SENTENCES_PER_WORD`: 최소 예문 수 (기본: 1)
- `MAX_SENTENCES_PER_WORD`: 최대 예문 수 (기본: 5)
- `MAX_SENTENCE_LENGTH`: 최대 문장 길이 (기본: 300)
- `MIN_SENTENCE_LENGTH`: 최소 문장 길이 (기본: 30)

### data/{version}/stopwords.txt 구조
- **기본 불용어**: 관사, 대명사, 전치사, 접속사 등
- **축약형**: lemmatization으로 생성된 축약형 (dont, didnt 등)
- **Lemmatization artifacts**: 성경에 없는 lemma (fulfil, appal 등)
- **Wrong lemmas**: 잘못된 lemma (hat→hated 오류, jam→James 오류 등)

### configs/{version}.json
```json
{
  "version": "niv",
  "name": "New International Version",
  "source_file": "NIV_Bible.json",
  "min_word_length": 2,
  "min_frequency": 1
}
```

## Input/Output Format

### Input: source-data/{VERSION}_Bible.json
```json
{
  "Book": {
    "Chapter": {
      "Verse": "text"
    }
  }
}
```

### Output: final_vocabulary.json
```json
{
  "metadata": {
    "source": "New International Version",
    "total_unique_words": 4868,
    "definitions_added": true
  },
  "words": [
    {
      "word": "lord",
      "count": 7864,
      "rank": 1,
      "sentence_ids": ["psalms-18-1"],
      "ipa_pronunciation": "[lɔːrd]",
      "korean_pronunciation": "로드",
      "definition_korean": "주인, 영주, 주님"
    }
  ]
}
```

### Output: final_sentences_korean.json
```json
{
  "metadata": {
    "source": "New International Version",
    "total_sentences": 16224,
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

## Adding New Bible Version

1. `pipeline/source-data/{VERSION}_Bible.json` 추가
2. `pipeline/vocabulary/configs/{version}.json` 설정 파일 생성
3. `pipeline/vocabulary/data/{version}/` 폴더 생성 (stopwords.txt, protected_words.txt, proper_nouns.txt)
4. `python run_pipeline.py --version {version}` 실행
