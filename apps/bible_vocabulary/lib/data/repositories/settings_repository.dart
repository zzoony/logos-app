import 'package:isar/isar.dart';
import '../models/app_settings_model.dart';

/// Repository for app settings data access
class SettingsRepository {
  final Isar _isar;

  SettingsRepository(this._isar);

  /// Get a setting by key
  Future<AppSettingsModel?> getSetting(String key) async {
    return await _isar.appSettingsModels
        .filter()
        .keyEqualTo(key)
        .findFirst();
  }

  /// Get an integer setting
  Future<int?> getIntSetting(String key) async {
    final setting = await getSetting(key);
    return setting?.intValue;
  }

  /// Get a string setting
  Future<String?> getStringSetting(String key) async {
    final setting = await getSetting(key);
    return setting?.stringValue;
  }

  /// Get a boolean setting
  Future<bool?> getBoolSetting(String key) async {
    final setting = await getSetting(key);
    return setting?.boolValue;
  }

  /// Set an integer setting
  Future<void> setIntSetting(String key, int value) async {
    await _isar.writeTxn(() async {
      var setting = await _isar.appSettingsModels
          .filter()
          .keyEqualTo(key)
          .findFirst();
      if (setting == null) {
        setting = AppSettingsModel()..key = key;
      }
      setting.intValue = value;
      await _isar.appSettingsModels.put(setting);
    });
  }

  /// Set a string setting
  Future<void> setStringSetting(String key, String value) async {
    await _isar.writeTxn(() async {
      var setting = await _isar.appSettingsModels
          .filter()
          .keyEqualTo(key)
          .findFirst();
      if (setting == null) {
        setting = AppSettingsModel()..key = key;
      }
      setting.stringValue = value;
      await _isar.appSettingsModels.put(setting);
    });
  }

  /// Set a boolean setting
  Future<void> setBoolSetting(String key, bool value) async {
    await _isar.writeTxn(() async {
      var setting = await _isar.appSettingsModels
          .filter()
          .keyEqualTo(key)
          .findFirst();
      if (setting == null) {
        setting = AppSettingsModel()..key = key;
      }
      setting.boolValue = value;
      await _isar.appSettingsModels.put(setting);
    });
  }

  /// Get last word position
  Future<int> getLastWordPosition() async {
    return await getIntSetting(SettingsKeys.lastWordRank) ?? 0;
  }

  /// Save last word position
  Future<void> saveLastWordPosition(int position) async {
    await setIntSetting(SettingsKeys.lastWordRank, position);
  }

  /// Get default sort option index
  Future<int?> getDefaultSortOption() async {
    return await getIntSetting(SettingsKeys.defaultSortOption);
  }

  /// Save default sort option
  Future<void> saveDefaultSortOption(int optionIndex) async {
    await setIntSetting(SettingsKeys.defaultSortOption, optionIndex);
  }

  /// Get default start option index
  Future<int?> getDefaultStartOption() async {
    return await getIntSetting(SettingsKeys.defaultStartOption);
  }

  /// Save default start option
  Future<void> saveDefaultStartOption(int optionIndex) async {
    await setIntSetting(SettingsKeys.defaultStartOption, optionIndex);
  }

  /// Get theme mode
  Future<String?> getThemeMode() async {
    return await getStringSetting(SettingsKeys.themeMode);
  }

  /// Save theme mode
  Future<void> saveThemeMode(String themeMode) async {
    await setStringSetting(SettingsKeys.themeMode, themeMode);
  }
}
