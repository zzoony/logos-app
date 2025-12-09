import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/word_model.dart';
import '../data/models/sentence_model.dart';
import '../data/repositories/repository_providers.dart';
import 'word_providers.dart';

class LearningSessionState {
  final List<WordModel> words;
  final int currentIndex;
  final bool isCardFlipped;
  final int knownCount;
  final int savedCount;
  final String? currentSentenceId; // 현재 선택된 예문 ID

  LearningSessionState({
    required this.words,
    required this.currentIndex,
    required this.isCardFlipped,
    this.knownCount = 0,
    this.savedCount = 0,
    this.currentSentenceId,
  });

  WordModel? get currentWord =>
      currentIndex < words.length && currentIndex >= 0 ? words[currentIndex] : null;
  bool get hasNext => currentIndex < words.length - 1;
  bool get hasPrevious => currentIndex > 0;
  double get progress =>
      words.isEmpty ? 0 : (currentIndex + 1) / words.length;

  LearningSessionState copyWith({
    List<WordModel>? words,
    int? currentIndex,
    bool? isCardFlipped,
    int? knownCount,
    int? savedCount,
    String? currentSentenceId,
    bool clearSentenceId = false,
  }) {
    return LearningSessionState(
      words: words ?? this.words,
      currentIndex: currentIndex ?? this.currentIndex,
      isCardFlipped: isCardFlipped ?? this.isCardFlipped,
      knownCount: knownCount ?? this.knownCount,
      savedCount: savedCount ?? this.savedCount,
      currentSentenceId: clearSentenceId ? null : (currentSentenceId ?? this.currentSentenceId),
    );
  }
}

class LearningSessionNotifier extends StateNotifier<LearningSessionState> {
  final Ref _ref;

  LearningSessionNotifier(this._ref)
      : super(LearningSessionState(
          words: [],
          currentIndex: 0,
          isCardFlipped: false,
        ));

  Future<void> initSession() async {
    final words = await _ref.read(filteredWordsProvider.future);

    // 마지막 위치에서 이어서 시작
    int startIndex = await _getLastPosition();

    state = LearningSessionState(
      words: words,
      currentIndex: startIndex.clamp(0, words.isEmpty ? 0 : words.length - 1),
      isCardFlipped: false,
    );
  }

  Future<int> _getLastPosition() async {
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      return await settingsRepo.getLastWordPosition();
    } catch (e) {
      return 0;
    }
  }

  Future<void> _savePosition() async {
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      await settingsRepo.saveLastWordPosition(state.currentIndex);
    } catch (e) {
      // Ignore errors
    }
  }

  void nextWord() {
    if (state.hasNext) {
      state = state.copyWith(
        currentIndex: state.currentIndex + 1,
        isCardFlipped: false,
        clearSentenceId: true, // 새 단어로 이동 시 예문 초기화
      );
      _savePosition();
    }
  }

  void previousWord() {
    if (state.hasPrevious) {
      state = state.copyWith(
        currentIndex: state.currentIndex - 1,
        isCardFlipped: false,
        clearSentenceId: true, // 새 단어로 이동 시 예문 초기화
      );
      _savePosition();
    }
  }

  void flipCard() {
    // 앞면 → 뒷면: 새 예문 선택
    if (!state.isCardFlipped) {
      final word = state.currentWord;
      if (word != null && word.sentenceIds.isNotEmpty) {
        final randomIndex = Random().nextInt(word.sentenceIds.length);
        state = state.copyWith(
          isCardFlipped: true,
          currentSentenceId: word.sentenceIds[randomIndex],
        );
        return;
      }
    }
    // 뒷면 → 앞면: 예문 유지
    state = state.copyWith(isCardFlipped: !state.isCardFlipped);
  }

  Future<void> markAsKnown() async {
    final word = state.currentWord;
    if (word == null) return;

    try {
      final progressRepo = await _ref.read(progressRepositoryProvider.future);
      await progressRepo.markWordAsKnown(word.word);

      // Remove from current list and move to next
      final newWords = List<WordModel>.from(state.words);
      newWords.removeAt(state.currentIndex);

      final newIndex = state.currentIndex >= newWords.length
          ? newWords.length - 1
          : state.currentIndex;

      state = state.copyWith(
        words: newWords,
        currentIndex: newIndex.clamp(0, newWords.length - 1),
        isCardFlipped: false,
        knownCount: state.knownCount + 1,
      );
    } catch (e) {
      // Handle error
    }
  }

  Future<void> saveToVocabulary() async {
    final word = state.currentWord;
    if (word == null) return;

    try {
      final progressRepo = await _ref.read(progressRepositoryProvider.future);
      await progressRepo.saveWordToVocabulary(word.word);

      state = state.copyWith(savedCount: state.savedCount + 1);
    } catch (e) {
      // Handle error
    }
  }

  Future<void> recordView() async {
    final word = state.currentWord;
    if (word == null) return;

    try {
      final progressRepo = await _ref.read(progressRepositoryProvider.future);
      await progressRepo.recordWordView(word.word);
    } catch (e) {
      // Ignore errors
    }
  }
}

final learningSessionProvider =
    StateNotifierProvider<LearningSessionNotifier, LearningSessionState>((ref) {
  return LearningSessionNotifier(ref);
});

// Provider that watches the current sentence ID from state
final currentSentenceIdProvider = Provider<String?>((ref) {
  return ref.watch(learningSessionProvider.select((s) => s.currentSentenceId));
});

final currentSentenceProvider = FutureProvider<SentenceModel?>((ref) async {
  final sentenceId = ref.watch(currentSentenceIdProvider);

  if (sentenceId == null) return null;

  return ref.watch(sentenceProvider(sentenceId).future);
});
