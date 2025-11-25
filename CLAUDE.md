# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NIV 성경 텍스트에서 단어를 추출하여 영어 단어장 앱을 만드는 프로젝트.
- **Phase 1**: pipeline/ - 데이터 추출 및 정제
- **Phase 2**: app/ - 단어장 앱 (추후 개발)

## Commands

### Run Pipeline
```bash
cd pipeline
pip install -r requirements.txt
python run_pipeline.py
```

### Run Individual Steps
```bash
cd pipeline/scripts
python extract_words.py        # Step 1: 단어 추출 + Lemmatization
python filter_stopwords.py     # Step 2: 불용어 제거
python filter_proper_nouns.py  # Step 3: 고유명사 제거
python finalize.py             # Step 4: 최종 처리
```

## Architecture

### Pipeline Structure
```
pipeline/
├── run_pipeline.py          # 파이프라인 실행 진입점
├── requirements.txt         # Python 의존성
├── scripts/                 # 처리 스크립트
│   ├── config.py            # 경로 및 설정
│   ├── extract_words.py     # Step 1
│   ├── filter_stopwords.py  # Step 2
│   ├── filter_proper_nouns.py # Step 3
│   └── finalize.py          # Step 4
├── source-data/             # 원본 성경 데이터
├── data/                    # 필터링용 참조 데이터
└── output/                  # 처리 결과물 (gitignore)
```

### Data Pipeline (4단계)
1. **extract_words.py** → `output/raw_words.json`
   - 단어 추출, Lemmatization (sons→son), 빈도수 카운트

2. **filter_stopwords.py** → `output/filtered_stopwords.json`
   - 관사, 대명사, 전치사, 접속사 등 불용어 제거

3. **filter_proper_nouns.py** → `output/filtered_proper_nouns.json`
   - 고유명사 제거 (인명, 지명)
   - 보호 목록: lord, god, king, son 등 119개

4. **finalize.py** → `output/bible_vocabulary.json`
   - 최소 길이/빈도 필터, 순위 부여

### Configuration (scripts/config.py)
- `MIN_WORD_LENGTH`: 최소 단어 길이 (기본: 2)
- `MIN_FREQUENCY`: 최소 출현 빈도 (기본: 2)

### Input Data (source-data/)
`NIV_Bible.json` 구조: `{Book: {Chapter: {Verse: "text"}}}`
- 다른 성경 버전 추가 시 이 폴더에 배치

### Output Format
```json
{
  "metadata": { "source": "NIV Bible", "total_unique_words": 4534, ... },
  "words": [{ "word": "lord", "count": 7864, "rank": 1 }, ...]
}
```
