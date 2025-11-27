import 'package:flutter/material.dart';

abstract class AppColors {
  // Light Mode
  static const lightBackground = Color(0xFFFFFFFF);
  static const lightSurface = Color(0xFFF5F5F5);
  static const lightCardBackground = Color(0xFFFFFFFF);
  static const lightText = Color(0xFF1C1C1E);
  static const lightTextSecondary = Color(0xFF8E8E93);
  static const lightDivider = Color(0xFFE5E5EA);

  // Dark Mode
  static const darkBackground = Color(0xFF000000);
  static const darkSurface = Color(0xFF1C1C1E);
  static const darkCardBackground = Color(0xFF2C2C2E);
  static const darkText = Color(0xFFFFFFFF);
  static const darkTextSecondary = Color(0xFF8E8E93);
  static const darkDivider = Color(0xFF38383A);

  // Accent Colors
  static const mint = Color(0xFF4ECDC4);
  static const mintLight = Color(0xFFB2DFDB);
  static const orange = Color(0xFFFFA726);
  static const purple = Color(0xFF9575CD);
  static const pink = Color(0xFFEF5350);
  static const yellow = Color(0xFFFFD54F);

  // Swipe Feedback
  static const swipeUpGreen = Color(0xFF4CAF50);
  static const swipeDownBlue = Color(0xFF2196F3);

  // Word Card Colors (Warm palette)
  static const cardBeige = Color(0xFFF5F0E8);
  static const cardBeigeDark = Color(0xFFE8DFD0);
  static const cardBrown = Color(0xFF8B7355);
  static const cardBrownLight = Color(0xFFB8A890);
  static const cardTerracotta = Color(0xFFCD8B62);
}
