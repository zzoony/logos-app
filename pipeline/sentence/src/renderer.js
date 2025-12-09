/**
 * Sentence Analysis Dashboard - UI Controller
 * 다크모드 분석탭 UI 상호작용 처리
 */

// 설정 상수
const CONFIG = {
  STORAGE_KEY: 'sentenceAnalysisSettings',
  DEFAULT_VERSION: 'ESV',
  DEFAULT_EDITOR: 'antigravity',
  DEFAULT_ANALYSIS_METHOD: 'api',
  BIBLE_FILES: {
    ESV: 'ESV_Bible.json',
    NIV: 'NIV_Bible.json',
    KJV: 'KJV_Bible.json',
    Easy: 'Easy_Bible.json',
    Hebrew: 'Hebrew_Bible.json'
  },
  EDITORS: {
    cursor: 'Cursor',
    antigravity: 'Antigravity'
  },
  ANALYSIS_METHODS: {
    api: { name: 'Z.AI API', poolSize: 4 },
    claude: { name: 'Claude CLI', poolSize: 30 },
    droid: { name: 'Droid Exec', poolSize: 30 }
  }
};

// 현재 설정 상태
let currentSettings = {
  bibleVersion: CONFIG.DEFAULT_VERSION,
  editor: CONFIG.DEFAULT_EDITOR,
  analysisMethod: CONFIG.DEFAULT_ANALYSIS_METHOD
};

// 성경 데이터 상태
let bibleData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 앱 버전 표시 (package.json에서 가져옴)
  await loadAppVersion();

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
 * 앱 버전 로드 및 표시
 * package.json의 버전을 가져와서 UI에 표시
 */
