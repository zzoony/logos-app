/**
 * Sentence Analyzer Module
 * Z.AI API를 사용한 성경 구절 분석
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const config = require('./config');

// 현재 분석 방법 (런타임에 변경 가능)
let currentAnalysisMethod = config.ANALYSIS_METHOD || 'api';

/**
 * 타임스탬프와 함께 로그 출력
 */
function log(...args) {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  console.log(`[${timestamp}]`, ...args);
}

// 경로 설정
const SOURCE_DATA_DIR = path.join(__dirname, '../../source-data');
const VOCABULARY_DIR = path.join(__dirname, '../../vocabulary/output');
const OUTPUT_DIR = path.join(__dirname, '../output');
const ENV_PATH = path.join(__dirname, '../../vocabulary/.env');

// API 설정
let API_KEY = '';
let API_BASE = 'https://api.z.ai/api/coding/paas/v4';
let API_MODEL = 'glm-4.6';

// 캐시
let bibleDataCache = {};
let koreanBibleCache = null;
let vocabularyCache = {};

// 분석 상태
let isAnalyzing = false;
let shouldStop = false;

/**
 * 책 이름을 파일명 형식으로 변환 (공백 제거)
 * 예: "1 Thessalonians" -> "1Thessalonians"
 */
function toFilename(bookName) {
  return bookName.replace(/\s+/g, '');
}

/**
 * 환경 변수 로드
 */
function loadEnv() {
  if (fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key.trim() === 'ZAI_API_KEY') API_KEY = value;
        if (key.trim() === 'ZAI_API_BASE') API_BASE = value;
        if (key.trim() === 'ZAI_MODEL') API_MODEL = value;
      }
    });
  }
}

// 버전명 → 파일명 매핑
const BIBLE_FILE_MAP = {
  'ESV': 'ESV_Bible.json',
  'NIV': 'NIV_Bible.json',
  'KJV': 'KJV_Bible.json',
  'Easy': 'Easy_Bible.json',
  'Hebrew': 'Hebrew_Bible.json'
};

/**
 * 성경 데이터 로드
 */
function loadBibleData(version) {
  if (bibleDataCache[version]) return bibleDataCache[version];

  const fileName = BIBLE_FILE_MAP[version] || `${version}_Bible.json`;
  const filePath = path.join(SOURCE_DATA_DIR, fileName);
  bibleDataCache[version] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return bibleDataCache[version];
}

/**
 * 개역개정 성경 로드
 */
function loadKoreanBible() {
  if (koreanBibleCache) return koreanBibleCache;

  const filePath = path.join(SOURCE_DATA_DIR, 'Korean_Bible.json');
  koreanBibleCache = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return koreanBibleCache;
}

/**
 * Vocabulary 로드
 */
