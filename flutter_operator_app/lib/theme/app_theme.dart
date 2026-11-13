import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppColors {
  // Brand Orange Palette
  static const primary = Color(0xFFEA580C); // Vibrant Orange (Orange 600)
  static const primaryDark = Color(0xFFC2410C); // Dark Orange (Orange 700)
  static const primaryLight = Color(0xFFFB923C); // Bright Orange (Orange 400)
  static const primaryBg = Color(0xFFFFF7ED); // Orange 50 (Soft tint)
  static const primaryBorder = Color(0xFFFFEDD5); // Orange 100

  // Backgrounds & Surfaces (White & Light Gray)
  static const background = Color(0xFFF8FAFC); // Clean light background
  static const surface = Colors.white; // Pure white cards/dialogs
  static const surfaceSecondary = Color(0xFFF1F5F9); // Light slate 100
  static const inputBg = Color(0xFFF8FAFC); // Input background

  // Borders & Dividers
  static const border = Color(0xFFE2E8F0); // Subtle slate 200
  static const borderLight = Color(0xFFF1F5F9);

  // Typography
  static const textPrimary = Color(0xFF0F172A); // Dark slate 900
  static const textSecondary = Color(0xFF475569); // Slate 600
  static const textMuted = Color(0xFF94A3B8); // Slate 400
  static const textOnPrimary = Colors.white;

  // Status & Utility Accents
  static const success = Color(0xFF16A34A);
  static const successBg = Color(0xFFF0FDF4);
  static const successBorder = Color(0xFFBBF7D0);

  static const danger = Color(0xFFDC2626);
  static const dangerBg = Color(0xFFFEF2F2);
  static const dangerBorder = Color(0xFFFECACA);

  static const warning = Color(0xFFD97706);
  static const warningBg = Color(0xFFFEFCE8);
  static const warningBorder = Color(0xFFFEF08A);

  static const info = Color(0xFF2563EB);
  static const infoBg = Color(0xFFEFF6FF);
  static const infoBorder = Color(0xFFBFDBFE);

  // Shadows
  static List<BoxShadow> get cardShadow => [
        BoxShadow(
          color: const Color(0xFF0F172A).withOpacity(0.04),
          blurRadius: 10,
          offset: const Offset(0, 3),
        ),
      ];

  static List<BoxShadow> get orangeShadow => [
        BoxShadow(
          color: primary.withOpacity(0.25),
          blurRadius: 12,
          offset: const Offset(0, 4),
        ),
      ];
}

class AppTheme {
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.background,
      primaryColor: AppColors.primary,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primary,
        secondary: AppColors.primaryLight,
        surface: AppColors.surface,
        error: AppColors.danger,
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.light().textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.textMuted,
        elevation: 8,
      ),
      useMaterial3: true,
    );
  }
}
