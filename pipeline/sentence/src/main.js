const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const analyzer = require('./analyzer');
const validator = require('./validator');
const { log, toFilename } = require('./utils');
const { PATHS, BIBLE_FILE_MAP, BOOK_NAMES_KO, OLD_TESTAMENT, NEW_TESTAMENT, ALL_BOOKS } = require('./constants');

let mainWindow;

// IPC 핸들러 등록
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('start-analysis', async (event, { books, version }) => {
  log(`\n${'='.repeat(60)}`);
  log(`Analysis started for ${books.length} books (${version})`);
  log(`Books: ${books.join(', ')}`);
  log(`${'='.repeat(60)}\n`);

  try {
    const result = await analyzer.analyzeBooks(books, version, (progress) => {
      // 진행상황을 렌더러로 전송
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('analysis-progress', progress);
      }
    });

    // 완료 이벤트 전송
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis-complete', result);
    }

    log(`\n${'='.repeat(60)}`);
    log(`Analysis completed: ${result.totalCompleted}/${result.totalVerses} verses`);
    log(`${'='.repeat(60)}\n`);

    return { success: true, result };
  } catch (error) {
    console.error('Analysis error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-analysis', async () => {
  log('\n[STOP] Stop analysis requested\n');
  analyzer.stopAnalysis();
  return { success: true };
});

// Output 폴더 경로 가져오기
function getOutputPath(version) {
  return path.join(PATHS.OUTPUT, version.toLowerCase());
}

// Output 폴더 구조 초기화 핸들러
ipcMain.handle('init-output-folders', async (event, version) => {
  try {
    const versionPath = getOutputPath(version);

    // output 폴더 생성
    if (!fs.existsSync(PATHS.OUTPUT)) {
      fs.mkdirSync(PATHS.OUTPUT, { recursive: true });
    }

    // 버전별 폴더 생성
    if (!fs.existsSync(versionPath)) {
      fs.mkdirSync(versionPath, { recursive: true });
    }

    // 각 성경 책별 폴더 생성 (공백 제거한 폴더명 사용)
    for (const bookName of ALL_BOOKS) {
      const bookPath = path.join(versionPath, toFilename(bookName));
      if (!fs.existsSync(bookPath)) {
        fs.mkdirSync(bookPath, { recursive: true });
      }
    }

    log(`Output folders initialized for ${version}`);
    return { success: true, path: versionPath };
  } catch (error) {
    console.error('Error initializing output folders:', error);
    return { success: false, error: error.message };
  }
});

// 진행률 가져오기 핸들러 (output 폴더 기반)
ipcMain.handle('get-analysis-progress', async (event, version) => {
  try {
    const versionPath = getOutputPath(version);
    const progress = {};

    if (!fs.existsSync(versionPath)) {
      // 폴더가 없으면 모든 책 진행률 0
      for (const bookName of ALL_BOOKS) {
        progress[bookName] = { analyzed: 0, files: [] };
      }
      return { success: true, progress };
    }

    // 각 성경 책별 진행률 계산 (공백 제거한 폴더명 사용)
    for (const bookName of ALL_BOOKS) {
      const bookPath = path.join(versionPath, toFilename(bookName));

      if (fs.existsSync(bookPath)) {
        const files = fs.readdirSync(bookPath).filter(f => f.endsWith('.json'));
        progress[bookName] = {
          analyzed: files.length,
          files: files
        };
      } else {
        progress[bookName] = { analyzed: 0, files: [] };
      }
    }

    return { success: true, progress };
  } catch (error) {
    console.error('Error getting analysis progress:', error);
    return { success: false, error: error.message };
  }
});

// 성경 데이터 로드 핸들러
ipcMain.handle('load-bible-data', async (event, version) => {
  try {
    const fileName = BIBLE_FILE_MAP[version] || `${version}_Bible.json`;
    const filePath = path.join(PATHS.SOURCE_DATA, fileName);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${fileName}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const books = [];
    let totalVerses = 0;

    // 구약 처리
    for (const bookName of OLD_TESTAMENT) {
      if (data[bookName]) {
        const bookData = data[bookName];
        const chapters = Object.keys(bookData).length;
        let verses = 0;
        for (const chapter of Object.values(bookData)) {
          verses += Object.keys(chapter).length;
        }
        totalVerses += verses;
        books.push({
          name: bookName,
          nameKo: BOOK_NAMES_KO[bookName] || bookName,
          chapters,
          verses,
          testament: 'old',
          analyzed: 0,
          progress: 0
        });
      }
    }

    // 신약 처리
    for (const bookName of NEW_TESTAMENT) {
      if (data[bookName]) {
        const bookData = data[bookName];
        const chapters = Object.keys(bookData).length;
        let verses = 0;
        for (const chapter of Object.values(bookData)) {
          verses += Object.keys(chapter).length;
        }
        totalVerses += verses;
        books.push({
          name: bookName,
          nameKo: BOOK_NAMES_KO[bookName] || bookName,
          chapters,
          verses,
          testament: 'new',
          analyzed: 0,
          progress: 0
        });
      }
    }

    return {
      success: true,
      data: {
        version,
        books,
        totalVerses,
        oldTestamentCount: OLD_TESTAMENT.length,
        newTestamentCount: NEW_TESTAMENT.length
      }
    };
  } catch (error) {
    console.error('Error loading bible data:', error);
    return { success: false, error: error.message };
  }
});

// 검증 시작 핸들러
ipcMain.handle('start-validation', async (event, { books, version }) => {
  log(`\n${'='.repeat(60)}`);
  log(`Validation started for ${books.length} books (${version})`);
  log(`Books: ${books.join(', ')}`);
  log(`${'='.repeat(60)}\n`);

  try {
    const result = validator.validateBooks(books, version, (progress) => {
      // 진행상황을 렌더러로 전송
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('validation-progress', progress);
      }
    });

    // 완료 이벤트 전송
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('validation-complete', result);
    }

    log(`\n${'='.repeat(60)}`);
    log(`Validation completed: ${result.totalValid}/${result.totalVerses} valid`);
    log(`Total issues: ${result.totalIssues}`);
    log(`${'='.repeat(60)}\n`);

    return { success: true, result };
  } catch (error) {
    console.error('Validation error:', error);
    return { success: false, error: error.message };
  }
});

