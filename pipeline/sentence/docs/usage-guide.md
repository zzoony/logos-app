# Sentence Analysis Dashboard 사용 가이드

## 개요

Sentence Analysis Dashboard는 성경 구절을 분석하여 영어 학습자를 위한 문장 데이터를 생성하는 Electron 기반 데스크톱 애플리케이션입니다.

### 주요 기능
- 성경 구절을 짧은 구문으로 분할
- 각 구문에 대한 한국어 번역 생성
- 어휘 인덱스 매핑
- 분석 결과 검증
- 문제 있는 구절 재분석

---

## 설치 및 실행

### 사전 요구사항
- Node.js 18.x 이상
- npm 또는 yarn
- Z.AI API 키

### 설치
```bash
cd pipeline/sentence
npm install
```

### API 키 설정
`pipeline/vocabulary/.env` 파일에 API 키를 설정합니다:
```env
ZAI_API_KEY=your_api_key_here
ZAI_API_BASE=https://api.z.ai/api/coding/paas/v4
ZAI_MODEL=glm-4.6
```

### 실행
```bash
npm start
```

개발 모드 (DevTools 활성화):
```bash
npm start -- --dev
```

---

## 탭별 기능 설명

### 1. 분석 탭

#### 통계 개요
- **전체 문장**: 선택된 성경 버전의 총 구절 수
- **분석 완료**: 이미 분석이 완료된 구절 수
- **대기 중**: 아직 분석되지 않은 구절 수
- **실패**: 분석 중 오류가 발생한 구절 수

#### 책 선택
- 구약 (39권) / 신약 (27권) 필터 버튼으로 빠른 선택
- 개별 책 카드 클릭으로 선택/해제
- "전체 선택" / "선택 해제" 버튼 사용

#### 분석 시작
1. 분석할 책을 선택합니다
2. "분석 시작" 버튼을 클릭합니다
3. 진행 상황이 실시간으로 표시됩니다
4. 분석 중 "중단" 버튼으로 언제든 중지 가능

### 2. 검증 탭

#### 검증 유형
- **원문 불일치**: 분석된 구문을 합쳤을 때 원문과 다른 경우
- **구문 합치기 오류**: 구문 병합 시 문제가 있는 경우
- **빈 번역**: 한국어 번역이 누락된 경우
- **비한글 문자**: 번역에 비정상적인 문자가 포함된 경우
- **영어 포함**: 한국어 번역에 영어가 섞인 경우

#### 검증 실행
1. 검증할 책을 선택합니다
2. "검증 시작" 버튼을 클릭합니다
3. 이슈가 발견되면 목록에 표시됩니다

#### 재분석 기능
1. 이슈 목록에서 재분석할 항목을 체크박스로 선택합니다
2. "전체 선택" 체크박스로 모든 항목 선택 가능
3. "선택 항목 재분석" 버튼을 클릭합니다
4. 5개의 워커가 병렬로 재분석을 수행합니다

#### 에디터에서 열기
- 이슈 항목을 더블클릭하면 선택한 에디터에서 해당 파일이 열립니다

### 3. 설정 탭

#### 성경 버전 선택
- **ESV**: English Standard Version
- **NIV**: New International Version

#### 에디터 선택
- **Cursor**: Cursor 에디터
- **Antigravity**: Antigravity 에디터

---

## 설정 파일

### config.js (`src/config.js`)

병렬 처리 및 API 관련 설정을 관리합니다.

```javascript
module.exports = {
  // 병렬 처리 Pool 크기 (동시 실행 worker 수)
  POOL_SIZE: 5,

  // API 타임아웃 (ms)
  API_TIMEOUT: 120000,

  // 기본 API 설정
  DEFAULT_API_BASE: 'https://api.z.ai/api/coding/paas/v4',
  DEFAULT_API_MODEL: 'glm-4.6'
};
```

#### POOL_SIZE 조정
- 값을 높이면: 분석 속도 증가, API 요청 부하 증가
- 값을 낮추면: 분석 속도 감소, API 요청 부하 감소
- 권장값: 3~10 (API 제한에 따라 조절)

---

## 출력 파일 구조

분석 결과는 `output/{version}/{book}/` 폴더에 저장됩니다.

### 파일명 형식
```
{Book}_{Chapter}_{Verse}.json
```

예: `Genesis_1_1.json`, `1Thessalonians_1_1.json`

### JSON 구조
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
      "word_indices": [1234, 5678]
    },
    {
      "sequence_order": 2,
      "original_text": "God created the heavens and the earth",
      "korean_translation": "하나님이 천지를 창조하시니라",
      "word_indices": [2345, 3456, 4567]
    }
  ]
}
```

---

## 트러블슈팅

### API 키 오류
```text
Error: API key not found
```
→ `pipeline/vocabulary/.env` 파일에 `ZAI_API_KEY`가 설정되어 있는지 확인하세요.

### 분석 속도가 너무 느림
→ `src/config.js`의 `POOL_SIZE`를 높여보세요 (최대 10 권장).

### 분석 실패가 많이 발생
→ API 서버 상태를 확인하거나, `POOL_SIZE`를 낮춰서 API 부하를 줄여보세요.

### 앱이 응답하지 않음
→ 앱을 종료하고 다시 시작하세요. 분석 진행 상황은 파일로 저장되므로 이어서 진행됩니다.

---

## 개발 정보

### 기술 스택
- **프레임워크**: Electron
- **언어**: JavaScript (ES6+)
- **스타일**: CSS (다크 테마)
- **API**: Z.AI (GLM-4.6)

### 주요 파일 구조
```
sentence/
├── src/
│   ├── main.js          # Electron 메인 프로세스
│   ├── preload.js       # IPC 브릿지
│   ├── renderer.js      # UI 로직
│   ├── analyzer.js      # 분석 모듈
│   ├── validator.js     # 검증 모듈
│   ├── config.js        # 설정 파일
│   ├── index.html       # UI 템플릿
│   └── styles.css       # 스타일시트
├── output/              # 분석 결과 저장
│   ├── esv/
│   └── niv/
└── docs/                # 문서
    └── usage-guide.md
```

---

## 버전 히스토리

### v0.1.0
- 초기 버전
- 분석, 검증, 설정 기본 기능
- Pool 기반 병렬 처리
- 배치 재분석 기능
