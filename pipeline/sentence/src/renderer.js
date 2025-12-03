/**
 * Sentence Analysis Dashboard - UI Controller
 * 다크모드 분석탭 UI 상호작용 처리
 */

// 설정 상수
const CONFIG = {
  STORAGE_KEY: 'sentenceAnalysisSettings',
  DEFAULT_VERSION: 'ESV',
  BIBLE_FILES: {
    ESV: 'ESV_Bible.json',
    NIV: 'NIV_Bible.json'
  }
};

// 현재 설정 상태
let currentSettings = {
  bibleVersion: CONFIG.DEFAULT_VERSION
};

// 성경 데이터 상태
let bibleData = null;

document.addEventListener('DOMContentLoaded', async () => {
  initSettings();
  initTabs();
  initFilters();
  initButtons();
  await loadBibleData();
  initBookCards();

  // 분석 진행상황 이벤트 리스너
  window.electronAPI.onAnalysisProgress(handleAnalysisProgress);
  window.electronAPI.onAnalysisComplete(handleAnalysisComplete);
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
  renderBookCards(filter);
  console.log(`Filter applied: ${filter}`);
}

/**
 * 성경 데이터 로드
 */
async function loadBibleData() {
  try {
    const version = currentSettings.bibleVersion;

    // 1. Output 폴더 초기화
    await window.electronAPI.initOutputFolders(version);

    // 2. 성경 데이터 로드
    const result = await window.electronAPI.loadBibleData(version);

    if (result.success) {
      bibleData = result.data;

      // 3. 진행률 가져오기
      const progressResult = await window.electronAPI.getAnalysisProgress(version);
      if (progressResult.success) {
        // 각 책에 진행률 반영
        for (const book of bibleData.books) {
          const progress = progressResult.progress[book.name];
          if (progress) {
            book.analyzed = progress.analyzed;
            book.progress = book.verses > 0
              ? Math.round((progress.analyzed / book.verses) * 100)
              : 0;
          }
        }
      }

      renderBookCards();
      updateOverallStats();
      console.log(`Bible data loaded: ${version}, ${bibleData.books.length} books, ${bibleData.totalVerses} verses`);
    } else {
      console.error('Failed to load bible data:', result.error);
    }
  } catch (error) {
    console.error('Error loading bible data:', error);
  }
}

/**
 * 책 카드 렌더링
 */
function renderBookCards(filter = 'all') {
  const grid = document.getElementById('booksGrid');
  if (!grid || !bibleData) return;

  grid.innerHTML = '';

  const books = bibleData.books.filter(book => {
    if (filter === 'all') return true;
    if (filter === 'old') return book.testament === 'old';
    if (filter === 'new') return book.testament === 'new';
    return true;
  });

  books.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.bookName = book.name;
    card.dataset.testament = book.testament;

    // 분석 현황 텍스트 (항상 분석된 구절 수 표시)
    const analyzedText = `${book.analyzed.toLocaleString()} / ${book.verses.toLocaleString()}구절`;

    card.innerHTML = `
      <div class="book-name">${book.nameKo}</div>
      <div class="book-name-en">${book.name}</div>
      <div class="book-stats">${analyzedText}</div>
      <div class="book-progress-bar">
        <div class="book-progress-fill" style="width: ${book.progress}%;"></div>
      </div>
      <div class="book-progress-text">${book.progress}%</div>
    `;

    card.addEventListener('click', () => {
      if (!card.classList.contains('analyzing')) {
        card.classList.toggle('selected');
        updateSelectionInfo();
      }
    });

    grid.appendChild(card);
  });

  updateSelectionInfo();
}

/**
 * 전체 통계 업데이트
 */
