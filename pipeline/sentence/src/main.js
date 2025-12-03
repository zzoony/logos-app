const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const analyzer = require('./analyzer');

// 성경 책 이름 매핑 (영어 -> 한글)
const BOOK_NAMES_KO = {
  // 구약
  'Genesis': '창세기', 'Exodus': '출애굽기', 'Leviticus': '레위기', 'Numbers': '민수기',
  'Deuteronomy': '신명기', 'Joshua': '여호수아', 'Judges': '사사기', 'Ruth': '룻기',
  '1 Samuel': '사무엘상', '2 Samuel': '사무엘하', '1 Kings': '열왕기상', '2 Kings': '열왕기하',
  '1 Chronicles': '역대상', '2 Chronicles': '역대하', 'Ezra': '에스라', 'Nehemiah': '느헤미야',
  'Esther': '에스더', 'Job': '욥기', 'Psalms': '시편', 'Proverbs': '잠언',
  'Ecclesiastes': '전도서', 'Song of Solomon': '아가', 'Isaiah': '이사야', 'Jeremiah': '예레미야',
  'Lamentations': '예레미야애가', 'Ezekiel': '에스겔', 'Daniel': '다니엘', 'Hosea': '호세아',
  'Joel': '요엘', 'Amos': '아모스', 'Obadiah': '오바댜', 'Jonah': '요나',
  'Micah': '미가', 'Nahum': '나훔', 'Habakkuk': '하박국', 'Zephaniah': '스바냐',
  'Haggai': '학개', 'Zechariah': '스가랴', 'Malachi': '말라기',
  // 신약
  'Matthew': '마태복음', 'Mark': '마가복음', 'Luke': '누가복음', 'John': '요한복음',
  'Acts': '사도행전', 'Romans': '로마서', '1 Corinthians': '고린도전서', '2 Corinthians': '고린도후서',
  'Galatians': '갈라디아서', 'Ephesians': '에베소서', 'Philippians': '빌립보서', 'Colossians': '골로새서',
  '1 Thessalonians': '데살로니가전서', '2 Thessalonians': '데살로니가후서', '1 Timothy': '디모데전서',
  '2 Timothy': '디모데후서', 'Titus': '디도서', 'Philemon': '빌레몬서', 'Hebrews': '히브리서',
  'James': '야고보서', '1 Peter': '베드로전서', '2 Peter': '베드로후서', '1 John': '요한1서',
  '2 John': '요한2서', '3 John': '요한3서', 'Jude': '유다서', 'Revelation': '요한계시록'
};

// 구약 책 목록 (순서대로)
const OLD_TESTAMENT = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah',
  'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah',
  'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'
];

// 신약 책 목록 (순서대로)
const NEW_TESTAMENT = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter',
  '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

let mainWindow;

// IPC 핸들러 등록
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('start-analysis', async (event, { books, version }) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analysis started for ${books.length} books (${version})`);
  console.log(`Books: ${books.join(', ')}`);
  console.log(`${'='.repeat(60)}\n`);

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

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Analysis completed: ${result.totalCompleted}/${result.totalVerses} verses`);
    console.log(`${'='.repeat(60)}\n`);

    return { success: true, result };
  } catch (error) {
    console.error('Analysis error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-analysis', async () => {
  console.log('\n[STOP] Stop analysis requested\n');
  analyzer.stopAnalysis();
  return { success: true };
});

// Output 폴더 경로 가져오기
function getOutputPath(version) {
  return path.join(__dirname, '../output', version.toLowerCase());
}

// Output 폴더 구조 초기화 핸들러
ipcMain.handle('init-output-folders', async (event, version) => {
  try {
    const outputBase = path.join(__dirname, '../output');
    const versionPath = getOutputPath(version);

    // output 폴더 생성
    if (!fs.existsSync(outputBase)) {
      fs.mkdirSync(outputBase, { recursive: true });
    }

    // 버전별 폴더 생성
    if (!fs.existsSync(versionPath)) {
      fs.mkdirSync(versionPath, { recursive: true });
    }

    // 각 성경 책별 폴더 생성
    const allBooks = [...OLD_TESTAMENT, ...NEW_TESTAMENT];
    for (const bookName of allBooks) {
      const bookPath = path.join(versionPath, bookName);
      if (!fs.existsSync(bookPath)) {
        fs.mkdirSync(bookPath, { recursive: true });
      }
    }

    console.log(`Output folders initialized for ${version}`);
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
      const allBooks = [...OLD_TESTAMENT, ...NEW_TESTAMENT];
      for (const bookName of allBooks) {
        progress[bookName] = { analyzed: 0, files: [] };
      }
      return { success: true, progress };
    }

    // 각 성경 책별 진행률 계산
    const allBooks = [...OLD_TESTAMENT, ...NEW_TESTAMENT];
    for (const bookName of allBooks) {
      const bookPath = path.join(versionPath, bookName);

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
    const fileName = version === 'NIV' ? 'NIV_Bible.json' : 'ESV_Bible.json';
    const filePath = path.join(__dirname, '../../source-data', fileName);

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