function loadVocabulary(version) {
  if (vocabularyCache[version]) return vocabularyCache[version];

  const filePath = path.join(VOCABULARY_DIR, version.toLowerCase(), `final_vocabulary_${version.toLowerCase()}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // word -> id 매핑 생성
  const wordToId = {};
  for (const word of data.words || []) {
    wordToId[word.word.toLowerCase()] = word.id;
  }

  vocabularyCache[version] = wordToId;
  return wordToId;
}

/**
 * 간단한 lemmatization (기본 규칙)
 */
function simpleLemmatize(word) {
  word = word.toLowerCase();

  // 불규칙 동사
  const irregulars = {
    'was': 'be', 'were': 'be', 'been': 'be', 'being': 'be', 'am': 'be', 'is': 'be', 'are': 'be',
    'had': 'have', 'has': 'have', 'having': 'have',
    'did': 'do', 'does': 'do', 'doing': 'do', 'done': 'do',
    'went': 'go', 'goes': 'go', 'going': 'go', 'gone': 'go',
    'came': 'come', 'comes': 'come', 'coming': 'come',
    'gave': 'give', 'gives': 'give', 'giving': 'give', 'given': 'give',
    'took': 'take', 'takes': 'take', 'taking': 'take', 'taken': 'take',
    'saw': 'see', 'sees': 'see', 'seeing': 'see', 'seen': 'see',
    'said': 'say', 'says': 'say', 'saying': 'say',
    'made': 'make', 'makes': 'make', 'making': 'make',
    'got': 'get', 'gets': 'get', 'getting': 'get',
    'creeps': 'creep', 'crept': 'creep',
    'heavens': 'heaven'
  };

  if (irregulars[word]) return irregulars[word];

  // 규칙 기반 처리
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y';
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('ed') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
  if (word.endsWith('s') && word.length > 2) return word.slice(0, -1);

  return word;
}

/**
 * 문장에서 word indices 찾기
 */
function findWordIndices(sentence, wordToId) {
  const words = sentence.match(/[a-zA-Z]+/g) || [];
  const indices = [];
  const seen = new Set();

  for (const word of words) {
    const lemma = simpleLemmatize(word);
    if (wordToId[lemma] && !seen.has(lemma)) {
      indices.push(wordToId[lemma]);
      seen.add(lemma);
    }
  }

  return indices.sort((a, b) => a - b);
}

/**
 * API 호출
 */
function callAPI(prompt) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}/chat/completions`);

    const requestBody = JSON.stringify({
      model: API_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 120000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`API error: ${res.statusCode} - ${data}`));
            return;
          }
          const result = JSON.parse(data);
          const content = result?.choices?.[0]?.message?.content || '';
          resolve(content);
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Claude CLI 호출
 */
function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const timeout = config.CLI_TIMEOUT || 120000;
    const model = config.CLAUDE_MODEL || 'haiku';

    const child = spawn('claude', ['--model', model, '--print'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Claude CLI error: ${err.message}`));
    });

    // 타임아웃 설정
    timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Claude CLI timeout'));
    }, timeout);

    // 프롬프트 전달
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * Droid exec 호출
 */
function callDroid(prompt) {
  return new Promise((resolve, reject) => {
    const timeout = config.CLI_TIMEOUT || 120000;

    const child = spawn('droid', ['exec', '-o', 'text'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timeoutId;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Droid exec exited with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Droid exec error: ${err.message}`));
    });

    // 타임아웃 설정
    timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Droid exec timeout'));
    }, timeout);

    // 프롬프트 전달
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/**
 * 현재 분석 방법에 따라 적절한 함수 호출
 */
async function callAnalyzer(prompt) {
  switch (currentAnalysisMethod) {
    case 'claude':
      return callClaude(prompt);
    case 'droid':
      return callDroid(prompt);
    case 'api':
    default:
      return callAPI(prompt);
  }
}

/**
 * 분석 방법 설정
 */
function setAnalysisMethod(method) {
  if (['api', 'claude', 'droid'].includes(method)) {
    currentAnalysisMethod = method;
    log(`분석 방법 변경: ${method}`);
    return true;
  }
  return false;
}

/**
 * 현재 분석 방법 반환
 */
function getAnalysisMethod() {
  return currentAnalysisMethod;
}

/**
 * 현재 설정에 맞는 Pool 크기 반환
 */
function getPoolSize() {
  if (currentAnalysisMethod === 'api') {
    return config.POOL_SIZE_API || 4;
  }
  return config.POOL_SIZE_CLI || 20;
}

/**
 * 분석 프롬프트 생성
 */
function createAnalysisPrompt(verseText, verseRef) {
  return `Analyze this Bible verse and split it into SHORT, readable clauses for English learners.
For each clause, provide a Korean translation.

Verse: "${verseText}"
Reference: ${verseRef}

Respond in JSON format ONLY (no markdown, no explanation):
{
  "sentences": [
    {
      "sequence_order": 1,
      "original_text": "short clause from the verse",
      "korean_translation": "한글 번역"
    }
  ]
}

Rules:
1. Split long sentences into SHORT clauses (max 10-15 words each)
2. Split at commas, semicolons, colons, "and", "but", "or", "that", "which", "who"
3. Each clause should be a complete thought that can be understood alone
4. Provide natural Korean translation for each clause
5. Keep sequence_order starting from 1
6. Cover ALL text from the verse - no omissions`;
}

