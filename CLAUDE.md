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

## Rules

- **[필수] 앱 실행 전 기존 인스턴스 강제 종료**: Electron 앱이나 Flutter 앱을 실행하기 전에 반드시 `pkill -9`로 기존 프로세스를 강제 종료해야 합니다. 이 규칙은 예외 없이 항상 적용됩니다.
  ```bash
  # Sentence Analysis Dashboard (Electron) - 반드시 -9 옵션 사용
  pkill -9 -f "electron" 2>/dev/null; pkill -9 -f "Electron" 2>/dev/null; sleep 1

  # Flutter App
  pkill -9 -f "flutter.*bible_vocabulary" 2>/dev/null; sleep 1
  ```

  **실행 예시 (Electron 앱):**
  ```bash
  pkill -9 -f "electron" 2>/dev/null; pkill -9 -f "Electron" 2>/dev/null; sleep 1 && cd /Users/peter/Dev/logos-app/pipeline/sentence && npm start
  ```

- **Output 파일은 main에 직접 푸시**: `pipeline/*/output/` 폴더의 파일들은 피처 브랜치가 아닌 main 브랜치에 직접 커밋하고 푸시합니다. 소스 코드 변경과 output 데이터 변경을 분리하여 관리합니다.
  ```bash
  # 소스 코드는 피처 브랜치에서 PR
  git checkout feature/xxx
  git add src/ ...
  git commit && git push

  # Output 파일은 main에 직접
  git checkout main
  git add pipeline/*/output/
  git commit -m "chore: update output files" && git push
  ```
