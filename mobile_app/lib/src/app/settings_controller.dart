import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/legacy.dart'
    show StateNotifier, StateNotifierProvider;

import '../core/storage/app_storage.dart';

final settingsControllerProvider =
    StateNotifierProvider<SettingsController, AppSettings>((ref) {
      return SettingsController(ref.watch(appStorageProvider));
    });

@immutable
class AppSettings {
  const AppSettings({required this.themeMode, required this.apiBaseUrl});

  final ThemeMode themeMode;
  final String apiBaseUrl;

  AppSettings copyWith({ThemeMode? themeMode, String? apiBaseUrl}) {
    return AppSettings(
      themeMode: themeMode ?? this.themeMode,
      apiBaseUrl: apiBaseUrl ?? this.apiBaseUrl,
    );
  }
}

class SettingsController extends StateNotifier<AppSettings> {
  SettingsController(this._storage)
    : super(
        AppSettings(
          themeMode: _storage.themeMode,
          apiBaseUrl: _storage.apiBaseUrl ?? _defaultApiBaseUrl(),
        ),
      );

  final AppStorage _storage;

  Future<void> toggleTheme() async {
    final next = state.themeMode == ThemeMode.dark
        ? ThemeMode.light
        : ThemeMode.dark;
    state = state.copyWith(themeMode: next);
    await _storage.saveThemeMode(next);
  }

  Future<void> saveApiBaseUrl(String value) async {
    final trimmed = value.trim().replaceAll(RegExp(r'/$'), '');
    if (trimmed.isEmpty) {
      return;
    }

    state = state.copyWith(apiBaseUrl: trimmed);
    await _storage.saveApiBaseUrl(trimmed);
  }

  static String _defaultApiBaseUrl() {
    if (kIsWeb) {
      return '/api';
    }

    if (Platform.isAndroid) {
      return 'https://10.0.2.2:5001/api';
    }

    return 'https://localhost:5001/api';
  }
}