async function loadAppVersion() {
  try {
    const version = await window.electronAPI.getAppVersion();
    const versionEl = document.getElementById('appVersion');
    if (versionEl && version) {
      versionEl.textContent = `v${version}`;
    }
  } catch (error) {
    console.warn('Failed to load app version:', error);
  }
}

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
    const analyzed = typeof book.analyzed === 'number' ? book.analyzed : 0;
    const analyzedText = `${analyzed.toLocaleString()} / ${book.verses.toLocaleString()}구절`;

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
  const completedVerses = bibleData.books.reduce((sum, book) => sum + (book.analyzed || 0), 0);
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

  // 선택된 책의 총 구절 수와 남은 구절 수 계산
  let totalVerses = 0;
  let remainingVerses = 0;

  selectedCards.forEach(card => {
    const bookName = card.dataset.bookName;
    const book = bibleData?.books?.find(b => b.name === bookName);
    if (book) {
      totalVerses += book.verses || 0;
      const analyzed = book.analyzed || 0;
      remainingVerses += Math.max(0, (book.verses || 0) - analyzed);
    }
  });

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
      selectionTextEl.textContent = `${count}권 선택됨 (${totalVerses.toLocaleString()}구절, 남은 ${remainingVerses.toLocaleString()}구절)`;
    }
  }

  // 예상 소요 시간 계산 및 업데이트
  const estimateTextEl = document.getElementById('estimateText');
  if (estimateTextEl) {
    if (count === 0 || remainingVerses === 0) {
      estimateTextEl.textContent = '예상 소요 시간: -';
    } else {
      // 평균 처리 시간: API=30초, Claude/Droid=12초 (병렬 처리 기준)
      const method = currentSettings.analysisMethod;
      const avgTimePerVerse = method === 'api' ? 30 : 12;  // 초
      const poolSize = CONFIG.ANALYSIS_METHODS[method]?.poolSize || 4;

      // 예상 시간 = (남은 구절 * 평균시간) / 풀크기
      const estimatedSeconds = Math.ceil((remainingVerses * avgTimePerVerse) / poolSize);

      // 시간 포맷
      const hours = Math.floor(estimatedSeconds / 3600);
      const minutes = Math.floor((estimatedSeconds % 3600) / 60);

      let timeStr;
      if (hours > 0) {
        timeStr = `약 ${hours}시간 ${minutes}분`;
      } else if (minutes > 0) {
        timeStr = `약 ${minutes}분`;
      } else {
        timeStr = '1분 미만';
      }

      estimateTextEl.textContent = `예상 소요 시간: ${timeStr} (${method.toUpperCase()}, ${poolSize}워커)`;
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

  // 분석 완료 이벤트 중복 방지 플래그 초기화
  analysisCompleteHandled = false;

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
function updateAnalysisStatus(message, logToConsole = true) {
  const statusEl = document.getElementById('analysisStatus');
  if (statusEl) {
    statusEl.textContent = message;
  }
  if (logToConsole) {
    console.log(`[STATUS] ${message}`);
  }
}

// 현재 진행중인 작업 목록 (key: "book_chapter_verse")
let processingTasks = new Map();

/**
 * 분석 진행상황 이벤트 핸들러
 */
function handleAnalysisProgress(progress) {
  const { book, chapter, verse, completed, processed, total, status, currentBook, totalBooks, bookIndex, bookCompleted, bookTotal, sessionCompleted, toAnalyze, retrySession, maxRetrySessions, failedCount, error } = progress;

  // 진행률 계산 (처리된 수 기준)
  const processedCount = processed || completed;  // 이전 버전 호환
  const percent = total > 0 ? Math.round((processedCount / total) * 100) : 0;
  const pending = total - processedCount;

  // 작업 키 생성
  const taskKey = `${book}_${chapter}_${verse}`;
  const bookData = bibleData?.books?.find(b => b.name === book);
  const bookNameKo = bookData?.nameKo || book;

  // 타임스탬프 생성 함수
  const getTimestamp = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  };

  // 재시도 세션 시작 처리
  if (status === 'retry_starting' || status === 'retry_init') {
    const retryStatusEl = document.getElementById('retrySessionStatus');
    if (retryStatusEl) {
      retryStatusEl.classList.remove('hidden');
      retryStatusEl.innerHTML = `<span class="retry-badge">재시도 ${retrySession}/${maxRetrySessions}</span> 실패 ${failedCount || 0}개 구절 재시도 중...`;
    }
    console.log(`[${getTimestamp()}] 🔄 재시도 세션 ${retrySession}/${maxRetrySessions} 시작 - ${failedCount || 0}개 구절`);
    return;
  }

  // 진행중 목록 관리 및 로그 출력
  if (status === 'processing') {
    processingTasks.set(taskKey, {
      book: bookNameKo,
      chapter,
      verse,
      startTime: Date.now()
    });
    // 시작 로그 (재시도 세션 표시)
    const retryPrefix = retrySession > 0 ? `[재시도 ${retrySession}] ` : '';
    console.log(`[${getTimestamp()}] 🚀 ${retryPrefix}시작: ${book} ${chapter}:${verse}`);
  } else if (status === 'completed') {
    const task = processingTasks.get(taskKey);
    const elapsed = task ? ((Date.now() - task.startTime) / 1000).toFixed(1) : '?';
    processingTasks.delete(taskKey);
    // 완료 로그 (재시도 세션 표시)
    const retryPrefix = retrySession > 0 ? `[재시도 ${retrySession}] ` : '';
    console.log(`[${getTimestamp()}] ✅ ${retryPrefix}완료: ${book} ${chapter}:${verse} (${elapsed}s) | 진행: ${completed}/${total} (${percent}%)`);
  } else if (status === 'error') {
    processingTasks.delete(taskKey);
    // 에러 로그 (재시도 세션 표시)
    const retryPrefix = retrySession > 0 ? `[재시도 ${retrySession}] ` : '';
    console.error(`[${getTimestamp()}] ❌ ${retryPrefix}실패: ${book} ${chapter}:${verse} - ${error || 'Unknown error'}`);
  }

  // 현재 진행중 목록 UI 업데이트
  updateProcessingList();

  // 상태 메시지 업데이트 (완료/에러 시에만)
  if (status === 'completed' || status === 'error') {
    // UI 상태 메시지 (재시도 세션 정보 포함)
    const retryInfo = retrySession > 0 ? `[재시도 ${retrySession}/${maxRetrySessions}] ` : '';
    const statusMessage = `${retryInfo}[${bookIndex || 1}/${totalBooks || 1}] ${book} ${chapter}:${verse} (${completed}/${total}) - ${percent}%`;
    updateAnalysisStatus(statusMessage, false);  // 콘솔에는 출력하지 않음
  }

  // 재시도 세션 상태 UI 업데이트
  const retryStatusEl = document.getElementById('retrySessionStatus');
  if (retryStatusEl) {
    if (retrySession > 0) {
      retryStatusEl.classList.remove('hidden');
      const currentFailed = failedCount || 0;
      retryStatusEl.innerHTML = `<span class="retry-badge">재시도 ${retrySession}/${maxRetrySessions}</span> 진행 중... (실패: ${currentFailed}개)`;
    } else {
      retryStatusEl.classList.add('hidden');
    }
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
    // 세션에서 완료된 수 표시 (sessionCompleted가 없으면 기존 방식 사용)
    const displayCompleted = sessionCompleted ?? 0;
    completedCountEl.textContent = displayCompleted.toLocaleString();
  }

  const processingCountEl = document.getElementById('processingCount');
  if (processingCountEl) {
    processingCountEl.textContent = processingTasks.size.toString();
  }

  const waitingCountEl = document.getElementById('waitingCount');
  if (waitingCountEl) {
    // 대기 = 분석해야 할 구절 - 세션 완료 - 진행중
    const analyzeTotal = toAnalyze ?? (total - completed + (sessionCompleted ?? 0));
    const waiting = Math.max(0, analyzeTotal - (sessionCompleted ?? 0) - processingTasks.size);
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

    // 책별 진행률 계산 (bookCompleted가 있으면 사용, 없으면 fallback)
    const currentBookCompleted = bookCompleted ?? 0;
    const currentBookTotal = bookTotal ?? (bibleData?.books?.find(b => b.name === book)?.verses ?? 0);
    const bookPercent = currentBookTotal > 0 ? Math.round((currentBookCompleted / currentBookTotal) * 100) : 0;

    if (progressBar) progressBar.style.width = `${bookPercent}%`;
    if (progressText) progressText.textContent = `${bookPercent}%`;

    // 분석된 구절 수 업데이트 (책별 수치)
    if (statsEl) {
      statsEl.textContent = `${currentBookCompleted.toLocaleString()} / ${currentBookTotal.toLocaleString()}구절`;
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

// 분석 완료 이벤트 중복 방지 플래그
let analysisCompleteHandled = false;

/**
 * 분석 완료 이벤트 핸들러
 */
async function handleAnalysisComplete(result) {
  console.log('Analysis complete:', result);

  // 이미 처리된 완료 이벤트는 무시 (늦게 도착한 프로세스 응답 등)
  if (analysisCompleteHandled) {
    console.log('Analysis complete event already handled, ignoring duplicate');
    return;
  }
  analysisCompleteHandled = true;

  const { totalCompleted, totalVerses, totalFailed, retrySessionsUsed, maxRetrySessions, stopped } = result;

  // 재시도 세션 정보 포함 메시지
  let message;
  if (stopped) {
    message = `분석 중단됨: ${totalCompleted}/${totalVerses} 구절`;
  } else if (totalFailed > 0) {
    message = `분석 완료: ${totalCompleted}/${totalVerses} 구절 (실패 ${totalFailed}개, 재시도 ${retrySessionsUsed || 0}회)`;
  } else {
    message = `분석 완료: ${totalCompleted}/${totalVerses} 구절`;
    if (retrySessionsUsed > 0) {
      message += ` (재시도 ${retrySessionsUsed}회로 모두 성공)`;
    }
  }

  updateAnalysisStatus(message);

  // 재시도 상태 UI 숨기기
  const retryStatusEl = document.getElementById('retrySessionStatus');
  if (retryStatusEl) {
    retryStatusEl.classList.add('hidden');
  }

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

  // 완료 팝업 표시 (재시도 정보 포함)
  let alertMessage;
  if (stopped) {
    alertMessage = `분석이 중단되었습니다.\n\n처리된 구절: ${totalCompleted}/${totalVerses}`;
  } else {
    alertMessage = `분석이 완료되었습니다!\n\n처리된 구절: ${totalCompleted}/${totalVerses}`;
    if (retrySessionsUsed > 0) {
      alertMessage += `\n재시도 세션: ${retrySessionsUsed}/${maxRetrySessions}회 사용`;
    }
    if (totalFailed > 0) {
      alertMessage += `\n최종 실패: ${totalFailed}개 구절`;
    }
  }
  alert(alertMessage);
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
async function initSettings() {
  // 저장된 설정 로드 (main process와 동기화 포함)
  await loadSettings();

  // 성경 버전 라디오 버튼 이벤트 설정
  const versionRadios = document.querySelectorAll('input[name="bibleVersion"]');
  versionRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setBibleVersion(e.target.value);
    });
  });

  // 에디터 선택 라디오 버튼 이벤트 설정
  const editorRadios = document.querySelectorAll('input[name="editorChoice"]');
  editorRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setEditor(e.target.value);
    });
  });

  // 분석 방법 라디오 버튼 이벤트 설정
  const methodRadios = document.querySelectorAll('input[name="analysisMethod"]');
  methodRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      setAnalysisMethodUI(e.target.value);
    });
  });

  // UI 초기화
  updateSettingsUI();
}

