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
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'micBtn';
  btn.title = msg('title');
  btn.innerHTML = '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><line x1="12" y1="18" x2="12" y2="21"/></svg>';
  /* Не даём кнопке украсть фокус у редактора */
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  const anchor = q('.save-wrap');
  if (anchor) { tools.insertBefore(sep, anchor); tools.insertBefore(btn, anchor); }
  else { tools.appendChild(sep); tools.appendChild(btn); }
  return btn;
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
function runCommand(raw) {
  const s = String(raw || '').toLowerCase().replace(/ё/g, 'е').replace(/[.,!?;:…]/g, '').replace(/\s+/g, ' ').trim();
  let rest = null;
  if (s.indexOf('фиджи') === 0) rest = s.slice(5).trim();
  else if (s.indexOf('fidji') === 0) rest = s.slice(5).trim();
  if (rest === null) return false;
  if (!rest) return true;
  const click = (sel) => { const el = q(sel); if (el) el.click(); };
  if (rest.indexOf('новая заметка') === 0 || rest.indexOf('новую заметку') === 0) { click('#newNote'); return true; }
  if (rest.indexOf('сохрани') === 0) { click('#saveBtn'); return true; }
  if (rest.indexOf('удали') === 0) { click('#deleteNote'); return true; }
  if (rest.indexOf('открепи') === 0 || rest.indexOf('закрепи') === 0) { const p = q('.note-item.active .pin'); if (p) p.click(); return true; }
  if (rest.indexOf('найди') === 0) {
    const word = rest.slice(5).trim();
    const w = q('#window');
    if (w && w.classList.contains('no-list')) click('#listToggle');
    const sEl = q('#search');
    if (sEl) { sEl.value = word; sEl.dispatchEvent(new Event('input', { bubbles: true })); }
    return true;
  }
  if (rest.indexOf('переведи') === 0) { click('#translateBtn'); return true; }
  if (rest.indexOf('тема') === 0) { click('#themeToggle'); return true; }
  if (rest.indexOf('стоп') === 0 || rest.indexOf('остановись') === 0) { stopVoice(true); return true; }
  return true;
}
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
  /* Возвращаем курсор в заметку, когда всё дообработается */
  v.pending.then(refocusEditor).catch(() => {});
}
function init() {
  cleanupStrayText();
  injectStyles();
  micBtn = injectButton();
  if (!micBtn) return;
  micBtn.addEventListener('click', () => {
    if (!isMainView()) return;
    if (voice) stopVoice(true);
    else startVoice();
  });
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('#langRow .lang-btn')) {
      setTimeout(() => { if (micBtn) micBtn.title = msg('title'); }, 0);
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
  window.addEventListener('load', cleanupStrayText);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();