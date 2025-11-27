import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/word_model.dart';

class WordCardFront extends StatelessWidget {
  final WordModel word;

  const WordCardFront({super.key, required this.word});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isDark
            ? const Color(0xFF2C2C2E)
            : const Color(0xFFF5F0E8), // 따뜻한 베이지
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.1),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          const Spacer(),
          Text(
            word.word,
            style: AppTypography.wordDisplay.copyWith(
              color: isDark ? AppColors.darkText : AppColors.lightText,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          if (word.ipaPronunciation != null)
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: isDark
                    ? Colors.white.withOpacity(0.1)
                    : const Color(0xFFE8DFD0), // 베이지보다 약간 진한 색
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                word.ipaPronunciation!,
                style: AppTypography.ipaStyle.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : const Color(0xFF8B7355), // 따뜻한 브라운
                ),
                textAlign: TextAlign.center,
              ),
            ),
          const Spacer(),
          Text(
            'Tap to flip',
            style: TextStyle(
              fontSize: 14,
              color: isDark
                  ? AppColors.darkTextSecondary.withOpacity(0.5)
                  : const Color(0xFFB8A890),
            ),
          ),
        ],
      ),
    );
  }
}