function updateOverallStats() {
  if (!bibleData) return;

  // 전체/완료 구절 수 계산
  const totalVerses = bibleData.totalVerses;
  const completedVerses = bibleData.books.reduce((sum, book) => sum + book.analyzed, 0);
  const progressPercent = totalVerses > 0
    ? Math.round((completedVerses / totalVerses) * 100)
    : 0;

  // 전체 구절 수 업데이트
  const totalVersesEl = document.getElementById('totalVerses');
  if (totalVersesEl) {
    totalVersesEl.textContent = totalVerses.toLocaleString();
  }

  // 완료된 구절 수 업데이트
  const completedVersesEl = document.getElementById('completedVerses');
  if (completedVersesEl) {
    completedVersesEl.textContent = completedVerses.toLocaleString();
  }

  // 진행률 바 업데이트
  const progressFill = document.getElementById('overallProgress');
  if (progressFill) {
    progressFill.style.width = `${progressPercent}%`;
  }

  const progressText = document.getElementById('overallProgressText');
  if (progressText) {
    progressText.textContent = `${progressPercent}%`;
  }

  // 통계 카드 업데이트
  const totalSentencesEl = document.getElementById('totalSentences');
  if (totalSentencesEl) {
    totalSentencesEl.textContent = totalVerses.toLocaleString();
  }

  const completedSentencesEl = document.getElementById('completedSentences');
  if (completedSentencesEl) {
    completedSentencesEl.textContent = completedVerses.toLocaleString();
  }

  const pendingSentencesEl = document.getElementById('pendingSentences');
  if (pendingSentencesEl) {
    pendingSentencesEl.textContent = (totalVerses - completedVerses).toLocaleString();
  }

  const progressPercentEl = document.getElementById('progressPercent');
  if (progressPercentEl) {
    progressPercentEl.textContent = `${progressPercent}%`;
  }
}

/**
 * 책 카드 초기화 (이벤트 바인딩)
 */
