/**
 * MarkdownReaderLib — markdown-reader 前端工具庫（可嵌入式 library）
 *
 * 把「與伺服器溝通」「下載」「檔名/時間戳」等可重用邏輯抽成一支 library，
 * index.html 只負責 DOM / zero-md 的呈現與事件繫結。
 *
 * 後端對應：
 *   - 上傳： POST /api/upload?folder=markdown-reader   （form 欄位 myFiles，多檔）
 *   - 列表： GET  /api/markdown-reader/files
 *   - 清空： POST /api/markdown-reader/clear
 *   - 靜態讀檔： /upload/markdown-reader/<name>
 *
 * 依賴：無（原生 fetch）。建議與 jQuery / Materialize / Lodash / zero-md 一起載入。
 *
 * Public API：
 *   MarkdownReaderLib.FOLDER                  → 'markdown-reader'
 *   MarkdownReaderLib.fetchConfig()           → Promise<{print:{keepTableTogether,keepListTogether}}>  讀 config.json（缺檔回預設）
 *   MarkdownReaderLib.isReadable(name)        → boolean   是否為支援的 markdown / 文字副檔名
 *   MarkdownReaderLib.deriveFilename(text)    → 'name.md' | null   以第一個標題推導檔名（無標題回 null）
 *   MarkdownReaderLib.resolveCollision(name, existingNames) → string   同名時檔名尾附時間戳避開
 *   MarkdownReaderLib.uploadFile(file)        → Promise<resp>   上傳單一檔案
 *   MarkdownReaderLib.listFiles()             → Promise<Array<{name,size,mtime}>>
 *   MarkdownReaderLib.clearFolder()           → Promise<{ok,removed}>
 *   MarkdownReaderLib.fetchText(name)         → Promise<string>  讀取檔案內容
 *   MarkdownReaderLib.fileUrl(name)           → string   靜態檔案 URL
 *   MarkdownReaderLib.timestamp(date)         → 'yyyyMMddHHmmss'
 *   MarkdownReaderLib.downloadText(name,text) → 觸發瀏覽器下載
 *   MarkdownReaderLib.formatSize(bytes)       → 'xx KB'
 */