/**
 * 설정 로드
 */
async function loadSettings() {
  try {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      currentSettings = { ...currentSettings, ...parsed };

      // 분석 방법을 main process와 동기화
      if (currentSettings.analysisMethod) {
        await window.electronAPI.setAnalysisMethod(currentSettings.analysisMethod);
        console.log(`Synced analysis method: ${currentSettings.analysisMethod} (pool: ${CONFIG.ANALYSIS_METHODS[currentSettings.analysisMethod]?.poolSize || 4})`);
      }
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
 * 에디터 설정
 */
function setEditor(editor) {
  if (CONFIG.EDITORS[editor]) {
    currentSettings.editor = editor;
    saveSettings();
    updateSettingsUI();
    console.log(`Editor changed to: ${editor}`);
  }
}

/**
 * 현재 에디터 가져오기
 */
function getEditor() {
  return currentSettings.editor;
}

/**
 * 분석 방법 설정 (UI에서 호출)
 */
async function setAnalysisMethodUI(method) {
  if (CONFIG.ANALYSIS_METHODS[method]) {
    currentSettings.analysisMethod = method;
    saveSettings();
    updateSettingsUI();

    // analyzer.js에 분석 방법 변경 알림
    try {
      await window.electronAPI.setAnalysisMethod(method);
      console.log(`Analysis method changed to: ${method}`);
    } catch (e) {
      console.error('Failed to set analysis method:', e);
    }
  }
}

/**
 * 현재 분석 방법 가져오기
 */
function getAnalysisMethod() {
  return currentSettings.analysisMethod;
}

/**
 * 현재 분석 방법의 Pool 크기 가져오기
 */
function getPoolSize() {
  const method = currentSettings.analysisMethod;
  return CONFIG.ANALYSIS_METHODS[method]?.poolSize || 4;
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
  const editor = currentSettings.editor;

  // 성경 버전 라디오 버튼 상태 업데이트
  const versionRadio = document.querySelector(`input[name="bibleVersion"][value="${version}"]`);
  if (versionRadio) {
    versionRadio.checked = true;
  }

  // 현재 버전 선택 표시 업데이트
  const versionDisplay = document.getElementById('currentVersionDisplay');
  if (versionDisplay) {
    versionDisplay.textContent = version;
  }

  // 소스 파일 경로 표시 업데이트
  const pathDisplay = document.getElementById('sourcePathDisplay');
  if (pathDisplay) {
    pathDisplay.textContent = getSourceFilePath();
  }

  // 에디터 라디오 버튼 상태 업데이트
  const editorRadio = document.querySelector(`input[name="editorChoice"][value="${editor}"]`);
  if (editorRadio) {
    editorRadio.checked = true;
  }

  // 현재 에디터 선택 표시 업데이트
  const editorDisplay = document.getElementById('currentEditorDisplay');
  if (editorDisplay) {
    editorDisplay.textContent = CONFIG.EDITORS[editor] || editor;
  }

  // 분석 방법 라디오 버튼 상태 업데이트
  const method = currentSettings.analysisMethod;
  const methodRadio = document.querySelector(`input[name="analysisMethod"][value="${method}"]`);
  if (methodRadio) {
    methodRadio.checked = true;
  }

  // 현재 분석 방법 선택 표시 업데이트
  const methodDisplay = document.getElementById('currentMethodDisplay');
  if (methodDisplay) {
    methodDisplay.textContent = CONFIG.ANALYSIS_METHODS[method]?.name || method;
  }

  // 현재 Pool 크기 표시 업데이트 (설정 탭)
  const poolSizeDisplay = document.getElementById('currentPoolSize');
  if (poolSizeDisplay) {
    const poolSize = CONFIG.ANALYSIS_METHODS[method]?.poolSize || 4;
    poolSizeDisplay.textContent = `동시 실행: ${poolSize}개`;
  }

  // 분석 탭의 배치 개수 입력 및 힌트 업데이트
  const poolSize = CONFIG.ANALYSIS_METHODS[method]?.poolSize || 4;
  const batchSizeInput = document.getElementById('batchSizeInput');
  if (batchSizeInput) {
    batchSizeInput.value = poolSize;
  }
  const batchSizeHint = document.getElementById('batchSizeHint');
  if (batchSizeHint) {
    batchSizeHint.textContent = `(기본값: ${poolSize}, 범위: 1-50)`;
  }

  // 분석 패널의 Pool 표시 업데이트
  const currentPoolDisplay = document.getElementById('currentPoolDisplay');
  if (currentPoolDisplay) {
    currentPoolDisplay.textContent = poolSize;
  }

  // 헤더 상태 표시 업데이트
  const headerBibleVersion = document.getElementById('headerBibleVersion');
  if (headerBibleVersion) {
    headerBibleVersion.textContent = version.toUpperCase();
  }
  const headerAnalysisMethod = document.getElementById('headerAnalysisMethod');
  if (headerAnalysisMethod) {
    const methodNames = { api: 'API', claude: 'Claude', droid: 'Droid' };
    headerAnalysisMethod.textContent = methodNames[method] || method.toUpperCase();
  }
}

// 전역 함수로 노출 (외부 연동용)
window.updateProgress = updateProgress;
window.updateStats = updateStats;
window.getBibleVersion = getBibleVersion;
window.getSourceFilePath = getSourceFilePath;

// ===================================
// 검증 탭 기능
// ===================================

// 검증 결과 상태
let validationResults = null;
let validationSelectedBooks = new Set();

/**
 * 검증 탭 초기화
 */
function initValidationTab() {
  // 검증 이벤트 리스너 등록
  window.electronAPI.onValidationProgress(handleValidationProgress);
  window.electronAPI.onValidationComplete(handleValidationComplete);

  // 전체 선택 버튼
  const selectAllBtn = document.getElementById('validateSelectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('#validateBooksGrid .book-card').forEach(card => {
        card.classList.add('selected');
        validationSelectedBooks.add(card.dataset.bookName);
      });
      updateValidationSelectionInfo();
    });
  }

  // 검증 시작 버튼
  const startBtn = document.getElementById('startValidationBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (validationSelectedBooks.size > 0) {
        startValidation();
      }
    });
  }

  // 리포트 내보내기 버튼
  const exportBtn = document.getElementById('exportReportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportValidationReport);
  }

  // 이슈 탭 버튼
  const issueTabBtns = document.querySelectorAll('.issue-tab-btn');
  issueTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      issueTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderIssueList(btn.dataset.issue);
    });
  });
}