// 검증 리포트 생성 핸들러
ipcMain.handle('generate-validation-report', async (event, results) => {
  try {
    const report = validator.generateReport(results);
    return { success: true, report };
  } catch (error) {
    console.error('Report generation error:', error);
    return { success: false, error: error.message };
  }
});

// 에디터에서 파일 열기 핸들러
ipcMain.handle('open-in-editor', async (event, { filePath, editor }) => {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(PATHS.OUTPUT, filePath);

    if (!fs.existsSync(absolutePath)) {
      return { success: false, error: `File not found: ${absolutePath}` };
    }

    log(`Opening in ${editor}: ${absolutePath}`);

    // 에디터별 명령어
    let command;
    if (editor === 'cursor') {
      // Cursor는 code 명령어와 비슷하게 동작
      command = `cursor "${absolutePath}"`;
    } else if (editor === 'antigravity') {
      // Antigravity 에디터
      command = `antigravity "${absolutePath}"`;
    } else {
      // 기본: 시스템 기본 앱으로 열기
      await shell.openPath(absolutePath);
      return { success: true };
    }

    return new Promise((resolve) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Editor error: ${error.message}`);
          // 명령어 실패 시 기본 앱으로 열기 시도
          shell.openPath(absolutePath);
          resolve({ success: true, fallback: true });
        } else {
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Open in editor error:', error);
    return { success: false, error: error.message };
  }
});

// 파일 경로 가져오기 핸들러
ipcMain.handle('get-file-path', async (event, { book, fileName, version }) => {
  try {
    const filePath = path.join(PATHS.OUTPUT, version.toLowerCase(), toFilename(book), fileName);
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 단일 구절 재분석 핸들러
ipcMain.handle('reanalyze-verse', async (event, { book, chapter, verse, version }) => {
  log(`\n[REANALYZE] ${book} ${chapter}:${verse} (${version})`);

  try {
    const result = await analyzer.reanalyzeVerse(book, chapter, verse, version);

    if (result) {
      log(`[REANALYZE] Success: ${book} ${chapter}:${verse}`);
      return { success: true, result };
    } else {
      return { success: false, error: 'No result returned' };
    }
  } catch (error) {
    console.error(`[REANALYZE] Error: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// 배치 재분석 핸들러 (Pool 기반 병렬 처리)
ipcMain.handle('reanalyze-batch', async (event, { verses, version }) => {
  log(`\n${'='.repeat(60)}`);
  log(`[BATCH REANALYZE] Starting ${verses.length} verses (${version})`);
  log(`${'='.repeat(60)}\n`);

  try {
    const result = await analyzer.reanalyzeBatch(verses, version, (progress) => {
      // 진행상황을 렌더러로 전송
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reanalyze-progress', progress);
      }
    });

    // 완료 이벤트 전송
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('reanalyze-complete', result);
    }

    log(`\n${'='.repeat(60)}`);
    log(`[BATCH REANALYZE] Completed: ${result.completed}/${result.total}`);
    log(`${'='.repeat(60)}\n`);

    return { success: true, result };
  } catch (error) {
    console.error('[BATCH REANALYZE] Error:', error);
    return { success: false, error: error.message };
  }
});

// 분석 방법 설정 핸들러
ipcMain.handle('set-analysis-method', async (event, method) => {
  log(`[CONFIG] Setting analysis method to: ${method}`);
  const success = analyzer.setAnalysisMethod(method);
  return { success, method };
});

// 현재 분석 방법 조회
ipcMain.handle('get-analysis-method', async () => {
  return analyzer.getAnalysisMethod();
});

// 현재 Pool 크기 조회
ipcMain.handle('get-pool-size', async () => {
  return analyzer.getPoolSize();
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0D0F12',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 개발 모드에서 DevTools 열기
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
