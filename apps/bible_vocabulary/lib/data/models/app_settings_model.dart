import 'package:isar/isar.dart';

part 'app_settings_model.g.dart';

@collection
class AppSettingsModel {
  Id id = Isar.autoIncrement;

  @Index(type: IndexType.hash, unique: true)
  late String key;

  String? stringValue;
  int? intValue;
  bool? boolValue;
}

class SettingsKeys {
  static const themeMode = 'theme_mode';
  static const lastWordRank = 'last_word_rank';
  static const defaultSortOption = 'default_sort';
  static const defaultStartOption = 'default_start';
  static const hasCompletedOnboarding = 'onboarding_complete';
}
