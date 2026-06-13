import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import { importKeePassCSV } from './services/keepassImporter';
import type { PasswordEntry } from './services/keepassImporter';
import {
  loadVault,
  saveVault,
  hasMasterPassword,
  setupMaster,
  unlock,
  lock,
  changeMaster,
  isUnlocked,
  getDataDir,
  setDataDir,
} from './services/vaultStore';

// 保存先を AppData\Roaming\ChocoPass に固定する（未パッケージ時の "Electron" 既定を上書き）
app.setName('ChocoPass');

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    // 自前のタイトルバーを使うのでOS標準フレームを無効化する
    frame: false,
    backgroundColor: '#05070f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
  }

  // 最大化状態の変化をレンダラに通知（タイトルバーのアイコン切替用）
  const emitMaximize = () => {
    mainWindow?.webContents.send('window-maximized-changed', mainWindow.isMaximized());
  };
  mainWindow.on('maximize', emitMaximize);
  mainWindow.on('unmaximize', emitMaximize);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- ウィンドウ操作 ---
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize-toggle', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// --- マスターパスワード / ロック ---
ipcMain.handle('auth-status', () => {
  return { hasMaster: hasMasterPassword(), unlocked: isUnlocked() };
});

ipcMain.handle('setup-master', (_event, password: string) => {
  const entries = setupMaster(password);
  return { ok: true, entries };
});

ipcMain.handle('unlock-vault', (_event, password: string) => {
  const entries = unlock(password);
  if (entries === null) {
    return { ok: false };
  }
  return { ok: true, entries };
});

ipcMain.handle('lock-vault', () => {
  lock();
  return true;
});

ipcMain.handle('change-master', (_event, payload: { oldPassword: string; newPassword: string }) => {
  const ok = changeMaster(payload.oldPassword, payload.newPassword);
  return { ok };
});

// --- データ保存先 ---
ipcMain.handle('get-data-dir', () => {
  return getDataDir();
});

ipcMain.handle('change-data-dir', async () => {
  if (!mainWindow) return { ok: false };
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'データの保存先フォルダを選択',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }
  try {
    const newPath = setDataDir(result.filePaths[0]);
    return { ok: true, path: newPath };
  } catch (error) {
    console.error('Failed to change data dir:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// IPC handler: import from an explicit file path
ipcMain.handle('import-keepass-csv', async (_event, filePath: string) => {
  return await importKeePassCSV(filePath);
});

// IPC handler: open a native file dialog, then import the selected CSV
ipcMain.handle('select-and-import-csv', async () => {
  const result = await dialog.showOpenDialog({
    title: 'KeePass CSVを選択',
    properties: ['openFile'],
    filters: [{ name: 'CSVファイル', extensions: ['csv'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return await importKeePassCSV(result.filePaths[0]);
});

// IPC handler: 保存済みのエントリを読み込む
ipcMain.handle('load-vault', async () => {
  return loadVault();
});

// IPC handler: エントリ一覧を永続保存する
ipcMain.handle('save-vault', async (_event, entries: PasswordEntry[]) => {
  saveVault(entries);
  return true;
});

// OS標準のアプリケーションメニューは自前UIに統合するため非表示にする
Menu.setApplicationMenu(null);
