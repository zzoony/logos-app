# Sentence Pipeline 코드 아키텍처

이 문서는 sentence 파이프라인의 코드 구조와 각 모듈의 역할을 설명합니다.

## 개요

Sentence 파이프라인은 성경 구절을 분석하여 영어 학습자를 위한 짧은 구문(clause)으로 분리하고 한국어 번역을 제공하는 Electron 기반 데스크톱 앱입니다.

## 디렉토리 구조

```text
pipeline/sentence/
├── package.json              # 프로젝트 설정 및 의존성
├── src/                      # 소스 코드
│   ├── main.js               # Electron 메인 프로세스
│   ├── preload.js            # IPC 브릿지
│   ├── renderer.js           # UI 컨트롤러
│   ├── index.html            # UI 레이아웃
│   ├── styles.css            # 다크모드 스타일
│   ├── analyzer.js           # 구절 분석 로직
│   ├── validator.js          # 분석 결과 검증
│   ├── config.js             # 분석 설정
│   ├── utils.js              # 공통 유틸리티
│   └── constants.js          # 상수 정의
└── output/                   # 분석 결과
    ├── esv/
    │   ├── Genesis/
    │   ├── Exodus/
    │   └── ...
    └── niv/
        └── ...
```

## 모듈 구조

```text
┌─────────────────────────────────────────────────────────────┐
│                    Electron App                              │
├─────────────────────────────────────────────────────────────┤
│  main.js (Main Process)                                      │
│  ├── IPC 핸들러                                              │
│  ├── 파일 시스템 접근                                         │
│  └── analyzer.js / validator.js 호출                         │
├─────────────────────────────────────────────────────────────┤
│  preload.js (IPC Bridge)                                     │
│  └── electronAPI 노출                                        │
├─────────────────────────────────────────────────────────────┤
│  renderer.js (Renderer Process)                              │
│  ├── UI 이벤트 처리                                          │
│  ├── 탭/필터/카드 관리                                        │
│  └── 분석/검증 결과 표시                                      │
└─────────────────────────────────────────────────────────────┘
```

## 핵심 모듈 설명

### constants.js - 상수 정의

경로, 성경 버전 매핑, 책 이름 등 공통 상수를 정의합니다.

```javascript
// 경로 설정
const PATHS = {
  SOURCE_DATA: path.join(__dirname, '../../source-data'),
  VOCABULARY: path.join(__dirname, '../../vocabulary/output'),
  OUTPUT: path.join(__dirname, '../output'),
  ENV: path.join(__dirname, '../../vocabulary/.env')
};

// 버전명 → 파일명 매핑
const BIBLE_FILE_MAP = {
  'ESV': 'ESV_Bible.json',
  'NIV': 'NIV_Bible.json',
  'KJV': 'KJV_Bible.json',
  'Easy': 'Easy_Bible.json',
  'Hebrew': 'Hebrew_Bible.json'
};

// 성경 책 목록
const OLD_TESTAMENT = ['Genesis', 'Exodus', ...];
const NEW_TESTAMENT = ['Matthew', 'Mark', ...];
const ALL_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT];
```

### utils.js - 공통 유틸리티

여러 모듈에서 사용하는 공통 함수들을 제공합니다.

```javascript
log(...args)           // 타임스탬프 로그
toFilename(bookName)   // "1 Samuel" → "1Samuel"
loadEnv(envPath)       // .env 파일 로드
loadJson(filePath)     // JSON 파일 로드
saveJson(filePath, data) // JSON 파일 저장
normalizeText(text)    // 텍스트 정규화 (공백 처리)
extractWords(text)     // 텍스트에서 단어 추출
ensureDir(dirPath)     // 디렉토리 생성
```

### config.js - 분석 설정

분석 방법과 병렬 처리 설정을 관리합니다.

```javascript
module.exports = {
  ANALYSIS_METHOD: 'api',        // 'api' | 'claude' | 'droid'
  POOL_SIZE_API: 4,              // API 동시 요청 수
  POOL_SIZE_CLI: 30,             // CLI 동시 프로세스 수
  CLI_TIMEOUT: 120000,           // CLI 타임아웃 (ms)
  DEFAULT_API_BASE: 'https://api.z.ai/v1',
  DEFAULT_API_MODEL: 'glm-4.6-plus'
};
```

### analyzer.js - 구절 분석

LLM을 사용하여 성경 구절을 분석합니다.

```javascript
// 분석 방법 (런타임 변경 가능)
setAnalysisMethod('api')     // Z.AI API
setAnalysisMethod('claude')  // Claude CLI
setAnalysisMethod('droid')   // Droid CLI

// 핵심 함수
analyzeVerse(book, chapter, verse, version)  // 단일 구절 분석
analyzeBook(bookName, version, callback)     // 책 전체 분석
analyzeBooks(bookNames, version, callback)   // 여러 책 분석
reanalyzeVerse(book, chapter, verse, version) // 재분석
reanalyzeBatch(verses, version, callback)    // 배치 재분석
```