/**
 * JSON 추출
 */
function extractJSON(response) {
  const match = response.match(/[\[{][\s\S]*[\]}]/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * 단일 구절 분석
 */
async function analyzeVerse(book, chapter, verse, version, wordToId, koreanBible, bibleData) {
  const verseText = bibleData?.[book]?.[String(chapter)]?.[String(verse)] || '';
  if (!verseText) return null;

  const koreanText = koreanBible?.[book]?.[String(chapter)]?.[String(verse)] || '';
  const verseRef = `${book} ${chapter}:${verse}`;

  // 분석기 호출 (API/Claude/Droid)
  const prompt = createAnalysisPrompt(verseText, verseRef);
  const response = await callAnalyzer(prompt);

  // JSON 파싱
  const parsed = extractJSON(response);
  if (!parsed) {
    throw new Error(`Failed to parse response for ${verseRef}`);
  }

  // 결과 구성
  const sentences = [];
  for (const sent of parsed.sentences || []) {
    const original = sent.original_text || '';
    sentences.push({
      sequence_order: sent.sequence_order || 0,
      original_text: original,
      korean_translation: sent.korean_translation || '',
      word_indices: findWordIndices(original, wordToId)
    });
  }

  return {
    verse_reference: verseRef,
    version: version.toUpperCase(),
    original_text: verseText,
    korean_text: koreanText,
    sentences
  };
}

// 병렬 처리 설정 (Pool 크기 - config.js에서 가져옴)

/**
 * Worker Pool 기반 병렬 처리
 * 5개의 worker가 지속적으로 작업을 처리하며, 하나가 끝나면 바로 다음 작업 시작
 */
async function processWithPool(tasks, poolSize, processor) {
  const results = [];
  let taskIndex = 0;

  // Worker 함수: 작업 큐에서 계속 가져와서 처리
  async function worker() {
    while (taskIndex < tasks.length && !shouldStop) {
      const currentIndex = taskIndex++;
      if (currentIndex >= tasks.length) break;

      const task = tasks[currentIndex];
      const result = await processor(task);
      results.push(result);
    }
  }

  // Pool 크기만큼 worker 시작
  const workers = [];
  for (let i = 0; i < Math.min(poolSize, tasks.length); i++) {
    workers.push(worker());
  }

  // 모든 worker 완료 대기
  await Promise.all(workers);

  return results;
}

/**
 * 책 분석 실행 (Pool 기반 병렬 처리)
 */
async function analyzeBook(bookName, version, progressCallback) {
  loadEnv();

  if (!API_KEY) {
    throw new Error('API key not found. Check vocabulary/.env file.');
  }

  const bibleData = loadBibleData(version);
  const koreanBible = loadKoreanBible();
  const wordToId = loadVocabulary(version);
  const bookData = bibleData[bookName];

  if (!bookData) {
    throw new Error(`Book not found: ${bookName}`);
  }

  // 구절 목록 생성
  const verses = [];
  for (const [chapter, chapterData] of Object.entries(bookData)) {
    for (const verseNum of Object.keys(chapterData)) {
      verses.push({ chapter: parseInt(chapter), verse: parseInt(verseNum) });
    }
  }

  // 출력 디렉토리 확인 (파일명에서 공백 제거)
  const bookFilename = toFilename(bookName);
  const outputPath = path.join(OUTPUT_DIR, version.toLowerCase(), bookFilename);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  let completed = 0;  // 성공한 구절 수
  let processed = 0;  // 처리된 구절 수 (성공 + 실패)
  const total = verses.length;
  const errors = [];

  // 분석이 필요한 구절만 필터링
  const versesToAnalyze = verses.filter(({ chapter, verse }) => {
    const fileName = `${bookFilename}_${chapter}_${verse}.json`;
    const filePath = path.join(outputPath, fileName);
    if (fs.existsSync(filePath)) {
      completed++;
      progressCallback?.({
        book: bookName,
        chapter,
        verse,
        completed,
        total,
        status: 'skipped'
      });
      return false;
    }
    return true;
  });

  log(`[INFO] ${bookName}: ${versesToAnalyze.length} verses to analyze (${completed} already done)`);
  log(`[POOL] Starting with ${getPoolSize()} concurrent workers (method: ${currentAnalysisMethod})`);

  // Pool 기반 병렬 처리
  const processor = async ({ chapter, verse }) => {
    const fileName = `${bookFilename}_${chapter}_${verse}.json`;
    const filePath = path.join(outputPath, fileName);

    // 처리 시작 알림
    progressCallback?.({
      book: bookName,
      chapter,
      verse,
      completed,
      total,
      status: 'processing'
    });

    try {
      const result = await analyzeVerse(bookName, chapter, verse, version, wordToId, koreanBible, bibleData);

      if (result) {
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
        log(`[SAVE] ${fileName}`);
      }

      completed++;  // 성공 시에만 증가
      processed++;
      progressCallback?.({
        book: bookName,
        chapter,
        verse,
        completed,
        processed,
        total,
        status: 'completed'
      });

      return { chapter, verse, status: 'completed' };
    } catch (error) {
      console.error(`[ERROR] ${bookName} ${chapter}:${verse}: ${error.message}`);

      processed++;  // 실패해도 처리됨
      errors.push({ chapter, verse, error: error.message });
      progressCallback?.({
        book: bookName,
        chapter,
        verse,
        completed,
        processed,
        total,
        status: 'error',
        error: error.message
      });

      return { chapter, verse, status: 'error', error: error.message };
    }
  };

  await processWithPool(versesToAnalyze, getPoolSize(), processor);

  if (shouldStop) {
    log(`[STOP] Analysis stopped by user`);
  }

  return { completed, total, errors, stopped: shouldStop };
}

/**
 * 여러 책 분석 (모든 구절을 하나의 풀에서 병렬 처리)
 */
async function analyzeBooks(bookNames, version, progressCallback) {
  loadEnv();

  if (!API_KEY) {
    throw new Error('API key not found. Check vocabulary/.env file.');
  }

  isAnalyzing = true;
  shouldStop = false;

  const poolSize = getPoolSize();
  log(`\n${'='.repeat(60)}`);
  log(`[CONFIG] 분석 방법: ${currentAnalysisMethod.toUpperCase()}, Pool 크기: ${poolSize}`);
  log(`[CONFIG] 선택된 책: ${bookNames.length}권 - ${bookNames.join(', ')}`);
  log(`${'='.repeat(60)}`);

  // 공통 데이터 로드
  const bibleData = loadBibleData(version);
  const koreanBible = loadKoreanBible();
  const wordToId = loadVocabulary(version);

  // 모든 책에서 구절 수집
  const allVerses = [];
  const bookStats = {};

  for (const bookName of bookNames) {
    const bookData = bibleData[bookName];
    if (!bookData) {
      log(`[WARN] Book not found: ${bookName}`);
      continue;
    }

    const bookFilename = toFilename(bookName);
    const outputPath = path.join(OUTPUT_DIR, version.toLowerCase(), bookFilename);
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    bookStats[bookName] = { total: 0, completed: 0, errors: [] };

    for (const [chapter, chapterData] of Object.entries(bookData)) {
      for (const verseNum of Object.keys(chapterData)) {
        const verse = {
          bookName,
          bookFilename,
          outputPath,
          chapter: parseInt(chapter),
          verse: parseInt(verseNum)
        };
        allVerses.push(verse);
        bookStats[bookName].total++;
      }
    }
  }

  // 전체 통계
  let totalCompleted = 0;
  let totalProcessed = 0;
  let totalFailed = 0;
  const totalVerses = allVerses.length;

  // 이미 분석된 구절 필터링
  const versesToAnalyze = allVerses.filter((v) => {
    const fileName = `${v.bookFilename}_${v.chapter}_${v.verse}.json`;
    const filePath = path.join(v.outputPath, fileName);
    if (fs.existsSync(filePath)) {
      totalCompleted++;
      bookStats[v.bookName].completed++;
      return false;
    }
    return true;
  });

  log(`[INFO] 전체: ${totalVerses}구절, 분석필요: ${versesToAnalyze.length}구절, 완료: ${totalCompleted}구절`);
  log(`[POOL] ${poolSize}개 워커로 병렬 처리 시작\n`);

  // 초기 진행상황 전달
  progressCallback?.({
    book: bookNames[0],
    chapter: 0,
    verse: 0,
    completed: totalCompleted,
    processed: totalCompleted,
    total: totalVerses,
    totalBooks: bookNames.length,
    bookIndex: 1,
    status: 'init'
  });

  // Pool 기반 병렬 처리
  const processor = async (v) => {
    const { bookName, bookFilename, outputPath, chapter, verse } = v;
    const fileName = `${bookFilename}_${chapter}_${verse}.json`;
    const filePath = path.join(outputPath, fileName);

    // 처리 시작 알림
    progressCallback?.({
      book: bookName,
      chapter,
      verse,
      completed: totalCompleted,
      processed: totalProcessed,
      total: totalVerses,
      totalBooks: bookNames.length,
      bookIndex: bookNames.indexOf(bookName) + 1,
      status: 'processing'
    });

    try {
      const result = await analyzeVerse(bookName, chapter, verse, version, wordToId, koreanBible, bibleData);

      if (result) {
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
        log(`[SAVE] ${bookName} ${chapter}:${verse} -> ${fileName}`);
      }

      totalCompleted++;
      totalProcessed++;
      bookStats[bookName].completed++;

      progressCallback?.({
        book: bookName,
        chapter,
        verse,
        completed: totalCompleted,
        processed: totalProcessed,
        total: totalVerses,
        totalBooks: bookNames.length,
        bookIndex: bookNames.indexOf(bookName) + 1,
        status: 'completed'
      });

      return { bookName, chapter, verse, status: 'completed' };
    } catch (error) {
      console.error(`[ERROR] ${bookName} ${chapter}:${verse}: ${error.message}`);

      totalProcessed++;
      totalFailed++;
      bookStats[bookName].errors.push({ chapter, verse, error: error.message });

      progressCallback?.({
        book: bookName,
        chapter,
        verse,
        completed: totalCompleted,
        processed: totalProcessed,
        total: totalVerses,
        totalBooks: bookNames.length,
        bookIndex: bookNames.indexOf(bookName) + 1,
        status: 'error',
        error: error.message
      });

      return { bookName, chapter, verse, status: 'error', error: error.message };
    }
  };

  await processWithPool(versesToAnalyze, poolSize, processor);

  if (shouldStop) {
    log(`[STOP] Analysis stopped by user`);
  }

  // 결과 요약
  log(`\n${'='.repeat(60)}`);
  log(`[SUMMARY] 전체: ${totalVerses}, 완료: ${totalCompleted}, 실패: ${totalFailed}`);
  for (const [bookName, stats] of Object.entries(bookStats)) {
    log(`  - ${bookName}: ${stats.completed}/${stats.total} (에러: ${stats.errors.length})`);
  }
  log(`${'='.repeat(60)}\n`);

  isAnalyzing = false;

  return {
    results: bookStats,
    totalCompleted,
    totalVerses,
    totalFailed,
    stopped: shouldStop
  };
}

/**
 * 분석 중단
 */
function stopAnalysis() {
  shouldStop = true;
  log('[STOP] Stop requested...');
}

/**
 * 분석 상태 확인
 */
function getAnalysisState() {
  return { isAnalyzing, shouldStop };
}

/**
 * 단일 구절 재분석 (기존 파일 삭제 후 새로 분석)
 */
async function reanalyzeVerse(book, chapter, verse, version) {
  loadEnv();

  if (!API_KEY) {
    throw new Error('API key not found. Check vocabulary/.env file.');
  }

  const bibleData = loadBibleData(version);
  const koreanBible = loadKoreanBible();
  const wordToId = loadVocabulary(version);

  // 파일 경로 (공백 제거)
  const bookFilename = toFilename(book);
  const outputPath = path.join(OUTPUT_DIR, version.toLowerCase(), bookFilename);
  const fileName = `${bookFilename}_${chapter}_${verse}.json`;
  const filePath = path.join(outputPath, fileName);

  // 기존 파일 삭제
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log(`[DELETE] ${fileName}`);
  }

  // 새로 분석
  log(`[REANALYZE] ${book} ${chapter}:${verse}`);
  const result = await analyzeVerse(book, chapter, verse, version, wordToId, koreanBible, bibleData);

  if (result) {
    // 디렉토리 확인
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
    log(`[SAVE] ${fileName}`);
  }

  return result;
}

/**
 * 여러 구절 배치 재분석 (Pool 기반 병렬 처리)
 * @param {Array} verses - [{book, chapter, verse}, ...] 형태의 배열
 * @param {string} version - 성경 버전
 * @param {function} progressCallback - 진행 콜백
 */
async function reanalyzeBatch(verses, version, progressCallback) {
  loadEnv();

  if (!API_KEY) {
    throw new Error('API key not found. Check vocabulary/.env file.');
  }

  const bibleData = loadBibleData(version);
  const koreanBible = loadKoreanBible();
  const wordToId = loadVocabulary(version);

  let completed = 0;
  let failed = 0;
  const total = verses.length;
  const results = [];

  log(`\n[BATCH REANALYZE] Starting ${total} verses with ${getPoolSize()} workers (method: ${currentAnalysisMethod})`);

  // 각 구절 처리 함수
  const processor = async ({ book, chapter, verse }) => {
    const bookFilename = toFilename(book);
    const outputPath = path.join(OUTPUT_DIR, version.toLowerCase(), bookFilename);
    const fileName = `${bookFilename}_${chapter}_${verse}.json`;
    const filePath = path.join(outputPath, fileName);

    // 처리 시작 알림
    progressCallback?.({
      book,
      chapter,
      verse,
      completed,
      failed,
      total,
      status: 'processing'
    });

    try {
      // 기존 파일 삭제
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 새로 분석
      const result = await analyzeVerse(book, chapter, verse, version, wordToId, koreanBible, bibleData);

      if (result) {
        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
        log(`[SAVE] ${fileName}`);
      }

      completed++;
      progressCallback?.({
        book,
        chapter,
        verse,
        completed,
        failed,
        total,
        status: 'completed'
      });

      results.push({ book, chapter, verse, status: 'completed', result });
      return { book, chapter, verse, status: 'completed' };

    } catch (error) {
      console.error(`[ERROR] ${book} ${chapter}:${verse}: ${error.message}`);
      failed++;

      progressCallback?.({
        book,
        chapter,
        verse,
        completed,
        failed,
        total,
        status: 'error',
        error: error.message
      });

      results.push({ book, chapter, verse, status: 'error', error: error.message });
      return { book, chapter, verse, status: 'error', error: error.message };
    }
  };

  // Pool 기반 병렬 처리
  await processWithPool(verses, getPoolSize(), processor);

  log(`[BATCH REANALYZE] Done: ${completed} completed, ${failed} failed`);

  return {
    total,
    completed,
    failed,
    results
  };
}

module.exports = {
  analyzeBooks,
  analyzeBook,
  analyzeVerse,
  reanalyzeVerse,
  reanalyzeBatch,
  stopAnalysis,
  getAnalysisState,
  loadEnv,
  // 분석 방법 관련
  setAnalysisMethod,
  getAnalysisMethod,
  getPoolSize
};
