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
  var STYLE_KEY = 'markdown-reader-style';   // 閱讀風格：'github' | 'newsprint'
  var PRINT_SCALE_KEY = 'markdown-reader-printscale';   // 列印字級放大 toggle 狀態
  var PRINT_KEY = 'markdown-reader-print';   // 列印分頁設定（config 面板）覆寫，存整個物件
  // 語系由 I18n 引擎管理（localStorage 'lang'，預設 zh-Hant），不再自行保存。

  var viewer = document.getElementById('viewer');
  var mdSlot = document.getElementById('md-slot');
  var sideNav = document.getElementById('side-nav');
  var emptyState = document.getElementById('empty-state');
  var dropOverlay = document.getElementById('drop-overlay');
  var filePicker = document.getElementById('file-picker');

  var state = {
    theme: 'dark',
    style: 'github', // 閱讀風格：'github'（預設）| 'newsprint'（報紙襯線紙感）
    format: false,   // 佛典文體格式化開關（側邊 toggle）；預設關閉＝顯示原文
    printScale: false, // 列印字級放大開關（側邊 toggle）；預設關閉＝原始大小
    print: {},       // 列印分頁設定（config.json 預設 + localStorage 覆寫；由 config 面板控制）
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
    // host 屬性：供 newsprint 皮膚（shadow DOM 內 :host([data-mode]))跟著 light/dark 切換
    viewer.setAttribute('data-mode', theme);
    setZeroMdTheme(theme);
    var icon = document.querySelector('#setting-mode i');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  /* ---------- 閱讀風格（github / newsprint） ---------- */

  // newsprint 字型（PT Serif 自託管 + Noto Serif TC/JP）首次切到 newsprint 才注入主文件
  var newsprintFontsInjected = false;
  function ensureNewsprintFonts() {
    if (newsprintFontsInjected) return;
    newsprintFontsInjected = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = './newsprint-fonts.css';
    document.head.appendChild(l);
  }

  // 以 media 屬性啟用/停用皮膚層 link（clone 安全，切回 github 不需重新下載）
  function applySkinToLink(link, style) {
    if (!link) return;
    if (style === 'newsprint') {
      link.setAttribute('href', './viewer-newsprint.css');
      link.setAttribute('media', 'all');
    } else {
      link.setAttribute('media', 'not all');
    }
  }

  function setSkin(style) {
    // 同步 template（供下次 render clone）與 live shadow root（即時生效）
    var tpl = viewer.querySelector('template');
    if (tpl && tpl.content) applySkinToLink(tpl.content.getElementById('md-skin-css'), style);
    var sr = viewer.shadowRoot;
    if (sr) applySkinToLink(sr.getElementById('md-skin-css'), style);
  }

  function applyStyle(style) {
    style = (style === 'newsprint') ? 'newsprint' : 'github';
    state.style = style;
    if (style === 'newsprint') ensureNewsprintFonts();
    viewer.setAttribute('data-skin', style);
    setSkin(style);
    var btn = document.getElementById('setting-style');
    if (btn) btn.classList.toggle('active', style === 'newsprint');
    try { localStorage.setItem(STYLE_KEY, style); } catch (e) {}
  }

  function toggleStyle() {
    applyStyle(state.style === 'newsprint' ? 'github' : 'newsprint');
    M.toast({ html: I18n.t(state.style === 'newsprint' ? 'toast.styleNewsprint' : 'toast.styleGithub') });
  }

  /* ---------- 內文字型（config 驅動：viewFont / printFont / codeFont） ---------- */
  // 由 config.json 覆寫 .markdown-body（含標題）與 code/pre 的字型／字級。viewFont/codeFont 套螢幕、
  // printFont/codePrintFont 套 @media print。用 !important 確保蓋過 github-markdown 與 newsprint 皮膚
  // ——家族決議：config 字型為「全域基準」（apply 時覆寫兩種閱讀風）。預設 apply:false＝不改外觀。
  var fontCss = '';

  function cssSafe(s) { return String(s == null ? '' : s).replace(/[;{}<>]/g, '').trim(); }

  // 內文（body + 標題）字型 + 基礎字級
  function fontRule(f) {
    if (!f || !f.apply) return '';
    var css = '', fam = cssSafe(f.family), size = cssSafe(f.size);
    if (fam) css += '.markdown-body,.markdown-body h1,.markdown-body h2,.markdown-body h3,' +
      '.markdown-body h4,.markdown-body h5,.markdown-body h6{font-family:' + fam + ' !important;}';
    if (size) css += '.markdown-body{font-size:' + size + ' !important;}';
    return css;
  }

  // code / pre 字型：family 套所有等寬語境；size 只套 pre 區塊（inline code 維持相對字級）
  function codeRule(f) {
    if (!f || !f.apply) return '';
    var css = '', fam = cssSafe(f.family), size = cssSafe(f.size);
    if (fam) css += '.markdown-body code,.markdown-body kbd,.markdown-body pre,.markdown-body samp{font-family:' + fam + ' !important;}';
    if (size) css += '.markdown-body pre{font-size:' + size + ' !important;}';
    return css;
  }

  function buildFontCss(cfg) {
    var screen = fontRule(cfg.viewFont) + codeRule(cfg.codeFont);
    var print = fontRule(cfg.printFont) + codeRule(cfg.codePrintFont);
    return screen + (print ? '@media print{' + print + '}' : '');
  }

  // config 字型若用到內建襯線（PT Serif / Noto Serif），確保 newsprint-fonts.css 已載入
  function ensureConfigFonts(cfg) {
    var fams = [cfg.viewFont, cfg.printFont, cfg.codeFont, cfg.codePrintFont]
      .map(function (f) { return (f && f.family) || ''; }).join(' ');
    if (/PT Serif|Noto Serif/i.test(fams)) ensureNewsprintFonts();
  }

  // 把字型樣式寫進 shadow DOM（template 供首次 render 複製、shadowRoot 供已渲染後即時更新）
  function setFonts() {
    var tpl = viewer.querySelector('template');
    if (tpl && tpl.content) { var t = tpl.content.getElementById('md-font'); if (t) t.textContent = fontCss; }
    var sr = viewer.shadowRoot;
    if (sr) { var s = sr.getElementById('md-font'); if (s) s.textContent = fontCss; }
  }

  /* ---------- 列印字級放大（side-tool toggle；倍率由 config.printScale 提供，預設 1.25＝125%） ---------- */
  // 抵銷「一張 A4 印 N 頁」造成的縮小：開啟時讓列印基準字級 × 倍率（標題/code 以 em/% 等比跟著放大；
  // 字會自動換行，不會橫向溢出）。寫進 shadow DOM 內 @media print，只影響列印、不動螢幕。
  var printScaleFactor = 1.25;     // config.printScale
  var printBaseSize = '12pt';      // 列印基準字級：printFont 有套用就用它，否則 viewer.css 的 12pt

  function setPrintScale() {
    var css = state.printScale
      ? '@media print{.markdown-body{font-size:calc(' + printBaseSize + ' * ' + printScaleFactor + ') !important;}}'
      : '';
    var tpl = viewer.querySelector('template');
    if (tpl && tpl.content) { var t = tpl.content.getElementById('md-print-scale'); if (t) t.textContent = css; }
    var sr = viewer.shadowRoot;
    if (sr) { var s = sr.getElementById('md-print-scale'); if (s) s.textContent = css; }
  }

  function updatePrintScaleIcon() {
    var el = document.getElementById('setting-print-scale');
    if (!el) return;
    el.classList.toggle('active', state.printScale);
    el.title = I18n.t('tool.printScale', { p: Math.round(printScaleFactor * 100) });
  }

  function togglePrintScale() {
    state.printScale = !state.printScale;
    try { localStorage.setItem(PRINT_SCALE_KEY, state.printScale ? '1' : '0'); } catch (e) {}
    updatePrintScaleIcon();
    setPrintScale();
    M.toast({ html: I18n.t(state.printScale ? 'toast.printScaleOn' : 'toast.printScaleOff', { p: Math.round(printScaleFactor * 100) }) });
  }

  /* ---------- 列印分頁設定（config 面板：即時 toggle，localStorage 覆寫 config.json） ---------- */

  // 五個列印分頁鍵 ↔ 面板 checkbox id
  var PRINT_KEYS = ['keepTableTogether', 'keepListTogether', 'pageBreakBeforeH1', 'allowBlockBreak', 'allowRowBreak'];
  var PRINT_CBOX = {
    keepTableTogether: 'cfg-keepTable',
    keepListTogether: 'cfg-keepList',
    pageBreakBeforeH1: 'cfg-breakH1',
    allowBlockBreak: 'cfg-allowBlock',
    allowRowBreak: 'cfg-allowRow'
  };

  // 依 state.print 設好 viewer 的三個 host 屬性（viewer.css 的 @media print 反應）
  function applyPrintSettings() {
    var p = state.print || {};
    var keep = [];
    if (p.keepTableTogether) keep.push('table');
    if (p.keepListTogether) keep.push('list');
    viewer.setAttribute('data-print-keep', keep.join(' '));
    viewer.setAttribute('data-print-break', p.pageBreakBeforeH1 ? 'h1' : '');
    var allow = [];
    if (p.allowBlockBreak) allow.push('block');
    if (p.allowRowBreak) allow.push('row');
    viewer.setAttribute('data-print-allow', allow.join(' '));
  }

  // 把 localStorage 覆寫疊到 config.json 預設上，得到目前生效的 state.print
  function loadPrintSettings(cfg) {
    var base = (cfg && cfg.print) ? cfg.print : {};
    var p = {};
    PRINT_KEYS.forEach(function (k) { p[k] = base[k] === true; });
    try {
      var saved = JSON.parse(localStorage.getItem(PRINT_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        PRINT_KEYS.forEach(function (k) { if (typeof saved[k] === 'boolean') p[k] = saved[k]; });
      }
    } catch (e) {}
    state.print = p;
  }

  // 面板勾選：更新 state、存 localStorage、即時套用到 viewer
  function setPrintOption(key, val) {
    state.print[key] = !!val;
    try { localStorage.setItem(PRINT_KEY, JSON.stringify(state.print)); } catch (e) {}
    applyPrintSettings();
  }

  // 把目前 state.print 反映到面板 checkbox
  function syncConfigPanel() {
    PRINT_KEYS.forEach(function (k) {
      var cb = document.getElementById(PRINT_CBOX[k]);
      if (cb) cb.checked = !!(state.print && state.print[k]);
    });
  }

  // 開啟設定面板（先同步勾選狀態再開）
  function openConfig() {
    syncConfigPanel();
    var el = document.getElementById('config-modal');
    if (!el) return;
    var inst = M.Modal.getInstance(el) || M.Modal.init(el);
    if (inst) inst.open();
  }

  /* ---------- 瀏覽 nodeapp/GitHub 下的 .md（唯讀） ---------- */

  var githubTree = {};        // { dirname: [{ path, name, size }] }（各資料夾直屬的 .md；'' = 根）
  var githubForest = null;    // 巢狀樹（含中間層資料夾）：{ children: { name: node } }
  var githubNodeIndex = {};   // { path: node }
  var githubExpanded = {};    // { path: true } 展開狀態
  var githubActiveFolder = null;
  var githubCurrentPath = null;   // 目前在 viewer 開啟的 GitHub 檔（重開面板時定位用）
  var githubCurrentRoot = '';     // '' = GitHub/；'nodeapp' = nodeapp 頂層

  // 分組成 { dirname: [檔案] }
  function buildGithubTree(files) {
    githubTree = {};
    files.forEach(function (f) {
      var i = f.path.lastIndexOf('/');
      var folder = i < 0 ? '' : f.path.slice(0, i);
      var name = i < 0 ? f.path : f.path.slice(i + 1);
      (githubTree[folder] = githubTree[folder] || []).push({ path: f.path, name: name, size: f.size });
    });
  }

  var NODEAPP_PATH = '@nodeapp';   // 頂層 nodeapp 容器節點的 sentinel 路徑（非真實資料夾）
  var TXF_PATH = '@txf';           // txf-neo 根節點的 sentinel 前綴（鍵＝'@txf' 或 '@txf/<rel>'）

  // 由各 dirname 建巢狀樹（補中間層節點）：nodeapp → GitHub 容器 ＋ 同層 txf-neo（有內容才顯示）
  function buildGithubForest() {
    githubNodeIndex = {};
    function makeNode(name, pathKey) { var n = { name: name, path: pathKey, children: {} }; githubNodeIndex[pathKey] = n; return n; }
    // 通用插入：keyPrefix＝節點 path 前綴（GitHub 相對＝''、txf＝'@txf'）
    function insert(rootNode, keyPrefix, relFolder) {
      var segs = relFolder.split('/'), node = rootNode, acc = keyPrefix;
      for (var i = 0; i < segs.length; i++) {
        acc = acc ? acc + '/' + segs[i] : segs[i];
        if (!node.children[segs[i]]) node.children[segs[i]] = makeNode(segs[i], acc);
        node = node.children[segs[i]];
      }
    }
    var githubNode = makeNode('GitHub', '');
    var txfNode = makeNode('txf-neo', TXF_PATH);
    Object.keys(githubTree).forEach(function (folder) {
      if (folder === '' || folder === NODEAPP_PATH || folder === TXF_PATH) return;
      if (folder.indexOf(TXF_PATH + '/') === 0) insert(txfNode, TXF_PATH, folder.slice(TXF_PATH.length + 1));
      else if (folder.charAt(0) !== '@') insert(githubNode, '', folder);
    });
    var nodeappNode = makeNode('nodeapp', NODEAPP_PATH);
    nodeappNode.children['GitHub'] = githubNode;
    githubForest = { children: { 'nodeapp': nodeappNode } };
    // txf-neo 掛在與 nodeapp 同層；沒掃到任何 .md 時不顯示（clone 到別台機器不會出現空節點）
    if ((githubTree[TXF_PATH] || []).length || Object.keys(txfNode.children).length) {
      githubForest.children['txf-neo'] = txfNode;
    }
  }

  function nodeHasKids(path) { var n = githubNodeIndex[path]; return !!(n && Object.keys(n.children).length); }

  // 渲染資料夾樹（縮排 + 展開/收合；篩選時自動展開命中分支）
  function renderGithubFolders() {
    var el = document.getElementById('github-folders');
    if (!el) return;
    var fEl = document.getElementById('github-filter');
    var q = String(fEl ? fEl.value : '').trim().toLowerCase();
    var showSet = null, forceExpand = false;
    if (q) {
      forceExpand = true; showSet = {};
      showSet[NODEAPP_PATH] = true; showSet[''] = true; showSet[TXF_PATH] = true;   // 頂層容器永遠保留
      Object.keys(githubTree).forEach(function (folder) {
        if (folder === '' || folder.toLowerCase().indexOf(q) < 0) return;
        var segs = folder.split('/'), acc = '';
        for (var i = 0; i < segs.length; i++) { acc = acc ? acc + '/' + segs[i] : segs[i]; showSet[acc] = true; }
      });
    }
    var out = [];
    (function walk(node, depth) {
      Object.keys(node.children).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (name) {
        var c = node.children[name];
        if (showSet && !showSet[c.path]) return;
        var hasKids = Object.keys(c.children).length > 0;
        var expanded = forceExpand || githubExpanded[c.path];
        var count = (githubTree[c.path] || []).length;
        out.push('<li><a href="#!" class="github-folder' + (c.path === githubActiveFolder ? ' active' : '') +
          '" data-folder="' + _.escape(c.path) + '" style="padding-left:' + (8 + depth * 15) + 'px;">' +
          '<i class="material-icons github-caret">' + (hasKids ? (expanded ? 'expand_more' : 'chevron_right') : '') + '</i>' +
          '<i class="material-icons">folder</i><span>' + _.escape(name) + '</span>' +
          (count ? '<span class="github-count">' + count + '</span>' : '') + '</a></li>');
        if (hasKids && expanded) walk(c, depth + 1);
      });
    })(githubForest, 0);
    el.innerHTML = out.length ? out.join('') : '<li class="github-empty">' + I18n.t('github.empty') + '</li>';
  }

  function renderGithubFiles(files) {
    var el = document.getElementById('github-files');
    if (!el) return;
    if (!files || !files.length) { el.innerHTML = '<li class="github-empty">' + I18n.t('github.pick') + '</li>'; return; }
    el.innerHTML = files.map(function (f) {
      var isCur = f.path === githubCurrentPath && (f.root || '') === githubCurrentRoot;   // 目前開啟的檔 → 高亮
      return '<li><a href="#!" class="github-item' + (isCur ? ' active' : '') + '" data-path="' + _.escape(f.path) + '"' +
        (f.root ? ' data-root="' + _.escape(f.root) + '"' : '') + '>' +
        '<i class="material-icons">description</i><span>' + _.escape(f.name) + '</span>' +
        '<span class="github-size">' + L.formatSize(f.size) + '</span></a></li>';
    }).join('');
  }

  // 只展開「祖先」讓選取項看得見；不動選取項自身的展開狀態（名稱點擊的收合才不會被蓋掉）
  function expandGithubAncestors(folder) {
    if (folder === NODEAPP_PATH || folder === TXF_PATH) return;   // 已是最上層
    if (folder.indexOf(TXF_PATH + '/') === 0) {                   // txf 子層：'@txf' 起的沿途祖先
      var tsegs = folder.split('/'), tacc = '';
      for (var t = 0; t < tsegs.length - 1; t++) { tacc = tacc ? tacc + '/' + tsegs[t] : tsegs[t]; githubExpanded[tacc] = true; }
      return;
    }
    githubExpanded[NODEAPP_PATH] = true;
    if (folder === '') return;                // GitHub 節點的上層只有 nodeapp
    githubExpanded[''] = true;
    var segs = folder.split('/'), acc = '';
    for (var i = 0; i < segs.length - 1; i++) { acc = acc ? acc + '/' + segs[i] : segs[i]; githubExpanded[acc] = true; }
  }

  function selectGithubFolder(folder) {
    githubActiveFolder = folder;
    expandGithubAncestors(folder);
    renderGithubFolders();
    renderGithubFiles(githubTree[folder] || []);
  }

  function toggleGithubExpand(folder) {
    githubExpanded[folder] = !githubExpanded[folder];
    renderGithubFolders();
  }

  // 篩選後重繪樹，並自動選第一個（或保留目前）有檔資料夾
  function applyGithubFilter() {
    var fEl = document.getElementById('github-filter');
    var q = String(fEl ? fEl.value : '').trim().toLowerCase();
    var candidates = Object.keys(githubTree).sort();
    if (q) candidates = candidates.filter(function (f) { return f !== '' && f.toLowerCase().indexOf(q) >= 0; });
    var pick = (githubActiveFolder != null && candidates.indexOf(githubActiveFolder) >= 0) ? githubActiveFolder : candidates[0];
    if (pick != null) selectGithubFolder(pick);
    else { renderGithubFolders(); renderGithubFiles([]); }
  }

  function openGithubModal() {
    var el = document.getElementById('github-modal');
    if (!el) return;
    var inst = M.Modal.getInstance(el) || M.Modal.init(el);
    var fol = document.getElementById('github-folders');
    var fil = document.getElementById('github-files');
    if (fol) fol.innerHTML = '<li class="github-loading">' + I18n.t('loading') + '</li>';
    if (fil) fil.innerHTML = '';
    if (inst) inst.open();
    L.listGithub().then(function (d) {
      buildGithubTree(d.files || []);
      // nodeapp 頂層 .md 掛在 nodeapp 節點（root:'nodeapp' → 開檔走 root=nodeapp）
      githubTree[NODEAPP_PATH] = (d.nodeappFiles || []).map(function (f) {
        return { path: f.name, name: f.name, size: f.size, root: 'nodeapp' };
      });
      // txf-neo 檔案：鍵加 '@txf' 前綴（避免與 GitHub 相對路徑相撞）；開檔走 root=txf-neo
      (d.txfFiles || []).forEach(function (f) {
        var i = f.path.lastIndexOf('/');
        var key = i < 0 ? TXF_PATH : TXF_PATH + '/' + f.path.slice(0, i);
        var name = i < 0 ? f.path : f.path.slice(i + 1);
        (githubTree[key] = githubTree[key] || []).push({ path: f.path, name: name, size: f.size, root: 'txf-neo' });
      });
      buildGithubForest();
      // 保留上次的展開/選取狀態；首次載入才給預設（展開 nodeapp / GitHub）
      if (!Object.keys(githubExpanded).length) { githubExpanded[NODEAPP_PATH] = true; githubExpanded[''] = true; githubExpanded[TXF_PATH] = true; }
      // 若 viewer 正開著某份 GitHub / nodeapp / txf 檔 → 定位到它所在的資料夾
      if (githubCurrentPath != null) {
        var cf;
        var cdir = githubCurrentPath.indexOf('/') < 0 ? '' : githubCurrentPath.slice(0, githubCurrentPath.lastIndexOf('/'));
        if (githubCurrentRoot === 'nodeapp') cf = NODEAPP_PATH;
        else if (githubCurrentRoot === 'txf-neo') cf = cdir ? TXF_PATH + '/' + cdir : TXF_PATH;
        else cf = cdir;
        if (githubTree[cf]) githubActiveFolder = cf;
      }
      applyGithubFilter();
      // 把選取的資料夾與檔案捲進可視範圍
      var actFol = document.querySelector('#github-folders .github-folder.active');
      if (actFol && actFol.scrollIntoView) actFol.scrollIntoView({ block: 'nearest' });
      var actFile = document.querySelector('#github-files .github-item.active');
      if (actFile && actFile.scrollIntoView) actFile.scrollIntoView({ block: 'nearest' });
    }).catch(function (err) {
      if (fol) fol.innerHTML = '<li class="github-empty">' + _.escape(I18n.t('github.fail', { m: err.message })) + '</li>';
    });
  }

  // 開啟一份 GitHub / nodeapp 頂層 .md（唯讀；不進上傳清單、不高亮側欄）
  function openGithub(rel, root) {
    if (!rel) return Promise.resolve();
    githubCurrentPath = rel;            // 記住目前開啟的 GitHub 檔（重開面板時定位）
    githubCurrentRoot = root || '';
    state.current = rel;
    document.title = rel + ' | ' + I18n.t('title.suffix');
    setPrintOptions();
    $('#side-nav li').removeClass('active');
    showViewer(true);
    showLoading();
    return L.fetchGithubText(rel, root)
      .then(function (text) { state.text = text; return renderCurrentContent(); })
      .catch(function (err) { state.text = ''; return renderText(I18n.t('md.loadFail', { n: rel, e: String(err) })); })
      .then(function () { hideLoading(); window.scrollTo(0, 0); });
  }

  /* ---------- 語系（i18n：透過 I18n 引擎，預設 zh-Hant，支援 zh-Hant / en / ja） ---------- */

  // 語言切換後，重繪由 JS 產生的動態內容（靜態文字 / 標題由 I18n.apply 處理）
  function onLangChanged() {
    updateFormatIcon();              // 格式化按鈕 title 依 state.format + 語系
    updatePrintScaleIcon();          // 列印字級放大鈕 title 依倍率 + 語系
    updateCopyTitles();              // 程式碼複製鈕 title 依語系
    renderSideNav(state.files);      // 「尚無檔案」訊息
    if (state.current) markActive(state.current);
    document.title = state.current
      ? (state.current + ' | ' + I18n.t('title.suffix'))
      : I18n.t('title.suffix');
  }

  // 點 #setting-lang：依註冊順序循環切換；I18n.set 會 persist 並派發 i18n:changed
  function cycleLang() {
    var next = I18n.cycle();
    M.toast({ html: I18n.t('toast.lang', { name: I18n.name(next) }), classes: 'teal' });
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
    // 就緒後額外讓出一個 macrotask：zero-md 在派發 zero-md-ready 的同一個 tick 內若立刻
    // render()，首次 render 可能卡住不 resolve；隔一個 setTimeout 等它穩定再渲染
    // （用 setTimeout 而非 rAF，背景分頁的 rAF 會被節流／暫停）。
    function settle(resolve) { setTimeout(resolve, 0); }
    if (el && el.ready) return new Promise(settle);
    return new Promise(function (resolve) {
      customElements.whenDefined('zero-md').then(function () {
        if (el.ready) return settle(resolve);
        el.addEventListener('zero-md-ready', function () { settle(resolve); }, { once: true });
      });
    });
  }

  // zero-md v3 的 render() 回 { body, styles }；冷啟動時 render() 的 promise 偶爾不 resolve
  // （內部等待樣式 <link> 的 load 事件，外部 CDN 慢/卡時就吊著）。用 timeout race 避免卡住整條鏈，
  // 並重試到某次 render 確實回報 body:true 為止（避免畫面停在空白）。
  function renderUntilBody(tries) {
    return Promise.race([
      viewer.render().then(function (res) { return res; }, function () { return null; }),
      new Promise(function (r) { setTimeout(function () { r('timeout'); }, 1200); })
    ]).then(function (res) {
      var painted = res && res !== 'timeout' && res.body;
      if (painted || tries >= 12) return;
      return new Promise(function (r) { setTimeout(r, 120); })
        .then(function () { return renderUntilBody(tries + 1); });
    });
  }

  function renderText(text) {
    return whenZeroMdReady(viewer).then(function () {
      setZeroMdTheme(state.theme);
      setSkin(state.style);
      // 相對路徑圖片以上傳資料夾為基準
      viewer.setAttribute('marked-base-url', '/upload/' + L.FOLDER + '/');
      mdSlot.textContent = text || '';
      // 讓出一個 macrotask：zero-md 以 MutationObserver 觀察 <script> slot 並快取內容，
      // 若設完 textContent 立刻 render() 會讀到舊 slot。等觀察器更新後再渲染。
      return new Promise(function (r) { setTimeout(r, 0); });
    }).then(function () {
      return renderUntilBody(0);
    }).then(function () {
      setZeroMdTheme(state.theme);
      setSkin(state.style);
      setFonts();
      setPrintScale();
      addCopyButtons();
    });
  }

  function showViewer(show) {
    viewer.style.display = show ? '' : 'none';
    emptyState.style.display = show ? 'none' : '';
    document.body.classList.toggle('is-empty', !show);
  }

  /* ---------- loading 動畫 ---------- */
  // 抓檔＋渲染期間顯示 Claude 風脈動點；用延遲避免快速切檔閃一下（載入很快就不顯示）。
  var loadingTimer = null;
  function showLoading() {
    clearTimeout(loadingTimer);
    loadingTimer = setTimeout(function () {
      var el = document.getElementById('loading');
      if (el) el.classList.add('show');
    }, 180);
  }
  function hideLoading() {
    clearTimeout(loadingTimer);
    var el = document.getElementById('loading');
    if (el) el.classList.remove('show');
  }

  /* ---------- 程式碼區塊複製鈕（shadow DOM） ---------- */
  // 內容在 zero-md 的 shadow DOM；每次 render 後呼叫，為每個 <pre> 包一層 .code-wrap 並加複製鈕。
  // 重渲染時 body 整批換新、舊鈕消失，這裡再補上（冪等：已包過就跳過）。
  var ICON_COPY = '<svg class="ci ci-copy" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>';
  var ICON_DONE = '<svg class="ci ci-done" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  function addCopyButtons() {
    var sr = viewer.shadowRoot;
    if (!sr || !navigator.clipboard) return;   // 無 shadow / 非安全環境（無 clipboard）就不加
    sr.querySelectorAll('.markdown-body pre').forEach(function (pre) {
      var parent = pre.parentNode;
      if (parent && parent.classList && parent.classList.contains('code-wrap')) return;  // 已處理
      var code = pre.querySelector('code');
      if (!code) return;
      var wrap = document.createElement('div');
      wrap.className = 'code-wrap';
      parent.insertBefore(wrap, pre);
      wrap.appendChild(pre);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.title = I18n.t('tool.copyCode');
      btn.innerHTML = ICON_COPY + ICON_DONE;
      btn.addEventListener('click', function () {
        navigator.clipboard.writeText(code.textContent).then(function () {
          btn.classList.add('copied');
          M.toast({ html: I18n.t('toast.copied'), classes: 'teal' });
          setTimeout(function () { btn.classList.remove('copied'); }, 1200);
        }).catch(function () {
          M.toast({ html: I18n.t('toast.copyFail'), classes: 'red' });
        });
      });
      wrap.appendChild(btn);
    });
  }

  // 切語言但未重渲染時，更新既有複製鈕的 title
  function updateCopyTitles() {
    var sr = viewer.shadowRoot;
    if (sr) sr.querySelectorAll('.copy-btn').forEach(function (b) { b.title = I18n.t('tool.copyCode'); });
  }

  // 依目前的格式化開關，重新渲染 state.text（原文）。
  // 先過 md-tweaks 的內容微調（永遠套用，只影響顯示；下載仍用 state.text 原檔）。
  function renderCurrentContent() {
    var text = (window.MdTweaks ? MdTweaks.apply(state.text) : state.text);
    if (state.format) {
      return formatterReady.then(function () { return renderText(formatMd(text)); });
    }
    return renderText(text);
  }

  /* ---------- 開檔 / 檔案清單 ---------- */

  function openFile(name) {
    if (!name) return Promise.resolve();
    state.current = name;
    document.title = name + ' | ' + I18n.t('title.suffix');
    setPrintOptions();
    markActive(name);
    showViewer(true);
    // 抓檔＋渲染期間蓋上 loading 動畫（取代原本在 viewer 內渲染 md.loading 文字）
    showLoading();
    return L.fetchText(name)
      .then(function (text) {
        state.text = text; // 保留原文（下載用原始檔，不含格式化）
        return renderCurrentContent();
      })
      .catch(function (err) {
        state.text = '';
        return renderText(I18n.t('md.loadFail', { n: name, e: String(err) }));
      })
      .then(function () { hideLoading(); window.scrollTo(0, 0); });   // 收起 loading，並回到頁面最上方
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
    var name = String(state.current).split('/').pop();   // GitHub 檔可能含路徑，下載取檔名
    L.downloadText(name, text);
    M.toast({ html: I18n.t('toast.downloaded', { n: name }), classes: 'teal' });
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
    document.getElementById('setting-style').addEventListener('click', toggleStyle);
    document.getElementById('setting-format').addEventListener('click', toggleFormat);
    document.getElementById('setting-orientation').addEventListener('click', toggleOrientation);
    document.getElementById('setting-print').addEventListener('click', function () { window.print(); });
    document.getElementById('setting-download').addEventListener('click', downloadCurrent);
    var scaleBtn = document.getElementById('setting-print-scale');
    if (scaleBtn) scaleBtn.addEventListener('click', togglePrintScale);
    var cfgBtn = document.getElementById('setting-config');
    if (cfgBtn) cfgBtn.addEventListener('click', openConfig);
    // 面板 checkbox：勾選即時套用並存 localStorage
    PRINT_KEYS.forEach(function (k) {
      var cb = document.getElementById(PRINT_CBOX[k]);
      if (cb) cb.addEventListener('change', function () { setPrintOption(k, cb.checked); });
    });
    // GitHub .md 瀏覽：icon 開面板、清單項目開檔、篩選
    var ghBtn = document.getElementById('setting-github');
    if (ghBtn) ghBtn.addEventListener('click', openGithubModal);
    $(document).on('click', '#github-folders a.github-folder', function (e) {
      e.preventDefault();
      var folder = String($(this).attr('data-folder'));
      if ($(e.target).closest('.github-caret').length) {
        toggleGithubExpand(folder);   // 點三角＝展開/收合
      } else {
        if (nodeHasKids(folder)) githubExpanded[folder] = !githubExpanded[folder];   // 點名稱＝選取＋展開/收合切換
        selectGithubFolder(folder);
      }
    });
    $(document).on('click', '#github-files a.github-item', function (e) {
      e.preventDefault();
      var p = String($(this).data('path'));
      var root = $(this).attr('data-root') || '';
      var gm = M.Modal.getInstance(document.getElementById('github-modal'));
      if (gm) gm.close();
      openGithub(p, root);
    });
    var ghFilter = document.getElementById('github-filter');
    if (ghFilter) ghFilter.addEventListener('input', applyGithubFilter);
    document.getElementById('setting-clear-page').addEventListener('click', clearPage);
    document.getElementById('setting-clear').addEventListener('click', clearFolder);

    // 列印前後切換 zero-md 主題為淺色（列印一律白底黑字），列印後還原
    window.addEventListener('beforeprint', function () {
      setZeroMdTheme('light');
      viewer.setAttribute('data-mode', 'light');   // newsprint 皮膚也走淺色紙本
    });
    window.addEventListener('afterprint', function () {
      setZeroMdTheme(state.theme);
      viewer.setAttribute('data-mode', state.theme);
    });
  }

  /* ---------- 初始化 ---------- */

  document.addEventListener('DOMContentLoaded', function () {
    M.Sidenav.init(document.querySelectorAll('.sidenav'), {
      edge: 'right',
      // 開啟 file-list 時隱藏 side tools；完全收起後再讓它們出現
      onOpenStart: function () { document.body.classList.add('sidenav-open'); },
      onCloseEnd: function () { document.body.classList.remove('sidenav-open'); }
    });

    var cfgModal = document.getElementById('config-modal');
    if (cfgModal) M.Modal.init(cfgModal);
    var ghModal = document.getElementById('github-modal');
    if (ghModal) M.Modal.init(ghModal);

    var saved = 'dark';
    try { saved = localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) {}
    applyTheme(saved === 'light' ? 'light' : 'dark');

    var savedStyle = 'github';
    try { savedStyle = localStorage.getItem(STYLE_KEY) || 'github'; } catch (e) {}
    applyStyle(savedStyle === 'newsprint' ? 'newsprint' : 'github');

    // 列印分頁設定（config.json）：設好 zero-md host 屬性，
    // 供 viewer.css 的 :host([data-print-keep~="..."]) 反應（缺檔則維持「可流動」預設）。
    L.fetchConfig().then(function (cfg) {
      // 列印分頁：config.json 為預設，localStorage（config 面板）覆寫；套到 viewer + 面板
      loadPrintSettings(cfg);
      applyPrintSettings();
      syncConfigPanel();
      // 內文字型（config 驅動）：算出樣式、確保字型載入、注入 shadow DOM
      fontCss = buildFontCss(cfg);
      ensureConfigFonts(cfg);
      setFonts();
      // 列印字級放大：倍率 + 基準字級（printFont 有套用就以它為基準），套用目前 toggle 狀態
      printScaleFactor = cfg.printScale || 1.25;
      printBaseSize = (cfg.printFont && cfg.printFont.apply && cfg.printFont.size) ? cfg.printFont.size : '12pt';
      setPrintScale();
      updatePrintScaleIcon();
    });

    try { state.format = localStorage.getItem(FORMAT_KEY) === '1'; } catch (e) { state.format = false; }
    try { state.printScale = localStorage.getItem(PRINT_SCALE_KEY) === '1'; } catch (e) { state.printScale = false; }

    // i18n：套用靜態文字 / 標題 + documentElement.lang（引擎自行解析初始語系：
    // ?lang → localStorage('lang') → 瀏覽器語言 → zh-Hant）。
    I18n.apply(document);
    document.addEventListener('i18n:changed', onLangChanged);
    updateFormatIcon();                     // 初始化格式化按鈕 title（i18n:changed 初次不觸發）
    updatePrintScaleIcon();
    document.title = I18n.t('title.suffix');

    setPrintOptions();
    bindEvents();
    bindDragDrop();
    refreshFiles();
  });
})();
