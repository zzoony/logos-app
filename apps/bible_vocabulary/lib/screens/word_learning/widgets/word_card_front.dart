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
        color: isDark ? AppColors.darkCardBackground : AppColors.lightCardBackground,
        borderRadius: BorderRadius.circular(20),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
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
          const SizedBox(height: 12),
          if (word.ipaPronunciation != null)
            Text(
              word.ipaPronunciation!,
              style: AppTypography.ipaStyle.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.lightTextSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          const Spacer(),
          Text(
            'Tap to flip',
            style: TextStyle(
              fontSize: 14,
              color: isDark
                  ? AppColors.darkTextSecondary.withOpacity(0.5)
                  : AppColors.lightTextSecondary.withOpacity(0.5),
            ),
          ),
        ],
      ),
    );
  }
}
