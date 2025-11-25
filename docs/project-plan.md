# Bible Vocabulary Project Plan

## 1. 프로젝트 개요

### 목표
NIV 성경에서 단어를 추출하여 성경 기반 영어 단어장 앱을 개발한다.

### 범위
- **Phase 1**: 데이터 파이프라인 구축 (단어 추출 및 정제)
- **Phase 2**: 단어장 앱 개발

---

## 2. Phase 1: 데이터 파이프라인

### 2.1 입력 데이터 분석

**NIV_Bible.json 구조:**
```json
{
  "Genesis": {
    "1": {
      "1": "In the beginning God created the heavens and the earth.",
      "2": "Now the earth was formless..."
    }
  }
}
```

- 계층: Book > Chapter > Verse > Text
- 특수문자: 유니코드 따옴표(" "), em dash(—), 줄바꿈(\n)

### 2.2 단어 추출 단계

#### Step 1: Raw Word Extraction
```
입력: NIV_Bible.json
처리:
  1. 모든 verse 텍스트 순회
  2. 특수문자 및 구두점 제거
  3. 소문자 변환
  4. 단어 분리 (whitespace 기준)
  5. 빈도수 카운트
출력: raw_words.json
```

#### Step 2: Stopword Filtering
```
입력: raw_words.json
처리:
  1. 영어 불용어(stopwords) 제거
     - 관사: a, an, the
     - be 동사: is, am, are, was, were, be, been, being
     - 조동사: will, would, shall, should, can, could, may, might
     - 대명사: I, you, he, she, it, we, they, me, him, her, us, them
     - 전치사: in, on, at, to, for, of, with, by, from
     - 접속사: and, or, but, if, because, as, when, while
     - 기타: this, that, these, those, what, which, who, whom
출력: filtered_stopwords.json
```

#### Step 3: Proper Noun Filtering
```
입력: filtered_stopwords.json + NIV_Bible.json (원본 참조)
처리:
  1. 원본에서 대문자로 시작하는 패턴 분석
  2. 문장 시작이 아닌 위치에서 대문자로 등장하는 단어 = 고유명사 후보
  3. 성경 인명/지명 목록과 대조 (외부 데이터 활용)
     - 인명: Adam, Eve, Abraham, Moses, David, Jesus, Paul...
     - 지명: Eden, Egypt, Israel, Jerusalem, Babylon...
  4. NER(Named Entity Recognition) 라이브러리 활용 가능
출력: filtered_proper_nouns.json
```

#### Step 4: Final Processing
```
입력: filtered_proper_nouns.json
처리:
  1. 숫자만 있는 항목 제거
  2. 1-2글자 단어 제거 (선택적)
  3. 빈도수 기준 정렬
  4. 빈도 순위(rank) 부여
출력: bible_vocabulary.json
```

### 2.3 최종 출력 형식

```json
{
  "metadata": {
    "source": "NIV Bible",
    "extraction_date": "2025-01-01",
    "total_verses_processed": 31102,
    "total_unique_words": 8500,
    "filters_applied": [
      "stopwords",
      "proper_nouns",
      "numbers"
    ]
  },
  "words": [
    {
      "word": "lord",
      "count": 7365,
      "rank": 1
    },
    {
      "word": "god",
      "count": 4447,
      "rank": 2
    },
    {
      "word": "love",
      "count": 551,
      "rank": 50
    }
  ]
}
```

### 2.4 기술 스택

| 구성요소 | 기술 | 이유 |
|---------|------|------|
| 언어 | Python 3.11+ | 데이터 처리, NLP 라이브러리 풍부 |
| NLP | NLTK / spaCy | Stopwords, NER |
| 데이터 | JSON | 입출력 형식 통일 |

### 2.5 파이프라인 구조

```
pipeline/
├── extract_words.py      # Step 1: 단어 추출
├── filter_stopwords.py   # Step 2: 불용어 제거
├── filter_proper_nouns.py # Step 3: 고유명사 제거
├── finalize.py           # Step 4: 최종 처리
├── run_pipeline.py       # 전체 파이프라인 실행
├── config.py             # 설정 (경로, 옵션)
├── data/
│   └── bible_proper_nouns.txt  # 성경 고유명사 목록
└── output/
    ├── raw_words.json
    ├── filtered_stopwords.json
    ├── filtered_proper_nouns.json
    └── bible_vocabulary.json
```

---

## 3. Phase 2: 단어장 앱 (추후 계획)

### 예상 기능
- 단어 목록 표시 (빈도순, 알파벳순)
- 단어 검색
- 플래시카드 학습
- 퀴즈 기능
- 학습 진도 추적

### 기술 스택 후보
- **Web**: React / Next.js
- **Mobile**: React Native / Flutter
- **Backend**: Node.js / Python FastAPI

---

## 4. 작업 체크리스트

### Phase 1: Pipeline

- [ ] Python 환경 설정 (requirements.txt)
- [ ] extract_words.py 구현
- [ ] filter_stopwords.py 구현
- [ ] filter_proper_nouns.py 구현
- [ ] 성경 고유명사 목록 수집
- [ ] finalize.py 구현
- [ ] run_pipeline.py 구현
- [ ] 테스트 및 검증
- [ ] 결과물 리뷰 및 수동 검수

### Phase 2: App

- [ ] 앱 기술 스택 결정
- [ ] UI/UX 설계
- [ ] 개발 및 테스트
- [ ] 배포

---

## 5. 고려사항 및 결정 필요 항목

### 고유명사 처리
1. **자동 필터링**: NER 라이브러리 사용 (정확도 ~85%)
2. **수동 필터링**: 성경 고유명사 목록 직접 관리
3. **하이브리드**: 자동 + 수동 검수

**권장**: 하이브리드 방식

### 단어 형태 처리
- **Lemmatization**: loving, loved, loves → love
- **장점**: 단어 수 감소, 학습 효율 증가
- **단점**: 원형 복원 오류 가능성

**권장**: 일단 원형 그대로 추출 후, 필요시 lemmatization 추가

### 최소 빈도 기준
- 1회만 등장하는 단어 포함 여부
- **권장**: 2회 이상 등장 단어만 포함 (노이즈 제거)

---

## 6. 예상 결과물

| 항목 | 예상 수치 |
|------|----------|
| 총 단어 수 (중복 포함) | ~800,000 |
| 고유 단어 수 (필터링 전) | ~15,000 |
| 고유 단어 수 (필터링 후) | ~6,000-8,000 |
| 가장 많이 등장하는 단어 | lord, god, said, people |