/**
 * 검증 탭 책 카드 렌더링
 */
function renderValidationBookCards() {
  const grid = document.getElementById('validateBooksGrid');
  if (!grid || !bibleData) return;

  grid.innerHTML = '';
  validationSelectedBooks.clear();

  // 분석된 책만 표시 (analyzed > 0)
  const analyzedBooks = bibleData.books.filter(book => book.analyzed > 0);

  if (analyzedBooks.length === 0) {
    grid.innerHTML = '<div class="issue-empty"><h4>분석된 구절이 없습니다</h4><p>먼저 분석 탭에서 구절을 분석해주세요.</p></div>';
    return;
  }

  analyzedBooks.forEach(book => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.bookName = book.name;
    card.dataset.testament = book.testament;
    card.style.position = 'relative';

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
      card.classList.toggle('selected');
      if (card.classList.contains('selected')) {
        validationSelectedBooks.add(book.name);
      } else {
        validationSelectedBooks.delete(book.name);
      }
      updateValidationSelectionInfo();
    });

    grid.appendChild(card);
  });

  // 검증 통계 초기화
  updateValidationStats(0, 0, 0);
  updateValidationSelectionInfo();
}

/**
 * 검증 선택 정보 업데이트
 */
function updateValidationSelectionInfo() {
  const count = validationSelectedBooks.size;

  const selectedCountEl = document.getElementById('validateSelectedCount');
  if (selectedCountEl) {
    selectedCountEl.textContent = `${count}권 선택됨`;
  }

  const selectionTextEl = document.getElementById('validateSelectionText');
  if (selectionTextEl) {
    if (count === 0) {
      selectionTextEl.textContent = '책을 선택하세요';
    } else {
      // 선택된 책들의 분석된 구절 수 합계
      let totalAnalyzed = 0;
      validationSelectedBooks.forEach(bookName => {
        const book = bibleData?.books?.find(b => b.name === bookName);
        if (book) totalAnalyzed += book.analyzed || 0;
      });
      selectionTextEl.textContent = `${count}권 선택됨 (${totalAnalyzed.toLocaleString()} 구절)`;
    }
  }

  const startBtn = document.getElementById('startValidationBtn');
  if (startBtn) {
    startBtn.disabled = count === 0;
  }
}

