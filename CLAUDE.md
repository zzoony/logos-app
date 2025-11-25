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
cd pipeline
python extract_words.py        # Step 1: 단어 추출
python filter_stopwords.py     # Step 2: 불용어 제거
python filter_proper_nouns.py  # Step 3: 고유명사 제거
python finalize.py             # Step 4: 최종 처리
```

## Architecture

### Data Pipeline (pipeline/)
4단계 순차 처리 파이프라인:

1. **extract_words.py** → `output/raw_words.json`
   - NIV_Bible.json에서 단어 추출, 소문자 변환, 빈도수 카운트

2. **filter_stopwords.py** → `output/filtered_stopwords.json`
   - 관사, 대명사, 전치사, 접속사 등 불용어 제거

3. **filter_proper_nouns.py** → `output/filtered_proper_nouns.json`
   - 문장 중간 대문자 패턴 분석 + `data/bible_proper_nouns.txt` 목록 활용

4. **finalize.py** → `output/bible_vocabulary.json`
   - 최소 길이/빈도 필터, 순위 부여

### Configuration (pipeline/config.py)
- `MIN_WORD_LENGTH`: 최소 단어 길이 (기본: 2)
- `MIN_FREQUENCY`: 최소 출현 빈도 (기본: 2)
- 모든 경로 상수 정의

### Input Data (pipeline/source-data/)
`NIV_Bible.json` 구조: `{Book: {Chapter: {Verse: "text"}}}`
- 유니코드 따옴표(" "), em dash(—) 등 특수문자 포함
- 다른 성경 버전 추가 시 이 폴더에 배치

### Output Format
```json
{
  "metadata": { "source": "NIV Bible", "total_unique_words": 8000, ... },
  "words": [{ "word": "lord", "count": 7365, "rank": 1 }, ...]
}
```
