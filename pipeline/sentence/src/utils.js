/**
 * Sentence Analysis Dashboard - Common Utilities
 * 공통 유틸리티 함수 모음
 */

const fs = require('fs');
const path = require('path');

/**
 * 타임스탬프와 함께 로그 출력
 * @param {...any} args - 로그 메시지
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

/**
 * 책 이름을 파일명 형식으로 변환 (공백 제거)
 * @param {string} bookName - 책 이름 (예: "1 Thessalonians")
 * @returns {string} 파일명 형식 (예: "1Thessalonians")
 */
function toFilename(bookName) {
  return bookName.replace(/\s+/g, '');
}

/**
 * 환경 변수 파일 로드
 * @param {string} envPath - .env 파일 경로
 * @returns {Object} 환경 변수 객체
 */
function loadEnv(envPath) {
  const env = {};

  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  return env;
}

/**
 * JSON 파일 로드
 * @param {string} filePath - JSON 파일 경로
 * @returns {Object} 파싱된 JSON 객체
 */
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * JSON 파일 저장
 * @param {string} filePath - 저장 경로
 * @param {Object} data - 저장할 데이터
 * @param {number} indent - 들여쓰기 (기본: 2)
 */
function saveJson(filePath, data, indent = 2) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, indent), 'utf-8');
}

/**
 * 텍스트 정규화 (비교용)
 * @param {string} text - 입력 텍스트
 * @returns {string} 정규화된 텍스트
 */
function normalizeText(text) {
  return text
    .replace(/\s+/g, ' ')  // 연속 공백 -> 단일 공백
    .replace(/\n/g, ' ')   // 줄바꿈 -> 공백
    .trim();
}

/**
 * 텍스트에서 단어 추출 (구두점 제거, em dash 분리)
 * @param {string} text - 입력 텍스트
 * @returns {string[]} 단어 배열
 */
function extractWords(text) {
  return text
    .replace(/[—–-]+/g, ' ')  // em dash, en dash, hyphen -> 공백
    .split(/\s+/)
    .map(w => w.replace(/^[^\w]+|[^\w]+$/g, '').toLowerCase())
    .filter(w => w.length > 0);
}

/**
 * 디렉토리가 없으면 생성
 * @param {string} dirPath - 디렉토리 경로
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

module.exports = {
  log,
  toFilename,
  loadEnv,
  loadJson,
  saveJson,
  normalizeText,
  extractWords,
  ensureDir
};
