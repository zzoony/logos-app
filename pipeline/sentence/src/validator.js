/**
 * Sentence Validator Module
 * 분석된 문장 데이터 검증
 */

const fs = require('fs');
const path = require('path');
const { toFilename, normalizeText, extractWords } = require('./utils');
const { PATHS, BIBLE_FILE_MAP } = require('./constants');

// 캐시
let bibleDataCache = {};

/**
 * 성경 데이터 로드
 */
function loadBibleData(version) {
  if (bibleDataCache[version]) return bibleDataCache[version];

  const fileName = BIBLE_FILE_MAP[version] || `${version}_Bible.json`;
  const filePath = path.join(PATHS.SOURCE_DATA, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bible data not found: ${filePath}`);
  }
  bibleDataCache[version] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return bibleDataCache[version];
}

/**
 * 한글 문자 검사 (한글, 공백, 구두점 허용)
 */
function isKoreanText(text) {
  // 한글 범위: 가-힣 (완성형), ㄱ-ㅎ (자음), ㅏ-ㅣ (모음)
  // 허용: 공백, 숫자, 기본 구두점
  const nonKoreanPattern = /[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\s0-9.,!?;:'"()\-–—…·]/g;
  const matches = text.match(nonKoreanPattern);
  return {
    isValid: !matches || matches.length === 0,
    invalidChars: matches ? [...new Set(matches)] : []
  };
}

/**
 * 영어 단어가 포함되어 있는지 검사
 */
function hasEnglishWord(text) {
  const englishPattern = /[a-zA-Z]{3,}/g;
  const matches = text.match(englishPattern);
  return {
    hasEnglish: matches && matches.length > 0,
    englishWords: matches ? [...new Set(matches)] : []
  };
}

/**
 * JSON 형식 검증
 * 필수 필드 및 타입 검사
 */
function validateJsonFormat(verseData) {
  const issues = [];

  // 필수 최상위 필드
  const requiredTopFields = ['verse_reference', 'version', 'original_text', 'korean_text', 'sentences'];

  for (const field of requiredTopFields) {
    if (verseData[field] === undefined || verseData[field] === null) {
      issues.push({
        type: 'invalid_json_format',
        message: `필수 필드 누락: ${field}`,
        field
      });
    }
  }

  // sentences 배열 검증
  if (verseData.sentences !== undefined) {
    if (!Array.isArray(verseData.sentences)) {
      issues.push({
        type: 'invalid_json_format',
        message: 'sentences가 배열이 아님',
        field: 'sentences',
        actualType: typeof verseData.sentences
      });
    } else if (verseData.sentences.length === 0) {
      issues.push({
        type: 'invalid_json_format',
        message: 'sentences 배열이 비어있음',
        field: 'sentences'
      });
    } else {
      // 각 sentence 객체 검증
      const requiredSentenceFields = ['sequence_order', 'original_text', 'korean_translation', 'word_indices'];

      for (let i = 0; i < verseData.sentences.length; i++) {
        const sent = verseData.sentences[i];

        for (const field of requiredSentenceFields) {
          if (sent[field] === undefined || sent[field] === null) {
            issues.push({
              type: 'invalid_json_format',
              message: `sentences[${i}] 필수 필드 누락: ${field}`,
              field: `sentences[${i}].${field}`,
              sequenceOrder: sent.sequence_order || i + 1
            });
          }
        }

        // sequence_order 타입 검증
        if (sent.sequence_order !== undefined && typeof sent.sequence_order !== 'number') {
          issues.push({
            type: 'invalid_json_format',
            message: `sentences[${i}].sequence_order가 숫자가 아님`,
            field: `sentences[${i}].sequence_order`,
            actualType: typeof sent.sequence_order
          });
        }

        // word_indices 타입 검증
        if (sent.word_indices !== undefined) {
          if (!Array.isArray(sent.word_indices)) {
            issues.push({
              type: 'invalid_json_format',
              message: `sentences[${i}].word_indices가 배열이 아님`,
              field: `sentences[${i}].word_indices`,
              actualType: typeof sent.word_indices
            });
          } else {
            // 배열 내 요소가 정수인지 검증 (NaN, Infinity, 소수점 제외)
            const invalidIndices = sent.word_indices.filter(idx => !Number.isInteger(idx));
            if (invalidIndices.length > 0) {
              issues.push({
                type: 'invalid_json_format',
                message: `sentences[${i}].word_indices에 유효하지 않은 요소 포함`,
                field: `sentences[${i}].word_indices`,
                invalidValues: invalidIndices.slice(0, 5)  // 처음 5개만 표시
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

/**
 * 단일 구절 검증
 */
function validateVerse(verseData, sourceVerse) {
  const issues = [];

  // 0. JSON 형식 검증
  const jsonFormatIssues = validateJsonFormat(verseData);
  issues.push(...jsonFormatIssues);

  // JSON 형식에 심각한 문제가 있으면 다른 검증 건너뜀
  if (jsonFormatIssues.length > 0) {
    return issues;
  }

  // 1. 원문 일치 검증 (source와 original_text 비교)
  if (sourceVerse) {
    const normalizedSource = normalizeText(sourceVerse);
    const normalizedOriginal = normalizeText(verseData.original_text);

    if (normalizedSource !== normalizedOriginal) {
      issues.push({
        type: 'source_mismatch',
        message: '원문이 소스와 일치하지 않음',
        expected: normalizedSource.substring(0, 100),
        actual: normalizedOriginal.substring(0, 100)
      });
    }
  }

  // 2. 구문 합치기 검증 (sentences 합치면 original_text와 같아야 함)
  if (verseData.sentences && verseData.sentences.length > 0) {
    const mergedText = verseData.sentences
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map(s => s.original_text)
      .join(' ');

    const normalizedOriginal = normalizeText(verseData.original_text);
    const normalizedMerged = normalizeText(mergedText);

    // 구문 합친 것이 원문과 다른지 검사
    // 구두점/대시 제거 후 단어 비교 (대소문자 무시)
    const originalWords = extractWords(normalizedOriginal);
    const mergedWords = extractWords(normalizedMerged);

    const missingWords = originalWords.filter(w => !mergedWords.includes(w));
    const extraWords = mergedWords.filter(w => !originalWords.includes(w));

    if (missingWords.length > 0 || extraWords.length > 0) {
      issues.push({
        type: 'sentence_merge_mismatch',
        message: '구문 합치기가 원문과 일치하지 않음',
        missingWords,
        extraWords,
        original: normalizedOriginal.substring(0, 100),
        merged: normalizedMerged.substring(0, 100)
      });
    }
  }

  // 3. 한글 번역 검증
  if (verseData.sentences) {
    for (const sent of verseData.sentences) {
      const korean = sent.korean_translation || '';

      // 3a. 빈 번역 검사
      if (!korean || korean.trim().length === 0) {
        issues.push({
          type: 'empty_translation',
          message: '빈 한글 번역',
          sequenceOrder: sent.sequence_order,
          originalText: sent.original_text
        });
        continue;
      }

      // 3b. 비한글 문자 검사
      const koreanCheck = isKoreanText(korean);
      if (!koreanCheck.isValid) {
        issues.push({
          type: 'non_korean_chars',
          message: '한글 번역에 비한글 문자 포함',
          sequenceOrder: sent.sequence_order,
          invalidChars: koreanCheck.invalidChars,
          translation: korean.substring(0, 50)
        });
      }

      // 3c. 영어 단어 포함 검사
      const englishCheck = hasEnglishWord(korean);
      if (englishCheck.hasEnglish) {
        issues.push({
          type: 'english_in_korean',
          message: '한글 번역에 영어 단어 포함',
          sequenceOrder: sent.sequence_order,
          englishWords: englishCheck.englishWords,
          translation: korean.substring(0, 50)
        });
      }
    }
  }

  return issues;
}

/**
 * 책 전체 검증
 */
function validateBook(bookName, version, progressCallback) {
  const bibleData = loadBibleData(version);
  const bookPath = path.join(PATHS.OUTPUT, version.toLowerCase(), toFilename(bookName));

  if (!fs.existsSync(bookPath)) {
    return { error: `Output folder not found: ${bookPath}` };
  }

  const files = fs.readdirSync(bookPath).filter(f => f.endsWith('.json'));
  const results = {
    bookName,
    version,
    totalVerses: files.length,
    validVerses: 0,
    issueCount: 0,
    issues: {
      invalid_json_format: [],
      json_parse_error: [],
      source_mismatch: [],
      sentence_merge_mismatch: [],
      empty_translation: [],
      non_korean_chars: [],
      english_in_korean: []
    }
  };

  let processed = 0;

  for (const file of files) {
    const filePath = path.join(bookPath, file);

    let verseData;
    try {
      verseData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (parseError) {
      // JSON 파싱 오류
      results.issueCount++;
      results.issues.json_parse_error.push({
        type: 'json_parse_error',
        message: `JSON 파싱 오류: ${parseError.message}`,
        fileName: file,
        verseRef: file.replace('.json', '').replace(/_/g, ' ')
      });
      processed++;
      progressCallback?.({
        book: bookName,
        processed,
        total: files.length,
        validCount: results.validVerses,
        issueCount: results.issueCount
      });
      continue;
    }

    // 원본 구절 가져오기
    const [, chapter, verse] = file.replace('.json', '').split('_').slice(-3);
    const sourceVerse = bibleData?.[bookName]?.[chapter]?.[verse] || null;

    // 검증
    const issues = validateVerse(verseData, sourceVerse);

    if (issues.length === 0) {
      results.validVerses++;
    } else {
      results.issueCount += issues.length;

      for (const issue of issues) {
        issue.verseRef = verseData.verse_reference || file.replace('.json', '').replace(/_/g, ' ');
        issue.fileName = file;

        if (results.issues[issue.type]) {
          results.issues[issue.type].push(issue);
        } else {
          console.warn(`[VALIDATE] Unknown issue type: ${issue.type}`, issue);
        }
      }
    }

    processed++;
    progressCallback?.({
      book: bookName,
      processed,
      total: files.length,
      validCount: results.validVerses,
      issueCount: results.issueCount
    });
  }

  return results;
}

/**
 * 여러 책 검증
 */
function validateBooks(bookNames, version, progressCallback) {
  const allResults = {
    version,
    totalBooks: bookNames.length,
    totalVerses: 0,
    totalValid: 0,
    totalIssues: 0,
    books: {}
  };

  for (let i = 0; i < bookNames.length; i++) {
    const bookName = bookNames[i];
    console.log(`\n[VALIDATE] ${bookName} (${i + 1}/${bookNames.length})`);

    const result = validateBook(bookName, version, (progress) => {
      progressCallback?.({
        ...progress,
        currentBook: bookName,
        bookIndex: i + 1,
        totalBooks: bookNames.length
      });
    });

    if (result.error) {
      allResults.books[bookName] = { error: result.error };
    } else {
      allResults.books[bookName] = result;
      allResults.totalVerses += result.totalVerses;
      allResults.totalValid += result.validVerses;
      allResults.totalIssues += result.issueCount;
    }
  }

  return allResults;
}

/**
 * 검증 리포트 생성
 */
function generateReport(results) {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('SENTENCE VALIDATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Version: ${results.version}`);
  lines.push(`Total Books: ${results.totalBooks}`);
  lines.push(`Total Verses: ${results.totalVerses}`);
  lines.push(`Valid Verses: ${results.totalValid}`);
  lines.push(`Total Issues: ${results.totalIssues}`);
  lines.push(`Pass Rate: ${((results.totalValid / results.totalVerses) * 100).toFixed(1)}%`);
  lines.push('');

  // 이슈 요약
  lines.push('--- Issue Summary ---');
  let issueTypes = {};
  for (const [bookName, bookResult] of Object.entries(results.books)) {
    if (bookResult.issues) {
      for (const [type, issues] of Object.entries(bookResult.issues)) {
        issueTypes[type] = (issueTypes[type] || 0) + issues.length;
      }
    }
  }
  for (const [type, count] of Object.entries(issueTypes)) {
    if (count > 0) {
      lines.push(`  ${type}: ${count}`);
    }
  }
  lines.push('');

  // 책별 요약
  lines.push('--- Book Summary ---');
  for (const [bookName, bookResult] of Object.entries(results.books)) {
    if (bookResult.error) {
      lines.push(`  ${bookName}: ERROR - ${bookResult.error}`);
    } else {
      const passRate = ((bookResult.validVerses / bookResult.totalVerses) * 100).toFixed(1);
      lines.push(`  ${bookName}: ${bookResult.validVerses}/${bookResult.totalVerses} (${passRate}%) - ${bookResult.issueCount} issues`);
    }
  }
  lines.push('');
  lines.push('='.repeat(60));

  return lines.join('\n');
}

module.exports = {
  validateVerse,
  validateBook,
  validateBooks,
  generateReport,
  loadBibleData
};
