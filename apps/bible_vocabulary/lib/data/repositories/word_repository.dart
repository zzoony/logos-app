import 'package:isar/isar.dart';
import '../models/word_model.dart';
import '../models/sentence_model.dart';

/// Repository for word and sentence data access
class WordRepository {
  final Isar _isar;

  WordRepository(this._isar);

  /// Get all words sorted by rank (frequency)
  Future<List<WordModel>> getAllWordsByFrequency() async {
    return await _isar.wordModels.where().sortByRank().findAll();
  }

  /// Get all words sorted alphabetically
  Future<List<WordModel>> getAllWordsAlphabetically() async {
    return await _isar.wordModels.where().sortByWord().findAll();
  }

  /// Get all words (unsorted)
  Future<List<WordModel>> getAllWords() async {
    return await _isar.wordModels.where().findAll();
  }

  /// Get word count
  Future<int> getWordCount() async {
    return await _isar.wordModels.count();
  }

  /// Get a word by its text
  Future<WordModel?> getWordByText(String word) async {
    return await _isar.wordModels.filter().wordEqualTo(word).findFirst();
  }

  /// Get a sentence by its ID
  Future<SentenceModel?> getSentenceById(String sentenceId) async {
    return await _isar.sentenceModels
        .filter()
        .sentenceIdEqualTo(sentenceId)
        .findFirst();
  }

  /// Get sentences for a word
  Future<List<SentenceModel>> getSentencesForWord(WordModel word) async {
    if (word.sentenceIds.isEmpty) return [];

    final sentences = <SentenceModel>[];
    for (final id in word.sentenceIds) {
      final sentence = await getSentenceById(id);
      if (sentence != null) {
        sentences.add(sentence);
      }
    }
    return sentences;
  }

  /// Get sentence count
  Future<int> getSentenceCount() async {
    return await _isar.sentenceModels.count();
  }
}
