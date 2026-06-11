/**
 * markdown-reader — 頁面控制器（glue）
 *
 * DOM 行為：主題切換、i18n（透過 I18n 引擎）、文體格式化 toggle、列印、
 * zero-md 渲染、開檔 / 清單 / 上傳 / 拖拉。
 * 與伺服器溝通、下載、檔名工具在 markdown-reader-lib.js；
 * i18n 引擎在 i18n.js，語言字典在 locales/<code>.js。
 *
 * 依賴（皆於 index.html 先載入）：jQuery / Materialize / Lodash / zero-md /
 * MarkdownReaderLib / I18n（+ locales）。
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
  // 語系由 I18n 引擎管理（localStorage 'lang'，預設 zh-Hant），不再自行保存。

  var viewer = document.getElementById('viewer');
  var mdSlot = document.getElementById('md-slot');
  var sideNav = document.getElementById('side-nav');
  var emptyState = document.getElementById('empty-state');
  var dropOverlay = document.getElementById('drop-overlay');
  var filePicker = document.getElementById('file-picker');

  var state = {
    theme: 'dark',
    format: false,   // 佛典文體格式化開關（側邊 toggle）；預設關閉＝顯示原文
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

  /* ---------- 語系（i18n：透過 I18n 引擎，預設 zh-Hant，支援 zh-Hant / en / ja） ---------- */

  // 語言切換後，重繪由 JS 產生的動態內容（靜態文字 / 標題由 I18n.apply 處理）
  function onLangChanged() {
    updateFormatIcon();              // 格式化按鈕 title 依 state.format + 語系
    renderSideNav(state.files);      // 「尚無檔案」訊息
    if (state.current) markActive(state.current);
    document.title = state.current
      ? (state.current + ' | ' + I18n.t('title.suffix'))
      : I18n.t('title.suffix');
  }

  // 點 #setting-lang：依註冊順序循環切換；I18n.set 會 persist 並派發 i18n:changed
  function cycleLang() {
    var langs = I18n.langs;
    var i = langs.indexOf(I18n.lang);
    I18n.set(langs[(i + 1) % langs.length]);
    M.toast({ html: I18n.name(I18n.lang) });
  }

  /* ---------- 文體格式化（MdFormater）開關 ---------- */

  function updateFormatIcon() {
    var el = document.getElementById('setting-format');
    if (!el) return;
    el.classList.toggle('active', state.format);
    el.title = state.format ? I18n.t('tool.formatOn') : I18n.t('tool.formatOff');
  }

  function toggleFormat() {
    state.format = !state.format;
    try { localStorage.setItem(FORMAT_KEY, state.format ? '1' : '0'); } catch (e) {}
    updateFormatIcon();
    M.toast({ html: state.format ? I18n.t('toast.formatOn') : I18n.t('toast.formatOff') });
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
    M.toast({ html: I18n.t('toast.orientation', { o: I18n.t(state.orientation === 'portrait' ? 'orient.portrait' : 'orient.landscape') }) });
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
    document.title = name + ' | ' + I18n.t('title.suffix');
    setPrintOptions();
    markActive(name);
    showViewer(true);
    return renderText(I18n.t('md.loading', { n: name }))
      .then(function () { return L.fetchText(name); })
      .then(function (text) {
        state.text = text; // 保留原文（下載用原始檔，不含格式化）
        return renderCurrentContent();
      })
      .catch(function (err) {
        state.text = '';
        return renderText(I18n.t('md.loadFail', { n: name, e: String(err) }));
      });
  }

  function markActive(name) {
    $('#side-nav li').removeClass('active');
    $('#side-nav li[data-name="' + (window.CSS && CSS.escape ? CSS.escape(name) : name) + '"]').addClass('active');
  }

  function renderSideNav(files) {
    if (!files.length) {
      sideNav.innerHTML = '<li><a style="color:var(--muted)!important;">' + I18n.t('side.noFiles') + '</a></li>';
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
        document.title = I18n.t('title.suffix');
        return;
      }
      var has = function (n) { return files.some(function (f) { return f.name === n; }); };
      var pick = (selectName && has(selectName)) ? selectName
        : (state.current && has(state.current)) ? state.current
          : files[0].name;
      return openFile(pick);
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.listFail', { m: err.message }), classes: 'red' });
    });
  }

  /* ---------- 上傳 ---------- */

  function uploadFiles(fileList) {
    var arr = Array.prototype.slice.call(fileList).filter(function (f) { return L.isReadable(f.name); });
    if (!arr.length) {
      M.toast({ html: I18n.t('toast.notReadable'), classes: 'orange' });
      return;
    }
    var lastName = null;
    var chain = Promise.resolve();
    arr.forEach(function (file) {
      chain = chain.then(function () {
        return L.uploadFile(file).then(function () {
          lastName = file.name;
          M.toast({ html: I18n.t('toast.uploaded', { n: file.name }), classes: 'green' });
        }).catch(function (err) {
          M.toast({ html: I18n.t('toast.uploadFail', { n: file.name, m: err.message }), classes: 'red' });
        });
      });
    });
    chain.then(function () { return refreshFiles(lastName); });
  }

  /* ---------- 下載 / 清空 ---------- */

  function downloadCurrent() {
    if (!state.current) {
      M.toast({ html: I18n.t('toast.noOpenFile'), classes: 'orange' });
      return;
    }
    var text = state.text != null ? state.text : '';
    L.downloadText(state.current, text);
    M.toast({ html: I18n.t('toast.downloaded', { n: state.current }), classes: 'teal' });
  }

  // 清除頁面上目前顯示的內容（回到初始空狀態），但不刪除伺服器上的檔案
  function clearPage() {
    state.current = null;
    state.text = '';
    mdSlot.textContent = '';
    $('#side-nav li').removeClass('active');
    document.title = I18n.t('title.suffix');
    showViewer(false);
    M.toast({ html: I18n.t('toast.pageCleared'), classes: 'grey' });
  }

  function clearFolder() {
    if (!confirm(I18n.t('confirm.clear'))) return;
    L.clearFolder().then(function (d) {
      M.toast({ html: I18n.t('toast.cleared', { n: d.removed || 0 }), classes: 'teal' });
      state.current = null;
      return refreshFiles();
    }).catch(function (err) {
      M.toast({ html: I18n.t('toast.clearFail', { m: err.message }), classes: 'red' });
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

    try { state.format = localStorage.getItem(FORMAT_KEY) === '1'; } catch (e) { state.format = false; }

    // i18n：套用靜態文字 / 標題 + documentElement.lang（引擎自行解析初始語系：
    // ?lang → localStorage('lang') → 瀏覽器語言 → zh-Hant）。
    I18n.apply(document);
    document.addEventListener('i18n:changed', onLangChanged);
    updateFormatIcon();                     // 初始化格式化按鈕 title（i18n:changed 初次不觸發）
    document.title = I18n.t('title.suffix');

    setPrintOptions();
    bindEvents();
    bindDragDrop();
    refreshFiles();
  });
})();