/**
 * 검증 통계 업데이트
 */
function updateValidationStats(total, valid, issues) {
  const totalEl = document.getElementById('validateTotalVerses');
  if (totalEl) totalEl.textContent = total.toLocaleString();

  const passedEl = document.getElementById('validatePassedVerses');
  if (passedEl) passedEl.textContent = valid.toLocaleString();

  const issueEl = document.getElementById('validateIssueCount');
  if (issueEl) issueEl.textContent = issues.toLocaleString();

  const failedEl = document.getElementById('validateFailedVerses');
  if (failedEl) failedEl.textContent = (total - valid).toLocaleString();

  const rateEl = document.getElementById('validatePassRate');
  if (rateEl) {
    const rate = total > 0 ? Math.round((valid / total) * 100) : 0;
    rateEl.textContent = `${rate}%`;
  }
}

/**
 * 검증 시작
 */
async function startValidation() {
  const books = Array.from(validationSelectedBooks);
  const version = currentSettings.bibleVersion;

  console.log(`Starting validation for ${books.length} books (${version})`);

  // UI 상태 변경
  const validationPanel = document.getElementById('validationPanel');
  if (validationPanel) {
    validationPanel.classList.remove('hidden');
  }

  const resultsPanel = document.getElementById('validationResultsPanel');
  if (resultsPanel) {
    resultsPanel.classList.add('hidden');
  }

  // 이슈 탭 필터 리셋 (전체로)
  const issueTabBtns = document.querySelectorAll('.issue-tab-btn');
  issueTabBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.issue === 'all') {
      btn.classList.add('active');
    }
  });

  // 버튼 비활성화
  const startBtn = document.getElementById('startValidationBtn');
  if (startBtn) startBtn.disabled = true;

  // 선택된 카드에 analyzing 클래스 추가 (selected는 유지)
  document.querySelectorAll('#validateBooksGrid .book-card.selected').forEach(card => {
    card.classList.add('analyzing');
  });

  // 상태 초기화
  const statusEl = document.getElementById('validationStatus');
  if (statusEl) statusEl.textContent = '검증 시작 중...';

  const progressFill = document.getElementById('validationProgressFill');
  if (progressFill) progressFill.style.width = '0%';

  // 검증 실행
  try {
    const result = await window.electronAPI.startValidation({ books, version });
    if (result.success) {
      console.log('Validation completed:', result.result);
    } else {
      console.error('Validation failed:', result.error);
      const statusEl = document.getElementById('validationStatus');
      if (statusEl) statusEl.textContent = `오류: ${result.error}`;
    }
  } catch (error) {
    console.error('Validation error:', error);
  }
}

