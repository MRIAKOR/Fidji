const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

let win;
const notesFile = () => path.join(app.getPath('userData'), 'fidji-notes.json');
const configFile = () => path.join(app.getPath('userData'), 'fidji-config.json');
const imagesDir = () => path.join(app.getPath('userData'), 'images');

const devIcon = path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const hasIcon = fs.existsSync(devIcon);

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configFile(), 'utf-8')); } catch { return null; }
}
function writeConfig(c) {
  fs.writeFileSync(configFile(), JSON.stringify(c, null, 2), 'utf-8');
}
function hashPw(pw, salt) {
  return crypto.scryptSync(String(pw), Buffer.from(salt, 'hex'), 64).toString('hex');
}

function createWindow() {
  const opts = {
    width: 1180, 
    height: 760, 
    minWidth: 760, 
    minHeight: 520,
    frame: false,           // Убираем системную рамку
    transparent: true,      // ВАЖНО: Делаем окно прозрачным для CSS border-radius
    resizable: true,
    backgroundColor: '#00000000', // Полностью прозрачный фон (ARGB)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false
    }
  };
  
  if (hasIcon) opts.icon = devIcon;
  
  win = new BrowserWindow(opts);
  win.loadFile('index.html');
}

ipcMain.handle('notes:load', () => {
  try { return JSON.parse(fs.readFileSync(notesFile(), 'utf-8')); } catch { return []; }
});
ipcMain.handle('notes:save', (_e, notes) => {
  fs.writeFileSync(notesFile(), JSON.stringify(notes, null, 2), 'utf-8');
  return true;
});

function ensureImagesDir() {
  if (!fs.existsSync(imagesDir())) fs.mkdirSync(imagesDir(), { recursive: true });
}

ipcMain.handle('image:add', async () => {
  ensureImagesDir();
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','gif','webp','bmp','svg'] }]
  });
  if (result.canceled || !result.filePaths.length) return [];
  const out = [];
  for (const srcPath of result.filePaths) {
    const ext = path.extname(srcPath).toLowerCase();
    const fileName = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + ext;
    const destPath = path.join(imagesDir(), fileName);
    try { fs.copyFileSync(srcPath, destPath); out.push(destPath); } catch (err) { console.error('image copy error:', err); }
  }
  return out;
});

ipcMain.handle('image:getBase', () => {
  ensureImagesDir();
  let u = pathToFileURL(imagesDir()).href;
  if (!u.endsWith('/')) u += '/';
  return u;
});

ipcMain.handle('file:openText', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Text', extensions: ['txt','md','markdown','csv','log','json','xml','html','htm'] }]
  });
  if (result.canceled || !result.filePaths.length) return { ok: false };
  try {
    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf-8');
    return { ok: true, text, name: path.basename(filePath) };
  } catch (err) { console.error('file open error:', err); return { ok: false }; }
});

ipcMain.handle('auth:getStatus', () => {
  const cfg = readConfig();
  if (!cfg) return { hasPassword: false, firstRun: true };
  return { hasPassword: !!cfg.passwordHash, firstRun: cfg.firstRun !== false };
});
ipcMain.handle('auth:setPassword', (_e, pw) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const cfg = readConfig() || {};
  cfg.salt = salt;
  cfg.passwordHash = hashPw(pw, salt);
  cfg.firstRun = false;
  writeConfig(cfg);
  return true;
});
ipcMain.handle('auth:skipSetup', () => {
  const cfg = readConfig() || {};
  delete cfg.salt; delete cfg.passwordHash; cfg.firstRun = false;
  writeConfig(cfg);
  return true;
});
ipcMain.handle('auth:removePassword', () => {
  const cfg = readConfig() || {};
  delete cfg.salt; delete cfg.passwordHash;
  writeConfig(cfg);
  return true;
});
ipcMain.handle('auth:verify', (_e, pw) => {
  const cfg = readConfig();
  if (!cfg || !cfg.passwordHash) return true;
  const h = hashPw(pw, cfg.salt);
  try { return crypto.timingSafeEqual(Buffer.from(h,'hex'), Buffer.from(cfg.passwordHash,'hex')); } catch { return false; }
});

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });