/**
 * Sentence Analysis Dashboard - UI Controller
 * 다크모드 분석탭 UI 상호작용 처리
 */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initFilters();
  initBookCards();
  initButtons();
});

/**
 * 탭 네비게이션 초기화
 */
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // 모든 탭 버튼 비활성화
      tabBtns.forEach(b => b.classList.remove('active'));
      // 클릭한 탭 버튼 활성화
      btn.classList.add('active');

      // 모든 탭 컨텐츠 숨기기
      tabContents.forEach(content => {
        content.style.display = 'none';
      });

      // 해당 탭 컨텐츠 표시
      const targetContent = document.getElementById(`${targetTab}Tab`);
      if (targetContent) {
        targetContent.style.display = 'block';
      }
    });
  });
}

/**
 * 필터 버튼 초기화
 */
function initFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 같은 그룹의 버튼들만 비활성화
      const parent = btn.closest('.filter-buttons');
      parent.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      filterBooks(filter);
    });
  });
}

/**
 * 책 필터링
 */
function filterBooks(filter) {
  const cards = document.querySelectorAll('.book-card');

  // 현재는 모든 카드를 표시 (실제 구현시 구약/신약 구분 필요)
  cards.forEach(card => {
    card.style.display = 'block';
  });

  console.log(`Filter applied: ${filter}`);
}

/**
 * 책 카드 초기화
 */
function initBookCards() {
  const cards = document.querySelectorAll('.book-card');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      // analyzing 상태가 아닐 때만 선택 토글
      if (!card.classList.contains('analyzing')) {
        card.classList.toggle('selected');
        updateSelectionInfo();
      }
    });
  });
}

/**
 * 선택 정보 업데이트
 */
function updateSelectionInfo() {
  const selectedCards = document.querySelectorAll('.book-card.selected');
  const count = selectedCards.length;

  // 선택된 책 수 업데이트
  const selectedCountEl = document.getElementById('selectedCount');
  if (selectedCountEl) {
    selectedCountEl.textContent = `${count}권 선택됨`;
  }

  // 선택 텍스트 업데이트
  const selectionTextEl = document.getElementById('selectionText');
  if (selectionTextEl) {
    if (count === 0) {
      selectionTextEl.textContent = '선택된 책이 없습니다';
    } else {
      selectionTextEl.textContent = `${count}권 선택됨`;
    }
  }

  // 버튼 활성화/비활성화
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.disabled = count === 0;
  }
}

/**
 * 버튼 초기화
 */
function initButtons() {
  // 전체 선택 버튼
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.book-card').forEach(card => {
        if (!card.classList.contains('analyzing')) {
          card.classList.add('selected');
        }
      });
      updateSelectionInfo();
    });
  }

  // 선택 해제 버튼
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.book-card').forEach(card => {
        card.classList.remove('selected');
      });
      updateSelectionInfo();
    });
  }

  // 새로고침 버튼
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      console.log('Refresh clicked');
      // 실제 구현시 데이터 새로고침 로직
    });
  }

  // 분석 시작 버튼
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const selectedCards = document.querySelectorAll('.book-card.selected');
      if (selectedCards.length > 0) {
        startAnalysis(selectedCards);
      }
    });
  }

  // 중단 버튼
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      stopAnalysis();
    });
  }

  // 파일 선택 버튼
  const fileSelectBtn = document.getElementById('analyzeFileSelectBtn');
  if (fileSelectBtn) {
    fileSelectBtn.addEventListener('click', () => {
      console.log('File select clicked');
      // 실제 구현시 파일 선택 패널 표시
    });
  }
}

/**
 * 분석 시작
 */
function startAnalysis(selectedCards) {
  console.log(`Starting analysis for ${selectedCards.length} books`);

  // UI 상태 변경
  const analysisPanel = document.getElementById('analysisPanel');
  if (analysisPanel) {
    analysisPanel.classList.remove('hidden');
  }

  // 버튼 상태 변경
  const startBtn = document.getElementById('startBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  if (startBtn) startBtn.classList.add('hidden');
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  // 선택된 카드들을 analyzing 상태로
  selectedCards.forEach(card => {
    card.classList.remove('selected');
    card.classList.add('analyzing');
  });

  // 실제 구현시 분석 로직 실행
}

/**
 * 분석 중단
 */
function stopAnalysis() {
  console.log('Stopping analysis');

  // UI 상태 변경
  const analysisPanel = document.getElementById('analysisPanel');
  if (analysisPanel) {
    analysisPanel.classList.add('hidden');
  }

  // 버튼 상태 변경
  const startBtn = document.getElementById('startBtn');
  const cancelBtn = document.getElementById('cancelBtn');

  if (startBtn) startBtn.classList.remove('hidden');
  if (cancelBtn) cancelBtn.classList.add('hidden');

  // analyzing 상태 해제
  document.querySelectorAll('.book-card.analyzing').forEach(card => {
    card.classList.remove('analyzing');
  });
}

/**
 * 진행률 업데이트 (외부에서 호출)
 */
function updateProgress(completed, total) {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const progressFill = document.getElementById('overallProgress');
  const progressText = document.getElementById('overallProgressText');
  const completedEl = document.getElementById('completedVerses');

  if (progressFill) progressFill.style.width = `${percentage}%`;
  if (progressText) progressText.textContent = `${percentage}%`;
  if (completedEl) completedEl.textContent = completed.toLocaleString();
}

/**
 * 통계 업데이트 (외부에서 호출)
 */
function updateStats(stats) {
  const elements = {
    totalSentences: stats.total,
    completedSentences: stats.completed,
    pendingSentences: stats.pending,
    failedSentences: stats.failed,
    progressPercent: `${stats.percentage}%`
  };

  for (const [id, value] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }
  }
}

// 전역 함수로 노출 (외부 연동용)
window.updateProgress = updateProgress;
window.updateStats = updateStats;
