import 'dart:io';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/settings_controller.dart';
import '../storage/app_storage.dart';

final dioProvider = Provider<Dio>((ref) {
  final settings = ref.watch(settingsControllerProvider);
  final storage = ref.read(appStorageProvider);

  final dio = Dio(
    BaseOptions(
      baseUrl: settings.apiBaseUrl,
      connectTimeout: const Duration(seconds: 20),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = storage.authSession?.token;
        options.headers['Accept'] = 'application/json';
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        } else {
          options.headers.remove('Authorization');
        }
        handler.next(options);
      },
    ),
  );

  if (!kIsWeb) {
    final adapter = dio.httpClientAdapter;
    if (adapter is IOHttpClientAdapter) {
      adapter.createHttpClient = () {
        final client = HttpClient();
        client.badCertificateCallback = (cert, host, port) {
          return kDebugMode;
        };
        return client;
      };
    }
  }

  return dio;
});
