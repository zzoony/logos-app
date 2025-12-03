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
  }
});