function initBookCards() {
  // 카드는 renderBookCards에서 동적으로 생성되므로 여기서는 필터 버튼 연결만
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
async function startAnalysis(selectedCards) {
  const books = Array.from(selectedCards).map(card => card.dataset.bookName);
  const version = currentSettings.bibleVersion;

  console.log(`Starting analysis for ${books.length} books (${version})`);
  console.log('Books:', books);

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

  // 진행상황 업데이트 텍스트 초기화
  updateAnalysisStatus('분석 시작 중...');

  // 분석 패널 통계 초기화
  processingTasks.clear();
  updateProcessingList();

  const currentBookEl = document.getElementById('currentBook');
  if (currentBookEl) currentBookEl.textContent = '-';

  const currentProgressEl = document.getElementById('currentProgress');
  if (currentProgressEl) currentProgressEl.textContent = '0%';

  const completedCountEl = document.getElementById('completedCount');
  if (completedCountEl) completedCountEl.textContent = '0';

  const processingCountEl = document.getElementById('processingCount');
  if (processingCountEl) processingCountEl.textContent = '0';

  const waitingCountEl = document.getElementById('waitingCount');
  if (waitingCountEl) waitingCountEl.textContent = '0';

  const failedCountEl = document.getElementById('failedCount');
  if (failedCountEl) failedCountEl.textContent = '0';

  const analysisProgressFill = document.getElementById('analysisProgressFill');
  if (analysisProgressFill) analysisProgressFill.style.width = '0%';

  // 분석 실행
  try {
    const result = await window.electronAPI.startAnalysis({ books, version });
    if (result.success) {
      console.log('Analysis completed:', result.result);
    } else {
      console.error('Analysis failed:', result.error);
      updateAnalysisStatus(`오류: ${result.error}`);
    }
  } catch (error) {
    console.error('Analysis error:', error);
    updateAnalysisStatus(`오류: ${error.message}`);
  }
}

/**
 * 분석 중단
 */
async function stopAnalysis() {
  console.log('Stopping analysis');
  updateAnalysisStatus('분석 중단 중...');

  try {
    await window.electronAPI.stopAnalysis();
  } catch (error) {
    console.error('Stop error:', error);
  }

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

  // 데이터 새로고침
  await loadBibleData();
}

/**
 * 분석 상태 업데이트
 */
function updateAnalysisStatus(message) {
  const statusEl = document.getElementById('analysisStatus');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log(`[STATUS] ${message}`);
}

// 현재 진행중인 작업 목록 (key: "book_chapter_verse")
let processingTasks = new Map();

/**
 * 분석 진행상황 이벤트 핸들러
 */
function handleAnalysisProgress(progress) {
  const { book, chapter, verse, completed, processed, total, status, currentBook, totalBooks, bookIndex } = progress;

  // 진행률 계산 (처리된 수 기준)
  const processedCount = processed || completed;  // 이전 버전 호환
  const percent = total > 0 ? Math.round((processedCount / total) * 100) : 0;
  const pending = total - processedCount;

  // 작업 키 생성
  const taskKey = `${book}_${chapter}_${verse}`;
  const bookData = bibleData?.books?.find(b => b.name === book);
  const bookNameKo = bookData?.nameKo || book;

  // 진행중 목록 관리
  if (status === 'processing') {
    processingTasks.set(taskKey, {
      book: bookNameKo,
      chapter,
      verse,
      startTime: Date.now()
    });
  } else if (status === 'completed' || status === 'error') {
    processingTasks.delete(taskKey);
  }

  // 현재 진행중 목록 UI 업데이트
  updateProcessingList();

  // 상태 메시지 업데이트 (완료/에러 시에만)
  if (status === 'completed' || status === 'error') {
    const statusMessage = `[${bookIndex || 1}/${totalBooks || 1}] ${book} ${chapter}:${verse} (성공:${completed}/처리:${processedCount}/${total}) - ${percent}%`;
    updateAnalysisStatus(statusMessage);
  }

  // 진행률 바 업데이트
  const progressFill = document.getElementById('analysisProgressFill');
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }

  // 분석 패널 통계 업데이트
  const currentBookEl = document.getElementById('currentBook');
  if (currentBookEl) {
    currentBookEl.textContent = bookNameKo;
  }

  const currentProgressEl = document.getElementById('currentProgress');
  if (currentProgressEl) {
    currentProgressEl.textContent = `${percent}%`;
  }

  const completedCountEl = document.getElementById('completedCount');
  if (completedCountEl) {
    completedCountEl.textContent = completed.toLocaleString();
  }

  const processingCountEl = document.getElementById('processingCount');
  if (processingCountEl) {
    processingCountEl.textContent = processingTasks.size.toString();
  }

  const waitingCountEl = document.getElementById('waitingCount');
  if (waitingCountEl) {
    // 대기 = 전체 - 완료 - 진행중
    const waiting = Math.max(0, total - completed - processingTasks.size);
    waitingCountEl.textContent = waiting.toLocaleString();
  }

  // 실패 카운트 업데이트
  if (status === 'error') {
    const failedCountEl = document.getElementById('failedCount');
    if (failedCountEl) {
      const currentFailed = parseInt(failedCountEl.textContent) || 0;
      failedCountEl.textContent = (currentFailed + 1).toString();
    }
  }

  // 해당 책 카드 진행률 업데이트 (성공한 수 기준)
  const card = document.querySelector(`.book-card[data-book-name="${book}"]`);
  if (card) {
    const progressBar = card.querySelector('.book-progress-fill');
    const progressText = card.querySelector('.book-progress-text');
    const statsEl = card.querySelector('.book-stats');

    // 성공률 계산 (성공한 수 / 전체)
    const successPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (progressBar) progressBar.style.width = `${successPercent}%`;
    if (progressText) progressText.textContent = `${successPercent}%`;

    // 분석된 구절 수 업데이트 (성공한 수)
    if (statsEl && bibleData) {
      const bookInfo = bibleData.books.find(b => b.name === book);
      if (bookInfo) {
        statsEl.textContent = `${completed.toLocaleString()} / ${bookInfo.verses.toLocaleString()}구절`;
      }
    }
  }
}

