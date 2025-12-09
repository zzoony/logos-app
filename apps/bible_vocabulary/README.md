# Bible Vocabulary App

성경 단어장 Flutter 앱.

## Development

### 의존성 설치
```bash
cd apps/bible_vocabulary
flutter pub get
```

### 코드 생성 (Isar 모델 변경 시)
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### iOS 시뮬레이터에서 실행

Hot reload를 사용하려면 별도 터미널 창에서 실행해야 함:

```bash
cd apps/bible_vocabulary
flutter run -d "iPhone 16 Pro"
```

**주의**: 백그라운드 실행(`run_in_background`)으로는 Hot reload (`r`) 사용 불가

### 다른 디바이스에서 실행
```bash
flutter devices                    # 사용 가능한 디바이스 목록
flutter run -d <device_id>         # 특정 디바이스에서 실행
flutter run -d chrome              # 웹 브라우저에서 실행
```

### 빌드
```bash
flutter build ios                  # iOS 빌드
flutter build apk                  # Android APK 빌드
flutter build web                  # 웹 빌드
```

## Project Structure

```
lib/
├── main.dart                      # 앱 진입점
├── app.dart                       # MaterialApp 설정
├── core/                          # 앱 공통 설정
│   ├── constants/                 # 상수 (색상 등)
│   │   └── app_colors.dart
│   ├── theme/                     # 테마 설정
│   │   ├── app_theme.dart
│   │   └── app_typography.dart
│   └── utils/                     # 유틸리티
│       └── responsive.dart
├── data/                          # 데이터 계층
│   ├── datasources/               # 데이터 소스 (JSON 임포트 등)
│   │   └── json_import_service.dart
│   ├── models/                    # Isar 데이터 모델
│   │   ├── word_model.dart
│   │   ├── sentence_model.dart
│   │   ├── user_progress_model.dart
│   │   └── app_settings_model.dart
│   └── repositories/              # Repository (데이터 접근 추상화)
│       ├── word_repository.dart
│       ├── progress_repository.dart
│       ├── settings_repository.dart
│       └── repository_providers.dart
├── providers/                     # Riverpod 상태 관리
│   ├── database_provider.dart     # Isar 인스턴스
│   ├── word_providers.dart        # 단어 관련 Provider
│   ├── learning_session_provider.dart  # 학습 세션
│   └── settings_provider.dart     # 앱 설정
├── screens/                       # 화면 (Feature 기반)
│   ├── home/
│   │   ├── home_screen.dart
│   │   └── widgets/
│   │       └── menu_card.dart
│   ├── word_learning/
│   │   ├── word_learning_screen.dart
│   │   └── widgets/
│   │       ├── flip_card.dart
│   │       ├── swipeable_card.dart
│   │       ├── word_card_front.dart
│   │       └── word_card_back.dart
│   ├── my_vocabulary/
│   │   └── my_vocabulary_screen.dart
│   ├── settings/
│   │   └── settings_screen.dart
│   └── splash/
│       └── splash_screen.dart
```

## Architecture

- **상태 관리**: Riverpod
- **로컬 DB**: Isar
- **아키텍처**: Clean Architecture (Data → Repository → Provider → UI)

### 데이터 흐름

```
[JSON 파일] → [JsonImportService] → [Isar DB]
                                        ↓
                              [Repository Layer]
                                        ↓
                              [Riverpod Providers]
                                        ↓
                                   [UI Screens]
```

## Data Source

파이프라인에서 생성된 데이터 사용:
- `pipeline/vocabulary/output/{version}/final_vocabulary_{version}.json`
- `pipeline/vocabulary/output/{version}/final_sentences_{version}.json`

## Tech Stack

- Flutter 3.x
- Riverpod (상태 관리)
- Isar (로컬 데이터베이스)
- go_router (라우팅) - 예정
