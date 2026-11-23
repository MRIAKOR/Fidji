(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const winEl = $('#window');
  const listEl = $('#noteList');
  const editor = $('#editor');
  const editorPane = $('.editor-pane');
  const titleEl = $('#noteTitle');
  const docTitleEl = $('#docTitle');
  const searchEl = $('#search');

  const markerBtn = $('#markerBtn');
  const eraserBtn = $('#eraserBtn');
  const markerPresets = $('#markerPresets');
  const eraserPresets = $('#eraserPresets');

  const translateBtn = $('#translateBtn');
  const translatePane = $('#translatePane');
  const trTarget = $('#trTarget');
  const trDo = $('#trDo');
  const trClose = $('#trClose');
  const trOut = $('#trOut');
  const trReplace = $('#trReplace');
  const trInsert = $('#trInsert');
  const trCopy = $('#trCopy');
  const trStatus = $('#trStatus');

  const toolSettings = $('#toolSettings');
  const tsTitle = $('#tsTitle');
  const tsSize = $('#tsSize');
  const tsSizeVal = $('#tsSizeVal');
  const tsOpacityRow = $('#tsOpacityRow');
  const tsOpacity = $('#tsOpacity');
  const tsOpacityVal = $('#tsOpacityVal');
  const tsSoft = $('#tsSoft');
  const tsSoftVal = $('#tsSoftVal');
  const tsColorRow = $('#tsColorRow');
  const tsColor = $('#tsColor');
  const tsColorAuto = $('#tsColorAuto');

  const drawLayer = $('#drawLayer');
  const drawSvg = $('#drawSvg');
  const infoPane = $('#infoPane');

  const views = {
    main: $('#viewMain'),
    lock: $('#viewLock'),
    setup: $('#viewSetup'),
    security: $('#viewSecurity'),
    settings: $('#viewSettings')
  };
  Object.keys(views).forEach(k => { if (!views[k]) delete views[k]; });

  let currentView = null;
  let notes = [];
  let currentId = null;

  let saveTimer = null;
  let dirty = false;
  let saving = false;
  let saveAgain = false;
  let saveStateTimer = null;

  let activePhoto = null;
  let pendingPhotos = [];
  let photoZ = 0;
  let interaction = null;
  let imagesBase = '';

  let activeTool = null;
  let drawing = null;

  let savedRange = null;
  let translateSourceText = '';
  let translateMode = 'selection';

  let editorScroll = null;
  let saveBtn = null;
  let saveStateEl = null;
  let listToggleBtn = null;
  let infoToggleBtn = null;

  let toastEl = null;
  let toastMsgEl = null;
  let toastActBtn = null;
  let toastTimer = null;
  let toastAction = null;
  let lastDeleted = null;
  let dragId = null;

  let reflowTimer = null;
  let reflowOn = false;
  let lastEdWidth = 0;

  const NARROW_W = 1000;
  const PANEL_MS = 280;

  let compact = false;
  let listOpen = true;
  let infoOpen = false;
  let wideList = true;
  let wideInfo = false;
  let modeTimer = null;
  let settleTimer = null;

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TRASH_SVG = '<svg class="ic ic-sm" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9.5 7V5.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M6.5 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h6.4a1.5 1.5 0 0 0 1.5-1.3L18.5 7"/><line x1="10" y1="11" x2="10" y2="16"/><line x1="14" y1="11" x2="14" y2="16"/></svg>';
  const SAVE_SVG = '<svg class="ic" viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="7"/></svg>';
  const LIST_SVG = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="9" y1="4" x2="9" y2="20"/></svg>';

  const DEFAULT_SETTINGS = {
    marker: { size: 2, opacity: 1, softness: 0, color: null },
    eraser: { size: 28, softness: 0 }
  };

  const PRESETS = {
    marker: {
      thin:  { size: 2,  opacity: 1,    softness: 0 },
      thick: { size: 8,  opacity: 1,    softness: 0 },
      soft:  { size: 14, opacity: 0.35, softness: 4 }
    },
    eraser: {
      small:  { size: 14, softness: 0 },
      medium: { size: 32, softness: 0 },
      large:  { size: 64, softness: 0 },
      soft:   { size: 44, softness: 8 }
    }
  };

  const I18N = {
    en: {
      'app.new': 'New Note', 'doc.untitled': 'Untitled', 'search.ph': 'Search', 'title.ph': 'Title',
      'editor.ph': 'Start writing…', 'list.empty': 'No notes',
      'preview.empty': 'Empty', 'preview.photo': 'Photo', 'preview.drawing': 'Drawing',
      'info.title': 'Note', 'info.table': 'Table',
      'meta.created': 'Created', 'meta.modified': 'Modified', 'meta.words': 'Words', 'meta.chars': 'Characters',
      'meta.lines': 'Lines', 'meta.width': 'Width',
      'tool.marker': 'Marker', 'tool.eraser': 'Eraser', 'tool.size': 'Size', 'tool.opacity': 'Opacity',
      'tool.soft': 'Softness', 'tool.color': 'Color', 'tool.auto': 'Auto',
      'table.addRow': 'Add Row', 'table.addColumn': 'Add Column', 'table.deleteRow': 'Delete Row',
      'table.deleteColumn': 'Delete Column', 'table.deleteTable': 'Delete Table', 'table.confirm': 'Confirm delete?',
      'tr.title': 'Translate', 'tr.lang': 'Lang', 'tr.do': 'Translate', 'tr.close': 'Close',
      'tr.outPh': 'Translation result', 'tr.replace': 'Replace', 'tr.insert': 'Insert', 'tr.copy': 'Copy',
      'tr.selected': 'Selected text', 'tr.whole': 'Whole note', 'tr.nothing': 'Nothing to translate',
      'tr.working': 'Translating…', 'tr.done': 'Done', 'tr.err': 'Translation error', 'tr.offline': 'No connection',
      'tr.replaced': 'Selection replaced', 'tr.selectFirst': 'Select text in editor first',
      'tr.selectToReplace': 'Select text in editor to replace', 'tr.insertedAfter': 'Inserted after selection',
      'tr.insertedEnd': 'Inserted at end', 'tr.cantInsert': 'Cannot insert here',
      'tr.copied': 'Copied', 'tr.copyFail': 'Copy failed',
      'act.delete': 'Delete', 'act.done': 'Done', 'act.close': 'Close', 'act.undo': 'Undo',
      'save.btn': 'Save', 'save.dirty': 'Not saved', 'save.saving': 'Saving…', 'save.saved': 'Saved', 'save.error': 'Save failed',
      'toast.deleted': 'Note deleted',
      'lock.title': 'Fidji is locked', 'lock.sub': 'Enter your password to continue.', 'lock.ph': 'Password',
      'lock.btn': 'Unlock', 'lock.err': 'Wrong password',
      'setup.title': 'Protect Fidji with a password?',
      'setup.sub': 'Set one now, or skip and turn it on later from the lock button in the toolbar.',
      'setup.set': 'Set Password', 'setup.skip': 'Skip', 'setup.create': 'Create a password',
      'setup.ph2': 'Confirm password', 'setup.save': 'Save Password', 'setup.back': 'Back',
      'sec.title': 'Security', 'sec.descSet': 'A password is set. You can change it or remove it.',
      'sec.descNone': 'No password yet. Set one to lock Fidji on startup.',
      'sec.new': 'New password', 'sec.change': 'Change Password', 'sec.remove': 'Remove Password', 'sec.confirm': 'Confirm remove?',
      'err.empty': 'Enter a password', 'err.match': 'Passwords do not match',
      'settings.title': 'Settings', 'settings.sub': 'Interface language.',
      'settings.hint': 'Drag notes in the list to reorder them.',
      'tb.bold': 'Bold', 'tb.italic': 'Italic', 'tb.underline': 'Underline', 'tb.strike': 'Strikethrough',
      'tb.h1': 'Heading 1', 'tb.h2': 'Heading 2', 'tb.p': 'Paragraph', 'tb.ul': 'Bullet List', 'tb.ol': 'Numbered List',
      'tb.checklist': 'Checklist', 'tb.table': 'Table', 'tb.alignLeft': 'Align Left', 'tb.alignCenter': 'Align Center',
      'tb.alignRight': 'Align Right', 'tb.justify': 'Justify', 'tb.image': 'Insert Image',
      'tb.marker': 'Marker', 'tb.eraser': 'Eraser', 'tb.markerThin': 'Thin Marker', 'tb.markerThick': 'Thick Marker',
      'tb.markerSoft': 'Soft Marker', 'tb.eraserSmall': 'Small Eraser', 'tb.eraserMedium': 'Medium Eraser',
      'tb.eraserLarge': 'Large Eraser', 'tb.eraserSoft': 'Soft Eraser', 'tb.translate': 'Translate',
      'tb.list': 'Notes list', 'tb.panel': 'Info panel', 'tb.security': 'Security', 'tb.settings': 'Settings',
      'tb.theme': 'Theme', 'tb.newNote': 'New Note'
    },
    ru: {
      'app.new': 'Новая заметка', 'doc.untitled': 'Без названия', 'search.ph': 'Поиск', 'title.ph': 'Заголовок',
      'editor.ph': 'Начните писать…', 'list.empty': 'Нет заметок',
      'preview.empty': 'Пусто', 'preview.photo': 'Фото', 'preview.drawing': 'Рисунок',
      'info.title': 'Заметка', 'info.table': 'Таблица',
      'meta.created': 'Создано', 'meta.modified': 'Изменено', 'meta.words': 'Слова', 'meta.chars': 'Символы',
      'meta.lines': 'Строки', 'meta.width': 'Ширина',
      'tool.marker': 'Маркер', 'tool.eraser': 'Ластик', 'tool.size': 'Размер', 'tool.opacity': 'Прозрачность',
      'tool.soft': 'Мягкость', 'tool.color': 'Цвет', 'tool.auto': 'Авто',
      'table.addRow': 'Добавить строку', 'table.addColumn': 'Добавить столбец', 'table.deleteRow': 'Удалить строку',
      'table.deleteColumn': 'Удалить столбец', 'table.deleteTable': 'Удалить таблицу', 'table.confirm': 'Точно удалить?',
      'tr.title': 'Перевод', 'tr.lang': 'Язык', 'tr.do': 'Перевести', 'tr.close': 'Закрыть',
      'tr.outPh': 'Результат перевода', 'tr.replace': 'Заменить', 'tr.insert': 'Вставить', 'tr.copy': 'Копировать',
      'tr.selected': 'Выделенный текст', 'tr.whole': 'Вся заметка', 'tr.nothing': 'Нечего переводить',
      'tr.working': 'Переводим…', 'tr.done': 'Готово', 'tr.err': 'Ошибка перевода', 'tr.offline': 'Нет соединения',
      'tr.replaced': 'Выделение заменено', 'tr.selectFirst': 'Сначала выделите текст',
      'tr.selectToReplace': 'Выделите текст для замены', 'tr.insertedAfter': 'Вставлено после выделения',
      'tr.insertedEnd': 'Вставлено в конец', 'tr.cantInsert': 'Не удалось вставить',
      'tr.copied': 'Скопировано', 'tr.copyFail': 'Не удалось скопировать',
      'act.delete': 'Удалить', 'act.done': 'Готово', 'act.close': 'Закрыть', 'act.undo': 'Вернуть',
      'save.btn': 'Сохранить', 'save.dirty': 'Не сохранено', 'save.saving': 'Сохранение…', 'save.saved': 'Сохранено', 'save.error': 'Ошибка сохранения',
      'toast.deleted': 'Заметка удалена',
      'lock.title': 'Fidji заблокирован', 'lock.sub': 'Введите пароль, чтобы продолжить.', 'lock.ph': 'Пароль',
      'lock.btn': 'Войти', 'lock.err': 'Неверный пароль',
      'setup.title': 'Защитить Fidji паролем?',
      'setup.sub': 'Задайте сейчас или пропустите — включить можно позже кнопкой замка в панели.',
      'setup.set': 'Задать пароль', 'setup.skip': 'Пропустить', 'setup.create': 'Создайте пароль',
      'setup.ph2': 'Повторите пароль', 'setup.save': 'Сохранить пароль', 'setup.back': 'Назад',
      'sec.title': 'Защита', 'sec.descSet': 'Пароль задан. Его можно сменить или удалить.',
      'sec.descNone': 'Пароля пока нет. Задайте его, чтобы Fidji блокировался при запуске.',
      'sec.new': 'Новый пароль', 'sec.change': 'Сменить пароль', 'sec.remove': 'Удалить пароль', 'sec.confirm': 'Точно удалить?',
      'err.empty': 'Введите пароль', 'err.match': 'Пароли не совпадают',
      'settings.title': 'Настройки', 'settings.sub': 'Язык интерфейса.',
      'settings.hint': 'Заметки в списке можно перетаскивать.',
      'tb.bold': 'Жирный', 'tb.italic': 'Курсив', 'tb.underline': 'Подчёркнутый', 'tb.strike': 'Зачёркнутый',
      'tb.h1': 'Заголовок 1', 'tb.h2': 'Заголовок 2', 'tb.p': 'Абзац', 'tb.ul': 'Маркированный список', 'tb.ol': 'Нумерованный список',
      'tb.checklist': 'Чек-лист', 'tb.table': 'Таблица', 'tb.alignLeft': 'По левому краю', 'tb.alignCenter': 'По центру',
      'tb.alignRight': 'По правому краю', 'tb.justify': 'По ширине', 'tb.image': 'Вставить картинку',
      'tb.marker': 'Маркер', 'tb.eraser': 'Ластик', 'tb.markerThin': 'Тонкий маркер', 'tb.markerThick': 'Толстый маркер',
      'tb.markerSoft': 'Мягкий маркер', 'tb.eraserSmall': 'Маленький ластик', 'tb.eraserMedium': 'Средний ластик',
      'tb.eraserLarge': 'Большой ластик', 'tb.eraserSoft': 'Мягкий ластик', 'tb.translate': 'Перевод',
      'tb.list': 'Список заметок', 'tb.panel': 'Панель информации', 'tb.security': 'Защита', 'tb.settings': 'Настройки',
      'tb.theme': 'Тема', 'tb.newNote': 'Новая заметка'
    }
  };

  let lang = localStorage.getItem('fidji-lang');
  if (lang !== 'en' && lang !== 'ru') lang = (navigator.language || 'en').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en';

  function t(key) {
    const pack = I18N[lang] || I18N.en;
    if (pack && typeof pack[key] === 'string') return pack[key];
    if (typeof I18N.en[key] === 'string') return I18N.en[key];
    return key;
  }

  let toolCfg = loadToolCfg();

  ensureUI();
  initPanels();

  function loadToolCfg() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('fidji-tool-settings') || 'null'); } catch {}
    return {
      marker: Object.assign({}, DEFAULT_SETTINGS.marker, saved && saved.marker ? saved.marker : {}),
      eraser: Object.assign({}, DEFAULT_SETTINGS.eraser, saved && saved.eraser ? saved.eraser : {})
    };
  }

  function saveToolCfg() {
    try { localStorage.setItem('fidji-tool-settings', JSON.stringify(toolCfg)); } catch {}
  }

  /* ---------- Build dynamic UI ---------- */
  function ensureUI() {
    editorScroll = $('#editorScroll');
    if (!editorScroll && editorPane && titleEl && editor) {
      editorScroll = document.createElement('div');
      editorScroll.className = 'editor-scroll';
      editorScroll.id = 'editorScroll';
      editorPane.insertBefore(editorScroll, titleEl);
      editorScroll.appendChild(titleEl);
      editorScroll.appendChild(editor);
      if (drawLayer) editorScroll.appendChild(drawLayer);
    }
    if (!editorScroll) editorScroll = editorPane;

    if (editorPane && !$('#reflowVeil')) {
      const veil = document.createElement('div');
      veil.className = 'reflow-veil';
      veil.id = 'reflowVeil';
      editorPane.appendChild(veil);
    }

    if (editorPane && !$('#toast')) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.id = 'toast';
      el.hidden = true;
      el.innerHTML = '<span id="toastMsg"></span><button type="button" class="toast-act" id="toastAction" hidden></button><button type="button" class="toast-x" id="toastClose" aria-label="Close">×</button>';
      editorPane.appendChild(el);
    }
    toastEl = $('#toast');
    toastMsgEl = $('#toastMsg');
    toastActBtn = $('#toastAction');
    if (toastActBtn) toastActBtn.addEventListener('click', () => { const fn = toastAction; hideToast(); if (fn) fn(); });
    const toastX = $('#toastClose');
    if (toastX) toastX.addEventListener('click', hideToast);

    const tools = $('.tools-static');
    if (tools && !$('#saveBtn')) {
      const sep = document.createElement('span');
      sep.className = 'tb-sep';
      const wrap = document.createElement('span');
      wrap.className = 'save-wrap';
      wrap.innerHTML = '<span class="save-state" id="saveState"></span><button type="button" id="saveBtn">' + SAVE_SVG + '</button>';
      const anchor = $('#panelToggle');
      if (anchor) { tools.insertBefore(sep, anchor); tools.insertBefore(wrap, anchor); }
      else { tools.appendChild(sep); tools.appendChild(wrap); }
    }
    saveBtn = $('#saveBtn');
    saveStateEl = $('#saveState');

    infoToggleBtn = $('#panelToggle');
    if (tools && !$('#listToggle')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'listToggle';
      b.setAttribute('data-i18n-title', 'tb.list');
      b.innerHTML = LIST_SVG;
      if (infoToggleBtn) tools.insertBefore(b, infoToggleBtn);
      else tools.appendChild(b);
    }
    listToggleBtn = $('#listToggle');

    const infoBody = $('.info-body');
    if (infoBody && !$('#mLines')) {
      const a = document.createElement('div');
      a.className = 'meta';
      a.innerHTML = '<span class="mk" data-i18n="meta.lines"></span><span class="mv" id="mLines">0</span>';
      const b = document.createElement('div');
      b.className = 'meta';
      b.innerHTML = '<span class="mk" data-i18n="meta.width"></span><span class="mv" id="mWidth">0</span>';
      infoBody.appendChild(a);
      infoBody.appendChild(b);
    }
  }

  /* ---------- Panels ---------- */
  function isNarrow() {
    return (window.innerWidth || document.documentElement.clientWidth || 1280) < NARROW_W;
  }

  function applyPanels() {
    winEl.classList.toggle('compact', compact);
    winEl.classList.toggle('no-list', !listOpen);
    winEl.classList.toggle('no-info', !infoOpen);
    if (listToggleBtn) {
      listToggleBtn.classList.toggle('on', listOpen);
      listToggleBtn.setAttribute('aria-pressed', String(listOpen));
    }
    if (infoToggleBtn) {
      infoToggleBtn.classList.toggle('on', infoOpen);
      infoToggleBtn.setAttribute('aria-pressed', String(infoOpen));
    }
    requestAnimationFrame(updateDrawLayerBox);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { updateDrawLayerBox(); measureLayout(); }, PANEL_MS + 60);
  }

  function initPanels() {
    compact = isNarrow();
    listOpen = !compact;
    infoOpen = false;
    wideList = true;
    wideInfo = false;
    winEl.classList.add('no-anim');
    applyPanels();
    winEl.classList.add('panels-ready');
    requestAnimationFrame(() => requestAnimationFrame(() => winEl.classList.remove('no-anim')));
  }

  // Layout mode is switched only after the collapse animation finished,
  // with transitions muted, so a closed panel never flashes into view.
  function commitMode(next) {
    winEl.classList.add('no-anim');
    compact = next;
    if (compact) { listOpen = false; infoOpen = false; }
    applyPanels();
    void winEl.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      winEl.classList.remove('no-anim');
      if (!compact) {
        listOpen = wideList;
        infoOpen = wideInfo;
        applyPanels();
      }
      updateDrawLayerBox();
    }));
  }

  function syncMode() {
    const narrow = isNarrow();

    if (narrow === compact) {
      if (modeTimer) {
        clearTimeout(modeTimer);
        modeTimer = null;
        listOpen = wideList;
        infoOpen = wideInfo;
        applyPanels();
      }
      return;
    }

    if (modeTimer) return;

    if (narrow) {
      wideList = listOpen;
      wideInfo = infoOpen;
      const animating = listOpen || infoOpen;
      listOpen = false;
      infoOpen = false;
      applyPanels();
      modeTimer = setTimeout(() => {
        modeTimer = null;
        commitMode(true);
      }, animating && !reduceMotion ? PANEL_MS : 0);
    } else {
      commitMode(false);
    }
  }

  function setListOpen(open) {
    listOpen = !!open;
    if (!compact) wideList = listOpen;
    applyPanels();
  }

  function setInfoOpen(open) {
    infoOpen = !!open;
    if (!compact) wideInfo = infoOpen;
    applyPanels();
  }

  function setPanel(open) { setInfoOpen(open); }

  if (listToggleBtn) listToggleBtn.addEventListener('click', () => setListOpen(!listOpen));
  if (infoToggleBtn) infoToggleBtn.addEventListener('click', () => setInfoOpen(!infoOpen));
  $('#infoClose').addEventListener('click', () => setInfoOpen(false));
  $('#infoDone').addEventListener('click', () => setInfoOpen(false));

  function applyI18n() {
    $$('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
    if (editor) editor.setAttribute('data-ph', t('editor.ph'));
    document.documentElement.lang = lang;
    $$('#langRow .lang-btn').forEach(b => b.classList.toggle('on', b.getAttribute('data-lang') === lang));
    updateSaveLabel();
    syncDocTitle();
    renderList();
    fillInfo(currentNote());
    if (currentView === 'security') refreshSecurityTexts();
    if (activeTool) syncToolInputs();
  }

  function currentNote() {
    return notes.find(x => x.id === currentId) || null;
  }

  /* ---------- Views ---------- */
  function closeTranslatePane() {
    if (translatePane) translatePane.hidden = true;
    if (translateBtn) translateBtn.classList.remove('on');
    if (trStatus) trStatus.textContent = '';
    if (trReplace) trReplace.disabled = false;
    savedRange = null;
    translateSourceText = '';
    translateMode = 'selection';
  }

  function setView(name) {
    if (!views[name]) name = 'main';
    Object.keys(views).forEach(k => {
      views[k].hidden = true;
      views[k].classList.remove('active');
    });

    views[name].hidden = false;
    views[name].classList.add('active');
    currentView = name;

    if (name !== 'main') {
      cancelPlacing();
      deselectPhoto();
      setTool(null);
      closeTranslatePane();
    }

    winEl.classList.toggle('show-tools', name === 'main');

    if (name === 'main') syncDocTitle();
    else if (name === 'security') docTitleEl.textContent = t('sec.title');
    else if (name === 'settings') docTitleEl.textContent = t('settings.title');
    else docTitleEl.textContent = 'Fidji';

    requestAnimationFrame(updateDrawLayerBox);
  }

  const isMain = () => currentView === 'main';

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('fidji-theme', theme); } catch {}
  }

  function initTheme() {
    const saved = localStorage.getItem('fidji-theme');
    if (saved === 'light' || saved === 'dark') return applyTheme(saved);
    applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  $('#themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    syncToolInputs();
  });

  /* ---------- Window controls ---------- */
  $('#tlClose').addEventListener('click', () => { flushCurrentNote(); window.fidji.win.close(); });
  $('#tlMin').addEventListener('click', () => window.fidji.win.minimize());
  $('#tlMax').addEventListener('click', () => window.fidji.win.maximize());

  /* ---------- Helpers ---------- */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function num(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function locale() { return lang === 'ru' ? 'ru-RU' : 'en-US'; }

  function fmtDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(locale(), { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString(locale(), {
      month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  async function persist() {
    try {
      await window.fidji.saveNotes(notes);
      return true;
    } catch (err) {
      console.error('save error:', err);
      return false;
    }
  }

  /* ---------- Save state ---------- */
  function updateSaveLabel() {
    if (!saveBtn) return;
    const cur = saveStateEl ? saveStateEl.textContent : '';
    saveBtn.title = (cur ? cur + ' — ' : '') + t('save.btn') + ' (Ctrl+S)';
  }

  function setSaveState(state, key) {
    const text = key ? t(key) : '';
    if (saveBtn) {
      saveBtn.classList.remove('dirty', 'saving', 'saved', 'error');
      if (state) saveBtn.classList.add(state);
    }
    if (saveStateEl) saveStateEl.textContent = text;
    updateSaveLabel();
  }

  function flashSaved() {
    clearTimeout(saveStateTimer);
    setSaveState('saved', 'save.saved');
    saveStateTimer = setTimeout(() => {
      if (!dirty && !saving) setSaveState('', '');
    }, 1600);
  }

  /* ---------- Info ---------- */
  function fillInfo(n) {
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    if (!n) {
      set('#mCreated', '—'); set('#mUpdated', '—'); set('#mWords', '0'); set('#mChars', '0');
      measureLayout();
      return;
    }
    const txt = stripHtml(n.html).trim();
    set('#mCreated', fmtDateTime(n.createdAt || n.updatedAt));
    set('#mUpdated', fmtDateTime(n.updatedAt));
    set('#mWords', txt ? txt.split(/\s+/).filter(Boolean).length : 0);
    set('#mChars', txt.length);
    measureLayout();
  }

  function countLines() {
    if (!editor) return 0;
    const txt = editor.textContent || '';
    if (!txt.trim() && !editor.querySelector('br, table, .photo')) return 0;
    const lh = parseFloat(getComputedStyle(editor).lineHeight) || 20;
    if (txt.length > 12000) return Math.max(1, Math.round(editor.scrollHeight / lh));
    try {
      const r = document.createRange();
      r.selectNodeContents(editor);
      const rects = r.getClientRects();
      const tops = new Set();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.width < 0.5 || rect.height < 0.5) continue;
        tops.add(Math.round(rect.top));
      }
      return tops.size;
    } catch {
      return Math.max(1, Math.round(editor.scrollHeight / lh));
    }
  }

  function measureLayout() {
    const l = $('#mLines'), w = $('#mWidth');
    if (l) l.textContent = String(countLines());
    if (w && editor) w.textContent = Math.round(editor.clientWidth) + 'px';
  }

  function syncDocTitle() {
    if (isMain()) docTitleEl.textContent = titleEl.value.trim() || t('app.new');
  }

  function drawMarkup() {
    const g = drawSvg ? drawSvg.querySelector('#drawStrokes') : null;
    return g ? g.innerHTML : '';
  }

  function syncNoteFromEditor() {
    const n = currentNote();
    if (!n) return false;
    const title = titleEl.value.trim();
    const html = editor.innerHTML;
    const draw = drawMarkup();
    if (n.title === title && n.html === html && n.draw === draw) return false;
    n.title = title;
    n.html = html;
    n.draw = draw;
    n.updatedAt = Date.now();
    return true;
  }

  async function flushCurrentNote(force) {
    if (!currentId) return true;
    if (saving) { saveAgain = true; return true; }

    const changed = syncNoteFromEditor();
    if (!changed && !dirty && !force) return true;

    saving = true;
    clearTimeout(saveTimer);
    saveTimer = null;
    setSaveState('saving', 'save.saving');

    let ok = true;
    try {
      do {
        saveAgain = false;
        syncNoteFromEditor();
        ok = await persist();
      } while (saveAgain && ok);
    } finally {
      saving = false;
    }

    if (ok) { dirty = false; flashSaved(); }
    else { dirty = true; setSaveState('error', 'save.error'); }

    renderList();
    fillInfo(currentNote());
    syncDocTitle();
    return ok;
  }

  async function manualSave() {
    if (!isMain() || !currentId) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    await flushCurrentNote(true);
  }

  function queueSave() {
    dirty = true;
    if (!saving) setSaveState('dirty', 'save.dirty');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { flushCurrentNote(); }, 500);
  }

  function notePreview(n) {
    const txt = stripHtml(n.html).trim();
    if (txt) return txt.slice(0, 60);
    if (/class="photo"/.test(n.html || '')) return t('preview.photo');
    if (/<path/i.test(n.draw || '')) return t('preview.drawing');
    return t('preview.empty');
  }

  /* ---------- Toast ---------- */
  function showToast(msg, actionLabel, fn) {
    if (!toastEl) return;
    if (toastMsgEl) toastMsgEl.textContent = msg;
    if (toastActBtn) {
      if (actionLabel && fn) {
        toastActBtn.hidden = false;
        toastActBtn.textContent = actionLabel;
        toastAction = fn;
      } else {
        toastActBtn.hidden = true;
        toastAction = null;
      }
    }
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.classList.remove('on');
    toastAction = null;
    setTimeout(() => { if (toastEl && !toastEl.classList.contains('on')) toastEl.hidden = true; }, 240);
  }

  /* ---------- Translation helpers ---------- */
  function getEditorSelectionRange() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return null;
    return range.cloneRange();
  }

  function saveEditorSelection() { savedRange = getEditorSelectionRange(); }

  function restoreEditorSelection() {
    if (!savedRange) return false;
    try {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.cloneRange());
      return true;
    } catch { return false; }
  }

  function selectedEditorText() {
    const range = getEditorSelectionRange();
    return range ? range.toString() : '';
  }

  function makeTextFragment(text) {
    const frag = document.createDocumentFragment();
    const lines = String(text).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (i > 0) frag.appendChild(document.createElement('br'));
      frag.appendChild(document.createTextNode(line));
    });
    return frag;
  }

  function insertFragmentAtRange(range, frag) {
    const last = frag.lastChild;
    range.insertNode(frag);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      savedRange = range.cloneRange();
    }
  }

  function replaceSavedSelectionWithText(text) {
    if (!restoreEditorSelection() || !savedRange || savedRange.collapsed) return false;
    const range = savedRange.cloneRange();
    range.deleteContents();
    insertFragmentAtRange(range, makeTextFragment(text));
    return true;
  }

  function insertSavedSelectionText(text) {
    if (!savedRange) return false;
    const range = savedRange.cloneRange();
    range.collapse(false);
    insertFragmentAtRange(range, makeTextFragment(text));
    return true;
  }

  function openTranslatePane() {
    if (!isMain() || !translatePane) return;
    if (activeTool) setTool(null);
    if (!infoOpen) setInfoOpen(true);

    saveEditorSelection();
    const selText = selectedEditorText();

    if (selText.trim()) {
      translateSourceText = selText;
      translateMode = 'selection';
      if (trStatus) trStatus.textContent = t('tr.selected');
    } else {
      translateSourceText = stripHtml(editor.innerHTML).trim();
      translateMode = 'note';
      if (trStatus) trStatus.textContent = translateSourceText ? t('tr.whole') : t('tr.nothing');
    }

    if (trOut) trOut.value = '';
    if (trReplace) trReplace.disabled = translateMode !== 'selection';

    translatePane.hidden = false;
    if (translateBtn) translateBtn.classList.add('on');
    if (trTarget) trTarget.focus();
  }

  function chunkText(text, limit) {
    const src = String(text);
    if (src.length <= limit) return [src];
    const out = [];
    let rest = src;
    while (rest.length > limit) {
      let cut = rest.lastIndexOf('\n', limit);
      if (cut < limit * 0.4) cut = rest.lastIndexOf('. ', limit);
      if (cut < limit * 0.4) cut = rest.lastIndexOf(' ', limit);
      if (cut < limit * 0.4) cut = limit; else cut += 1;
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    if (rest) out.push(rest);
    return out;
  }

  async function translateChunk(part, target) {
    try {
      const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=' +
        encodeURIComponent(target) + '&q=' + encodeURIComponent(part);
      const res = await fetch(url);
      if (!res.ok) throw new Error('http ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('bad response');
      return data[0].map(seg => (Array.isArray(seg) && seg[0]) ? seg[0] : '').join('');
    } catch {
      const url2 = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(part.slice(0, 480)) +
        '&langpair=' + encodeURIComponent('en|' + target);
      const res2 = await fetch(url2);
      if (!res2.ok) throw new Error(t('tr.offline'));
      const d2 = await res2.json();
      const txt = d2 && d2.responseData && d2.responseData.translatedText;
      if (!txt) throw new Error(t('tr.err'));
      return txt;
    }
  }

  async function translateText(text, target) {
    if (window.fidji && typeof window.fidji.translate === 'function') {
      const r = await window.fidji.translate(text, target);
      if (r && r.ok) return r.text;
      throw new Error((r && r.error) || t('tr.err'));
    }
    const parts = chunkText(text, 1200);
    const out = [];
    for (const part of parts) out.push(await translateChunk(part, target));
    return out.join('');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      ta.remove();
      return ok;
    }
  }

  /* ---------- List ---------- */
  function clearDropMarks() {
    $$('.note-item.drop-before, .note-item.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
  }

  function reorderNote(srcId, targetId, after) {
    const from = notes.findIndex(n => n.id === srcId);
    if (from < 0) return;
    const moved = notes.splice(from, 1)[0];
    let to = notes.findIndex(n => n.id === targetId);
    if (to < 0) { notes.splice(from, 0, moved); return; }
    if (after) to += 1;
    notes.splice(to, 0, moved);
    persist();
    renderList();
  }

  function renderList() {
    if (!listEl) return;
    const scroll = listEl.scrollTop;
    const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
    listEl.innerHTML = '';

    let shown = notes;
    if (q) {
      shown = notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        stripHtml(n.html).toLowerCase().includes(q)
      );
    }

    if (!shown.length) {
      const e = document.createElement('div');
      e.className = 'note-item';
      e.style.color = 'var(--ter)';
      e.style.cursor = 'default';
      e.textContent = t('list.empty');
      listEl.appendChild(e);
      return;
    }

    const canDrag = !q;

    shown.forEach(n => {
      const item = document.createElement('div');
      item.className = 'note-item' + (n.id === currentId ? ' active' : '');
      item.tabIndex = 0;

      item.innerHTML =
        '<span class="nt">' + esc(n.title || t('doc.untitled')) + '</span>' +
        '<span class="np">' + esc(notePreview(n)) + '</span>' +
        '<span class="nd">' + fmtDate(n.updatedAt) + '</span>' +
        '<button class="del" title="' + esc(t('act.delete')) + '" aria-label="' + esc(t('act.delete')) + '">' + TRASH_SVG + '</button>';

      item.addEventListener('click', (ev) => {
        if (ev.target.closest('.del')) return;
        openNote(n.id);
      });
      item.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') openNote(n.id);
      });
      item.querySelector('.del').addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteNote(n.id);
      });

      if (canDrag) {
        item.draggable = true;
        item.addEventListener('dragstart', (ev) => {
          dragId = n.id;
          item.classList.add('dragging');
          try { ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', n.id); } catch {}
        });
        item.addEventListener('dragend', () => {
          dragId = null;
          item.classList.remove('dragging');
          clearDropMarks();
        });
        item.addEventListener('dragover', (ev) => {
          if (!dragId || dragId === n.id) return;
          ev.preventDefault();
          try { ev.dataTransfer.dropEffect = 'move'; } catch {}
          const r = item.getBoundingClientRect();
          const after = ev.clientY > r.top + r.height / 2;
          clearDropMarks();
          item.classList.add(after ? 'drop-after' : 'drop-before');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drop-before', 'drop-after'));
        item.addEventListener('drop', (ev) => {
          ev.preventDefault();
          const src = dragId;
          clearDropMarks();
          if (!src || src === n.id) return;
          const r = item.getBoundingClientRect();
          reorderNote(src, n.id, ev.clientY > r.top + r.height / 2);
        });
      }

      listEl.appendChild(item);
    });

    listEl.scrollTop = scroll;
  }

  /* ---------- Actions ---------- */
  async function openNote(id) {
    await flushCurrentNote();

    const n = notes.find(x => x.id === id);
    if (!n) return;
    currentId = id;

    cancelPlacing();
    deselectPhoto();
    cancelDrawing();
    closeTranslatePane();
    hideTableSettings();

    titleEl.value = n.title || '';
    editor.innerHTML = n.html || '';
    sanitizeEditor();
    refreshPhotoZ();
    updateToolbarState();

    drawSvg.innerHTML = n.draw || '';
    normalizeDrawSvg();

    if (compact && listOpen) setListOpen(false);

    requestAnimationFrame(() => {
      updateDrawLayerBox();
      lastEdWidth = editor.clientWidth;
      measureLayout();
    });

    syncToolInputs();
    renderList();
    fillInfo(n);
    syncDocTitle();
    dirty = false;
    setSaveState('', '');
  }

  async function newNote() {
    await flushCurrentNote();
    const now = Date.now();
    const n = { id: uid(), title: '', html: '', draw: '', createdAt: now, updatedAt: now };
    notes.unshift(n);
    await persist();
    await openNote(n.id);
    titleEl.focus();
  }

  async function deleteNote(id) {
    const idx = notes.findIndex(x => x.id === id);
    if (idx < 0) return;
    const removed = notes[idx];

    cancelPlacing();
    deselectPhoto();
    cancelDrawing();
    setTool(null);
    closeTranslatePane();
    hideTableSettings();

    if (currentId === id) currentId = null;
    notes.splice(idx, 1);
    await persist();

    if (!notes.length) {
      titleEl.value = '';
      editor.innerHTML = '';
      drawSvg.innerHTML = '';
      normalizeDrawSvg();
      fillInfo(null);
      renderList();
      await newNote();
    } else {
      renderList();
      await openNote(notes[Math.min(idx, notes.length - 1)].id);
    }

    lastDeleted = { note: removed, index: idx };
    showToast(t('toast.deleted'), t('act.undo'), undoDelete);
  }

  async function undoDelete() {
    if (!lastDeleted) return;
    const note = lastDeleted.note;
    const index = lastDeleted.index;
    lastDeleted = null;
    if (notes.some(n => n.id === note.id)) return;
    await flushCurrentNote();
    notes.splice(Math.max(0, Math.min(index, notes.length)), 0, note);
    await persist();
    renderList();
    await openNote(note.id);
  }

  $('#deleteNote').addEventListener('click', () => { if (currentId) deleteNote(currentId); });

  /* ---------- Sanitize ---------- */
  const STYLE_KEEP = ['font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'text-align'];

  function filterInlineStyle(el) {
    if (!el.getAttribute) return;
    const raw = el.getAttribute('style');
    if (!raw) return;
    const parts = raw.split(';').map(s => s.trim()).filter(Boolean);
    const keep = parts.filter(p => STYLE_KEEP.indexOf(p.split(':')[0].trim().toLowerCase()) !== -1);
    if (keep.length) el.setAttribute('style', keep.join('; '));
    else el.removeAttribute('style');
  }

  function sanitizeNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.classList && node.classList.contains('photo')) return;
    Array.from(node.childNodes).forEach(sanitizeNode);
    filterInlineStyle(node);
    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    if (tag === 'span' || tag === 'font') {
      const st = (node.getAttribute('style') || '').trim();
      if (!st) {
        const parent = node.parentNode;
        if (!parent) return;
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
      }
    }
  }

  function sanitizeEditor() {
    if (!editor) return;
    Array.from(editor.childNodes).forEach(sanitizeNode);
  }

  /* ---------- Paste ---------- */
  editor.addEventListener('paste', (e) => {
    if (activeTool) { e.preventDefault(); return; }
    e.preventDefault();
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    let text = cd.getData('text/plain');
    if (text == null) text = '';
    const lines = text.split(/\r\n|\r|\n/);
    const frag = document.createDocumentFragment();
    lines.forEach(line => {
      const d = document.createElement('div');
      if (line === '') d.innerHTML = '<br>';
      else d.textContent = line;
      frag.appendChild(d);
    });
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const lastNode = frag.lastChild;
      range.insertNode(frag);
      if (lastNode) {
        const nr = document.createRange();
        nr.setStartAfter(lastNode);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    } else {
      editor.appendChild(frag);
    }
    queueSave();
  });

  function exec(cmd) {
    if (activeTool) setTool(null);
    if (document.activeElement !== editor) editor.focus();
    const sel = window.getSelection();
    let hasSelectionInEditor = false;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) hasSelectionInEditor = true;
    }
    if (!hasSelectionInEditor) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try { document.execCommand(cmd, false, null); } catch (err) { console.warn(err); }
    updateToolbarState();
    queueSave();
  }

  function block(tag) {
    if (activeTool) setTool(null);
    editor.focus();
    const sel = window.getSelection();
    let validSel = false;
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (editor.contains(r.commonAncestorContainer)) validSel = true;
    }
    if (!validSel) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try { document.execCommand('formatBlock', false, tag); } catch (err) { console.warn(err); }
    updateToolbarState();
    queueSave();
  }

  function updateToolbarState() {
    $$('.tools-static [data-cmd]').forEach(b => {
      let on = false;
      try { on = document.queryCommandState(b.dataset.cmd); } catch {}
      b.classList.toggle('on', on);
    });
    let cur = '';
    try { cur = (document.queryCommandValue('formatBlock') || '').toLowerCase(); } catch {}
    $$('.tools-static [data-block]').forEach(b => {
      b.classList.toggle('on', b.dataset.block === (cur || 'p'));
    });
  }

  $$('.tools-static [data-cmd]').forEach(b => {
    b.addEventListener('mousedown', (e) => { e.preventDefault(); exec(b.dataset.cmd); });
  });
  $$('.tools-static [data-block]').forEach(b => {
    b.addEventListener('mousedown', (e) => { e.preventDefault(); block(b.dataset.block); });
  });

  /* ---------- Typing -> autosave ---------- */
  editor.addEventListener('input', () => { queueSave(); });
  titleEl.addEventListener('input', () => { syncDocTitle(); queueSave(); });
  editor.addEventListener('cut', () => queueSave());
  editor.addEventListener('drop', (e) => { e.preventDefault(); queueSave(); });
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) !== -1) updateToolbarState();
  });
  document.addEventListener('selectionchange', () => {
    if (isMain() && document.activeElement === editor) updateToolbarState();
  });
  if (searchEl) searchEl.addEventListener('input', renderList);

  /* ---------- Checklist / Table / Align ---------- */
  $$('.tools-static [data-align]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const map = { left: 'justifyLeft', center: 'justifyCenter', right: 'justifyRight', justify: 'justifyFull' };
      const cmd = map[btn.dataset.align];
      if (cmd) exec(cmd);
    });
  });

  const checklistBtn = $('#btnChecklist');
  if (checklistBtn) checklistBtn.addEventListener('click', () => {
    if (!isMain()) return;
    editor.focus();
    const ul = document.createElement('ul');
    ul.className = 'checklist';
    const li = document.createElement('li');
    li.textContent = lang === 'ru' ? 'Задача' : 'Task';
    ul.appendChild(li);
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(ul);
      const r = document.createRange();
      r.selectNodeContents(li);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      editor.appendChild(ul);
    }
    queueSave();
  });

  editor.addEventListener('click', (e) => {
    const li = e.target.closest('ul.checklist > li');
    if (li) { li.classList.toggle('checked'); queueSave(); }
  });

  const tableBtn = $('#btnTable');
  if (tableBtn) tableBtn.addEventListener('click', () => {
    if (!isMain()) return;
    editor.focus();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = '<table><tbody><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td><td><br></td></tr></tbody></table>';
    const table = tempDiv.firstElementChild;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(table);
      const firstTd = table.querySelector('td');
      if (firstTd) {
        const r = document.createRange();
        r.selectNodeContents(firstTd);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } else {
      editor.appendChild(table);
    }
    showTableSettings();
    queueSave();
  });

  function showTableSettings() {
    if (toolSettings) toolSettings.hidden = true;
    const tbl = $('#tableSettings');
    if (tbl) tbl.hidden = false;
    const infoTitle = $('.info-title');
    if (infoTitle) infoTitle.textContent = t('info.table');
    if (!infoOpen) setInfoOpen(true);
  }

  function hideTableSettings() {
    const tbl = $('#tableSettings');
    if (tbl) tbl.hidden = true;
    const infoTitle = $('.info-title');
    if (infoTitle) infoTitle.textContent = t('info.title');
    resetTableDelete();
    if (activeTool && toolSettings) toolSettings.hidden = false;
  }

  let tblDeleteArmed = false;
  let tblDeleteTimer = null;
  function resetTableDelete() {
    tblDeleteArmed = false;
    clearTimeout(tblDeleteTimer);
    const b = $('#tblDelete');
    if (b) { b.classList.remove('armed'); b.textContent = t('table.deleteTable'); }
  }

  function tableFromSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let node = sel.anchorNode;
    while (node && node !== editor) {
      if (node.nodeName === 'TABLE') return node;
      node = node.parentNode;
    }
    return null;
  }

  $$('#tableSettings .tbl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.tbl;
      const table = tableFromSelection();
      if (!table) return;
      const sel = window.getSelection();

      if (action === 'addRow') addTableRow(table);
      else if (action === 'addColumn') addTableColumn(table);
      else if (action === 'deleteRow') deleteTableRow(table, sel);
      else if (action === 'deleteColumn') deleteTableColumn(table, sel);
      else if (action === 'deleteTable') {
        if (!tblDeleteArmed) {
          tblDeleteArmed = true;
          btn.classList.add('armed');
          btn.textContent = t('table.confirm');
          clearTimeout(tblDeleteTimer);
          tblDeleteTimer = setTimeout(resetTableDelete, 3000);
          return;
        }
        table.remove();
        resetTableDelete();
        hideTableSettings();
      }
      queueSave();
    });
  });

  function addTableRow(table) {
    const tbody = table.tBodies[0] || table;
    const cols = (table.rows[0] && table.rows[0].cells.length) || 3;
    const row = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const cell = document.createElement('td');
      cell.innerHTML = '<br>';
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  function addTableColumn(table) {
    Array.from(table.rows).forEach(row => {
      const cell = document.createElement('td');
      cell.innerHTML = '<br>';
      row.appendChild(cell);
    });
  }

  function deleteTableRow(table, sel) {
    if (!sel) return;
    let node = sel.anchorNode;
    while (node && node !== table) {
      if (node.nodeName === 'TR') {
        if (table.rows.length > 1) node.remove();
        return;
      }
      node = node.parentNode;
    }
  }

  function deleteTableColumn(table, sel) {
    if (!sel) return;
    let node = sel.anchorNode;
    let cell = null;
    while (node && node !== table) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') { cell = node; break; }
      node = node.parentNode;
    }
    if (!cell || !cell.parentNode) return;
    const colIndex = Array.from(cell.parentNode.cells).indexOf(cell);
    if (colIndex >= 0 && table.rows[0] && table.rows[0].cells.length > 1) {
      Array.from(table.rows).forEach(row => { if (row.cells[colIndex]) row.cells[colIndex].remove(); });
    }
  }

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#tableSettings') && !e.target.closest('table') && !e.target.closest('#btnTable')) {
      const tbl = $('#tableSettings');
      if (tbl && !tbl.hidden) hideTableSettings();
    }
  }, true);

  /* ---------- Photos ---------- */
  function isPlacing() { return pendingPhotos.length > 0; }
  function updatePlacingUI() {
    const placing = isPlacing();
    winEl.classList.toggle('placing-photo', placing);
    const btn = $('#btnAddImg');
    if (btn) btn.classList.toggle('on', placing);
  }
  function cancelPlacing() { pendingPhotos = []; updatePlacingUI(); }
  function startPlacing(urls) {
    pendingPhotos = Array.isArray(urls) ? urls.filter(Boolean) : [];
    setTool(null);
    updatePlacingUI();
  }
  async function initImagesBase() {
    try {
      if (window.fidji && typeof window.fidji.getImagesBase === 'function') {
        imagesBase = await window.fidji.getImagesBase();
      }
    } catch {}
    if (imagesBase && !imagesBase.endsWith('/')) imagesBase += '/';
  }
  function extractImageName(src) {
    if (!src) return '';
    const s0 = String(src);
    if (/^(data|blob|https?):/i.test(s0)) return s0;
    let s = s0.replace(/\\/g, '/');
    try {
      if (/^file:/i.test(s)) {
        const u = new URL(s);
        s = decodeURIComponent(u.pathname);
        if (/^\/[a-zA-Z]:/.test(s)) s = s.slice(1);
      }
    } catch {}
    const parts = s.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : s;
  }
  function photoSrcToUrl(src) {
    const name = extractImageName(src);
    if (!name) return '';
    if (/^(data|blob|https?):/i.test(name)) return name;
    return imagesBase ? imagesBase + encodeURI(name) : name;
  }
  function applyPhotoStyle(el) {
    const cx = parseFloat(el.dataset.cx) || 0;
    const cy = parseFloat(el.dataset.cy) || 0;
    const w = parseFloat(el.dataset.w) || 160;
    const rot = parseFloat(el.dataset.rot) || 0;
    const z = parseInt(el.dataset.z, 10) || 0;
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    el.style.width = w + 'px';
    el.style.zIndex = String(z);
    el.style.transform = 'translate(-50%, -50%) rotate(' + rot + 'deg)';
  }
  function renderPhoto(data) {
    const el = document.createElement('div');
    el.className = 'photo';
    el.setAttribute('contenteditable', 'false');
    const storedSrc = extractImageName(data.src);
    el.dataset.id = data.id || uid();
    el.dataset.src = storedSrc;
    el.dataset.cx = num(data.cx || 0);
    el.dataset.cy = num(data.cy || 0);
    el.dataset.w = num(data.w || 240);
    el.dataset.rot = num(data.rot || 0);
    el.dataset.z = num(data.z || ++photoZ);
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    img.src = photoSrcToUrl(storedSrc);
    img.addEventListener('load', () => { updateDrawLayerBox(); measureLayout(); });
    el.appendChild(img);
    ['nw', 'ne', 'sw', 'se'].forEach(dir => {
      const h = document.createElement('span');
      h.className = 'ph-rs ' + dir;
      h.dataset.dir = dir;
      el.appendChild(h);
    });
    const rot = document.createElement('span');
    rot.className = 'ph-rot';
    el.appendChild(rot);
    applyPhotoStyle(el);
    return el;
  }
  function createPhoto(src, x, y) {
    const editorW = editor.clientWidth || editorPane.clientWidth || 600;
    const w = num(Math.max(140, Math.min(360, editorW - 40)));
    return renderPhoto({ id: uid(), src, cx: num(x), cy: num(y), w, rot: 0, z: ++photoZ });
  }
  function selectPhoto(el) {
    if (activePhoto === el) {
      if (el) { el.style.zIndex = String(++photoZ); el.dataset.z = String(photoZ); }
      return;
    }
    if (activePhoto) activePhoto.classList.remove('selected');
    activePhoto = el || null;
    if (activePhoto) {
      activePhoto.classList.add('selected');
      activePhoto.style.zIndex = String(++photoZ);
      activePhoto.dataset.z = String(photoZ);
    }
  }
  function deselectPhoto() {
    if (activePhoto) activePhoto.classList.remove('selected');
    activePhoto = null;
  }
  function refreshPhotoZ() {
    photoZ = 0;
    editor.querySelectorAll('.photo').forEach(p => {
      const z = parseInt(p.dataset.z, 10) || 0;
      if (z > photoZ) photoZ = z;
    });
  }
  function placePendingAt(clientX, clientY) {
    if (!pendingPhotos.length) return;
    const src = pendingPhotos.shift();
    const rect = editor.getBoundingClientRect();
    const el = createPhoto(src, clientX - rect.left, clientY - rect.top);
    editor.appendChild(el);
    selectPhoto(el);
    updatePlacingUI();
    updateDrawLayerBox();
    queueSave();
  }
  function onPhotoPointerMove(e) {
    if (!interaction) return;
    e.preventDefault();
    const type = interaction.type, el = interaction.el;
    if (type === 'move') {
      el.dataset.cx = num(interaction.startCx + (e.clientX - interaction.startX));
      el.dataset.cy = num(interaction.startCy + (e.clientY - interaction.startY));
      applyPhotoStyle(el);
      return;
    }
    if (type === 'resize') {
      const dist = Math.hypot(e.clientX - interaction.centerClientX, e.clientY - interaction.centerClientY);
      let w = interaction.startW * (dist / interaction.startDist);
      w = Math.max(40, Math.min(4000, w));
      el.dataset.w = num(w);
      applyPhotoStyle(el);
      return;
    }
    if (type === 'rotate') {
      const angle = Math.atan2(e.clientY - interaction.centerClientY, e.clientX - interaction.centerClientX);
      let rot = interaction.startRot + (angle - interaction.startAngle) * 180 / Math.PI;
      if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      rot = ((rot % 360) + 360) % 360;
      el.dataset.rot = num(rot);
      applyPhotoStyle(el);
    }
  }
  function onPhotoPointerUp() {
    if (interaction) { interaction = null; queueSave(); }
    window.removeEventListener('pointermove', onPhotoPointerMove);
    window.removeEventListener('pointerup', onPhotoPointerUp);
    window.removeEventListener('pointercancel', onPhotoPointerUp);
  }
  $('#btnAddImg').addEventListener('click', async () => {
    if (!isMain()) return;
    if (isPlacing()) { cancelPlacing(); return; }
    const files = await window.fidji.addImages();
    if (files && files.length) startPlacing(files);
  });
  if (editorPane) {
    editorPane.addEventListener('pointerdown', (e) => {
      if (!isPlacing()) return;
      if (activeTool) return;
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      placePendingAt(e.clientX, e.clientY);
    }, true);
  }
  editor.addEventListener('pointerdown', (e) => {
    if (isPlacing()) return;
    if (activeTool) return;
    if (e.button !== 0) return;
    const photo = e.target.closest('.photo');
    if (!photo) {
      deselectPhoto();
      if (document.activeElement !== editor) {
        setTimeout(() => { if (!activeTool && !isPlacing()) editor.focus(); }, 0);
      }
      return;
    }
    const handleRotate = e.target.closest('.ph-rot');
    const handleResize = e.target.closest('.ph-rs');
    e.preventDefault();
    selectPhoto(photo);
    const rect = editor.getBoundingClientRect();
    const cx = parseFloat(photo.dataset.cx) || 0;
    const cy = parseFloat(photo.dataset.cy) || 0;
    const centerClientX = rect.left + cx;
    const centerClientY = rect.top + cy;
    const startX = e.clientX;
    const startY = e.clientY;
    if (handleRotate) {
      interaction = {
        type: 'rotate', el: photo, centerClientX, centerClientY,
        startAngle: Math.atan2(startY - centerClientY, startX - centerClientX),
        startRot: parseFloat(photo.dataset.rot) || 0
      };
    } else if (handleResize) {
      interaction = {
        type: 'resize', el: photo, centerClientX, centerClientY,
        startW: parseFloat(photo.dataset.w) || 160,
        startDist: Math.max(1, Math.hypot(startX - centerClientX, startY - centerClientY))
      };
    } else {
      interaction = { type: 'move', el: photo, startX, startY, startCx: cx, startCy: cy };
    }
    window.addEventListener('pointermove', onPhotoPointerMove);
    window.addEventListener('pointerup', onPhotoPointerUp);
    window.addEventListener('pointercancel', onPhotoPointerUp);
  });

  /* ---------- Draw ---------- */
  function normalizeDrawSvg() {
    const all = Array.from(drawSvg.querySelectorAll('path'));
    const strokes = all.filter(p => !p.closest('#eraseStrokes'));
    drawSvg.innerHTML = '';
    const g = document.createElementNS(SVG_NS, 'g');
    g.id = 'drawStrokes';
    const cur = document.createElementNS(SVG_NS, 'circle');
    cur.id = 'eraserCursor';
    cur.setAttribute('class', 'eraser-cursor');
    cur.setAttribute('r', '14');
    cur.setAttribute('cx', '0');
    cur.setAttribute('cy', '0');
    cur.style.display = 'none';
    strokes.forEach(p => g.appendChild(p));
    drawSvg.appendChild(g);
    drawSvg.appendChild(cur);
    strokes.forEach(p => ensureStrokeMeta(p));
  }
  function drawStrokesGroup() { return drawSvg.querySelector('#drawStrokes'); }
  function eraserCursorEl() { return drawSvg.querySelector('#eraserCursor'); }
  function computeBBox(pts) {
    if (!pts.length) return [0, 0, 0, 0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return [num(minX), num(minY), num(maxX - minX), num(maxY - minY)];
  }
  function samplePathToPoints(path) {
    const pts = [];
    try {
      const len = path.getTotalLength();
      if (!len || !isFinite(len)) return pts;
      const step = Math.max(2, len / 150);
      for (let s = 0; s <= len; s += step) {
        const pt = path.getPointAtLength(s);
        pts.push({ x: num(pt.x), y: num(pt.y) });
      }
      const end = path.getPointAtLength(len);
      pts.push({ x: num(end.x), y: num(end.y) });
    } catch {}
    return pts;
  }
  function ensureStrokeMeta(path) {
    if (path.dataset.pts) return;
    const pts = samplePathToPoints(path);
    path.dataset.pts = JSON.stringify(pts);
    path.dataset.bbox = JSON.stringify(computeBBox(pts));
  }
  function getStrokePoints(path) {
    if (path.dataset.pts) { try { return JSON.parse(path.dataset.pts); } catch {} }
    const pts = samplePathToPoints(path);
    path.dataset.pts = JSON.stringify(pts);
    path.dataset.bbox = JSON.stringify(computeBBox(pts));
    return pts;
  }
  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - ax, py - ay);
    let s = ((px - ax) * dx + (py - ay) * dy) / l2;
    s = Math.max(0, Math.min(1, s));
    return Math.hypot(px - (ax + s * dx), py - (ay + s * dy));
  }
  function hitEraser(x, y) {
    const radius = (toolCfg.eraser.size || 1) / 2;
    const group = drawStrokesGroup();
    if (!group) return 0;
    const paths = Array.from(group.querySelectorAll('path'));
    const toRemove = [];
    for (const path of paths) {
      const sw = parseFloat(path.getAttribute('stroke-width')) || 1;
      const reach = radius + sw / 2;
      let bbox = null;
      if (path.dataset.bbox) { try { bbox = JSON.parse(path.dataset.bbox); } catch { bbox = null; } }
      if (!bbox) { getStrokePoints(path); try { bbox = JSON.parse(path.dataset.bbox); } catch { bbox = null; } }
      if (bbox) {
        const bx = bbox[0], by = bbox[1], bw = bbox[2], bh = bbox[3];
        if (x < bx - reach || x > bx + bw + reach || y < by - reach || y > by + bh + reach) continue;
      }
      const pts = getStrokePoints(path);
      let hit = false;
      if (pts.length === 1) {
        hit = Math.hypot(x - pts[0].x, y - pts[0].y) <= reach;
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          if (distToSeg(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= reach) { hit = true; break; }
        }
      }
      if (hit) toRemove.push(path);
    }
    toRemove.forEach(p => p.remove());
    return toRemove.length;
  }
  function positionEraserCursor(x, y, inside) {
    const cur = eraserCursorEl();
    if (!cur) return;
    if (!inside || activeTool !== 'eraser') { cur.style.display = 'none'; return; }
    const r = Math.max(2, (toolCfg.eraser.size || 1) / 2);
    cur.setAttribute('r', String(num(r)));
    cur.setAttribute('cx', String(num(x)));
    cur.setAttribute('cy', String(num(y)));
    const soft = toolCfg.eraser.softness || 0;
    cur.style.filter = soft > 0 ? 'blur(' + soft + 'px)' : '';
    cur.style.display = 'block';
  }
  function hideEraserCursor() {
    const cur = eraserCursorEl();
    if (cur) cur.style.display = 'none';
  }

  /* ---------- Tools ---------- */
  function autoColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#ffffff' : '#000000';
  }
  function getMarkerStyle() {
    const s = toolCfg.marker;
    return { color: s.color || autoColor(), size: s.size, opacity: s.opacity, softness: s.softness };
  }
  function applyLayerInteractivity() {
    if (!drawLayer) return;
    drawLayer.style.pointerEvents = activeTool ? 'auto' : 'none';
  }
  function setTool(tool) {
    if (activeTool === tool) tool = null;
    if (tool) { cancelPlacing(); deselectPhoto(); }
    cancelDrawing();
    hideEraserCursor();
    activeTool = tool || null;
    winEl.classList.toggle('tool-marker', activeTool === 'marker');
    winEl.classList.toggle('tool-eraser', activeTool === 'eraser');
    if (markerBtn) markerBtn.classList.toggle('on', activeTool === 'marker');
    if (eraserBtn) eraserBtn.classList.toggle('on', activeTool === 'eraser');
    if (markerPresets) markerPresets.hidden = activeTool !== 'marker';
    if (eraserPresets) eraserPresets.hidden = activeTool !== 'eraser';
    if (toolSettings) toolSettings.hidden = !activeTool;
    if (activeTool) {
      const tbl = $('#tableSettings');
      if (tbl) tbl.hidden = true;
      const infoTitle = $('.info-title');
      if (infoTitle) infoTitle.textContent = t('info.title');
      if (!infoOpen) setInfoOpen(true);
    }
    applyLayerInteractivity();
    syncToolInputs();
    updateDrawLayerBox();
  }
  function syncToolInputs() {
    if (!activeTool) return;
    const s = toolCfg[activeTool];
    const isMarker = activeTool === 'marker';
    if (tsTitle) tsTitle.textContent = isMarker ? t('tool.marker') : t('tool.eraser');
    if (tsSize) tsSize.value = s.size;
    if (tsSizeVal) tsSizeVal.textContent = Math.round(s.size) + 'px';
    if (tsOpacityRow) tsOpacityRow.hidden = !isMarker;
    if (isMarker) {
      if (tsOpacity) tsOpacity.value = s.opacity;
      if (tsOpacityVal) tsOpacityVal.textContent = Math.round(s.opacity * 100) + '%';
    }
    if (tsSoft) tsSoft.value = s.softness;
    if (tsSoftVal) tsSoftVal.textContent = Math.round(s.softness);
    if (tsColorRow) tsColorRow.hidden = !isMarker;
    if (isMarker && tsColor) tsColor.value = s.color || autoColor();
    updatePresetStates();
  }
  function updatePresetStates() {
    if (!activeTool) return;
    const s = toolCfg[activeTool];
    const group = activeTool === 'eraser' ? eraserPresets : markerPresets;
    if (!group) return;
    group.querySelectorAll('[data-preset]').forEach(btn => {
      const p = PRESETS[activeTool][btn.dataset.preset];
      let on = !!p;
      if (p) {
        for (const k in p) {
          if (k === 'opacity') {
            if (Math.abs((s[k] || 1) - p[k]) >= 0.01) { on = false; break; }
          } else if (Math.round(s[k] || 0) !== Math.round(p[k])) { on = false; break; }
        }
      }
      btn.classList.toggle('on', on);
    });
  }
  function applyPreset(tool, name) {
    const p = PRESETS[tool] && PRESETS[tool][name];
    if (!p) return;
    Object.assign(toolCfg[tool], p);
    saveToolCfg();
    syncToolInputs();
  }
  if (markerBtn) markerBtn.addEventListener('click', () => { if (isMain()) setTool('marker'); });
  if (eraserBtn) eraserBtn.addEventListener('click', () => { if (isMain()) setTool('eraser'); });
  $$('.tool-presets [data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (tool !== activeTool) setTool(tool);
      applyPreset(tool, btn.dataset.preset);
    });
  });
  if (tsSize) tsSize.addEventListener('input', () => {
    if (!activeTool) return;
    toolCfg[activeTool].size = Number(tsSize.value);
    tsSizeVal.textContent = Math.round(toolCfg[activeTool].size) + 'px';
    saveToolCfg(); updatePresetStates();
  });
  if (tsOpacity) tsOpacity.addEventListener('input', () => {
    if (activeTool !== 'marker') return;
    toolCfg.marker.opacity = Number(tsOpacity.value);
    tsOpacityVal.textContent = Math.round(toolCfg.marker.opacity * 100) + '%';
    saveToolCfg(); updatePresetStates();
  });
  if (tsSoft) tsSoft.addEventListener('input', () => {
    if (!activeTool) return;
    toolCfg[activeTool].softness = Number(tsSoft.value);
    tsSoftVal.textContent = Math.round(toolCfg[activeTool].softness);
    saveToolCfg(); updatePresetStates();
  });
  if (tsColor) tsColor.addEventListener('input', () => {
    if (activeTool !== 'marker') return;
    toolCfg.marker.color = tsColor.value;
    saveToolCfg();
  });
  if (tsColorAuto) tsColorAuto.addEventListener('click', () => {
    if (activeTool !== 'marker') return;
    toolCfg.marker.color = null;
    saveToolCfg(); syncToolInputs();
  });

  /* ---------- Translation UI ---------- */
  if (translateBtn) {
    translateBtn.addEventListener('mousedown', (e) => e.preventDefault());
    translateBtn.addEventListener('click', () => {
      if (!isMain()) return;
      if (translatePane && translatePane.hidden) openTranslatePane();
      else closeTranslatePane();
    });
  }
  if (trClose) trClose.addEventListener('click', closeTranslatePane);

  if (trDo) trDo.addEventListener('click', async () => {
    if (!translateSourceText.trim()) {
      if (trStatus) trStatus.textContent = t('tr.nothing');
      return;
    }
    trDo.disabled = true;
    if (trStatus) trStatus.textContent = t('tr.working');
    try {
      const text = await translateText(translateSourceText, trTarget ? trTarget.value : 'ru');
      if (trOut) trOut.value = text;
      if (trStatus) trStatus.textContent = t('tr.done');
    } catch (err) {
      if (trStatus) trStatus.textContent = String((err && err.message) || t('tr.err'));
    } finally {
      trDo.disabled = false;
    }
  });

  if (trReplace) trReplace.addEventListener('click', () => {
    if (!trOut || !trOut.value) return;
    if (translateMode !== 'selection') {
      if (trStatus) trStatus.textContent = t('tr.selectToReplace');
      return;
    }
    if (replaceSavedSelectionWithText(trOut.value)) {
      if (trStatus) trStatus.textContent = t('tr.replaced');
      queueSave();
      updateToolbarState();
    } else if (trStatus) {
      trStatus.textContent = t('tr.selectFirst');
    }
  });

  if (trInsert) trInsert.addEventListener('click', () => {
    if (!trOut || !trOut.value) return;
    if (translateMode === 'selection' && savedRange) {
      if (insertSavedSelectionText(trOut.value)) {
        if (trStatus) trStatus.textContent = t('tr.insertedAfter');
        queueSave();
      } else if (trStatus) {
        trStatus.textContent = t('tr.cantInsert');
      }
    } else {
      const frag = makeTextFragment(trOut.value);
      if (editor.firstChild) editor.appendChild(document.createElement('br'));
      editor.appendChild(frag);
      if (trStatus) trStatus.textContent = t('tr.insertedEnd');
      queueSave();
    }
  });

  if (trCopy) trCopy.addEventListener('click', async () => {
    if (!trOut || !trOut.value) return;
    const ok = await copyToClipboard(trOut.value);
    if (trStatus) trStatus.textContent = ok ? t('tr.copied') : t('tr.copyFail');
  });

  /* ---------- Drawing ---------- */
  function pointsToD(points) {
    if (!points.length) return '';
    const p0 = points[0];
    if (points.length === 1) return 'M ' + num(p0.x) + ' ' + num(p0.y) + ' l 0.01 0';
    let d = 'M ' + num(p0.x) + ' ' + num(p0.y);
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      d += ' Q ' + num(p.x) + ' ' + num(p.y) + ' ' + num((p.x + n.x) / 2) + ' ' + num((p.y + n.y) / 2);
    }
    const last = points[points.length - 1];
    d += ' L ' + num(last.x) + ' ' + num(last.y);
    return d;
  }
  function cleanupDrawingListeners() {
    window.removeEventListener('pointermove', onDrawMove);
    window.removeEventListener('pointerup', onDrawUp);
    window.removeEventListener('pointercancel', onDrawUp);
  }
  function cancelDrawing() {
    if (!drawing) return;
    if (drawing.path) drawing.path.remove();
    drawing = null;
    cleanupDrawingListeners();
  }
  function finishDrawing() {
    if (!drawing) return;
    if (drawing.tool === 'marker' && drawing.path) {
      if (drawing.points.length === 1) {
        const p = drawing.points[0];
        drawing.path.setAttribute('d', 'M ' + num(p.x) + ' ' + num(p.y) + ' l 0.01 0');
      }
      drawing.path.dataset.pts = JSON.stringify(drawing.points.map(p => ({ x: num(p.x), y: num(p.y) })));
      drawing.path.dataset.bbox = JSON.stringify(computeBBox(drawing.points));
    }
    const removed = drawing.removed || 0;
    const wasMarker = drawing.tool === 'marker';
    drawing = null;
    cleanupDrawingListeners();
    if (removed || wasMarker) queueSave();
  }
  function editorPoint(e) {
    const rect = editor.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      inside: e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
    };
  }
  function onDrawMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const pt = editorPoint(e);
    if (drawing.tool === 'marker') {
      const last = drawing.points[drawing.points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1) return;
      drawing.points.push({ x: pt.x, y: pt.y });
      drawing.path.setAttribute('d', pointsToD(drawing.points));
    } else {
      drawing.removed = (drawing.removed || 0) + hitEraser(pt.x, pt.y);
      positionEraserCursor(pt.x, pt.y, pt.inside);
    }
  }
  function onDrawUp() { finishDrawing(); }
  function startDrawing(e) {
    if (!activeTool || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = editorPoint(e);
    if (activeTool === 'eraser') {
      const removed = hitEraser(pt.x, pt.y);
      positionEraserCursor(pt.x, pt.y, pt.inside);
      drawing = { tool: 'eraser', removed };
      cleanupDrawingListeners();
      window.addEventListener('pointermove', onDrawMove);
      window.addEventListener('pointerup', onDrawUp);
      window.addEventListener('pointercancel', onDrawUp);
      return;
    }
    const st = getMarkerStyle();
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', st.color);
    path.setAttribute('stroke-width', String(st.size));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    if (st.opacity < 1) path.setAttribute('opacity', String(st.opacity));
    if (st.softness > 0) path.style.filter = 'blur(' + st.softness + 'px)';
    path.setAttribute('d', 'M ' + num(pt.x) + ' ' + num(pt.y) + ' l 0.01 0');
    drawStrokesGroup().appendChild(path);
    drawing = { tool: 'marker', path, points: [{ x: pt.x, y: pt.y }] };
    cleanupDrawingListeners();
    window.addEventListener('pointermove', onDrawMove);
    window.addEventListener('pointerup', onDrawUp);
    window.addEventListener('pointercancel', onDrawUp);
  }
  if (drawLayer) {
    drawLayer.addEventListener('pointerdown', startDrawing);
    drawLayer.addEventListener('pointermove', (e) => {
      if (activeTool !== 'eraser' || drawing) return;
      const pt = editorPoint(e);
      positionEraserCursor(pt.x, pt.y, pt.inside);
    });
    drawLayer.addEventListener('pointerleave', () => { if (!drawing) hideEraserCursor(); });
    drawLayer.addEventListener('wheel', (e) => {
      if (!activeTool || !editorScroll) return;
      e.preventDefault();
      editorScroll.scrollTop += e.deltaY;
    }, { passive: false });
  }

  document.addEventListener('pointerdown', (e) => {
    if (activeTool && !e.target.closest('.editor-pane') && !e.target.closest('#markerBtn') &&
        !e.target.closest('#eraserBtn') && !e.target.closest('.tool-presets') && !e.target.closest('.tool-settings')) {
      setTool(null);
    }
    if (isPlacing()) {
      if (e.target.closest('#btnAddImg')) return;
      if (editorPane && !editorPane.contains(e.target)) cancelPlacing();
      return;
    }
    if (activePhoto && !e.target.closest('.photo')) deselectPhoto();
  }, true);

  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (mod && (k === 's' || k === 'S' || k === 'ы' || k === 'Ы')) {
      e.preventDefault();
      manualSave();
      return;
    }
    if (mod && (k === 'n' || k === 'N')) {
      e.preventDefault();
      if (isMain()) newNote();
      return;
    }
    if (mod && (k === 'f' || k === 'F')) {
      if (!isMain()) return;
      e.preventDefault();
      if (!listOpen) setListOpen(true);
      if (searchEl) { searchEl.focus(); searchEl.select(); }
      return;
    }
    if (mod && (k === 'z' || k === 'Z' || k === 'y' || k === 'Y')) {
      if (activeTool || !isMain()) return;
      if (document.activeElement !== editor) editor.focus();
      return;
    }
    if (k === 'Escape') {
      if (drawing) { cancelDrawing(); queueSave(); return; }
      if (isPlacing()) { cancelPlacing(); return; }
      if (activeTool) { setTool(null); return; }
      if (translatePane && !translatePane.hidden) { closeTranslatePane(); return; }
      if (compact && listOpen) { setListOpen(false); return; }
      if (compact && infoOpen) { setInfoOpen(false); return; }
      if (currentView === 'settings' || currentView === 'security') { setView('main'); return; }
    }
    if ((k === 'Delete' || k === 'Backspace') && activePhoto) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      if (e.target && e.target.isContentEditable) return;
      e.preventDefault();
      const el = activePhoto;
      activePhoto = null;
      el.remove();
      queueSave();
      return;
    }
    if (activeTool && !activePhoto && (k === 'Delete' || k === 'Backspace')) {
      const tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      if (e.target && e.target.isContentEditable) return;
      e.preventDefault();
      const group = drawStrokesGroup();
      const paths = group ? group.querySelectorAll('path') : [];
      if (paths.length) { paths[paths.length - 1].remove(); queueSave(); }
    }
  });

  /* ---------- Reflow ---------- */
  function reflowPulse() {
    updateDrawLayerBox();
    if (reduceMotion || !isMain()) { measureLayout(); return; }
    if (!reflowOn) {
      reflowOn = true;
      winEl.classList.add('reflowing');
    }
    clearTimeout(reflowTimer);
    reflowTimer = setTimeout(endReflow, 140);
  }

  function endReflow() {
    clearTimeout(reflowTimer);
    reflowTimer = null;
    if (reflowOn) {
      reflowOn = false;
      winEl.classList.remove('reflowing');
    }
    requestAnimationFrame(() => { updateDrawLayerBox(); measureLayout(); });
  }

  function checkReflow() {
    updateDrawLayerBox();
    if (!editor) return;
    const w = editor.clientWidth;
    if (lastEdWidth && Math.abs(w - lastEdWidth) >= 1) reflowPulse();
    lastEdWidth = w;
  }

  if (window.ResizeObserver && editor) {
    const ro = new ResizeObserver(() => checkReflow());
    ro.observe(editor);
  }

  window.addEventListener('resize', () => {
    syncMode();
    checkReflow();
  });

  function updateDrawLayerBox() {
    if (!drawLayer || !editor || !editorPane) return;
    if (!isMain()) return;
    drawLayer.style.left = editor.offsetLeft + 'px';
    drawLayer.style.top = editor.offsetTop + 'px';
    drawLayer.style.width = editor.offsetWidth + 'px';
    drawLayer.style.height = editor.offsetHeight + 'px';
  }

  /* ---------- App start ---------- */
  async function startApp() {
    notes = await window.fidji.loadNotes();
    if (!Array.isArray(notes)) notes = [];
    notes.forEach(n => {
      if (!n.id) n.id = uid();
      if (!n.createdAt) n.createdAt = n.updatedAt || Date.now();
      if (!n.updatedAt) n.updatedAt = n.createdAt;
      if (typeof n.draw !== 'string') n.draw = '';
      if (typeof n.html !== 'string') n.html = '';
      if (typeof n.title !== 'string') n.title = '';
    });

    setView('main');
    applyPanels();
    renderList();

    if (notes.length) await openNote(notes[0].id);
    else await newNote();

    requestAnimationFrame(() => { lastEdWidth = editor.clientWidth; measureLayout(); });
  }

  /* ---------- Lock ---------- */
  function showLock() {
    setView('lock');
    const input = $('#lockInput');
    input.value = '';
    $('#lockError').textContent = '';
    setTimeout(() => input.focus(), 50);
  }
  $('#lockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await window.fidji.auth.verify($('#lockInput').value);
    if (ok) startApp();
    else {
      $('#lockError').textContent = t('lock.err');
      const card = $('#lockForm');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      $('#lockInput').select();
    }
  });

  /* ---------- Setup ---------- */
  function showSetup() {
    setView('setup');
    $('#setupChoose').hidden = false;
    $('#setupForm').hidden = true;
    $('#obError').textContent = '';
    $('#obPw1').value = '';
    $('#obPw2').value = '';
  }
  $('#obSet').addEventListener('click', () => {
    $('#setupChoose').hidden = true;
    $('#setupForm').hidden = false;
    $('#obPw1').focus();
  });
  $('#obBack').addEventListener('click', showSetup);
  $('#obSkip').addEventListener('click', async () => {
    await window.fidji.auth.skipSetup();
    startApp();
  });
  $('#setupForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('#obPw1').value;
    const p2 = $('#obPw2').value;
    if (!p1) { $('#obError').textContent = t('err.empty'); return; }
    if (p1 !== p2) { $('#obError').textContent = t('err.match'); return; }
    await window.fidji.auth.setPassword(p1);
    startApp();
  });

  /* ---------- Security ---------- */
  let secRemoveArmed = false;
  let secRemoveTimer = null;
  let secHasPassword = false;

  function resetSecRemove() {
    secRemoveArmed = false;
    clearTimeout(secRemoveTimer);
    $('#secRemove').textContent = t('sec.remove');
  }
  function refreshSecurityTexts() {
    $('#secDesc').textContent = secHasPassword ? t('sec.descSet') : t('sec.descNone');
    $('#secSave').textContent = secHasPassword ? t('sec.change') : t('setup.save');
    $('#secRemove').style.display = secHasPassword ? '' : 'none';
    if (!secRemoveArmed) $('#secRemove').textContent = t('sec.remove');
  }
  async function showSecurity() {
    const st = await window.fidji.auth.getStatus();
    secHasPassword = !!st.hasPassword;
    refreshSecurityTexts();
    $('#secPw1').value = '';
    $('#secPw2').value = '';
    $('#secError').textContent = '';
    resetSecRemove();
    setView('security');
    $('#secPw1').focus();
  }
  $('#securityBtn').addEventListener('click', () => { if (isMain()) { flushCurrentNote(); showSecurity(); } });
  $('#secClose').addEventListener('click', () => setView('main'));
  $('#secForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = $('#secPw1').value;
    const p2 = $('#secPw2').value;
    if (!p1) { $('#secError').textContent = t('err.empty'); return; }
    if (p1 !== p2) { $('#secError').textContent = t('err.match'); return; }
    await window.fidji.auth.setPassword(p1);
    setView('main');
  });
  $('#secRemove').addEventListener('click', async () => {
    if (!secRemoveArmed) {
      secRemoveArmed = true;
      $('#secRemove').textContent = t('sec.confirm');
      secRemoveTimer = setTimeout(resetSecRemove, 3000);
      return;
    }
    await window.fidji.auth.removePassword();
    resetSecRemove();
    setView('main');
  });

  /* ---------- Settings ---------- */
  const settingsBtn = $('#settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    if (!isMain()) return;
    flushCurrentNote();
    setView('settings');
  });
  const settingsClose = $('#settingsClose');
  if (settingsClose) settingsClose.addEventListener('click', () => setView('main'));
  $$('#langRow .lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      lang = btn.getAttribute('data-lang') === 'ru' ? 'ru' : 'en';
      try { localStorage.setItem('fidji-lang', lang); } catch {}
      applyI18n();
    });
  });

  /* ---------- Save button & safety flush ---------- */
  if (saveBtn) {
    saveBtn.addEventListener('mousedown', (e) => e.preventDefault());
    saveBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); manualSave(); });
  }
  window.addEventListener('blur', () => { if (isMain() && dirty) flushCurrentNote(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && isMain() && dirty) flushCurrentNote(); });
  window.addEventListener('beforeunload', () => {
    if (!currentId) return;
    syncNoteFromEditor();
    try { window.fidji.saveNotes(notes); } catch {}
  });

  const newNoteBtn = $('#newNote');
  if (newNoteBtn) newNoteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMain()) newNote();
  });

  /* ---------- Init ---------- */
  (async function init() {
    initTheme();
    normalizeDrawSvg();
    applyLayerInteractivity();
    applyI18n();
    setSaveState('', '');
    await initImagesBase();

    const st = await window.fidji.auth.getStatus();
    if (st && st.hasPassword) showLock();
    else if (st && st.firstRun) showSetup();
    else await startApp();
  })();
})();