/**
 * 현재 진행중 목록 UI 업데이트
 */
function updateProcessingList() {
  const processingList = document.getElementById('processingList');
  if (!processingList) return;

  if (processingTasks.size === 0) {
    processingList.innerHTML = '<li class="empty">대기 중...</li>';
    return;
  }

  const items = [];
  processingTasks.forEach((task, key) => {
    const elapsed = Math.floor((Date.now() - task.startTime) / 1000);
    items.push(`<li><span class="status-icon processing"></span>${task.book} ${task.chapter}:${task.verse} <span class="elapsed">(${elapsed}초)</span></li>`);
  });

  processingList.innerHTML = items.join('');
}

/**
 * 분석 완료 이벤트 핸들러
 */
async function handleAnalysisComplete(result) {
  console.log('Analysis complete:', result);

  const { totalCompleted, totalVerses, stopped } = result;
  const message = stopped
    ? `분석 중단됨: ${totalCompleted}/${totalVerses} 구절`
    : `분석 완료: ${totalCompleted}/${totalVerses} 구절`;

  updateAnalysisStatus(message);

  // UI 상태 복원
  const analysisPanel = document.getElementById('analysisPanel');
  if (analysisPanel) {
    analysisPanel.classList.add('hidden');
  }

  const startBtn = document.getElementById('startBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  if (startBtn) startBtn.classList.remove('hidden');
  if (cancelBtn) cancelBtn.classList.add('hidden');

  // analyzing 상태 해제
  document.querySelectorAll('.book-card.analyzing').forEach(card => {
    card.classList.remove('analyzing');
  });

  // 데이터 새로고침
  await loadBibleData();
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

/**
 * 설정 초기화
 */
function initSettings() {
  // 저장된 설정 로드
  loadSettings();

  // 라디오 버튼 이벤트 설정
  const versionRadios = document.querySelectorAll('input[name="bibleVersion"]');
  versionRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setBibleVersion(e.target.value);
    });
  });

  // UI 초기화
  updateSettingsUI();
}

/**
 * 설정 로드
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      currentSettings = { ...currentSettings, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

/**
 * 설정 저장
 */
function saveSettings() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentSettings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

/**
 * 성경 버전 설정
 */
async function setBibleVersion(version) {
  if (CONFIG.BIBLE_FILES[version]) {
    currentSettings.bibleVersion = version;
    saveSettings();
    updateSettingsUI();
    await loadBibleData();
    console.log(`Bible version changed to: ${version}`);
  }
}

/**
 * 현재 성경 버전 가져오기
 */
function getBibleVersion() {
  return currentSettings.bibleVersion;
}

/**
 * 현재 소스 파일 경로 가져오기
 */
function getSourceFilePath() {
  const version = currentSettings.bibleVersion;
  return `source-data/${CONFIG.BIBLE_FILES[version]}`;
}

/**
 * 설정 UI 업데이트
 */
function updateSettingsUI() {
  const version = currentSettings.bibleVersion;

  // 라디오 버튼 상태 업데이트
  const radio = document.querySelector(`input[name="bibleVersion"][value="${version}"]`);
  if (radio) {
    radio.checked = true;
  }

  // 현재 선택 표시 업데이트
  const versionDisplay = document.getElementById('currentVersionDisplay');
  if (versionDisplay) {
    versionDisplay.textContent = version;
  }

  // 소스 파일 경로 표시 업데이트
  const pathDisplay = document.getElementById('sourcePathDisplay');
  if (pathDisplay) {
    pathDisplay.textContent = getSourceFilePath();
  }
}

// 전역 함수로 노출 (외부 연동용)
window.updateProgress = updateProgress;
window.updateStats = updateStats;
window.getBibleVersion = getBibleVersion;
window.getSourceFilePath = getSourceFilePath;
