/**
 * Preload Script
 * contextBridge를 통해 렌더러에 안전한 API만 노출
 */

const { contextBridge, ipcRenderer } = require('electron');

// 렌더러에서 사용할 수 있는 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 성경 데이터 로드
  loadBibleData: (version) => ipcRenderer.invoke('load-bible-data', version),

  // Output 폴더 관련
  initOutputFolders: (version) => ipcRenderer.invoke('init-output-folders', version),
  getAnalysisProgress: (version) => ipcRenderer.invoke('get-analysis-progress', version),

  // 분석 관련 IPC (추후 구현)
  startAnalysis: (books) => ipcRenderer.invoke('start-analysis', books),
  stopAnalysis: () => ipcRenderer.invoke('stop-analysis'),

  // 이벤트 리스너 (cleanup 함수 반환)
  onAnalysisProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('analysis-progress', listener);
    return () => ipcRenderer.removeListener('analysis-progress', listener);
  },
  onAnalysisComplete: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('analysis-complete', listener);
    return () => ipcRenderer.removeListener('analysis-complete', listener);
  },

  // 검증 관련 IPC
  startValidation: (options) => ipcRenderer.invoke('start-validation', options),
  generateValidationReport: (results) => ipcRenderer.invoke('generate-validation-report', results),

  // 검증 이벤트 리스너
  onValidationProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('validation-progress', listener);
    return () => ipcRenderer.removeListener('validation-progress', listener);
  },
  onValidationComplete: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('validation-complete', listener);
    return () => ipcRenderer.removeListener('validation-complete', listener);
  },

  // 에디터에서 파일 열기
  openInEditor: (options) => ipcRenderer.invoke('open-in-editor', options),
  getFilePath: (options) => ipcRenderer.invoke('get-file-path', options),

  // 단일 구절 재분석
  reanalyzeVerse: (options) => ipcRenderer.invoke('reanalyze-verse', options),

  // 배치 재분석 (Pool 기반 병렬 처리)
  reanalyzeBatch: (options) => ipcRenderer.invoke('reanalyze-batch', options),

  // 배치 재분석 이벤트 리스너
  onReanalyzeProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('reanalyze-progress', listener);
    return () => ipcRenderer.removeListener('reanalyze-progress', listener);
  },
  onReanalyzeComplete: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('reanalyze-complete', listener);
    return () => ipcRenderer.removeListener('reanalyze-complete', listener);
  },

  // 분석 방법 설정
  setAnalysisMethod: (method) => ipcRenderer.invoke('set-analysis-method', method),
  getAnalysisMethod: () => ipcRenderer.invoke('get-analysis-method'),
  getPoolSize: () => ipcRenderer.invoke('get-pool-size')
});
