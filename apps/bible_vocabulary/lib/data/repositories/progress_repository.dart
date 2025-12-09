import 'package:isar/isar.dart';
import '../models/user_progress_model.dart';
import '../models/word_model.dart';

/// Repository for user progress data access
class ProgressRepository {
  final Isar _isar;

  ProgressRepository(this._isar);

  /// Get progress for a specific word
  Future<UserProgressModel?> getProgressForWord(String word) async {
    return await _isar.userProgressModels
        .filter()
        .wordEqualTo(word)
        .findFirst();
  }

  /// Get all known words progress
  Future<List<UserProgressModel>> getKnownWordsProgress() async {
    return await _isar.userProgressModels
        .filter()
        .statusEqualTo(WordStatus.known)
        .findAll();
  }

  /// Get set of known word names
  Future<Set<String>> getKnownWordNames() async {
    final progress = await getKnownWordsProgress();
    return progress.map((p) => p.word).toSet();
  }

  /// Get all saved words progress
  Future<List<UserProgressModel>> getSavedWordsProgress() async {
    return await _isar.userProgressModels
        .filter()
        .isSavedEqualTo(true)
        .findAll();
  }

  /// Get set of saved word names
  Future<Set<String>> getSavedWordNames() async {
    final progress = await getSavedWordsProgress();
    return progress.map((p) => p.word).toSet();
  }

  /// Get saved word count
  Future<int> getSavedWordCount() async {
    return await _isar.userProgressModels
        .filter()
        .isSavedEqualTo(true)
        .count();
  }

  /// Mark a word as known
  Future<void> markWordAsKnown(String word) async {
    await _isar.writeTxn(() async {
      var progress = await _isar.userProgressModels
          .filter()
          .wordEqualTo(word)
          .findFirst();

      if (progress == null) {
        progress = UserProgressModel()
          ..word = word
          ..isSaved = false
          ..viewCount = 0
          ..lastViewedAt = DateTime.now();
      }

      progress.status = WordStatus.known;
      progress.masteredAt = DateTime.now();
      await _isar.userProgressModels.put(progress);
    });
  }

  /// Save a word to vocabulary
  Future<void> saveWordToVocabulary(String word) async {
    await _isar.writeTxn(() async {
      var progress = await _isar.userProgressModels
          .filter()
          .wordEqualTo(word)
          .findFirst();

      if (progress == null) {
        progress = UserProgressModel()
          ..word = word
          ..status = WordStatus.unknown
          ..viewCount = 0
          ..lastViewedAt = DateTime.now();
      }

      progress.isSaved = true;
      await _isar.userProgressModels.put(progress);
    });
  }

  /// Remove a word from saved vocabulary
  Future<void> removeWordFromVocabulary(String word) async {
    await _isar.writeTxn(() async {
      final progress = await _isar.userProgressModels
          .filter()
          .wordEqualTo(word)
          .findFirst();
      if (progress != null) {
        progress.isSaved = false;
        await _isar.userProgressModels.put(progress);
      }
    });
  }

  /// Record a view for a word
  Future<void> recordWordView(String word) async {
    await _isar.writeTxn(() async {
      var progress = await _isar.userProgressModels
          .filter()
          .wordEqualTo(word)
          .findFirst();

      if (progress == null) {
        progress = UserProgressModel()
          ..word = word
          ..status = WordStatus.unknown
          ..isSaved = false
          ..viewCount = 0;
      }

      progress.viewCount++;
      progress.lastViewedAt = DateTime.now();

      if (progress.status == WordStatus.unknown) {
        progress.status = WordStatus.learning;
      }

      await _isar.userProgressModels.put(progress);
    });
  }
}
