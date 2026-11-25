const { app, BrowserWindow, ipcMain, dialog, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

let win;

const notesFile = () => path.join(app.getPath('userData'), 'fidji-notes.json');
const configFile = () => path.join(app.getPath('userData'), 'fidji-config.json');
const imagesDir = () => path.join(app.getPath('userData'), 'images');
const devIcon = path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const hasIcon = fs.existsSync(devIcon);

function voiceDirs() {
  return [
    path.join(app.getPath('userData'), 'voice'),
    path.join(__dirname, 'voice')
  ];
}

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
    frame: false,
    transparent: true,
    resizable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  };
  if (hasIcon) opts.icon = devIcon;
  win = new BrowserWindow(opts);
  win.loadFile('index.html');
  win.webContents.on('dom-ready', () => {
    const p = path.join(__dirname, 'voice.js');
    try {
      const code = fs.readFileSync(p, 'utf-8');
      win.webContents.executeJavaScript(code).catch((err) => console.error('voice.js error:', err));
    } catch (err) { console.error('voice.js load error:', err); }
  });
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

/* ---------- Voice: Whisper, offline, auto language ---------- */
const WHISPER_MODEL_URLS = [
  'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  'https://hf-mirror.com/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
];
const WHISPER_ZIP_URLS = [
  'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip',
  'https://gh-proxy.com/https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip'
];
/* Подсказка для whisper: с ней он слышит командные слова гораздо чище */
const WHISPER_PROMPT = 'Фиджи: новая заметка, сохрани, удали заметку, закрепи, открепи, найди, переведи, тема, стоп. Fidji: new note, save, delete note, pin, unpin, find, translate, theme, stop.';
let voiceReady = null;

function doFetch(url, opts) {
  const f = (net && typeof net.fetch === 'function') ? net.fetch : fetch;
  return f(url, opts);
}
async function httpBuffer(url, timeoutMs) {
  let signal = undefined;
  try { signal = AbortSignal.timeout(timeoutMs || 300000); } catch {}
  const res = await doFetch(url, { signal, headers: { 'User-Agent': 'fidji', 'Accept': '*/*' } });
  if (!res.ok) throw new Error('http ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}
function findWhisperExe(dir) {
  for (const n of ['whisper-cli.exe', 'main.exe']) {
    const p = path.join(dir, n);
    if (fs.existsSync(p)) return p;
  }
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const f = findWhisperExe(path.join(dir, e.name));
        if (f) return f;
      }
    }
  } catch {}
  return null;
}
async function ensureVoice() {
  for (const dir of voiceDirs()) {
    const exe = findWhisperExe(dir);
    const modelPath = path.join(dir, 'ggml-base.bin');
    if (exe && fs.existsSync(modelPath)) {
      console.log('voice: found local files in', dir);
      return { exe, modelPath };
    }
  }
  const dir = voiceDirs()[0];
  fs.mkdirSync(dir, { recursive: true });
  const modelPath = path.join(dir, 'ggml-base.bin');
  let exe = findWhisperExe(dir);
  if (!exe) {
    const zip = path.join(dir, 'whisper.zip');
    const errs = [];
    let ok = false;
    for (const u of WHISPER_ZIP_URLS) {
      try {
        console.log('Downloading whisper bin from:', u);
        const buf = await httpBuffer(u, 300000);
        fs.writeFileSync(zip, buf);
        ok = true;
        break;
      } catch (e) { errs.push(String((e && e.message) || e)); }
    }
    if (!ok) throw new Error('bin: ' + errs.join(' | '));
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Expand-Archive', '-LiteralPath', zip, '-DestinationPath', dir, '-Force'], { windowsHide: true });
    } catch (e) { throw new Error('unzip: ' + String((e && e.message) || e)); }
    try { fs.unlinkSync(zip); } catch {}
    exe = findWhisperExe(dir);
    if (!exe) throw new Error('exe not found after unzip');
  }
  if (!fs.existsSync(modelPath)) {
    const errs = [];
    let ok = false;
    for (const u of WHISPER_MODEL_URLS) {
      try {
        console.log('Downloading whisper model from:', u);
        const buf = await httpBuffer(u, 600000);
        fs.writeFileSync(modelPath, buf);
        ok = true;
        break;
      } catch (e) { errs.push(String((e && e.message) || e)); }
    }
    if (!ok) throw new Error('model: ' + errs.join(' | '));
  }
  return { exe, modelPath };
}
function writeWav(file, pcm, rate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
}
ipcMain.handle('voice:ensure', async () => {
  try {
    if (!voiceReady) voiceReady = ensureVoice();
    await voiceReady;
    return { ok: true };
  } catch (err) {
    voiceReady = null;
    console.error('voice ensure error:', err);
    return { ok: false, error: String((err && err.message) || err) };
  }
});
ipcMain.handle('voice:segment', async (_e, data) => {
  try {
    if (!voiceReady) voiceReady = ensureVoice();
    const { exe, modelPath } = await voiceReady;
    const dir = path.dirname(modelPath);
    const wav = path.join(dir, 'seg-' + Date.now() + '.wav');
    const outPrefix = wav + '-out';
    writeWav(wav, Buffer.from(data && data.buffer ? data.buffer : data), 16000);
    console.log('voice: running whisper on', Math.round((data.byteLength / 2 / 16000) * 10) / 10, 'sec of audio');
    const text = await new Promise((resolve, reject) => {
      const args = ['-m', modelPath, '-f', wav, '-l', 'auto', '-otxt', '-nt', '-ng', '-of', outPrefix, '--prompt', WHISPER_PROMPT];
      const child = spawn(exe, args, { windowsHide: true });
      child.stdout.on('data', d => console.log('whisper out:', d.toString().trim()));
      child.stderr.on('data', d => console.log('whisper err:', d.toString().trim()));
      child.on('error', reject);
      child.on('close', (code) => {
        console.log('whisper exit code:', code);
        try {
          const f = outPrefix + '.txt';
          let txt = '';
          if (fs.existsSync(f)) {
            txt = fs.readFileSync(f, 'utf-8');
            try { fs.unlinkSync(f); } catch {}
          }
          try { fs.unlinkSync(wav); } catch {}
          if (code !== 0 && !txt.trim()) { reject(new Error('whisper exit ' + code)); return; }
          resolve(txt);
        } catch (e) { reject(e); }
      });
    });
    console.log('voice: recognized text:', JSON.stringify(text));
    return { ok: true, text: String(text || '').replace(/\s+/g, ' ').trim() };
  } catch (err) {
    console.error('voice segment error:', err);
    return { ok: false, error: String((err && err.message) || err) };
  }
});

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(true);
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });