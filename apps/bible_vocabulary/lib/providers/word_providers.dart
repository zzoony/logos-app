import 'dart:math';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:isar/isar.dart';
import '../data/models/word_model.dart';
import '../data/models/sentence_model.dart';
import '../data/models/user_progress_model.dart';
import '../data/models/app_settings_model.dart';
import 'database_provider.dart';

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
      final isar = await _ref.read(isarProvider.future);
      final setting = await isar.appSettingsModels
          .filter()
          .keyEqualTo(SettingsKeys.defaultSortOption)
          .findFirst();
      if (setting?.intValue != null) {
        state = SortOption.values[setting!.intValue!];
      }
      _initialized = true;
    } catch (e) {
      _initialized = true;
    }
  }

  Future<void> setOption(SortOption option) async {
    state = option;
    try {
      final isar = await _ref.read(isarProvider.future);
      await isar.writeTxn(() async {
        var setting = await isar.appSettingsModels
            .filter()
            .keyEqualTo(SettingsKeys.defaultSortOption)
            .findFirst();
        if (setting == null) {
          setting = AppSettingsModel()..key = SettingsKeys.defaultSortOption;
        }
        setting.intValue = option.index;
        await isar.appSettingsModels.put(setting);
      });
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
      final isar = await _ref.read(isarProvider.future);
      final setting = await isar.appSettingsModels
          .filter()
          .keyEqualTo(SettingsKeys.defaultStartOption)
          .findFirst();
      if (setting?.intValue != null) {
        state = StartOption.values[setting!.intValue!];
      }
      _initialized = true;
    } catch (e) {
      _initialized = true;
    }
  }

  Future<void> setOption(StartOption option) async {
    state = option;
    try {
      final isar = await _ref.read(isarProvider.future);
      await isar.writeTxn(() async {
        var setting = await isar.appSettingsModels
            .filter()
            .keyEqualTo(SettingsKeys.defaultStartOption)
            .findFirst();
        if (setting == null) {
          setting = AppSettingsModel()..key = SettingsKeys.defaultStartOption;
        }
        setting.intValue = option.index;
        await isar.appSettingsModels.put(setting);
      });
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
  final isar = await ref.watch(isarProvider.future);
  final sortOption = ref.watch(sortOptionProvider);

  switch (sortOption) {
    case SortOption.frequency:
      return await isar.wordModels.where().sortByRank().findAll();
    case SortOption.alphabetical:
      return await isar.wordModels.where().sortByWord().findAll();
    case SortOption.random:
      final words = await isar.wordModels.where().findAll();
      words.shuffle(Random());
      return words;
  }
});

final filteredWordsProvider = FutureProvider<List<WordModel>>((ref) async {
  final words = await ref.watch(allWordsProvider.future);
  final isar = await ref.watch(isarProvider.future);

  // Filter out known words
  final knownWords = await isar.userProgressModels
      .filter()
      .statusEqualTo(WordStatus.known)
      .findAll();
  final knownWordSet = knownWords.map((p) => p.word).toSet();

  return words.where((w) => !knownWordSet.contains(w.word)).toList();
});

final sentenceProvider =
    FutureProvider.family<SentenceModel?, String>((ref, sentenceId) async {
  final isar = await ref.watch(isarProvider.future);
  return await isar.sentenceModels
      .filter()
      .sentenceIdEqualTo(sentenceId)
      .findFirst();
});

final savedWordsProvider = FutureProvider<List<WordModel>>((ref) async {
  final isar = await ref.watch(isarProvider.future);

  final savedProgress = await isar.userProgressModels
      .filter()
      .isSavedEqualTo(true)
      .findAll();

  final savedWordNames = savedProgress.map((p) => p.word).toSet();

  final words = await isar.wordModels.where().findAll();
  return words.where((w) => savedWordNames.contains(w.word)).toList();
});
