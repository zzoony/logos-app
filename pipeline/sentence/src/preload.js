/**
 * Preload Script
 * contextBridge를 통해 렌더러에 안전한 API만 노출
 */

const { contextBridge, ipcRenderer } = require('electron');

// 렌더러에서 사용할 수 있는 안전한 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 앱 정보
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // 분석 관련 IPC (추후 구현)
  startAnalysis: (books) => ipcRenderer.invoke('start-analysis', books),
  stopAnalysis: () => ipcRenderer.invoke('stop-analysis'),

  // 이벤트 리스너
  onAnalysisProgress: (callback) => {
    ipcRenderer.on('analysis-progress', (event, data) => callback(data));
  },
  onAnalysisComplete: (callback) => {
    ipcRenderer.on('analysis-complete', (event, data) => callback(data));
  },

  // 리스너 제거
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
