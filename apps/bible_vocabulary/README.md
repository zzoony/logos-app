# Bible Vocabulary App

성경 단어장 Flutter 앱.

## Development

### 의존성 설치
```bash
cd apps/bible_vocabulary
flutter pub get
```

### iOS 시뮬레이터에서 실행

Hot reload를 사용하려면 별도 터미널 창에서 실행해야 함:

```bash
# 프로젝트 루트에서 실행
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
├── main.dart              # 앱 진입점
├── models/                # 데이터 모델
├── screens/               # 화면 위젯
├── widgets/               # 재사용 가능한 위젯
└── services/              # 비즈니스 로직, API 호출
```

## Data Source

파이프라인에서 생성된 데이터 사용:
- `pipeline/vocabulary/output/{version}/final_vocabulary_{version}.json`
- `pipeline/vocabulary/output/{version}/final_sentences_{version}.json`
