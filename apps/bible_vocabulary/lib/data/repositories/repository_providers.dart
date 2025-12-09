import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/database_provider.dart';
import 'word_repository.dart';
import 'progress_repository.dart';
import 'settings_repository.dart';

/// Provider for WordRepository
final wordRepositoryProvider = FutureProvider<WordRepository>((ref) async {
  final isar = await ref.watch(isarProvider.future);
  return WordRepository(isar);
});

/// Provider for ProgressRepository
final progressRepositoryProvider = FutureProvider<ProgressRepository>((ref) async {
  final isar = await ref.watch(isarProvider.future);
  return ProgressRepository(isar);
});

/// Provider for SettingsRepository
final settingsRepositoryProvider = FutureProvider<SettingsRepository>((ref) async {
  final isar = await ref.watch(isarProvider.future);
  return SettingsRepository(isar);
});
