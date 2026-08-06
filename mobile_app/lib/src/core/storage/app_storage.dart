import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../models/domain_models.dart';

final appStorageProvider = Provider<AppStorage>((ref) {
  throw UnimplementedError('AppStorage must be overridden in main().');
});

class AppStorage {
  AppStorage._(this._prefs, this._secureStorage, this._authSession);

  static const _keyToken = 'quiz_token';
  static const _keyRole = 'quiz_role';
  static const _keyUserId = 'quiz_user_id';
  static const _keyEmail = 'quiz_email';
  static const _keyStatus = 'quiz_status';
  static const _keyFirstName = 'quiz_first_name';
  static const _keyLastName = 'quiz_last_name';
  static const _keyThemeMode = 'mobile_theme_mode';
  static const _keyApiBaseUrl = 'mobile_api_base_url';
  static const _keyParticipantId = 'participant_id';
  static const _keyParticipantToken = 'participant_token';
  static const _keyParticipantName = 'participant_display_name';
  static const _keyParticipantJoinStatus = 'participant_join_status';
  static const _keyParticipantSessionId = 'participant_session_id';

  final SharedPreferences _prefs;
  final FlutterSecureStorage _secureStorage;
  AuthSession? _authSession;

  static Future<AppStorage> init() async {
    const secureStorage = FlutterSecureStorage();
    final prefs = await SharedPreferences.getInstance();
    final values = await secureStorage.readAll();

    final token = values[_keyToken];
    AuthSession? session;
    if (token != null && token.isNotEmpty) {
      session = AuthSession(
        token: token,
        email: values[_keyEmail] ?? '',
        userId: int.tryParse(values[_keyUserId] ?? '') ?? 0,
        firstName: values[_keyFirstName] ?? '',
        lastName: values[_keyLastName] ?? '',
        role: AppRoleX.fromAny(values[_keyRole]),
        status: int.tryParse(values[_keyStatus] ?? '') ?? 1,
      );
    }

    return AppStorage._(prefs, secureStorage, session);
  }

  AuthSession? get authSession => _authSession;

  ThemeMode get themeMode {
    final raw = _prefs.getString(_keyThemeMode);
    return raw == 'light' ? ThemeMode.light : ThemeMode.dark;
  }

  String? get apiBaseUrl => _prefs.getString(_keyApiBaseUrl);

  ParticipantSession? get participantSession {
    final participantId = _prefs.getInt(_keyParticipantId);
    final sessionId = _prefs.getInt(_keyParticipantSessionId);
    final token = _prefs.getString(_keyParticipantToken);
    if (participantId == null || sessionId == null || token == null) {
      return null;
    }

    return ParticipantSession(
      participantId: participantId,
      sessionId: sessionId,
      participantToken: token,
      displayName: _prefs.getString(_keyParticipantName) ?? '',
      joinStatus: _prefs.getInt(_keyParticipantJoinStatus) ?? 1,
    );
  }

  Future<void> saveThemeMode(ThemeMode mode) {
    return _prefs.setString(
      _keyThemeMode,
      mode == ThemeMode.light ? 'light' : 'dark',
    );
  }

  Future<void> saveApiBaseUrl(String value) {
    return _prefs.setString(_keyApiBaseUrl, value);
  }

  Future<void> saveAuthSession(AuthSession session) async {
    _authSession = session;
    await _secureStorage.write(key: _keyToken, value: session.token);
    await _secureStorage.write(key: _keyRole, value: session.role.apiValue);
    await _secureStorage.write(key: _keyUserId, value: '${session.userId}');
    await _secureStorage.write(key: _keyEmail, value: session.email);
    await _secureStorage.write(key: _keyStatus, value: '${session.status}');
    await _secureStorage.write(key: _keyFirstName, value: session.firstName);
    await _secureStorage.write(key: _keyLastName, value: session.lastName);
  }

  Future<void> clearAuthSession() async {
    _authSession = null;
    await _secureStorage.deleteAll();
  }

  Future<void> saveParticipantSession(ParticipantSession session) async {
    await _prefs.setInt(_keyParticipantId, session.participantId);
    await _prefs.setInt(_keyParticipantSessionId, session.sessionId);
    await _prefs.setString(_keyParticipantToken, session.participantToken);
    await _prefs.setString(_keyParticipantName, session.displayName);
    await _prefs.setInt(_keyParticipantJoinStatus, session.joinStatus);
  }

  Future<void> updateParticipantJoinStatus(int status) async {
    await _prefs.setInt(_keyParticipantJoinStatus, status);
  }

  Future<void> clearParticipantSession() async {
    await _prefs.remove(_keyParticipantId);
    await _prefs.remove(_keyParticipantSessionId);
    await _prefs.remove(_keyParticipantToken);
    await _prefs.remove(_keyParticipantName);
    await _prefs.remove(_keyParticipantJoinStatus);
  }
}
