import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../data/models/word_model.dart';
import '../../../data/models/sentence_model.dart';

class WordCardBack extends StatelessWidget {
  final WordModel word;
  final SentenceModel? sentence;

  const WordCardBack({
    super.key,
    required this.word,
    this.sentence,
  });

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
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Korean meaning
            if (word.definitionKorean != null) ...[
              Text(
                word.definitionKorean!,
                style: AppTypography.koreanMeaning.copyWith(
                  color: isDark ? AppColors.darkText : AppColors.lightText,
                ),
              ),
              const SizedBox(height: 8),
            ],
            // Korean pronunciation
            if (word.koreanPronunciation != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withOpacity(0.1)
                      : const Color(0xFFE8DFD0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  word.koreanPronunciation!,
                  style: AppTypography.koreanPronunciation.copyWith(
                    color: isDark
                        ? AppColors.darkTextSecondary
                        : const Color(0xFF8B7355),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            // Divider
            Divider(
              color: isDark
                  ? AppColors.darkDivider
                  : const Color(0xFFD4C9B8),
            ),
            const SizedBox(height: 16),
            // Example sentence
            if (sentence != null) ...[
              // English sentence
              Text(
                '"${sentence!.text}"',
                style: AppTypography.bodyLarge.copyWith(
                  color: isDark ? AppColors.darkText : AppColors.lightText,
                  fontStyle: FontStyle.italic,
                ),
              ),
              const SizedBox(height: 12),
              // Korean translation
              Text(
                '"${sentence!.korean}"',
                style: AppTypography.bodyLarge.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : const Color(0xFF6B5B4F),
                ),
              ),
              const SizedBox(height: 12),
              // Bible reference
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: isDark
                      ? AppColors.mint.withOpacity(0.15)
                      : AppColors.cardBeigeDark,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  sentence!.ref,
                  style: AppTypography.bibleReference.copyWith(
                    color: isDark ? AppColors.mint : AppColors.cardBrown,
                  ),
                ),
              ),
            ] else ...[
              Text(
                'No example sentence available',
                style: AppTypography.bodyLarge.copyWith(
                  color: isDark
                      ? AppColors.darkTextSecondary
                      : const Color(0xFF8B7355),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
