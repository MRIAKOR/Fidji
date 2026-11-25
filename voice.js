(function () {
'use strict';
function q(s) { return document.querySelector(s); }
let voice = null;
let voiceRange = null;
let micBtn = null;
let toastEl = null;
let toastTimer = null;
let loadingTimer = null;
let ensured = false;
let tbRows = null;
const CHUNK_SEC = 12;

function uiRu() {
  try { return localStorage.getItem('fidji-lang') !== 'en'; } catch { return true; }
}
function msg(key) {
  const map = {
    denied: ['Нет доступа к микрофону', 'Microphone access denied'],
    net: ['Ошибка голоса', 'Voice error'],
    loading: ['Готовлю голос: при первом запуске скачивается модель, подожди…', 'Preparing voice: first run downloads the model, wait…'],
    title: ['Голосовой ввод', 'Voice input']
  };
  const m = map[key] || [key, key];
  return uiRu() ? m[0] : m[1];
}
function errText(r) {
  const code = r && r.error ? String(r.error) : '';
  if (!code) return '';
  const map = {
    bin: ' (не скачался архив whisper, проверь интернет)',
    model: ' (не скачалась модель ggml-base.bin, проверь интернет)',
    unzip: ' (не удалось распаковать архив)',
    exe: ' (в архиве не нашёлся whisper-cli.exe)'
  };
  return map[code] || ' (' + code + ')';
}
/* ---------- Настройка тулбара ---------- */
const TOOLBAR_ITEMS = [
  { id: 'bold', sel: ['.tools-static [data-cmd="bold"]'], ru: 'Жирный', en: 'Bold' },
  { id: 'italic', sel: ['.tools-static [data-cmd="italic"]'], ru: 'Курсив', en: 'Italic' },
  { id: 'underline', sel: ['.tools-static [data-cmd="underline"]'], ru: 'Подчёркнутый', en: 'Underline' },
  { id: 'strike', sel: ['.tools-static [data-cmd="strikeThrough"]'], ru: 'Зачёркнутый', en: 'Strikethrough' },
  { id: 'h1', sel: ['.tools-static [data-block="h1"]'], ru: 'Заголовок 1', en: 'Heading 1' },
  { id: 'h2', sel: ['.tools-static [data-block="h2"]'], ru: 'Заголовок 2', en: 'Heading 2' },
  { id: 'p', sel: ['.tools-static [data-block="p"]'], ru: 'Абзац', en: 'Paragraph' },
  { id: 'ul', sel: ['.tools-static [data-cmd="insertUnorderedList"]'], ru: 'Маркированный список', en: 'Bullet list' },
  { id: 'ol', sel: ['.tools-static [data-cmd="insertOrderedList"]'], ru: 'Нумерованный список', en: 'Numbered list' },
  { id: 'checklist', sel: ['#btnChecklist'], ru: 'Чек-лист', en: 'Checklist' },
  { id: 'table', sel: ['#btnTable'], ru: 'Таблица', en: 'Table' },
  { id: 'align', sel: ['.tools-static [data-align]'], ru: 'Выравнивание', en: 'Alignment' },
  { id: 'image', sel: ['#btnAddImg'], ru: 'Картинка', en: 'Image' },
  { id: 'marker', sel: ['#markerBtn'], offAlso: ['#markerPresets'], ru: 'Маркер', en: 'Marker' },
  { id: 'eraser', sel: ['#eraserBtn'], offAlso: ['#eraserPresets'], ru: 'Ластик', en: 'Eraser' },
  { id: 'translate', sel: ['#translateBtn'], ru: 'Перевод', en: 'Translate' },
  { id: 'mic', sel: ['#micBtn', '#micSep'], ru: 'Голосовой ввод', en: 'Voice input' }
];
function loadTbCfg() {
  try { return JSON.parse(localStorage.getItem('fidji-toolbar') || '{}'); } catch { return {}; }
}
function saveTbCfg(c) {
  try { localStorage.setItem('fidji-toolbar', JSON.stringify(c)); } catch {}
}
function tidySeparators() {
  const tools = q('.tools-static');
  if (!tools) return;
  let lastVisible = null;
  Array.from(tools.children).forEach(ch => {
    if (ch.classList.contains('tb-sep')) {
      ch.hidden = !lastVisible;
      if (!ch.hidden) lastVisible = ch;
    } else if (!ch.hidden) {
      lastVisible = ch;
    }
  });
  if (lastVisible && lastVisible.classList.contains('tb-sep')) lastVisible.hidden = true;
  let prevSep = false;
  Array.from(tools.children).forEach(ch => {
    if (ch.hidden) return;
    if (ch.classList.contains('tb-sep')) {
      if (prevSep) ch.hidden = true;
      else prevSep = true;
    } else prevSep = false;
  });
}
function applyToolbarConfig() {
  const cfg = loadTbCfg();
  TOOLBAR_ITEMS.forEach(item => {
    const on = cfg[item.id] !== false;
    item.sel.forEach(s => {
      const el = q(s);
      if (el) el.hidden = !on;
    });
    (item.offAlso || []).forEach(s => {
      const el = q(s);
      if (el && !on) el.hidden = true;
    });
  });
  tidySeparators();
}
function updateTbLabels() {
  const t2 = q('#tbCfgTitle');
  if (t2) t2.textContent = uiRu() ? 'Панель инструментов' : 'Toolbar buttons';
  if (!tbRows) return;
  TOOLBAR_ITEMS.forEach(item => { if (tbRows[item.id]) tbRows[item.id].textContent = uiRu() ? item.ru : item.en; });
}
function buildToolbarSettings() {
  const card = q('#viewSettings .screen-card');
  if (!card || q('#tbCfg')) return;
  const title = document.createElement('p');
  title.className = 'screen-sub tb-cfg-title';
  title.id = 'tbCfgTitle';
  const box = document.createElement('div');
  box.className = 'tb-cfg';
  box.id = 'tbCfg';
  const cfg = loadTbCfg();
  tbRows = {};
  TOOLBAR_ITEMS.forEach(item => {
    const row = document.createElement('label');
    row.className = 'tb-cfg-row';
    const span = document.createElement('span');
    span.textContent = uiRu() ? item.ru : item.en;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = cfg[item.id] !== false;
    cb.addEventListener('change', () => {
      const c = loadTbCfg();
      c[item.id] = cb.checked;
      saveTbCfg(c);
      applyToolbarConfig();
    });
    row.appendChild(span);
    row.appendChild(cb);
    box.appendChild(row);
    tbRows[item.id] = span;
  });
  const closeRow = card.querySelector('.row-btns.center');
  if (closeRow) { card.insertBefore(title, closeRow); card.insertBefore(box, closeRow); }
  else { card.appendChild(title); card.appendChild(box); }
  updateTbLabels();
}
/* ---------- Служебное ---------- */
function cleanupStrayText() {
  const body = document.body;
  if (!body) return;
  Array.from(body.childNodes).forEach(node => {
    if (node.nodeType === 3 && node.textContent.trim()) body.removeChild(node);
  });
}
function injectStyles() {
  if (q('#voiceStyles')) return;
  const st = document.createElement('style');
  st.id = 'voiceStyles';
  st.textContent = [
    '#window.voice-on .editor, #window.voice-on .note-title, #window.voice-on .draw-layer { filter: blur(2.2px); opacity: .82; transform: translateY(1px) scale(.997); }',
    '#window.voice-on .reflow-veil { opacity: .55; }',
    '.tools-static #micBtn.on { color: var(--danger); background: var(--danger-soft); animation: micpulse 1.4s ease-out infinite; }',
    '@keyframes micpulse { 0%,100% { box-shadow: 0 0 0 0 rgba(255,59,48,.35); } 50% { box-shadow: 0 0 0 6px rgba(255,59,48,0); } }',
    '#voiceToast { position: fixed; left: 50%; bottom: 18px; z-index: 999; transform: translate(-50%, 12px); opacity: 0; pointer-events: none; background: var(--win-bg); color: var(--text); border: 1px solid var(--line); border-radius: 12px; padding: 8px 14px; font-size: 12.5px; box-shadow: 0 12px 30px rgba(0,0,0,.18); transition: opacity .2s ease, transform .2s ease; }',
    '#voiceToast.on { opacity: 1; transform: translate(-50%, 0); }',
    '#viewSettings.active { align-items: stretch; justify-content: flex-start; }',
    '#viewSettings .screen-card { max-width: 900px; width: 100%; height: 100%; max-height: 100%; justify-content: flex-start; text-align: left; gap: 14px; }',
    '#viewSettings .screen-title { text-align: left; font-size: 20px; }',
    '#viewSettings .screen-sub { text-align: left; }',
    '#viewSettings .lang-row { justify-content: flex-start; }',
    '#viewSettings .row-btns, #viewSettings .row-btns.center { justify-content: flex-start; }',
    '#viewSettings .tb-cfg-title { margin-top: 2px; font-size: 13px; font-weight: 600; color: var(--text); }',
    '#viewSettings .tb-cfg { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 2px 22px; max-height: none; overflow: visible; text-align: left; width: 100%; padding: 2px; }',
    '.tb-cfg-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; color: var(--text); padding: 5px 8px; border-radius: 8px; cursor: pointer; }',
    '.tb-cfg-row:hover { background: var(--hover); }',
    '.tb-cfg-row input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 34px; height: 20px; border-radius: 999px; background: var(--active); position: relative; cursor: pointer; transition: background .15s ease; flex: none; outline: none; margin: 0; }',
    '.tb-cfg-row input[type="checkbox"]::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--win-bg); transition: left .15s ease; box-shadow: 0 1px 3px rgba(0,0,0,.3); }',
    '.tb-cfg-row input[type="checkbox"]:checked { background: var(--accent); }',
    '.tb-cfg-row input[type="checkbox"]:checked::after { left: 16px; }',
    '@media (prefers-reduced-motion: reduce) { .tools-static #micBtn.on { animation: none; } #window.voice-on .editor, #window.voice-on .note-title, #window.voice-on .draw-layer { filter: none; opacity: 1; transform: none; } #window.voice-on .reflow-veil { opacity: 0; } }'
  ].join('\n');
  document.head.appendChild(st);
}
function hideToast() {
  clearTimeout(toastTimer);
  if (toastEl) toastEl.classList.remove('on');
}
function showToast(text, ms) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'voiceToast';
    const host = q('#window') || document.body;
    host.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms || 6000);
}
function injectButton() {
  if (q('#micBtn')) return q('#micBtn');
  const tools = q('.tools-static');
  if (!tools) return null;
  const sep = document.createElement('span');
  sep.className = 'tb-sep';
  sep.id = 'micSep';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'micBtn';
  btn.title = msg('title');
  btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><line x1="12" y1="18" x2="12" y2="21"/></svg>';
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  const anchor = q('.save-wrap');
  if (anchor) { tools.insertBefore(sep, anchor); tools.insertBefore(btn, anchor); }
  else { tools.appendChild(sep); tools.appendChild(btn); }
  return btn;
}
function bindToolSettingsSafety() {
  ['#markerBtn', '#eraserBtn'].forEach(s => {
    const b = q(s);
    if (!b) return;
    b.addEventListener('click', () => {
      setTimeout(() => {
        if (!b.classList.contains('on')) return;
        const ts = q('#toolSettings');
        if (ts && ts.hidden) ts.hidden = false;
        const w = q('#window');
        if (w && w.classList.contains('no-info')) {
          const pt = q('#panelToggle');
          if (pt) pt.click();
        }
      }, 0);
    });
  });
}
function isMainView() { const v = q('#viewMain'); return !!v && !v.hidden; }
function editorEl() { return q('#editor'); }
function refocusEditor() {
  const ed = editorEl();
  if (!ed || !isMainView()) return;
  ed.focus();
  if (voiceRange) {
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(voiceRange);
    } catch {}
  }
}
function insertText(text) {
  const ed = editorEl();
  if (!ed) return;
  ed.focus();
  if (voiceRange) {
    try { const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(voiceRange); } catch {}
  }
  let ok = false;
  try { ok = document.execCommand('insertText', false, text + ' '); } catch {}
  if (!ok) {
    ed.appendChild(document.createTextNode(text + ' '));
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }
  const sel2 = window.getSelection();
  if (sel2 && sel2.rangeCount) voiceRange = sel2.getRangeAt(0).cloneRange();
  console.log('voice: вставлено в заметку:', text);
}
/* ---------- Команды: нечёткий поиск ---------- */
const TRIGGERS = ['фиджи', 'fidji', 'fiji'];
function normCmd(t) {
  return String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
function click(sel) { const el = q(sel); if (el) el.click(); }
function pinClick() { const p = q('.note-item.active .pin'); if (p) p.click(); }
function doFind(word) {
  const w = q('#window');
  if (w && w.classList.contains('no-list')) click('#listToggle');
  const sEl = q('#search');
  if (sEl) { sEl.value = word; sEl.dispatchEvent(new Event('input', { bubbles: true })); }
}
/* Группы команд: фразы + действие */
function cmdGroups() {
  return [
    { p: ['новая заметка', 'новую заметку', 'new note'], run: () => click('#newNote') },
    { p: ['сохрани', 'сохранить', 'save'], run: () => click('#saveBtn') },
    { p: ['удали', 'удалить', 'delete'], run: () => click('#deleteNote') },
    { p: ['открепи', 'открепить', 'unpin'], run: pinClick },
    { p: ['закрепи', 'закрепить', 'pin'], run: pinClick },
    { p: ['переведи', 'перевести', 'translate'], run: () => click('#translateBtn') },
    { p: ['тема', 'theme'], run: () => click('#themeToggle') },
    { p: ['стоп', 'stop', 'остановись'], run: () => stopVoice(true) },
    { p: ['найди', 'найти', 'find', 'search'], run: null }
  ];
}
/* Совпадение фразы с началом строки, допускаем ошибку в 1 букву */
function matchPhrase(restStr, ph) {
  if (restStr.indexOf(ph) === 0) return true;
  if (restStr.length >= ph.length - 1 && lev(restStr.slice(0, ph.length), ph) <= 1) return true;
  return false;
}
function runCommand(raw) {
  const s = normCmd(raw);
  if (!s) return false;
  const words = s.split(' ');
  /* Ищем триггер среди первых трёх слов, нечётко */
  let trigIdx = -1;
  for (let i = 0; i < Math.min(3, words.length); i++) {
    const w = words[i];
    for (const trig of TRIGGERS) {
      const allow = trig.length > 4 ? 2 : 1;
      if (w === trig || (Math.abs(w.length - trig.length) <= allow && lev(w, trig) <= allow)) { trigIdx = i; break; }
    }
    if (trigIdx >= 0) break;
  }
  const groups = cmdGroups();
  if (trigIdx >= 0) {
    const rest = words.slice(trigIdx + 1).join(' ');
    console.log('voice: cmd check: триггер найден, команда =', JSON.stringify(rest));
    if (!rest) return true;
    for (const g of groups) {
      for (const ph of g.p) {
        if (matchPhrase(rest, ph)) {
          if (g.run === null) doFind(rest.slice(Math.min(ph.length, rest.length)).trim());
          else g.run();
          return true;
        }
      }
    }
    console.log('voice: cmd check: триггер был, но команда не распознана:', JSON.stringify(rest));
    return true; /* не пишем мусор в заметку */
  }
  /* Без триггера: только однозначные команды с начала фразы */
  const distinct = ['новая заметка', 'новую заметку', 'new note', 'сохрани заметку', 'save note', 'удали заметку', 'delete note'];
  for (const ph of distinct) {
    if (matchPhrase(s, ph)) {
      console.log('voice: cmd check: команда без триггера =', JSON.stringify(ph));
      if (ph.indexOf('нов') === 0 || ph.indexOf('new') === 0) click('#newNote');
      else if (ph.indexOf('сох') === 0 || ph.indexOf('save') === 0) click('#saveBtn');
      else click('#deleteNote');
      return true;
    }
  }
  console.log('voice: cmd check: триггер не найден в', JSON.stringify(s));
  return false;
}
/* ---------- Захват и распознавание ---------- */
function resample(input, from, to) {
  if (from === to) return input;
  const ratio = from / to;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const f = pos - i0;
    out[i] = input[i0] * (1 - f) + input[i1] * f;
  }
  return out;
}
function toPCM(f32) {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(out.buffer);
}
async function sendSegment(f32) {
  const bytes = toPCM(f32);
  if (!bytes.length) return;
  let r = null;
  try { r = await window.fidji.voiceSegment(bytes); } catch { r = null; }
  if (!r || !r.ok) {
    if (voice) stopVoice(false);
    showToast(msg('net') + errText(r));
    return;
  }
  const text = String(r.text || '').trim();
  if (!text) {
    console.log('voice: whisper вернул пустоту');
    return;
  }
  console.log('voice: распознано:', JSON.stringify(text));
  const w = q('#window');
  if (w) w.classList.remove('voice-on');
  if (runCommand(text)) return;
  insertText(text);
}
async function startVoice() {
  if (voice || !isMainView()) return;
  if (!window.fidji || typeof window.fidji.voiceSegment !== 'function') { showToast(msg('net')); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch { showToast(msg('denied')); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const srcNode = ctx.createMediaStreamSource(stream);
  const node = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.connect(mute);
  mute.connect(ctx.destination);
  voice = { stream, ctx, node, acc: [], pending: Promise.resolve() };
  voiceRange = null;
  const ed = editorEl();
  const sel0 = window.getSelection();
  if (sel0 && sel0.rangeCount && ed && ed.contains(sel0.getRangeAt(0).commonAncestorContainer)) {
    voiceRange = sel0.getRangeAt(0).cloneRange();
  }
  if (!ensured) {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => showToast(msg('loading'), 30000), 2000);
    voice.pending = voice.pending.then(async () => {
      const r = await window.fidji.voiceEnsure();
      clearTimeout(loadingTimer);
      hideToast();
      if (!r || !r.ok) {
        stopVoice(false);
        showToast(msg('net') + errText(r));
        return;
      }
      ensured = true;
    });
  }
  const need = 16000 * CHUNK_SEC;
  node.onaudioprocess = (e) => {
    if (!voice) return;
    const inp = e.inputBuffer.getChannelData(0);
    const r16 = resample(inp, ctx.sampleRate, 16000);
    voice.acc.push(r16);
    let total = 0;
    for (const a of voice.acc) total += a.length;
    if (total >= need) {
      const merged = new Float32Array(total);
      let off = 0;
      for (const a of voice.acc) { merged.set(a, off); off += a.length; }
      voice.acc = [];
      voice.pending = voice.pending.then(() => sendSegment(merged));
    }
  };
  srcNode.connect(node);
  const w = q('#window');
  if (w) w.classList.add('voice-on');
  if (micBtn) micBtn.classList.add('on');
}
function stopVoice(flush) {
  if (!voice) return;
  const v = voice;
  voice = null;
  const w = q('#window');
  if (w) w.classList.remove('voice-on');
  if (micBtn) micBtn.classList.remove('on');
  try { v.node.onaudioprocess = null; v.node.disconnect(); } catch {}
  try { v.stream.getTracks().forEach(tr => tr.stop()); } catch {}
  try { v.ctx.close(); } catch {}
  if (flush) {
    let total = 0;
    for (const a of v.acc) total += a.length;
    if (total >= 16000 * 1.5) {
      const merged = new Float32Array(total);
      let off = 0;
      for (const a of v.acc) { merged.set(a, off); off += a.length; }
      v.pending = v.pending.then(() => sendSegment(merged));
    }
  }
  v.pending.then(refocusEditor).catch(() => {});
}
function init() {
  cleanupStrayText();
  injectStyles();
  micBtn = injectButton();
  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (!isMainView()) return;
      if (voice) stopVoice(true);
      else startVoice();
    });
  }
  bindToolSettingsSafety();
  applyToolbarConfig();
  buildToolbarSettings();
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('#langRow .lang-btn')) {
      setTimeout(() => {
        if (micBtn) micBtn.title = msg('title');
        updateTbLabels();
      }, 0);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && voice) stopVoice(true);
  }, true);
  const v = q('#viewMain');
  if (v && window.MutationObserver) {
    new MutationObserver(() => { if (v.hidden && voice) stopVoice(false); }).observe(v, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('beforeunload', () => { if (voice) stopVoice(false); });
  window.addEventListener('load', () => { cleanupStrayText(); applyToolbarConfig(); });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();