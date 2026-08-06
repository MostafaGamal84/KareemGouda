import 'package:flutter/material.dart';

class AppTheme {
  static const Color wine = Color(0xFF731718);
  static const Color darkBg = Color(0xFF202020);
  static const Color darkSurface = Color(0xFF242323);
  static const Color darkSoft = Color(0xFF282C33);
  static const Color lightBg = Color(0xFFF8F9FA);
  static const Color lightSoft = Color(0xFFF1F3F5);
  static const Color steel = Color(0xFF525254);

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: steel,
      secondary: wine,
      surface: darkSurface,
      error: Color(0xFFEF4444),
    );

    return _baseTheme(
      scheme,
      scaffold: darkBg,
      card: darkSurface,
      muted: const Color(0xFF9CA3AF),
    );
  }

  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: steel,
      secondary: wine,
      surface: Colors.white,
      error: Color(0xFFDC3545),
    );

    return _baseTheme(
      scheme,
      scaffold: lightBg,
      card: Colors.white,
      muted: const Color(0xFF6C757D),
    );
  }

  static ThemeData _baseTheme(
    ColorScheme scheme, {
    required Color scaffold,
    required Color card,
    required Color muted,
  }) {
    final borderRadius = BorderRadius.circular(18);

    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scaffold,
      cardColor: card,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: card,
        foregroundColor: scheme.onSurface,
        elevation: 0,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.24),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: wine, width: 1.4),
        ),
      ),
      cardTheme: CardThemeData(
        color: card,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: borderRadius,
          side: BorderSide(
            color: scheme.outlineVariant.withValues(alpha: 0.45),
          ),
        ),
        margin: EdgeInsets.zero,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: darkSurface,
        contentTextStyle: const TextStyle(color: Colors.white),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      navigationDrawerTheme: NavigationDrawerThemeData(
        backgroundColor: card,
        surfaceTintColor: Colors.transparent,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: card,
        indicatorColor: wine.withValues(alpha: 0.15),
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: wine,
        foregroundColor: Colors.white,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: scheme.surfaceContainerHighest.withValues(alpha: 0.35),
        selectedColor: wine.withValues(alpha: 0.15),
        side: BorderSide(color: scheme.outlineVariant),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
        labelStyle: TextStyle(
          color: scheme.onSurface,
          fontWeight: FontWeight.w600,
        ),
      ),
      textTheme: TextTheme(
        headlineMedium: TextStyle(
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
        headlineSmall: TextStyle(
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
        titleLarge: TextStyle(
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
        bodyMedium: TextStyle(height: 1.45, color: scheme.onSurface),
        bodySmall: TextStyle(height: 1.4, color: muted),
      ),
    );
  }
}
