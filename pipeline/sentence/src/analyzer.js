/**
 * Sentence Analyzer Module
 * Z.AI API를 사용한 성경 구절 분석
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

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

/**
 * 성경 데이터 로드
 */
function loadBibleData(version) {
  if (bibleDataCache[version]) return bibleDataCache[version];

  const fileName = `${version.toUpperCase()}_Bible.json`;
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

  // API 호출
  const prompt = createAnalysisPrompt(verseText, verseRef);
  const response = await callAPI(prompt);

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

// 병렬 처리 설정 (Pool 크기)
const POOL_SIZE = 5;

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

  // 출력 디렉토리 확인
  const outputPath = path.join(OUTPUT_DIR, version.toLowerCase(), bookName);
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  }

  let completed = 0;  // 성공한 구절 수
  let processed = 0;  // 처리된 구절 수 (성공 + 실패)
  const total = verses.length;
  const errors = [];

  // 분석이 필요한 구절만 필터링
  const versesToAnalyze = verses.filter(({ chapter, verse }) => {
    const fileName = `${bookName}_${chapter}_${verse}.json`;
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

  console.log(`[INFO] ${bookName}: ${versesToAnalyze.length} verses to analyze (${completed} already done)`);
  console.log(`[POOL] Starting with ${POOL_SIZE} concurrent workers`);

  // Pool 기반 병렬 처리
  const processor = async ({ chapter, verse }) => {
    const fileName = `${bookName}_${chapter}_${verse}.json`;
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
        console.log(`[SAVE] ${fileName}`);
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

  await processWithPool(versesToAnalyze, POOL_SIZE, processor);

  if (shouldStop) {
    console.log(`[STOP] Analysis stopped by user`);
  }

  return { completed, total, errors, stopped: shouldStop };
}

/**
 * 여러 책 분석
 */
async function analyzeBooks(bookNames, version, progressCallback) {
  isAnalyzing = true;
  shouldStop = false;

  const results = {};
  let totalCompleted = 0;
  let totalVerses = 0;

  for (const bookName of bookNames) {
    if (shouldStop) break;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[START] Analyzing ${bookName} (${version})`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const result = await analyzeBook(bookName, version, (progress) => {
        progressCallback?.({
          ...progress,
          currentBook: bookName,
          totalBooks: bookNames.length,
          bookIndex: bookNames.indexOf(bookName) + 1
        });
      });

      results[bookName] = result;
      totalCompleted += result.completed;
      totalVerses += result.total;

      console.log(`\n[DONE] ${bookName}: ${result.completed}/${result.total} verses`);
      if (result.errors.length > 0) {
        console.log(`[ERRORS] ${result.errors.length} errors occurred`);
      }

    } catch (error) {
      console.error(`[FATAL] ${bookName}: ${error.message}`);
      results[bookName] = { error: error.message };
    }
  }

  isAnalyzing = false;

  return {
    results,
    totalCompleted,
    totalVerses,
    stopped: shouldStop
  };
}

/**
 * 분석 중단
 */
function stopAnalysis() {
  shouldStop = true;
  console.log('[STOP] Stop requested...');
}

/**
 * 분석 상태 확인
 */
function getAnalysisState() {
  return { isAnalyzing, shouldStop };
}

module.exports = {
  analyzeBooks,
  analyzeBook,
  analyzeVerse,
  stopAnalysis,
  getAnalysisState,
  loadEnv
};
