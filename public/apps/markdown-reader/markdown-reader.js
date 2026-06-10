/**
 * markdown-reader — 頁面控制器（glue）
 *
 * 從 index.html 內嵌 <script> 拉出：主題切換、i18n、文體格式化 toggle、
 * 列印、zero-md 渲染、開檔 / 清單 / 上傳 / 拖拉等 DOM 行為。
 * 與伺服器溝通、下載、檔名工具在 markdown-reader-lib.js。
 *
 * 依賴（皆於 index.html 先載入）：jQuery / Materialize / Lodash / zero-md / MarkdownReaderLib。
 * 註：內嵌的 I18N 字典暫隨控制器一併拉出；日後依 Guidelines §6 收斂為 i18n.js + locales/*.js。
 */

(function () {
  'use strict';

  var L = window.MarkdownReaderLib;

  // 佛典文體格式化器（/lib/adp-col/mdFormater.js）：預設一律套用。
  // 以動態 import() 載入（classic script 亦支援）；載不到就維持原文，不影響閱讀。
  var formatMd = function (t) { return t; };
  var formatterReady = import('/lib/adp-col/mdFormater.js')
    .then(function (mod) {
      var fmt = new mod.MdFormater();
      formatMd = function (t) {
        try { return fmt.format(t); }
        catch (e) { console.error('MdFormater.format 失敗，改用原文：', e); return t; }
      };
    })
    .catch(function (e) { console.warn('MdFormater 載入失敗，改用原文：', e); });

  // zero-md 主題樣式表（light / dark）
  var THEME = {
    dark: {
      md: 'https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-dark.css',
      hl: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css'
    },
    light: {
      md: 'https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-light.css',
      hl: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css'
    }
  };
  var THEME_KEY = 'markdown-reader-theme';
  var FORMAT_KEY = 'markdown-reader-format';
  var LANG_KEY = 'markdown-reader-lang';

  // ===== i18n：英文為主，支援 en / zh-Hant / ja =====
  var I18N = {
    en: {
      htmlLang: 'en',
      titleSuffix: 'Markdown Reader',
      langName: 'English',
      emptyTitle: 'Drag a Markdown file anywhere on the page',
      emptyHintHtml: 'Files are uploaded to <code>/upload/markdown-reader</code> (same name overwrites);<br />or <u>click to choose a file</u>. Supports <code>.md</code> / <code>.markdown</code> / <code>.txt</code>, etc.',
      dropText: 'Release to upload to /upload/markdown-reader',
      sideHeader: 'Files',
      noFiles: 'No files yet — drag to upload',
      tMenu: 'File list',
      tMode: 'Toggle light / dark',
      tLang: 'Language',
      tFormatOn: 'Text formatting: on (click to show raw)',
      tFormatOff: 'Text formatting: off (click to format)',
      tOrientation: 'Print orientation: portrait / landscape',
      tPrint: 'Print',
      tDownload: 'Download current Markdown',
      tClearPage: 'Clear page content (keeps files)',
      tClear: 'Empty /upload/markdown-reader',
      portrait: 'portrait',
      landscape: 'landscape',
      orientationToast: function (o) { return 'Print orientation: ' + o; },
      formatOn: 'Text formatting enabled',
      formatOff: 'Text formatting disabled (showing raw)',
      uploaded: function (n) { return 'Uploaded: ' + n; },
      uploadFail: function (n, m) { return 'Upload failed: ' + n + ' (' + m + ')'; },
      notReadable: 'Please drop markdown / text files (.md / .txt …)',
      downloaded: function (n) { return 'Downloaded: ' + n; },
      noOpenFile: 'No file is currently open',
      pageCleared: 'Page content cleared',
      cleared: function (n) { return 'Cleared ' + n + ' file(s)'; },
      clearFail: function (m) { return 'Clear failed: ' + m; },
      confirmClear: 'Empty all files in /upload/markdown-reader? This cannot be undone.',
      listFail: function (m) { return 'Failed to load file list: ' + m; },
      loading: function (n) { return '# Loading…\n\nLoading **' + n + '**'; },
      loadFail: function (n, e) { return '# Load failed\n\n- file: `' + n + '`\n- error: `' + e + '`'; }
    },
    'zh-Hant': {
      htmlLang: 'zh-Hant',
      titleSuffix: 'Markdown Reader',
      langName: '繁體中文',
      emptyTitle: '拖拉 Markdown 檔到頁面任意位置',
      emptyHintHtml: '檔案會上傳到 <code>/upload/markdown-reader</code>，同名直接覆寫；<br />或<u>點此選擇檔案</u>。支援 <code>.md</code> / <code>.markdown</code> / <code>.txt</code> 等。',
      dropText: '放開以上傳到 /upload/markdown-reader',
      sideHeader: '檔案清單',
      noFiles: '尚無檔案，拖拉上傳吧',
      tMenu: '檔案清單',
      tMode: '切換 light / dark',
      tLang: '語言',
      tFormatOn: '文體格式化：開（點擊關閉，顯示原文）',
      tFormatOff: '文體格式化：關（點擊開啟）',
      tOrientation: '列印方向：直向 / 橫向',
      tPrint: '列印',
      tDownload: '下載目前的 Markdown',
      tClearPage: '清除頁面內容（不刪除檔案）',
      tClear: '清空 /upload/markdown-reader',
      portrait: '直向',
      landscape: '橫向',
      orientationToast: function (o) { return '列印方向：' + o; },
      formatOn: '已開啟文體格式化',
      formatOff: '已關閉文體格式化（顯示原文）',
      uploaded: function (n) { return '已上傳：' + n; },
      uploadFail: function (n, m) { return '上傳失敗：' + n + '（' + m + '）'; },
      notReadable: '請拖入 markdown / 文字檔（.md / .txt …）',
      downloaded: function (n) { return '已下載：' + n; },
      noOpenFile: '目前沒有開啟的檔案',
      pageCleared: '已清除頁面內容',
      cleared: function (n) { return '已清空 ' + n + ' 個檔案'; },
      clearFail: function (m) { return '清空失敗：' + m; },
      confirmClear: '確定要清空 /upload/markdown-reader 下的所有檔案嗎？此動作無法復原。',
      listFail: function (m) { return '讀取檔案清單失敗：' + m; },
      loading: function (n) { return '# Loading…\n\n正在載入 **' + n + '**'; },
      loadFail: function (n, e) { return '# 載入失敗\n\n- 檔案：`' + n + '`\n- 錯誤：`' + e + '`'; }
    },
    ja: {
      htmlLang: 'ja',
      titleSuffix: 'Markdown Reader',
      langName: '日本語',
      emptyTitle: 'Markdown ファイルをページにドラッグ',
      emptyHintHtml: 'ファイルは <code>/upload/markdown-reader</code> にアップロードされます（同名は上書き）。<br /><u>クリックして選択</u>。<code>.md</code> / <code>.markdown</code> / <code>.txt</code> などに対応。',
      dropText: 'ドロップして /upload/markdown-reader にアップロード',
      sideHeader: 'ファイル一覧',
      noFiles: 'ファイルがありません — ドラッグでアップロード',
      tMenu: 'ファイル一覧',
      tMode: 'ライト / ダーク切替',
      tLang: '言語',
      tFormatOn: '文体整形：オン（クリックで原文表示）',
      tFormatOff: '文体整形：オフ（クリックで整形）',
      tOrientation: '印刷方向：縦 / 横',
      tPrint: '印刷',
      tDownload: '現在の Markdown をダウンロード',
      tClearPage: '表示をクリア（ファイルは保持）',
      tClear: '/upload/markdown-reader を空にする',
      portrait: '縦',
      landscape: '横',
      orientationToast: function (o) { return '印刷方向：' + o; },
      formatOn: '文体整形を有効化',
      formatOff: '文体整形を無効化（原文表示）',
      uploaded: function (n) { return 'アップロード：' + n; },
      uploadFail: function (n, m) { return 'アップロード失敗：' + n + '（' + m + '）'; },
      notReadable: 'markdown / テキストファイルをドロップしてください（.md / .txt …）',
      downloaded: function (n) { return 'ダウンロード：' + n; },
      noOpenFile: '開いているファイルがありません',
      pageCleared: '表示をクリアしました',
      cleared: function (n) { return n + ' 件のファイルを削除しました'; },
      clearFail: function (m) { return '消去に失敗：' + m; },
      confirmClear: '/upload/markdown-reader 内のすべてのファイルを削除しますか？元に戻せません。',
      listFail: function (m) { return 'ファイル一覧の取得に失敗：' + m; },
      loading: function (n) { return '# Loading…\n\n**' + n + '** を読み込み中'; },
      loadFail: function (n, e) { return '# 読み込み失敗\n\n- ファイル：`' + n + '`\n- エラー：`' + e + '`'; }
    }
  };
  var LANG_ORDER = ['en', 'zh-Hant', 'ja'];
  var dict = I18N.en;

  var viewer = document.getElementById('viewer');
  var mdSlot = document.getElementById('md-slot');
  var sideNav = document.getElementById('side-nav');
  var emptyState = document.getElementById('empty-state');
  var dropOverlay = document.getElementById('drop-overlay');
  var filePicker = document.getElementById('file-picker');

  var state = {
    theme: 'dark',
    format: true,    // 佛典文體格式化開關（側邊 toggle）
    lang: 'en',      // 介面語系（en / zh-Hant / ja，預設 en）
    orientation: 'portrait',
    current: null,   // 目前開啟的檔名
    text: '',        // 目前檔案原文
    files: []
  };

  /* ---------- 主題（light / dark） ---------- */

  function setZeroMdTheme(theme) {
    // 同步 template（供下次 render 時 clone）
    var tpl = viewer.querySelector('template');
    if (tpl && tpl.content) {
      var tmd = tpl.content.getElementById('md-md-css');
      var thl = tpl.content.getElementById('md-hl-css');
      if (tmd) tmd.href = THEME[theme].md;
      if (thl) thl.href = THEME[theme].hl;
    }
    // 同步 live shadow root（即時生效，不需重新 render）
    var sr = viewer.shadowRoot;
    if (sr) {
      var smd = sr.getElementById('md-md-css');
      var shl = sr.getElementById('md-hl-css');
      if (smd) smd.href = THEME[theme].md;
      if (shl) shl.href = THEME[theme].hl;
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    setZeroMdTheme(theme);
    var icon = document.querySelector('#setting-mode i');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  /* ---------- 語系（i18n：en / zh-Hant / ja，預設 en） ---------- */

  function applyI18n() {
    var d = dict, el;
    document.documentElement.setAttribute('lang', d.htmlLang);
    if ((el = document.getElementById('empty-title'))) el.textContent = d.emptyTitle;
    if ((el = document.getElementById('empty-hint'))) el.innerHTML = d.emptyHintHtml;
    if ((el = document.getElementById('drop-text'))) el.textContent = d.dropText;
    if ((el = document.getElementById('side-header-label'))) el.textContent = d.sideHeader;
    [['setting-menu', d.tMenu], ['setting-mode', d.tMode], ['setting-lang', d.tLang],
     ['setting-orientation', d.tOrientation], ['setting-print', d.tPrint],
     ['setting-download', d.tDownload], ['setting-clear-page', d.tClearPage],
     ['setting-clear', d.tClear]].forEach(function (p) {
      var e = document.getElementById(p[0]); if (e) e.title = p[1];
    });
    updateFormatIcon();
    renderSideNav(state.files);
    if (state.current) markActive(state.current);
    document.title = state.current ? (state.current + ' | ' + d.titleSuffix) : d.titleSuffix;
  }

  function applyLang(lang) {
    if (!I18N[lang]) lang = 'en';
    state.lang = lang;
    dict = I18N[lang];
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    applyI18n();
  }

  function cycleLang() {
    var i = LANG_ORDER.indexOf(state.lang);
    applyLang(LANG_ORDER[(i + 1) % LANG_ORDER.length]);
    M.toast({ html: dict.langName });
  }

  /* ---------- 文體格式化（MdFormater）開關 ---------- */

  function updateFormatIcon() {
    var el = document.getElementById('setting-format');
    if (!el) return;
    el.classList.toggle('active', state.format);
    el.title = state.format ? dict.tFormatOn : dict.tFormatOff;
  }

  function toggleFormat() {
    state.format = !state.format;
    try { localStorage.setItem(FORMAT_KEY, state.format ? '1' : '0'); } catch (e) {}
    updateFormatIcon();
    M.toast({ html: state.format ? dict.formatOn : dict.formatOff });
    if (state.current) renderCurrentContent();
  }

  /* ---------- 列印（方向 / 頁尾） ---------- */

  function setPrintOptions() {
    var styleEl = document.getElementById('print-runtime-style');
    var name = (state.current || 'markdown').replace(/"/g, '\\"');
    styleEl.textContent =
      '@media print {' +
      '  @page {' +
      '    size: A4 ' + state.orientation + ';' +
      '    margin: 14mm;' +
      '    @bottom-left { content: "〔 ' + name + ' 〕"; font-size: 10pt; color: #666; }' +
      '    @bottom-right { content: counter(page) " / " counter(pages); font-size: 10pt; color: #900; }' +
      '  }' +
      '}';
  }

  function toggleOrientation() {
    state.orientation = state.orientation === 'portrait' ? 'landscape' : 'portrait';
    var icon = document.querySelector('#setting-orientation i');
    if (icon) icon.textContent = state.orientation === 'portrait' ? 'crop_portrait' : 'crop_landscape';
    setPrintOptions();
    M.toast({ html: dict.orientationToast(state.orientation === 'portrait' ? dict.portrait : dict.landscape) });
  }

  /* ---------- zero-md 渲染 ---------- */

  function whenZeroMdReady(el) {
    if (el && el.ready) return Promise.resolve();
    return new Promise(function (resolve) {
      customElements.whenDefined('zero-md').then(function () {
        if (el.ready) return resolve();
        el.addEventListener('zero-md-ready', function () { resolve(); }, { once: true });
      });
    });
  }

  function renderText(text) {
    return whenZeroMdReady(viewer).then(function () {
      setZeroMdTheme(state.theme);
      // 相對路徑圖片以上傳資料夾為基準
      viewer.setAttribute('marked-base-url', '/upload/' + L.FOLDER + '/');
      mdSlot.textContent = text || '';
      return viewer.render();
    }).then(function () {
      setZeroMdTheme(state.theme);
    });
  }

  function showViewer(show) {
    viewer.style.display = show ? '' : 'none';
    emptyState.style.display = show ? 'none' : '';
    document.body.classList.toggle('is-empty', !show);
  }

  // 依目前的格式化開關，重新渲染 state.text（原文）
  function renderCurrentContent() {
    if (state.format) {
      return formatterReady.then(function () { return renderText(formatMd(state.text)); });
    }
    return renderText(state.text);
  }

  /* ---------- 開檔 / 檔案清單 ---------- */

  function openFile(name) {
    if (!name) return Promise.resolve();
    state.current = name;
    document.title = name + ' | ' + dict.titleSuffix;
    setPrintOptions();
    markActive(name);
    showViewer(true);
    return renderText(dict.loading(name))
      .then(function () { return L.fetchText(name); })
      .then(function (text) {
        state.text = text; // 保留原文（下載用原始檔，不含格式化）
        return renderCurrentContent();
      })
      .catch(function (err) {
        state.text = '';
        return renderText(dict.loadFail(name, String(err)));
      });
  }

  function markActive(name) {
    $('#side-nav li').removeClass('active');
    $('#side-nav li[data-name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]').addClass('active');
  }

  function renderSideNav(files) {
    if (!files.length) {
      sideNav.innerHTML = '<li><a style="color:var(--muted)!important;">' + dict.noFiles + '</a></li>';
      return;
    }
    sideNav.innerHTML = files.map(function (f) {
      return '<li data-name="' + _.escape(f.name) + '">' +
        '<a href="#!" class="file-item" data-name="' + _.escape(f.name) + '">' +
        '<i class="material-icons">description</i>' +
        '<span style="flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _.escape(f.name) + '</span>' +
        '<span class="file-meta">' + L.formatSize(f.size) + '</span>' +
        '</a></li>';
    }).join('');
  }

  function refreshFiles(selectName) {
    return L.listFiles().then(function (files) {
      state.files = files;
      renderSideNav(files);
      if (!files.length) {
        state.current = null;
        state.text = '';
        showViewer(false);
        document.title = dict.titleSuffix;
        return;
      }
      var has = function (n) { return files.some(function (f) { return f.name === n; }); };
      var pick = (selectName && has(selectName)) ? selectName
        : (state.current && has(state.current)) ? state.current
          : files[0].name;
      return openFile(pick);
    }).catch(function (err) {
      M.toast({ html: dict.listFail(err.message), classes: 'red' });
    });
  }

  /* ---------- 上傳 ---------- */

  function uploadFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList).filter(function (f) { return L.isReadable(f.name); });
    if (!arr.length) {
      M.toast({ html: dict.notReadable, classes: 'orange' });
      return;
    }
    var lastName = null;
    var chain = Promise.resolve();
    arr.forEach(function (file) {
      chain = chain.then(function () {
        return L.uploadFile(file).then(function () {
          lastName = file.name;
          M.toast({ html: dict.uploaded(file.name), classes: 'green' });
        }).catch(function (err) {
          M.toast({ html: dict.uploadFail(file.name, err.message), classes: 'red' });
        });
      });
    });
    chain.then(function () { return refreshFiles(lastName); });
  }

  /* ---------- 下載 / 清空 ---------- */

  function downloadCurrent() {
    if (!state.current) {
      M.toast({ html: dict.noOpenFile, classes: 'orange' });
      return;
    }
    var text = state.text != null ? state.text : '';
    L.downloadText(state.current, text);
    M.toast({ html: dict.downloaded(state.current), classes: 'teal' });
  }

  // 清除頁面上目前顯示的內容（回到初始空狀態），但不刪除伺服器上的檔案
  function clearPage() {
    state.current = null;
    state.text = '';
    mdSlot.textContent = '';
    $('#side-nav li').removeClass('active');
    document.title = 'Markdown Reader';
    showViewer(false);
    M.toast({ html: dict.pageCleared, classes: 'grey' });
  }

  function clearFolder() {
    if (!confirm(dict.confirmClear)) return;
    L.clearFolder().then(function (d) {
      M.toast({ html: dict.cleared(d.removed || 0), classes: 'teal' });
      state.current = null;
      return refreshFiles();
    }).catch(function (err) {
      M.toast({ html: dict.clearFail(err.message), classes: 'red' });
    });
  }

  /* ---------- 全頁拖拉 ---------- */

  function hasFiles(e) {
    var dt = e.dataTransfer;
    if (!dt) return false;
    if (dt.types) {
      for (var i = 0; i < dt.types.length; i++) {
        if (dt.types[i] === 'Files') return true;
      }
    }
    return false;
  }

  function bindDragDrop() {
    var depth = 0;
    window.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      dropOverlay.classList.add('show');
    });
    window.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    window.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return;
      depth--;
      if (depth <= 0) { depth = 0; dropOverlay.classList.remove('show'); }
    });
    window.addEventListener('drop', function (e) {
      e.preventDefault();
      depth = 0;
      dropOverlay.classList.remove('show');
      var dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length) uploadFiles(dt.files);
    });
  }

  /* ---------- 事件繫結 ---------- */

  function bindEvents() {
    // 側欄檔案點擊
    $(document).on('click', '#side-nav a.file-item', function (e) {
      e.preventDefault();
      var name = $(this).data('name');
      openFile(String(name));
      var inst = M.Sidenav.getInstance(document.getElementById('slide-out'));
      if (inst && inst.isOpen) inst.close();
    });

    // 空狀態 / 檔案選擇器
    emptyState.addEventListener('click', function () { filePicker.click(); });
    filePicker.addEventListener('change', function (e) {
      if (e.target.files && e.target.files.length) uploadFiles(e.target.files);
      filePicker.value = '';
    });

    // 右側工具列
    document.getElementById('setting-menu').addEventListener('click', function () {
      var inst = M.Sidenav.getInstance(document.getElementById('slide-out'));
      if (inst) inst.open();
    });
    document.getElementById('setting-mode').addEventListener('click', toggleTheme);
    document.getElementById('setting-lang').addEventListener('click', cycleLang);
    document.getElementById('setting-format').addEventListener('click', toggleFormat);
    document.getElementById('setting-orientation').addEventListener('click', toggleOrientation);
    document.getElementById('setting-print').addEventListener('click', function () { window.print(); });
    document.getElementById('setting-download').addEventListener('click', downloadCurrent);
    document.getElementById('setting-clear-page').addEventListener('click', clearPage);
    document.getElementById('setting-clear').addEventListener('click', clearFolder);

    // 列印前後切換 zero-md 主題為淺色（列印一律白底黑字），列印後還原
    window.addEventListener('beforeprint', function () { setZeroMdTheme('light'); });
    window.addEventListener('afterprint', function () { setZeroMdTheme(state.theme); });
  }

  /* ---------- 初始化 ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    M.Sidenav.init(document.querySelectorAll('.sidenav'), {
      edge: 'right',
      // 開啟 file-list 時隱藏 side tools；完全收起後再讓它們出現
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });

    var saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
    applyTheme(saved === 'light' ? 'light' : 'dark');

    try { state.format = localStorage.getItem(FORMAT_KEY) !== '0'; } catch (e) { state.format = true; }

    var savedLang = 'en';
    try { savedLang = localStorage.getItem(LANG_KEY) || 'en'; } catch (e) {}
    applyLang(savedLang);   // 設定 dict 並套用所有靜態文字 / 標題（含 updateFormatIcon）

    setPrintOptions();
    bindEvents();
    bindDragDrop();
    refreshFiles();
  });
})();
