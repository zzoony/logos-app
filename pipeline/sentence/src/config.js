/**
 * Sentence Analysis Dashboard Configuration
 * 분석 및 검증 관련 설정
 */

module.exports = {
  // 분석 방법: 'api' | 'claude' | 'droid'
  // - api: Z.AI API 직접 호출 (기본값)
  // - claude: Claude CLI (haiku 모델)
  // - droid: Droid exec (glm-4.6 모델)
  ANALYSIS_METHOD: 'droid',

  // 병렬 처리 Pool 크기 (동시 실행 worker 수)
  // API: 4개 (최대 허용), Claude/Droid: 30개
  POOL_SIZE_API: 4,
  POOL_SIZE_CLI: 30,

  // API 타임아웃 (ms)
  API_TIMEOUT: 120000,

  // CLI 타임아웃 (ms)
  CLI_TIMEOUT: 180000,

  // 기본 API 설정 (Z.AI)
  DEFAULT_API_BASE: 'https://api.z.ai/api/coding/paas/v4',
  DEFAULT_API_MODEL: 'glm-4.6',

  // Claude CLI 설정
  CLAUDE_MODEL: 'haiku',

  // Droid exec 설정
  DROID_MODEL: 'glm-4.6',

  // 재시도 설정
  // 전체 세션 완료 후 실패한 구절들을 재시도하는 최대 횟수
  MAX_RETRY_SESSIONS: 5
};
