# CLAUDE.md

Claude Code 가이드 - 이 저장소에서 작업할 때 참고하는 파일입니다.

## Project Overview

성경 텍스트에서 단어를 추출하여 영어 단어장 앱을 만드는 프로젝트.

| Phase | 경로 | 상태 | 설명 |
|-------|------|------|------|
| 1 | `pipeline/vocabulary` | ✅ 완료 | 단어 데이터 추출 및 정제 |
| 2 | `pipeline/sentence` | 예정 | 문장 데이터 처리 |
| 3 | `apps/bible_vocabulary` | 개발중 | Flutter 단어장 앱 |

## Project Structure

```
logos-app/
├── CLAUDE.md                 # 이 파일
├── docs/                     # 프로젝트 문서
│   ├── project-plan.md
│   └── bible-vocabulary-app-plan.md
├── pipeline/                 # 데이터 파이프라인
│   ├── docs/                 # 파이프라인 문서
│   │   ├── vocabulary-pipeline.md   # 단어 파이프라인 가이드
│   │   ├── pipeline-output-files.md
│   │   └── hebrew-pipeline.md
│   ├── source-data/          # 원본 데이터 (공유)
│   ├── vocabulary/           # 단어 추출 파이프라인
│   └── sentence/             # 문장 처리 파이프라인 (예정)
└── apps/                     # 앱
    └── bible_vocabulary/     # Flutter 앱
```

## Documentation

각 서브 프로젝트별 상세 문서:

- **Vocabulary Pipeline**: [pipeline/docs/vocabulary-pipeline.md](pipeline/docs/vocabulary-pipeline.md)
- **Hebrew Pipeline**: [pipeline/docs/hebrew-pipeline.md](pipeline/docs/hebrew-pipeline.md)
- **Output Files**: [pipeline/docs/pipeline-output-files.md](pipeline/docs/pipeline-output-files.md)
- **Flutter App**: [apps/bible_vocabulary/README.md](apps/bible_vocabulary/README.md)

## Quick Commands

### Vocabulary Pipeline
```bash
cd pipeline/vocabulary
python run_pipeline.py --version niv --with-sentences
```

### Flutter App
```bash
cd apps/bible_vocabulary
flutter run
```

## Tech Stack

- **Pipeline**: Python 3.x, spaCy (NLP), Z.AI SDK
- **App**: Flutter/Dart
- **Data**: JSON
