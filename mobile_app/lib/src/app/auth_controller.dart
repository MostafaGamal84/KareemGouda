import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/legacy.dart'
    show StateNotifier, StateNotifierProvider;

import '../core/network/app_repository.dart';
import '../core/storage/app_storage.dart';
import '../models/domain_models.dart';

final authControllerProvider = StateNotifierProvider<AuthController, AuthState>(
  (ref) {
    return AuthController(
      ref.watch(appStorageProvider),
      ref.watch(appRepositoryProvider),
    );
  },
);

@immutable
class AuthState {
  const AuthState({
    required this.initialized,
    this.session,
    this.error,
    this.isSubmitting = false,
  });

  final bool initialized;
  final AuthSession? session;
  final String? error;
  final bool isSubmitting;

  bool get isAuthenticated => session != null;
  bool get isPending => session?.status == 0;

  AuthState copyWith({
    bool? initialized,
    AuthSession? session,
    bool clearSession = false,
    String? error,
    bool clearError = false,
    bool? isSubmitting,
  }) {
    return AuthState(
      initialized: initialized ?? this.initialized,
      session: clearSession ? null : (session ?? this.session),
      error: clearError ? null : (error ?? this.error),
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._storage, this._repository)
    : super(AuthState(initialized: true, session: _storage.authSession));

  final AppStorage _storage;
  final AppRepository _repository;

  Future<bool> login({required String email, required String password}) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final session = await _repository.login(email: email, password: password);
      await _storage.saveAuthSession(session);
      state = state.copyWith(session: session, isSubmitting: false);
      return true;
    } catch (error) {
      state = state.copyWith(error: _messageFrom(error), isSubmitting: false);
      return false;
    }
  }

  Future<bool> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
    required String role,
  }) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      await _repository.register(
        email: email,
        password: password,
        firstName: firstName,
        lastName: lastName,
        role: role,
      );
      state = state.copyWith(isSubmitting: false);
      return true;
    } catch (error) {
      state = state.copyWith(error: _messageFrom(error), isSubmitting: false);
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clearAuthSession();
    await _storage.clearParticipantSession();
    state = const AuthState(initialized: true);
  }

  void clearError() {
    state = state.copyWith(clearError: true);
  }

  String _messageFrom(Object error) {
    if (error is AppException) {
      return error.message;
    }
    return 'Something went wrong. Please try again.';
  }
}
