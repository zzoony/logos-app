/**
 * Sentence Analysis Dashboard Configuration
 * 분석 및 검증 관련 설정
 */

module.exports = {
  // 병렬 처리 Pool 크기 (동시 실행 worker 수)
  // 이 값을 변경하면 분석/재분석 속도에 영향을 줌
  POOL_SIZE: 5,

  // API 타임아웃 (ms)
  API_TIMEOUT: 120000,

  // 기본 API 설정
  DEFAULT_API_BASE: 'https://api.z.ai/api/coding/paas/v4',
  DEFAULT_API_MODEL: 'glm-4.6'
};
