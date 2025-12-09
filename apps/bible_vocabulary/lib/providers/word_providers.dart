import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/word_model.dart';
import '../data/models/sentence_model.dart';
import '../data/repositories/repository_providers.dart';

enum SortOption { frequency, alphabetical, random }
enum StartOption { beginning, resume, random }

class SortOptionNotifier extends StateNotifier<SortOption> {
  final Ref _ref;
  bool _initialized = false;

  SortOptionNotifier(this._ref) : super(SortOption.random) {
    _loadSavedOption();
  }

  Future<void> _loadSavedOption() async {
    if (_initialized) return;
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      final savedIndex = await settingsRepo.getDefaultSortOption();
      if (savedIndex != null) {
        state = SortOption.values[savedIndex];
      }
      _initialized = true;
    } catch (e) {
      _initialized = true;
    }
  }

  Future<void> setOption(SortOption option) async {
    state = option;
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      await settingsRepo.saveDefaultSortOption(option.index);
    } catch (e) {
      // Ignore errors
    }
  }
}

class StartOptionNotifier extends StateNotifier<StartOption> {
  final Ref _ref;
  bool _initialized = false;

  StartOptionNotifier(this._ref) : super(StartOption.random) {
    _loadSavedOption();
  }

  Future<void> _loadSavedOption() async {
    if (_initialized) return;
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      final savedIndex = await settingsRepo.getDefaultStartOption();
      if (savedIndex != null) {
        state = StartOption.values[savedIndex];
      }
      _initialized = true;
    } catch (e) {
      _initialized = true;
    }
  }

  Future<void> setOption(StartOption option) async {
    state = option;
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      await settingsRepo.saveDefaultStartOption(option.index);
    } catch (e) {
      // Ignore errors
    }
  }
}

final sortOptionProvider = StateNotifierProvider<SortOptionNotifier, SortOption>((ref) {
  return SortOptionNotifier(ref);
});

final startOptionProvider = StateNotifierProvider<StartOptionNotifier, StartOption>((ref) {
  return StartOptionNotifier(ref);
});

final allWordsProvider = FutureProvider<List<WordModel>>((ref) async {
  final wordRepo = await ref.watch(wordRepositoryProvider.future);
  final sortOption = ref.watch(sortOptionProvider);

  switch (sortOption) {
    case SortOption.frequency:
      return await wordRepo.getAllWordsByFrequency();
    case SortOption.alphabetical:
      return await wordRepo.getAllWordsAlphabetically();
    case SortOption.random:
      final words = await wordRepo.getAllWords();
      words.shuffle(Random());
      return words;
  }
});

final filteredWordsProvider = FutureProvider<List<WordModel>>((ref) async {
  final words = await ref.watch(allWordsProvider.future);
  final progressRepo = await ref.watch(progressRepositoryProvider.future);

  // Filter out known words
  final knownWordSet = await progressRepo.getKnownWordNames();

  return words.where((w) => !knownWordSet.contains(w.word)).toList();
});

final sentenceProvider =
    FutureProvider.family<SentenceModel?, String>((ref, sentenceId) async {
  final wordRepo = await ref.watch(wordRepositoryProvider.future);
  return await wordRepo.getSentenceById(sentenceId);
});

final savedWordsProvider = FutureProvider<List<WordModel>>((ref) async {
  final wordRepo = await ref.watch(wordRepositoryProvider.future);
  final progressRepo = await ref.watch(progressRepositoryProvider.future);

  final savedWordNames = await progressRepo.getSavedWordNames();
  final words = await wordRepo.getAllWords();

  return words.where((w) => savedWordNames.contains(w.word)).toList();
});
