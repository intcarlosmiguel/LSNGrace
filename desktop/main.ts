import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import { join } from 'node:path';
import { startServer } from './server';

let window: BrowserWindow | undefined;
let status: { phase: string; version?: string; percent?: number; message?: string } = { phase: 'idle' };
const update = (next: typeof status) => {
  status = next;
  window?.webContents.send('updates:changed', status);
};
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.on('checking-for-update', () => update({ phase: 'checking' }));
autoUpdater.on('update-available', info => update({ phase: 'available', version: info.version }));
autoUpdater.on('update-not-available', () => update({ phase: 'current' }));
autoUpdater.on('download-progress', info => update({ phase: 'downloading', percent: info.percent }));
autoUpdater.on('update-downloaded', info => update({ phase: 'ready', version: info.version }));
autoUpdater.on('error', error => update({ phase: 'error', message: error.message }));
async function check() {
  if (!app.isPackaged) { update({ phase: 'disabled', message: 'Atualizações disponíveis na versão instalada.' }); return; }
  if (['checking', 'available', 'downloading', 'ready'].includes(status.phase)) return;
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { update({ phase: 'error', message: (error as Error).message }); }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.restore(); window?.focus(); });
  void app.whenReady().then(async () => {
    const { server, url } = await startServer(join(app.getAppPath(), 'dist'));
    app.on('before-quit', () => server.close());
    window = new BrowserWindow({
      title: 'LSNGrace', width: 1440, height: 960, minWidth: 850, minHeight: 600,
      webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    window.setMenuBarVisibility(false);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event, target) => {
      if (new URL(target).origin !== url) event.preventDefault();
    });
    const trusted = (event: Electron.IpcMainInvokeEvent) => {
      if (event.sender !== window?.webContents || event.senderFrame?.url !== `${url}/`) throw Error('Origem não autorizada.');
    };
    ipcMain.handle('updates:status', event => { trusted(event); return status; });
    ipcMain.handle('updates:check', async event => { trusted(event); await check(); });
    ipcMain.handle('updates:download', async event => {
      trusted(event);
      if (status.phase !== 'available') return;
      update({ phase: 'downloading', percent: 0 });
      try { await autoUpdater.downloadUpdate(); }
      catch (error) { update({ phase: 'error', message: (error as Error).message }); }
    });
    ipcMain.handle('updates:install', event => {
      trusted(event);
      if (status.phase === 'ready') autoUpdater.quitAndInstall();
    });
    await window.loadURL(url);
    void check();
    const timer = setInterval(() => void check(), 4 * 60 * 60 * 1000);
    timer.unref();
  }).catch(error => { dialog.showErrorBox('LSNGrace', String(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
}
