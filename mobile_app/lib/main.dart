import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/app/app.dart';
import 'src/core/storage/app_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storage = await AppStorage.init();

  runApp(
    ProviderScope(
      overrides: [appStorageProvider.overrideWithValue(storage)],
      child: const GoudaprepMobileApp(),
    ),
  );
}
