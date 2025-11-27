import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/responsive.dart';
import '../../providers/database_provider.dart';
import '../../providers/settings_provider.dart';
import '../../providers/word_providers.dart';
import 'widgets/menu_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  String _getSortOptionLabel(SortOption option) {
    switch (option) {
      case SortOption.frequency:
        return '빈도순';
      case SortOption.alphabetical:
        return '알파벳순';
      case SortOption.random:
        return '랜덤';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wordCount = ref.watch(wordCountProvider);
    final savedCount = ref.watch(savedWordCountProvider);
    final sortOption = ref.watch(sortOptionProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final padding = Responsive.screenPadding(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Logos Voca'),
        actions: [
          IconButton(
            icon: Icon(
              isDark ? Icons.light_mode : Icons.dark_mode,
            ),
            onPressed: () {
              ref.read(themeModeProvider.notifier).toggleTheme();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(padding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Today's Words",
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                _getFormattedDate(),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 32),
              MenuCard(
                title: '단어 학습',
                subtitle: wordCount.when(
                  data: (count) => '$count words · ${_getSortOptionLabel(sortOption)}',
                  loading: () => 'Loading...',
                  error: (_, __) => 'Error',
                ),
                icon: Icons.menu_book_rounded,
                accentColor: AppColors.mint,
                onTap: () => context.push('/word-learning'),
              ),
              const SizedBox(height: 16),
              MenuCard(
                title: '나만의 단어장',
                subtitle: savedCount.when(
                  data: (count) => '$count saved',
                  loading: () => 'Loading...',
                  error: (_, __) => 'Error',
                ),
                icon: Icons.star_rounded,
                accentColor: AppColors.orange,
                onTap: () => context.push('/my-vocabulary'),
              ),
              const SizedBox(height: 16),
              MenuCard(
                title: '설정',
                subtitle: 'Theme, preferences',
                icon: Icons.settings_rounded,
                accentColor: AppColors.purple,
                onTap: () => context.push('/settings'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getFormattedDate() {
    final now = DateTime.now();
    final months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return '${months[now.month - 1]} ${now.day}, ${now.year}';
  }
}