(function (window) {
  'use strict';

  var FOLDER = 'markdown-reader';
  var UPLOAD_API = '/api/upload?folder=' + FOLDER;
  var FILES_API = '/api/markdown-reader/files';
  var CLEAR_API = '/api/markdown-reader/clear';
  var STATIC_BASE = '/upload/' + FOLDER + '/';
  var CONFIG_URL = '/apps/' + FOLDER + '/config.json';

  // app 設定的後備預設（config.json 缺檔 / 壞檔 / 缺鍵時使用）。
  // print.keepTableTogether / keepListTogether：列印時是否「整塊絕不跨頁切」（預設否＝可流動）。
  // print.pageBreakBeforeH1：列印時每個 h1（首個除外）另起新頁（預設否）。
  // print.allowBlockBreak：允許 p / blockquote / pre 跨頁；allowRowBreak：允許表格單列跨頁（皆預設否＝保護）。
  // viewFont / printFont：覆寫內文字型；codeFont / codePrintFont：覆寫 code/pre 字型。
  // 皆 { apply, family, size }；apply 預設 false＝沿用 github/newsprint 預設。
  function fontCfg(o) {
    var f = (o && typeof o === 'object') ? o : {};
    return {
      apply: f.apply === true,
      family: typeof f.family === 'string' ? f.family : '',
      size: typeof f.size === 'string' ? f.size : ''
    };
  }
  function mergeConfig(cfg) {
    var c = (cfg && typeof cfg === 'object') ? cfg : {};
    var p = (c.print && typeof c.print === 'object') ? c.print : {};
    return {
      print: {
        keepTableTogether: p.keepTableTogether === true,
        keepListTogether: p.keepListTogether === true,
        pageBreakBeforeH1: p.pageBreakBeforeH1 === true,
        allowBlockBreak: p.allowBlockBreak === true,
        allowRowBreak: p.allowRowBreak === true
      },
      viewFont: fontCfg(c.viewFont),
      printFont: fontCfg(c.printFont),
      codeFont: fontCfg(c.codeFont),
      codePrintFont: fontCfg(c.codePrintFont),
      // 列印字級放大倍率（side-tool toggle 開啟時套用；1.25 = 125%）
      printScale: (typeof c.printScale === 'number' && c.printScale > 0) ? c.printScale : 1.25
    };
  }

  // 支援的副檔名（markdown 與常見純文字）
  var READABLE_RE = /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|text|txt)$/i;

  /* ---------- 檔名推導（貼上文字存檔用） ---------- */

  // 剝掉標題文字裡的行內 markdown，留下可讀的純文字當檔名素材。
  // 底線 _ 刻意保留（snake_case 標題常見；GFM 的 _ 強調需字界，誤刪風險大於漏刪）。
  function stripInlineMd(s) {
    return String(s || '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')   // 圖片 → alt 文字
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // 連結 → 連結文字
      .replace(/`+/g, '')                          // 行內碼圍欄
      .replace(/\*+/g, '')                         // * 強調記號
      .replace(/~~/g, '')                          // 刪除線
      .replace(/<[^>]+>/g, '')                     // HTML 標籤
      .trim();
  }

  // 檔案系統禁字 → 空白，收斂連續空白，去頭尾點/空白，長度上限 80（碼位計，surrogate 安全）
  function sanitizeName(s) {
    var t = String(s || '')
      .replace(/[\/\\:*?"<>|\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .replace(/[. ]+$/, '');
    var cps = Array.from(t);
    if (cps.length > 80) t = cps.slice(0, 80).join('').trim();
    return t;
  }

  // 找第一個標題：ATX（# ～ ######）或 setext H1（下一行 ===）。
  // 先去掉 fenced code block，避免把程式碼裡的 "# 註解" 誤認成標題；
  // setext 只認 = 底線（- 底線與清單 / YAML frontmatter 分隔線易混淆，不採）。
  function firstHeading(text) {
    var src = String(text || '').replace(/\r\n?/g, '\n')
      .replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?\n {0,3}\1[^\n]*(\n|$)/gm, '\n');
    var atx = src.match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m);
    var setext = src.match(/^ {0,3}(\S[^\n]*?)[ \t]*\n {0,3}=+[ \t]*$/m);
    if (atx && setext) return (atx.index <= setext.index) ? atx[1] : setext[1];
    return atx ? atx[1] : (setext ? setext[1] : null);
  }

  function pad2(n) { return ('0' + n).slice(-2); }

  // 加上 cache-busting query，確保每次都讀到伺服器最新內容
  function bust(url) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + Date.now();
  }

  function fileUrl(name) {
    return STATIC_BASE + encodeURIComponent(name);
  }

  var MarkdownReaderLib = {

    FOLDER: FOLDER,

    /**
     * 讀取 app 設定（/apps/markdown-reader/config.json）。
     * 純資料：缺檔 / 解析失敗都回後備預設，永不 reject（由控制器套到 DOM）。
     */
    fetchConfig: function () {
      return fetch(bust(CONFIG_URL), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (cfg) { return mergeConfig(cfg); });
    },

    /** 是否為可閱讀的 markdown / 文字檔 */
    isReadable: function (name) {
      return READABLE_RE.test(String(name || ''));
    },

    /**
     * 以內文第一個標題推導檔名（'標題.md'）。
     * 找不到標題、或標題消毒後為空 → 回 null（由 UI 擋下並提示補標題）。
     */
    deriveFilename: function (text) {
      var h = firstHeading(text);
      if (h == null) return null;
      var name = sanitizeName(stripInlineMd(h));
      return name ? name + '.md' : null;
    },

    /**
     * 檔名與既有清單同名（不分大小寫，macOS 檔案系統預設不分）時，
     * 尾附 -yyyyMMddHHmmss 避開，永不覆寫既有檔案。
     */
    resolveCollision: function (name, existingNames) {
      var taken = {};
      (existingNames || []).forEach(function (n) { taken[String(n).toLowerCase()] = true; });
      if (!taken[String(name).toLowerCase()]) return name;
      var i = name.lastIndexOf('.');
      var base = i > 0 ? name.slice(0, i) : name;
      var ext = i > 0 ? name.slice(i) : '';
      // 時間戳只有秒級精度：fallback 名也要查表，仍撞（同秒二存、或清單裡本來就有該名）就補序號
      var cand = base + '-' + MarkdownReaderLib.timestamp() + ext;
      for (var seq = 2; taken[cand.toLowerCase()]; seq++) {
        cand = base + '-' + MarkdownReaderLib.timestamp() + '-' + seq + ext;
      }
      return cand;
    },

    /**
     * 上傳單一檔案到 /upload/markdown-reader（同名覆寫）。
     * 回傳伺服器 JSON；失敗時 reject。
     */
    uploadFile: function (file) {
      var fd = new FormData();
      fd.append('myFiles', file);
      return fetch(UPLOAD_API, { method: 'POST', body: fd })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (resp) {
          if (!resp || !resp.ok) {
            throw new Error((resp && resp.error) || '上傳失敗');
          }
          return resp;
        });
    },

    /** 列出資料夾內檔案（依修改時間新→舊） */
    listFiles: function () {
      return fetch(bust(FILES_API), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('列表載入失敗 (' + r.status + ')');
          return r.json();
        })
        .then(function (d) { return (d && d.files) || []; });
    },

    /** 清空資料夾下所有可見檔案 */
    clearFolder: function () {
      return fetch(CLEAR_API, { method: 'POST' })
        .then(function (r) { return r.json().catch(function () { return null; }); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error((d && d.error) || '清空失敗');
          return d;
        });
    },

    /** 讀取單一檔案的文字內容 */
    fetchText: function (name) {
      return fetch(bust(fileUrl(name)), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('讀取失敗 (' + r.status + ')');
          return r.text();
        });
    },

    fileUrl: fileUrl,

    /** 本地時間 yyyyMMddHHmmss */
    timestamp: function (date) {
      var d = date || new Date();
      return d.getFullYear() +
        pad2(d.getMonth() + 1) +
        pad2(d.getDate()) +
        pad2(d.getHours()) +
        pad2(d.getMinutes()) +
        pad2(d.getSeconds());
    },

    /** 以 Blob 觸發瀏覽器下載文字內容 */
    downloadText: function (name, text) {
      var blob = new Blob([text == null ? '' : text], { type: 'text/markdown;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name || 'document.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    /** 人類可讀的檔案大小 */
    formatSize: function (bytes) {
      bytes = Number(bytes) || 0;
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }
  };

  window.MarkdownReaderLib = MarkdownReaderLib;
})(window);