### validator.js - 결과 검증

분석된 데이터의 품질을 검증합니다.

```javascript
// 검증 항목
// - JSON 형식 검증 (필수 필드, 타입)
// - 원문 일치 검증 (source vs original_text)
// - 구문 합치기 검증 (sentences 합치면 원문과 일치해야 함)
// - 한글 번역 검증 (빈 번역, 비한글 문자, 영어 단어 포함)

validateVerse(verseData, sourceVerse)  // 단일 구절 검증
validateBook(bookName, version)        // 책 전체 검증
validateBooks(bookNames, version)      // 여러 책 검증
generateReport(results)                // 검증 리포트 생성
```

### main.js - Electron 메인 프로세스

IPC 핸들러를 등록하고 앱 윈도우를 관리합니다.

```javascript
// 주요 IPC 핸들러
'start-analysis'       // 분석 시작
'stop-analysis'        // 분석 중단
'start-validation'     // 검증 시작
'reanalyze-verse'      // 단일 구절 재분석
'reanalyze-batch'      // 배치 재분석
'load-bible-data'      // 성경 데이터 로드
'get-analysis-progress' // 진행률 조회
'set-analysis-method'  // 분석 방법 변경
```

## 분석 프로세스

```text
┌─────────────────────────────────────────────────────────────┐
│  1. 구절 선택                                                │
│  - UI에서 책/장/절 선택 또는 전체 책 선택                     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  2. LLM 분석 요청                                            │
│  - 구절 텍스트와 함께 분석 프롬프트 전송                       │
│  - 짧은 구문으로 분리 + 한국어 번역 요청                       │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 결과 처리                                                │
│  - JSON 파싱                                                 │
│  - word_indices 계산 (vocabulary와 연결)                     │
│  - 파일 저장 (output/{version}/{book}/{book}_{ch}_{v}.json) │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 검증 (선택)                                              │
│  - 원문 일치 확인                                            │
│  - 한글 번역 품질 확인                                        │
│  - 이슈 리포트 생성                                          │
└─────────────────────────────────────────────────────────────┘
```

## 출력 파일 형식

### 구절 분석 결과 (Genesis_1_1.json)

```json
{
  "verse_reference": "Genesis 1:1",
  "version": "ESV",
  "original_text": "In the beginning, God created the heavens and the earth.",
  "korean_text": "태초에 하나님이 천지를 창조하시니라",
  "sentences": [
    {
      "sequence_order": 1,
      "original_text": "In the beginning",
      "korean_translation": "태초에",
      "word_indices": [123, 456]
    },
    {
      "sequence_order": 2,
      "original_text": "God created the heavens and the earth",
      "korean_translation": "하나님이 하늘과 땅을 창조하셨다",
      "word_indices": [789, 101, 234]
    }
  ]
}
```

## 실행 방법

### 개발 모드

```bash
cd pipeline/sentence
npm install
npm start
```

### 개발 모드 (DevTools 포함)

```bash
npm run dev
```

## 분석 방법 비교

| 방법 | 장점 | 단점 | Pool 크기 |
|------|------|------|-----------|
| Z.AI API | 안정적, 빠름 | API 키 필요, 비용 | 4 |
| Claude CLI | 무료 | 느림, CLI 설치 필요 | 30 |
| Droid CLI | 무료 | 느림, CLI 설치 필요 | 30 |

## 검증 이슈 유형

| 유형 | 설명 |
|------|------|
| `invalid_json_format` | 필수 필드 누락 또는 타입 오류 |
| `json_parse_error` | JSON 파싱 실패 |
| `source_mismatch` | 원문이 소스와 불일치 |
| `sentence_merge_mismatch` | 구문 합치기가 원문과 불일치 |
| `empty_translation` | 빈 한글 번역 |
| `non_korean_chars` | 한글 번역에 비한글 문자 포함 |
| `english_in_korean` | 한글 번역에 영어 단어 포함 |

## 리팩토링 요약

### 변경 사항 (2024)

- `utils.js` 생성: 공통 유틸리티 함수 통합
- `constants.js` 생성: 경로, 상수 통합
- `analyzer.js`: 중복 코드 제거, PATHS 사용
- `validator.js`: 중복 코드 제거, PATHS 사용
- `main.js`: 중복 코드 제거, constants 사용

### 중복 제거 항목

| 이전 | 이후 |
|------|------|
| `log()` 함수 중복 | `utils.js`의 `log()` 사용 |
| `toFilename()` 중복 | `utils.js`의 `toFilename()` 사용 |
| 경로 상수 중복 | `constants.js`의 `PATHS` 사용 |
| `BIBLE_FILE_MAP` 중복 | `constants.js`에서 import |
| `BOOK_NAMES_KO` 중복 | `constants.js`에서 import |
| `OLD_TESTAMENT` 중복 | `constants.js`에서 import |
