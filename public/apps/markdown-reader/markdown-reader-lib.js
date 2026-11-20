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
 *   MarkdownReaderLib.uploadFile(file)        → Promise<resp>   上傳單一檔案
 *
 *   ⚠️ 撞名處理**不在這裡**：2026-08-03 移除了 `resolveCollision(name, existingNames)`，
 *      因為「先查清單再挑名字」本質是 TOCTOU（查與寫之間別的分頁可以建出同名檔）。
 *      現由後端 `routes/upload.js` 以 `fs.open(…,'wx')` 原子建立、同名一律改名；
 *      **`uploadFile` 回應的 `files[0].filename` 才是實際落地的名字**。
 *   MarkdownReaderLib.listFiles()             → Promise<Array<{name,size,mtime}>>
 *   MarkdownReaderLib.clearFolder()           → Promise<{ok,removed}>
 *   MarkdownReaderLib.fetchText(name)         → Promise<string>  讀取檔案內容
 *   MarkdownReaderLib.fileUrl(name)           → string   靜態檔案 URL
 *   MarkdownReaderLib.basename(name)          → string   去掉目錄（GitHub 檔的 name 可能含路徑）
 *   MarkdownReaderLib.stem(name)              → string   再去掉副檔名（列印頁尾用）
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

  // 去掉目錄。GitHub 匯入的檔名可能含路徑（'docs/a/b.md'），本地上傳的則不含。
  function basename(p) {
    var s = String(p == null ? '' : p);
    var i = s.lastIndexOf('/');
    return i < 0 ? s : s.slice(i + 1);
  }

  // 檔名去掉副檔名（列印頁尾用）：'docs/a/b.md' → 'b'、'README.zh-Hant.md' → 'README.zh-Hant'。
  // ⚠️ 只有「點不在開頭」才切——'.gitignore' 的點在 index 0，切了會變成空字串，
  //    而空的頁尾與「這一份沒有檔名」長得一模一樣。沒有副檔名時原樣回傳。
  function stem(p) {
    var b = basename(p);
    var i = b.lastIndexOf('.');
    return i > 0 ? b.slice(0, i) : b;
  }

  // ⚠️ 以下「行尾連結」整段是 markdown-library 的 markdown-library-lib.js 同一段的**逐字複製件**（markdown-library 的 scripts/test-cite-links.js 逐位元組比對）。
  /* ===================================================================
   * 行尾連結 → 膠囊〔owner 2026-11-15〕
   *   「…之佛。[Authority](https://…)」：連結是**那一行最後的東西、前面還有文字** ⇒ 它是出處，
   *   畫成約 0.8em 的膠囊（樣式在各 app 的 CSS，class 是 md-cite）。
   *   連結自成一段／一行（前面沒有文字，例如「- [標題](…)」的清單）⇒ 照舊是一般連結。
   *   句中的連結（「根據[CNBC](…)，…」——後面還有字）不算。
   *   - 「一行」以 <br> 與區塊子元素切（chat-notebook 的 marked 開 breaks:true，原文換行就是 <br>；
   *     markdown-library 沒開，同一段裡的原文換行畫出來本來就接在一起，不算行尾）。
   *   - 行尾連續幾個連結（以空白或「、，,；;」隔開）全部算。
   *   - 外面包一層 `(…)`／`（…）` 也算（ChatGPT 的另一種寫法：「… ([網站](…))」）；括號留著。
   * 純函式、不碰 DOM：控制器給一個區塊的子節點與分類函式——
   *   kindOf(node) → 'text'（要 textOf 讀字）｜'link'｜'break'（<br>、區塊子元素）｜'skip'（註解）｜'el'（其他行內元素：算「有內容」）
   * 回傳要畫成膠囊的那些 link 節點（依原順序）。
   * ⚠️ 權威版在 markdown-library 的 markdown-library-lib.js；chat-notebook／markdown-reader／local-reader 的 lib
   *    那一段是逐字複製件（markdown-library 的 scripts/test-cite-links.js 與 chat-notebook 的 verify ⑳ 逐位元組比對）。
   *    改這一段要四支一起改。
   * =================================================================== */
  var CITE_CLOSE_RE = /^\s*[)）]\s*$/;
  var CITE_OPEN_RE = /[(（]\s*$/;
  var CITE_SEP_RE = /^[\s、，,；;]*$/;
  function citeLinks(nodes, kindOf, textOf) {
    var out = [], line = [];
    function blank(it) { return it.k === 'text' && !/\S/.test(textOf(it.n)); }
    function flush() {
      var i = line.length - 1, paren = false, links = [], head, j;
      while (i >= 0 && blank(line[i])) i--;
      if (i >= 0 && line[i].k === 'text' && CITE_CLOSE_RE.test(textOf(line[i].n))) {
        paren = true;
        i--;
        while (i >= 0 && blank(line[i])) i--;
      }
      while (i >= 0 && line[i].k === 'link') {
        links.unshift(line[i].n);
        i--;
        // 連結與連結之間只准空白或分隔符號；分隔符號之前不是連結的話，它屬於前面的句子
        j = i;
        while (j >= 0 && line[j].k === 'text' && CITE_SEP_RE.test(textOf(line[j].n))) j--;
        if (j >= 0 && line[j].k === 'link') i = j;
        else while (i >= 0 && blank(line[i])) i--;
      }
      if (links.length) {
        if (paren) {
          head = i >= 0 && line[i].k === 'text' ? textOf(line[i].n).replace(/\s+$/, '') : '';
          if (!CITE_OPEN_RE.test(head)) links = [];                      // 收尾的括號沒有對應的開括號：不是包起來的出處
          else if (/\S/.test(head.replace(CITE_OPEN_RE, ''))) i = -2;    // 開括號前面同一段字裡就有內容
          else i--;
        }
        var content = i === -2;
        for (j = 0; !content && j <= i; j++) {
          content = line[j].k === 'el' || (line[j].k === 'text' && /\S/.test(textOf(line[j].n)));
        }
        if (content) out.push.apply(out, links);
      }
      line = [];
    }
    for (var n = 0; n < nodes.length; n++) {
      var k = kindOf(nodes[n]);
      if (k === 'break') flush();
      else if (k !== 'skip') line.push({ n: nodes[n], k: k });
    }
    flush();
    return out;
  }

  /* 編號出處「[1] (https://…)」→ 連結「[1]」〔owner 2026-11-20〕
   *   AI 回答複製出來的出處常是這個形狀（例：「…如來」。 [1] (https://cbetaonline…), [2] (https://…)」）：
   *   `]` 與 `(` 之間有空白 ⇒ markdown 不當成連結，GFM 再把網址自動連結 ⇒ 畫面上是整串網址。
   *   ⇒ render 之前換成 `[\[1\]](https://…)`：畫面上是連結「[1]」，在行尾時照 citeLinks() 的規則畫成膠囊。
   *   - 只認**數字**標籤（1～3 位）與 http(s) 網址（不含空白與括號）；`[文字] (url)` 可能真的是一句話，不碰。
   *   - 前面緊貼 `]`／`!`／`\`／字母數字的不碰（參照式連結、圖片、跳脫）。
   *   - 程式碼（``` ／ ~~~ 區塊與 `…`）不碰。
   *   純字串、不改原文（下載與存檔仍是原文）。冪等：換完 `]` 後面緊接 `(`，不再命中。 */
  var CITE_REF_RE = /(^|[^\]!\\0-9A-Za-z])\[(\d{1,3})\][ \t]+\((https?:\/\/[^\s()<>]+)\)/g;
  var CITE_CODE_RE = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/;
  function citeRefs(md) {
    return String(md == null ? '' : md).split(CITE_CODE_RE).map(function (seg, k) {
      return k % 2 ? seg : seg.replace(CITE_REF_RE, function (m, pre, n, url) { return pre + '[\\[' + n + '\\]](' + url + ')'; });
    }).join('');
  }
  // ⚠️ 行尾連結那一段到這裡為止。

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

    basename: basename,
    stem: stem,

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
    },

    // 行尾連結 → 膠囊（markdown-library 那一段的逐字複製件）
    citeLinks: citeLinks,
    citeRefs: citeRefs
  };

  window.MarkdownReaderLib = MarkdownReaderLib;
})(window);
