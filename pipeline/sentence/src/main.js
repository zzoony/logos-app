const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

// IPC 핸들러 등록
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('start-analysis', async (event, books) => {
  // TODO: 분석 로직 구현
  console.log('Analysis started for books:', books);
  return { success: true };
});

ipcMain.handle('stop-analysis', async () => {
  // TODO: 분석 중단 로직 구현
  console.log('Analysis stopped');
  return { success: true };
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0D0F12',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // 개발 모드에서 DevTools 열기
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
