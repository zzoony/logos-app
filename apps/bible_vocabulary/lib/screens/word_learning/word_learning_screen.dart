import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/responsive.dart';
import '../../providers/learning_session_provider.dart';
import '../../providers/word_providers.dart';
import 'widgets/flip_card.dart';
import 'widgets/swipeable_card.dart';

class WordLearningScreen extends ConsumerStatefulWidget {
  const WordLearningScreen({super.key});

  @override
  ConsumerState<WordLearningScreen> createState() => _WordLearningScreenState();
}

class _WordLearningScreenState extends ConsumerState<WordLearningScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(learningSessionProvider.notifier).initSession();
    });
  }

  String _getSortLabel(SortOption option) {
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
  Widget build(BuildContext context) {
    final session = ref.watch(learningSessionProvider);
    final sentenceAsync = ref.watch(currentSentenceProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final padding = Responsive.screenPadding(context);

    if (session.words.isEmpty) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('단어 학습'),
        ),
        body: const Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    final word = session.currentWord;
    if (word == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('단어 학습'),
        ),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.check_circle,
                size: 80,
                color: AppColors.swipeUpGreen,
              ),
              const SizedBox(height: 16),
              const Text(
                '모든 단어를 학습했습니다!',
                style: TextStyle(fontSize: 18),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('${session.currentIndex + 1} / ${session.words.length}'),
        actions: [
          PopupMenuButton<SortOption>(
            onSelected: (option) {
              ref.read(sortOptionProvider.notifier).setOption(option);
              ref.read(learningSessionProvider.notifier).initSession();
            },
            itemBuilder: (context) {
              final current = ref.read(sortOptionProvider);
              return [
                CheckedPopupMenuItem(
                  value: SortOption.frequency,
                  checked: current == SortOption.frequency,
                  child: const Text('빈도순'),
                ),
                CheckedPopupMenuItem(
                  value: SortOption.alphabetical,
                  checked: current == SortOption.alphabetical,
                  child: const Text('알파벳순'),
                ),
                CheckedPopupMenuItem(
                  value: SortOption.random,
                  checked: current == SortOption.random,
                  child: const Text('랜덤'),
                ),
              ];
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _getSortLabel(ref.watch(sortOptionProvider)),
                    style: const TextStyle(fontSize: 14),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.arrow_drop_down, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Progress indicator
            LinearProgressIndicator(
              value: session.progress,
              backgroundColor:
                  isDark ? AppColors.darkSurface : AppColors.lightSurface,
              valueColor: const AlwaysStoppedAnimation(AppColors.mint),
            ),
            // Swipe hints
            Padding(
              padding: EdgeInsets.symmetric(horizontal: padding, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.arrow_upward,
                    size: 16,
                    color: AppColors.swipeUpGreen.withOpacity(0.5),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '아는 단어',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            // Card area
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxHeight: Responsive.cardHeight(context),
                    ),
                    child: SwipeableCard(
                      onSwipeLeft: () {
                        ref.read(learningSessionProvider.notifier).nextWord();
                      },
                      onSwipeRight: () {
                        ref.read(learningSessionProvider.notifier).previousWord();
                      },
                      onSwipeUp: () {
                        ref.read(learningSessionProvider.notifier).markAsKnown();
                        _showSnackBar(context, '아는 단어로 표시됨', AppColors.swipeUpGreen);
                      },
                      onSwipeDown: () {
                        ref.read(learningSessionProvider.notifier).saveToVocabulary();
                        _showSnackBar(context, '단어장에 저장됨', AppColors.swipeDownBlue);
                      },
                      child: sentenceAsync.when(
                        data: (sentence) => FlipCard(
                          word: word,
                          sentence: sentence,
                          isFlipped: session.isCardFlipped,
                          onFlip: () {
                            ref.read(learningSessionProvider.notifier).flipCard();
                            ref.read(learningSessionProvider.notifier).recordView();
                          },
                        ),
                        loading: () => FlipCard(
                          word: word,
                          sentence: null,
                          isFlipped: session.isCardFlipped,
                          onFlip: () {
                            ref.read(learningSessionProvider.notifier).flipCard();
                          },
                        ),
                        error: (_, __) => FlipCard(
                          word: word,
                          sentence: null,
                          isFlipped: session.isCardFlipped,
                          onFlip: () {
                            ref.read(learningSessionProvider.notifier).flipCard();
                          },
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Save hint
            Padding(
              padding: EdgeInsets.symmetric(horizontal: padding, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.arrow_downward,
                    size: 16,
                    color: AppColors.swipeDownBlue.withOpacity(0.5),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '저장하기',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppColors.darkTextSecondary
                          : AppColors.lightTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            // Navigation buttons
            Padding(
              padding: EdgeInsets.all(padding),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton(
                    onPressed: session.hasPrevious
                        ? () {
                            ref.read(learningSessionProvider.notifier).previousWord();
                          }
                        : null,
                    icon: const Icon(Icons.chevron_left),
                    iconSize: 32,
                  ),
                  ElevatedButton(
                    onPressed: () {
                      ref.read(learningSessionProvider.notifier).flipCard();
                      ref.read(learningSessionProvider.notifier).recordView();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.mint,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 32,
                        vertical: 12,
                      ),
                    ),
                    child: Text(session.isCardFlipped ? '앞면 보기' : '뒤집기'),
                  ),
                  IconButton(
                    onPressed: session.hasNext
                        ? () {
                            ref.read(learningSessionProvider.notifier).nextWord();
                          }
                        : null,
                    icon: const Icon(Icons.chevron_right),
                    iconSize: 32,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(BuildContext context, String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
