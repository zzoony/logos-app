/**
 * Sentence Analysis Dashboard - Constants
 * 상수 정의 (성경 책 이름, 버전 매핑 등)
 */

const path = require('path');

// 경로 설정
const PATHS = {
  SOURCE_DATA: path.join(__dirname, '../../source-data'),
  VOCABULARY: path.join(__dirname, '../../vocabulary/output'),
  OUTPUT: path.join(__dirname, '../output'),
  ENV: path.join(__dirname, '../../vocabulary/.env')
};

// 버전명 → 파일명 매핑
const BIBLE_FILE_MAP = {
  'ESV': 'ESV_Bible.json',
  'NIV': 'NIV_Bible.json',
  'KJV': 'KJV_Bible.json',
  'Easy': 'Easy_Bible.json',
  'Hebrew': 'Hebrew_Bible.json'
};

// 성경 책 이름 매핑 (영어 -> 한글)
const BOOK_NAMES_KO = {
  // 구약
  'Genesis': '창세기',
  'Exodus': '출애굽기',
  'Leviticus': '레위기',
  'Numbers': '민수기',
  'Deuteronomy': '신명기',
  'Joshua': '여호수아',
  'Judges': '사사기',
  'Ruth': '룻기',
  '1 Samuel': '사무엘상',
  '2 Samuel': '사무엘하',
  '1 Kings': '열왕기상',
  '2 Kings': '열왕기하',
  '1 Chronicles': '역대상',
  '2 Chronicles': '역대하',
  'Ezra': '에스라',
  'Nehemiah': '느헤미야',
  'Esther': '에스더',
  'Job': '욥기',
  'Psalms': '시편',
  'Proverbs': '잠언',
  'Ecclesiastes': '전도서',
  'Song of Solomon': '아가',
  'Isaiah': '이사야',
  'Jeremiah': '예레미야',
  'Lamentations': '예레미야애가',
  'Ezekiel': '에스겔',
  'Daniel': '다니엘',
  'Hosea': '호세아',
  'Joel': '요엘',
  'Amos': '아모스',
  'Obadiah': '오바댜',
  'Jonah': '요나',
  'Micah': '미가',
  'Nahum': '나훔',
  'Habakkuk': '하박국',
  'Zephaniah': '스바냐',
  'Haggai': '학개',
  'Zechariah': '스가랴',
  'Malachi': '말라기',
  // 신약
  'Matthew': '마태복음',
  'Mark': '마가복음',
  'Luke': '누가복음',
  'John': '요한복음',
  'Acts': '사도행전',
  'Romans': '로마서',
  '1 Corinthians': '고린도전서',
  '2 Corinthians': '고린도후서',
  'Galatians': '갈라디아서',
  'Ephesians': '에베소서',
  'Philippians': '빌립보서',
  'Colossians': '골로새서',
  '1 Thessalonians': '데살로니가전서',
  '2 Thessalonians': '데살로니가후서',
  '1 Timothy': '디모데전서',
  '2 Timothy': '디모데후서',
  'Titus': '디도서',
  'Philemon': '빌레몬서',
  'Hebrews': '히브리서',
  'James': '야고보서',
  '1 Peter': '베드로전서',
  '2 Peter': '베드로후서',
  '1 John': '요한1서',
  '2 John': '요한2서',
  '3 John': '요한3서',
  'Jude': '유다서',
  'Revelation': '요한계시록'
};

// 구약 책 목록 (순서대로)
const OLD_TESTAMENT = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah',
  'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
  'Haggai', 'Zechariah', 'Malachi'
];

// 신약 책 목록 (순서대로)
const NEW_TESTAMENT = [
  'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans',
  '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John',
  'Jude', 'Revelation'
];

// 전체 성경 책 목록
const ALL_BOOKS = [...OLD_TESTAMENT, ...NEW_TESTAMENT];

module.exports = {
  PATHS,
  BIBLE_FILE_MAP,
  BOOK_NAMES_KO,
  OLD_TESTAMENT,
  NEW_TESTAMENT,
  ALL_BOOKS
};
