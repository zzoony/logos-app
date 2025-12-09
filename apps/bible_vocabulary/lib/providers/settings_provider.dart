import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repositories/repository_providers.dart';

final themeModeProvider =
    StateNotifierProvider<ThemeModeNotifier, ThemeMode>((ref) {
  return ThemeModeNotifier(ref);
});

class ThemeModeNotifier extends StateNotifier<ThemeMode> {
  final Ref _ref;

  ThemeModeNotifier(this._ref) : super(ThemeMode.system) {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      final themeValue = await settingsRepo.getThemeMode();

      if (themeValue != null) {
        state = _parseThemeMode(themeValue);
      }
    } catch (e) {
      // Use default on error
    }
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = mode;

    try {
      final settingsRepo = await _ref.read(settingsRepositoryProvider.future);
      await settingsRepo.saveThemeMode(_themeModeToString(mode));
    } catch (e) {
      // Ignore save errors
    }
  }

  Future<void> toggleTheme() async {
    final newMode = state == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    await setThemeMode(newMode);
  }

  ThemeMode _parseThemeMode(String value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  String _themeModeToString(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
      case ThemeMode.system:
        return 'system';
    }
  }
}