/**
 * 검증 진행상황 핸들러
 */
function handleValidationProgress(progress) {
  const { book, processed, total, validCount, issueCount, currentBook, bookIndex, totalBooks } = progress;

  const bookData = bibleData?.books?.find(b => b.name === book);
  const bookNameKo = bookData?.nameKo || book;

  // 진행률 계산
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  // 상태 메시지
  const statusEl = document.getElementById('validationStatus');
  if (statusEl) {
    statusEl.textContent = `[${bookIndex || 1}/${totalBooks || 1}] ${bookNameKo} 검증 중... (${processed}/${total})`;
  }

  // 진행률 바
  const progressFill = document.getElementById('validationProgressFill');
  if (progressFill) progressFill.style.width = `${percent}%`;

  // 통계
  const currentBookEl = document.getElementById('validateCurrentBook');
  if (currentBookEl) currentBookEl.textContent = bookNameKo;

  const currentProgressEl = document.getElementById('validateCurrentProgress');
  if (currentProgressEl) currentProgressEl.textContent = `${percent}%`;

  const validCountEl = document.getElementById('validateValidCount');
  if (validCountEl) validCountEl.textContent = (validCount || 0).toLocaleString();

  const issuesFoundEl = document.getElementById('validateIssuesFound');
  if (issuesFoundEl) issuesFoundEl.textContent = (issueCount || 0).toLocaleString();
}

/**
 * 검증 완료 핸들러
 */
function handleValidationComplete(result) {
  console.log('Validation complete:', result);

  validationResults = result;

  // UI 상태 복원
  const validationPanel = document.getElementById('validationPanel');
  if (validationPanel) validationPanel.classList.add('hidden');

  const resultsPanel = document.getElementById('validationResultsPanel');
  if (resultsPanel) resultsPanel.classList.remove('hidden');

  // 버튼 복원
  const startBtn = document.getElementById('startValidationBtn');
  if (startBtn) startBtn.disabled = false;

  // analyzing 상태 해제
  document.querySelectorAll('#validateBooksGrid .book-card.analyzing').forEach(card => {
    card.classList.remove('analyzing');
  });

  // 통계 업데이트
  updateValidationStats(result.totalVerses, result.totalValid, result.totalIssues);

  // 이슈 목록 렌더링
  renderIssueList('all');
}

/**
 * 이슈 목록 렌더링
 */
