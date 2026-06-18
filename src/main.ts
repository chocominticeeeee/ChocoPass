import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { importKeePassCSV } from './services/keepassImporter.js';
import type { PasswordEntry } from './services/keepassImporter.js';
import {
  hasMasterPassword,
  isUnlocked,
  setupMaster,
  unlock,
  lock,
  changeMaster,
  getDataDir,
  setDataDir,
  loadVault,
  saveVault,
  openDbFile,
  getCurrentDbPath,
} from './services/vaultStore.js';

// ESM では __dirname が存在しないため import.meta.url から導出する
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: any;

/** 起動引数から実在する .cdb ファイルのパスを探す（ダブルクリック起動時に渡される） */
function findCdbInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.toLowerCase().endsWith('.cdb') && fs.existsSync(arg)) {
      return arg;
    }
  }
  return null;
}

/** 指定された .cdb を開き、ウィンドウがあればレンダラへ通知してロック画面に戻す */
function handleOpenCdb(filePath: string) {
  openDbFile(filePath);
  if (mainWindow) {
    mainWindow.webContents.send('open-cdb', filePath);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

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
      preload: path.join(__dirname, 'preload.cjs'),
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

// 二重起動を防ぐ。既に起動中なら、渡された .cdb を最初のインスタンスに転送して終了する
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event: any, argv: string[]) => {
    const file = findCdbInArgv(argv);
    if (file) {
      handleOpenCdb(file);
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// macOS: Finder からのファイルオープン（ready 前にも発火しうるので最上位で登録）
app.on('open-file', (event: any, filePath: string) => {
  event.preventDefault();
  if (app.isReady()) {
    handleOpenCdb(filePath);
  } else {
    // 起動途中なら、ウィンドウ生成後に開けるよう記憶しておく
    openDbFile(filePath);
  }
});

app.on('ready', () => {
  app.setName('ChocoPass');
  // ダブルクリック起動時はそのファイルを開いた状態でウィンドウを作る
  const file = findCdbInArgv(process.argv);
  if (file) {
    openDbFile(file);
  }
  createWindow();
});

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

ipcMain.handle('setup-master', (_event: any, password: string) => {
  const entries = setupMaster(password);
  return { ok: true, entries };
});

ipcMain.handle('unlock-vault', (_event: any, password: string) => {
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

ipcMain.handle('change-master', (_event: any, payload: { oldPassword: string; newPassword: string }) => {
  const ok = changeMaster(payload.oldPassword, payload.newPassword);
  return { ok };
});

// --- データ保存先 ---
ipcMain.handle('get-data-dir', () => {
  return getDataDir();
});

// 現在開いている .cdb のフルパス
ipcMain.handle('get-current-db', () => {
  return getCurrentDbPath();
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
ipcMain.handle('import-keepass-csv', async (_event: any, filePath: string) => {
  return await importKeePassCSV(filePath);
});

// IPC handler: open a native file dialog, then import the selected CSV
ipcMain.handle('select-and-import-csv', async (_event: any) => {
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
ipcMain.handle('save-vault', async (_event: any, entries: PasswordEntry[]) => {
  saveVault(entries);
  return true;
});

// OS標準のアプリケーションメニューは自前UIに統合するため非表示にする
Menu.setApplicationMenu(null);