function renderIssueList(issueType = 'all') {
  const issueList = document.getElementById('issueList');
  if (!issueList || !validationResults) return;

  // 모든 이슈 수집 (bookName 포함)
  let allIssues = [];

  for (const [bookName, bookResult] of Object.entries(validationResults.books || {})) {
    if (bookResult.issues) {
      for (const [type, issues] of Object.entries(bookResult.issues)) {
        if (issueType === 'all' || issueType === type) {
          allIssues = allIssues.concat(issues.map(issue => ({
            ...issue,
            issueType: type,
            bookName: bookName  // 책 이름 추가
          })));
        }
      }
    }
  }

  if (allIssues.length === 0) {
    issueList.innerHTML = `
      <div class="issue-empty">
        <h4>${issueType === 'all' ? '이슈가 없습니다' : '해당 유형의 이슈가 없습니다'}</h4>
        <p>모든 검증을 통과했습니다.</p>
      </div>
    `;
    return;
  }

  // 이슈 타입별 라벨
  const typeLabels = {
    invalid_json_format: 'JSON 형식 오류',
    json_parse_error: 'JSON 파싱 오류',
    source_mismatch: '원문 불일치',
    sentence_merge_mismatch: '구문 합치기 오류',
    empty_translation: '빈 번역',
    non_korean_chars: '비한글 문자',
    english_in_korean: '영어 포함'
  };

  const html = allIssues.slice(0, 100).map(issue => {
    let bodyContent = '';

    switch (issue.issueType) {
      case 'invalid_json_format':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">오류:</span>
            <span class="content">${escapeHtml(issue.message || '')}</span>
          </div>
          ${issue.field ? `
          <div class="issue-detail">
            <span class="label">필드:</span>
            <span class="chars">${escapeHtml(issue.field)}</span>
          </div>` : ''}
        `;
        break;

      case 'json_parse_error':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">오류:</span>
            <span class="content">${escapeHtml(issue.message || '')}</span>
          </div>
        `;
        break;

      case 'source_mismatch':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">예상:</span>
            <span class="content">${escapeHtml(issue.expected || '')}</span>
          </div>
          <div class="issue-detail">
            <span class="label">실제:</span>
            <span class="content">${escapeHtml(issue.actual || '')}</span>
          </div>
        `;
        break;

      case 'sentence_merge_mismatch':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">누락 단어:</span>
            <span class="chars">${(issue.missingWords || []).join(', ') || '없음'}</span>
          </div>
          <div class="issue-detail">
            <span class="label">추가 단어:</span>
            <span class="chars">${(issue.extraWords || []).join(', ') || '없음'}</span>
          </div>
        `;
        break;

      case 'empty_translation':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">원문:</span>
            <span class="content">${escapeHtml(issue.originalText || '')}</span>
          </div>
        `;
        break;

      case 'non_korean_chars':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">비한글 문자:</span>
            <span class="chars">${(issue.invalidChars || []).join(' ')}</span>
          </div>
          <div class="issue-detail">
            <span class="label">번역:</span>
            <span class="content">${escapeHtml(issue.translation || '')}</span>
          </div>
        `;
        break;

      case 'english_in_korean':
        bodyContent = `
          <div class="issue-detail">
            <span class="label">영어 단어:</span>
            <span class="chars">${(issue.englishWords || []).join(', ')}</span>
          </div>
          <div class="issue-detail">
            <span class="label">번역:</span>
            <span class="content">${escapeHtml(issue.translation || '')}</span>
          </div>
        `;
        break;
    }

    return `
      <div class="issue-item" data-book="${escapeHtml(issue.bookName || '')}" data-file-name="${escapeHtml(issue.fileName || '')}">
        <label class="issue-checkbox">
          <input type="checkbox" class="issue-select" />
        </label>
        <div class="issue-content">
          <div class="issue-header">
            <span class="issue-ref">${escapeHtml(issue.verseRef || issue.fileName || '')}</span>
            <span class="issue-type ${issue.issueType}">${typeLabels[issue.issueType] || issue.issueType}</span>
          </div>
          <div class="issue-body">
            ${bodyContent}
          </div>
        </div>
      </div>
    `;
  }).join('');

  issueList.innerHTML = html;

  if (allIssues.length > 100) {
    issueList.innerHTML += `<div class="issue-empty"><p>... 외 ${allIssues.length - 100}개 이슈</p></div>`;
  }

  // 툴바 요소들
  const toolbar = document.getElementById('issueToolbar');
  const selectAllCheckbox = document.getElementById('selectAllIssues');
  const selectedCountSpan = document.getElementById('selectedCount');
  const reanalyzeSelectedBtn = document.getElementById('reanalyzeSelectedBtn');

  // 이슈가 있으면 툴바 표시
  if (allIssues.length > 0 && toolbar) {
    toolbar.style.display = 'flex';
  } else if (toolbar) {
    toolbar.style.display = 'none';
  }

  // 선택 상태 업데이트 함수
  function updateSelectionState() {
    const checkboxes = issueList.querySelectorAll('.issue-select');
    const checkedBoxes = issueList.querySelectorAll('.issue-select:checked');
    const count = checkedBoxes.length;

    selectedCountSpan.textContent = `${count}개 선택됨`;
    reanalyzeSelectedBtn.disabled = count === 0;

    // 전체 선택 체크박스 상태 업데이트
    if (checkboxes.length > 0) {
      selectAllCheckbox.checked = count === checkboxes.length;
      selectAllCheckbox.indeterminate = count > 0 && count < checkboxes.length;
    }
  }

  // 전체 선택 체크박스 이벤트
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      const checkboxes = issueList.querySelectorAll('.issue-select');
      checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
      });
      updateSelectionState();
    });
  }

  // 선택 항목 재분석 버튼 이벤트
  if (reanalyzeSelectedBtn) {
    reanalyzeSelectedBtn.addEventListener('click', async () => {
      const checkedItems = issueList.querySelectorAll('.issue-item:has(.issue-select:checked)');
      if (checkedItems.length === 0) return;

      // 중복 제거를 위한 Map (같은 구절에 여러 이슈가 있을 수 있음)
      const versesToReanalyze = new Map();

      checkedItems.forEach(item => {
        const book = item.dataset.book;
        const fileName = item.dataset.fileName;
        if (!book || !fileName) return;

        const match = fileName.match(/_(\d+)_(\d+)\.json$/);
        if (!match) return;

        const key = `${book}_${match[1]}_${match[2]}`;
        if (!versesToReanalyze.has(key)) {
          versesToReanalyze.set(key, {
            book,
            chapter: parseInt(match[1]),
            verse: parseInt(match[2]),
            items: []
          });
        }
        versesToReanalyze.get(key).items.push(item);
      });

      const total = versesToReanalyze.size;
      const version = currentSettings.bibleVersion;

      // 버튼 상태 변경
      reanalyzeSelectedBtn.disabled = true;
      reanalyzeSelectedBtn.textContent = `재분석 중... (0/${total})`;

      // 배치 재분석 진행 상황 리스너 설정
      const removeProgressListener = window.electronAPI.onReanalyzeProgress((progress) => {
        reanalyzeSelectedBtn.textContent = `재분석 중... (${progress.completed + progress.failed}/${progress.total})`;
      });

      // 배치 재분석 완료 리스너 설정
      const removeCompleteListener = window.electronAPI.onReanalyzeComplete((result) => {
        console.log('Batch reanalyze complete:', result);
      });

      try {
        // 구절 배열 생성
        const verses = Array.from(versesToReanalyze.values()).map(data => ({
          book: data.book,
          chapter: data.chapter,
          verse: data.verse
        }));

        console.log(`Starting batch reanalyze: ${verses.length} verses (Pool based)`);

        // 배치 재분석 API 호출 (Pool 기반 병렬 처리)
        const result = await window.electronAPI.reanalyzeBatch({
          verses,
          version
        });

        if (result.success) {
          // 성공한 구절들 UI 업데이트
          result.result.results.forEach(verseResult => {
            if (verseResult.status === 'completed') {
              const key = `${verseResult.book}_${verseResult.chapter}_${verseResult.verse}`;
              const data = versesToReanalyze.get(key);
              if (data) {
                data.items.forEach(item => {
                  item.classList.add('reanalyzed');
                  const checkbox = item.querySelector('.issue-select');
                  if (checkbox) checkbox.checked = false;
                });
              }
            }
          });

          // 완료 메시지
          reanalyzeSelectedBtn.textContent = `완료! (${result.result.completed}/${result.result.total} 성공)`;
        } else {
          reanalyzeSelectedBtn.textContent = `오류 발생: ${result.error}`;
        }
      } catch (error) {
        console.error('Batch reanalyze error:', error);
        reanalyzeSelectedBtn.textContent = '오류 발생';
      } finally {
        // 리스너 제거
        removeProgressListener();
        removeCompleteListener();

        // 버튼 상태 복원
        setTimeout(() => {
          reanalyzeSelectedBtn.textContent = '선택 항목 재분석';
          updateSelectionState();
        }, 2000);
      }
    });
  }

  // 더블클릭 및 체크박스 이벤트 핸들러
  issueList.querySelectorAll('.issue-item').forEach(item => {
    // 더블클릭으로 에디터에서 열기
    item.querySelector('.issue-content')?.addEventListener('dblclick', async () => {
      const book = item.dataset.book;
      const fileName = item.dataset.fileName;

      if (!book || !fileName) {
        console.warn('Missing book or fileName for issue item');
        return;
      }

      const version = currentSettings.bibleVersion.toLowerCase();
      const bookFolder = toFilename(book);
      const filePath = `${version}/${bookFolder}/${fileName}`;
      const editor = currentSettings.editor;

      console.log(`Opening in ${editor}: ${filePath}`);

      try {
        const result = await window.electronAPI.openInEditor({ filePath, editor });
        if (!result.success) {
          console.error('Failed to open file:', result.error);
        } else if (result.fallback) {
          console.log('Opened with fallback (system default app)');
        }
      } catch (error) {
        console.error('Error opening file:', error);
      }
    });

    // 체크박스 변경 이벤트
    const checkbox = item.querySelector('.issue-select');
    if (checkbox) {
      checkbox.addEventListener('change', updateSelectionState);
    }
  });

  // 초기 선택 상태 업데이트
  updateSelectionState();
}

/**
 * HTML 이스케이프
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 책 이름을 파일명 형식으로 변환 (공백 제거)
 * 예: "1 Thessalonians" -> "1Thessalonians"
 */
function toFilename(bookName) {
  return bookName.replace(/\s+/g, '');
}

/**
 * 검증 리포트 내보내기
 */
async function exportValidationReport() {
  if (!validationResults) {
    alert('검증 결과가 없습니다.');
    return;
  }

  try {
    const result = await window.electronAPI.generateValidationReport(validationResults);
    if (result.success) {
      // 클립보드에 복사
      await navigator.clipboard.writeText(result.report);
      alert('리포트가 클립보드에 복사되었습니다.');
    } else {
      alert(`리포트 생성 실패: ${result.error}`);
    }
  } catch (error) {
    console.error('Report export error:', error);
    alert(`리포트 내보내기 오류: ${error.message}`);
  }
}

// 탭 전환 시 검증 탭 초기화
const originalInitTabs = initTabs;
initTabs = function() {
  originalInitTabs();

  // 검증 탭 초기화 추가
  initValidationTab();

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'validate') {
        // 검증 탭으로 전환할 때 책 카드 렌더링
        renderValidationBookCards();
      }
    });
  });
};
