/**
 * md-tweaks.js — markdown 內容微調（依序套用的小修正）
 *
 * 在「渲染前」對 .md 原文做不改變語意、只調整呈現結構的微調。純字串轉換、不碰 DOM。
 * 下載仍是原檔（state.text），微調只影響顯示——比照文體格式化 formatMd 的慣例。
 *
 * 新增微調＝寫一個 (md:string) => string 的純函式，再加進下方 TWEAKS 陣列（依序套用）。
 * IIFE → window.MdTweaks（apply(md) / tweaks）。
 */
(function (window) {
  'use strict';

  // 把程式碼（``` / ~~~ fenced 與 `…` inline）暫存成 NUL 佔位，套用 transform 後還原，
  // 讓微調不會動到程式碼內容。NUL 邊界不含 ~ / *、也不會撞到內文。
  function withCodeMasked(md, transform) {
    var stash = [], NUL = String.fromCharCode(0);
    function keep(m) { stash.push(m); return NUL + (stash.length - 1) + NUL; }
    var out = String(md == null ? '' : md)
      .replace(/```[\s\S]*?```/g, keep)   // ``` fenced code
      .replace(/~~~[\s\S]*?~~~/g, keep)   // ~~~ fenced code
      .replace(/`[^`\n]*`/g, keep);       // inline code
    out = transform(out);
    return out.replace(new RegExp(NUL + '(\\d+)' + NUL, 'g'), function (m, i) { return stash[+i]; });
  }

  /* 微調 1：**Tags** 後的 hashtag 清單 → 收成單行、每個 tag 以反引號包成行內碼。
   * 兩種輸入都吃：
   *   項目清單              單行（可能已含反引號）
   *   - #概念釋義           #概念釋義 #情感經濟 …
   *   - #情感經濟
   *   …
   * 兩者都 →  `#概念釋義` `#情感經濟` …
   * 只在該區塊「只由 tag／項目符號／反引號／空白 構成」時才處理，避免動到一般段落或清單。 */
  function inlineTagList(md) {
    return md.replace(
      /(\*\*Tags\*\*)[ \t]*\r?\n[ \t]*\r?\n([^\r\n]+(?:\r?\n[^\r\n]+)*)/g,
      function (whole, head, block) {
        // token 同時吃 #x 與跳脫寫法 \#x（輸出時去掉跳脫）
        var tokens = block.match(/\\?#[^\s`]+/g);
        if (!tokens || !tokens.length) return whole;
        // block 去掉 tag / 項目符號 / 反引號 / 空白後若還有東西，代表不是純 tag 區 → 不動
        if (block.replace(/\\?#[^\s`]+/g, '').replace(/[-*`\s]/g, '')) return whole;
        // 不補尾端換行：block 後原本的換行仍在，由它收尾（避免多一個空行）
        return head + '\n\n' + tokens.map(function (t) { return '`' + t.replace(/^\\/, '') + '`'; }).join(' ');
      }
    );
  }

  /* 微調 1b：「沒有 **Tags** / ## Tags 標題」的純 hashtag 區塊，也收成單行行內碼。
   * 以空行分隔的區塊為單位：整塊「只由 tag／項目符號／反引號／空白 構成」才處理（同 #1 的保護），
   *   - #概念釋義          #概念釋義
   *   - #情感經濟    或    #情感經濟     →   `#概念釋義` `#情感經濟`
   * 一般段落／表格／混有其他文字的清單不動；跳過程式碼（遮罩）；已是行內碼單行者重組結果相同（冪等）。 */
  function bareTagList(md) {
    return withCodeMasked(md, function (s) {
      // 以捕捉群組 split：奇數位是「空行分隔符」原樣保留，偶數位才是區塊內容
      var parts = s.split(/(\r?\n[ \t]*\r?\n)/);
      for (var i = 0; i < parts.length; i += 2) {
        var block = parts[i];
        var tokens = block.match(/\\?#[^\s`]+/g);   // 同時吃 #x 與跳脫寫法 \#x
        if (!tokens || !tokens.length) continue;
        if (block.replace(/\\?#[^\s`]+/g, '').replace(/[-*`\s]/g, '')) continue;   // 非純 tag 區 → 不動
        // 保留區塊頭尾的原有空白（如連續空行的第三個 \n），只重組中間內容
        var lead = (block.match(/^\s*/) || [''])[0];
        var tail = (block.match(/\s*$/) || [''])[0];
        parts[i] = lead + tokens.map(function (t) { return '`' + t.replace(/^\\/, '') + '`'; }).join(' ') + tail;
      }
      return parts.join('');
    });
  }

  /* 微調 1c：整行只有 **Key words** 或 **Tags** 這種「粗體偽標題」，升級成真正的 #### 標題。
   *   **Key words**   →   #### Key words
   *   **Tags**        →   #### Tags
   * 必須放在 #1（inlineTagList）/ #1b（bareTagList）之後：那兩個微調靠偵測整段 **Tags** 粗體
   * 文字來觸發後面 hashtag 清單的收合；若先轉成標題，**Tags** 就不存在了、觸發不到。
   * 只吃「整行剛好只有這個粗體詞」（trim 後完全相等），避免誤傷句子中提到的 **Tags**；
   * 已是 #### 標題者不會再被吃到（冪等）。跳過程式碼（遮罩）。 */
  function headerizeLabels(md) {
    return withCodeMasked(md, function (s) {
      return s.replace(/^[ \t]*\*\*(Key words|Tags)\*\*[ \t]*$/gm, '#### $1');
    });
  }

  /* 微調 2：把「前後皆無空白的單一 ~」補成 ` ~ `（前後各一個空白）。
   *   Option 1~Option 7   →   Option 1 ~ Option 7
   * 否則成對的單一 ~ 會被 GFM 當刪除線分隔符（~text~）。跳過程式碼；不動雙波浪 ~~刪除線~~
   *（單 ~ 緊鄰另一個 ~ 時不處理）。 */
  function spaceBareTilde(md) {
    return withCodeMasked(md, function (s) {
      return s.replace(/(?<=[^\s~])~(?=[^\s~])/g, ' ~ ');
    });
  }

  /* 微調 3：CJK 場景下，全形開引號/括號（「『（《… in OPEN）緊貼 ** 時，GFM/marked 的 flanking
   * 規則會認不出粗體分隔符，於是在外側補一個空白。兩種觸發各補在不同側：
   *   A) 開頭 **「…」**（內容以 CJK 開括號開頭）：開頭 ** 夾在「CJK 字 + 開括號」間 → 不算合法開強調
   *      → 於 span 前補空白（結尾沿用「** 後緊跟非空白字就補」）：
   *        追蹤的**「真言」雙重語境問題**。  →  追蹤的 **「真言」雙重語境問題** 。
   *   B) 一般 **粗體**：只有當收尾 ** 緊跟 CJK 開括號（**…**（）時 marked 認不出收尾分隔符
   *      → 僅在 span 與該開括號間補一個空白（不動開頭）：
   *        **立基**（六大為體…）  →  **立基** （六大為體…）
   *   C) 內容以 CJK 閉括號「結尾」且後面緊接文字（**…）**傳）：收尾 ** 前是標點、後是字
   *      → 不算合法收強調（flanking 2b 不成立）→ 於 span 前、後各補一個空白：
   *        淨土教的**他力（tariki）**傳統  →  淨土教的 **他力（tariki）** 傳統
   * 單次掃描：把「可選的前一字」連同 span 一起消耗（收尾 ** 被吃掉，就不會被當成另一個 **（…**
   * 的開頭——例：**「甲」**（…**乙** 中那組收尾 ** + （ 不會誤配）。後一字用 charAt 前看、不消耗，
   * 所以兩個相鄰粗體共用的中間字也能各自補對。跳過程式碼。 */
  function spaceCjkBold(md) {
    var OPEN = '「『（《【〈〔［｛“‘';                                   // CJK / 全形 開引號・括號
    var CLOSE = '」』）》】〉〕］｝”’';                                  // CJK / 全形 閉引號・括號
    var re = new RegExp('([^\\s*])?(\\*\\*(?:(?!\\*\\*)[^\\n])+\\*\\*)', 'g');
    return withCodeMasked(md, function (s) {
      return s.replace(re, function (m, before, span, offset, str) {
        var startsOpen = OPEN.indexOf(span.charAt(2)) >= 0;   // 開頭 ** 後第一個內容字是否為 CJK 開括號
        var endsClose = CLOSE.indexOf(span.charAt(span.length - 3)) >= 0;   // 收尾 ** 前一個內容字是否為 CJK 閉括號
        var after = str.charAt(offset + m.length);
        var beforeSpace, afterSpace;
        if (startsOpen) {                                     // A：bracket-led span（既有行為）
          beforeSpace = (before != null);
          afterSpace = !!(after && after !== '*' && !/\s/.test(after));
        } else if (endsClose) {                               // C：bracket-tailed span → 需要修時兩側都補
          afterSpace = !!(after && after !== '*' && !/\s/.test(after));
          beforeSpace = (before != null) && afterSpace;
        } else {                                              // B：一般粗體，只補「**（」這種收尾
          beforeSpace = false;
          afterSpace = !!(after && OPEN.indexOf(after) >= 0);
        }
        return (before == null ? '' : before) + (beforeSpace ? ' ' : '') + span + (afterSpace ? ' ' : '');
      });
    });
  }

  /* 微調 4：把 LaTeX 區塊公式修成 zero-md（KaTeX）吃得下的 $$…$$。兩種輸入：
   *   A) 正規 LaTeX 的 \[ … \]  →  $$ … $$（KaTeX 只認 $ 系列，方括號寫法原樣印出）
   *   B) ChatGPT 匯出時反斜線被吃掉、只剩單獨成行的 [ … ]  →  同上
   * B 是「猜」，故層層設限：整行剛好只有 [ / ]、區塊內不得有空行、40 行以內，
   * 且內容要像數學（含 \巨集，或純 ASCII 且有 = ^ _ 其中之一）——一般段落／markdown
   * 連結（[文字](url) 不會整行只有一個中括號）都碰不到。不符就原樣留著，不吞內容。
   * 轉換的同時修三個被吃掉／會誤判的東西（只在區塊內）：
   *   ① 行尾單一 \ → \\（換行；cases／bmatrix 各列靠它分行）
   *   ② 數字後的 % → \%（% 在 LaTeX 是註解字元，5% 會吃掉整行後半；只認緊跟數字者，
   *      不動可能是真註解的 %）
   *   ③ 裸中文 → \text{…}（該行已有 \text{ 就不動，避免巢狀）
   * 行內公式 \( … \) 亦轉成 $…$；但**不修**被吃掉的行內版——那已與一般括號無異（(P^5)），
   * 猜了會誤傷正文，需人工補 $。跳過程式碼（遮罩）。冪等（轉完不再有 [ / ] 可觸發）。 */
  function repairLatexMath(md) {
    var CJK = /[㐀-鿿　-〿＀-￯]+/g;
    function looksLikeMath(lines) {
      if (!lines.length || lines.length > 40) return false;
      var body = lines.join('\n');
      if (!body.trim()) return false;
      if (lines.some(function (l) { return !l.trim(); })) return false;   // 區塊內有空行 → 不是公式
      if (lines.some(function (l) { return /^[ \t]*([-*+>#|]\s|\d+\.\s)/.test(l); })) return false;   // 像清單/表格/標題 → 不是公式
      if (/\\[a-zA-Z]/.test(body)) return true;                          // 有 LaTeX 巨集
      // 純 ASCII ＋ 至少一個算式符號 ＋ 至少一個字母或數字（P(Bull)-P(Bear)、Signal=0.75-0.05 這種）
      return /^[\x20-\x7E\n]*$/.test(body) && /[=^_+\-*/|]/.test(body) && /[A-Za-z0-9]/.test(body);
    }
    function fixLine(l) {
      l = l.replace(/(?<!\\)\\[ \t]*$/, '\\\\');                         // ① 行尾單一 \
      l = l.replace(/(?<=\d)%/g, '\\%');                                 // ② 5% → 5\%
      if (l.indexOf('\\text{') < 0) l = l.replace(CJK, function (m) { return '\\text{' + m + '}'; });
      return l;
    }
    return withCodeMasked(md, function (s) {
      s = s.replace(/\\\(([^\n]+?)\\\)/g, function (m, inner) { return '$' + inner.trim() + '$'; });
      var lines = s.split('\n'), out = [], buf = null, open = -1;
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (buf === null) {
          if (t === '[' || t === '\\[') { buf = []; open = i; }
          else out.push(lines[i]);
          continue;
        }
        if (t === ']' || t === '\\]') {
          if (looksLikeMath(buf)) out.push('$$', buf.map(fixLine).join('\n'), '$$');
          else out.push(lines[open], buf.join('\n'), lines[i]);           // 不像公式 → 原樣還原
          buf = null;
          continue;
        }
        buf.push(lines[i]);
        if (buf.length > 40) { out.push(lines[open]); out = out.concat(buf); buf = null; }   // 沒收尾 → 放棄
      }
      if (buf !== null) { out.push(lines[open]); out = out.concat(buf); }  // 檔尾未收尾：原樣吐回
      return out.join('\n');
    });
  }

  /* 微調 5：<span class="note"> 依字數自動補 max-width，讓小註自然折成兩行左右。
   *   <span class="note">梵云踰繕那，此十六里，云由旬、由延，皆訛略也。</span>
   *   → <span class="note" style="max-width: 12em">…</span>（23 字 → 23/2 = 11.5 → 進位 12）
   * 值＝ceil(內容字數 / 2)，單位 em——em 跟著 .note 自身字級走，列印放大與 config 換字型都不走樣
   *（viewer.css 那條註解寫明「一律用 em 不用 px」）。這等於把作者原本「在內容長度約 1/2 處
   * 手插 <br/>」那個慣例自動化：CJK 一字約一 em 寬，上限取一半即折成兩行，再由 text-wrap:
   * balance 把兩行勻分。
   * 字數不計內層標籤（<br/> 等）——手插的 <br/> 是斷行指示不是內容，計進去會把上限撐寬。
   *
   * 作者已手插 <br/> 時，上限取 max(字數/2, 最長半行)：<br/> 切出的半行本來就是作者要的
   * 一行，若上限比它窄，那一行會再被折斷——2 行變 4 行，比不加上限還糟。實測語料 147 條
   * 手插 <br/> 的小註中，23 條的最長半行超過 字數/2（作者切得不對半）。
   * ⚠ 「最長半行」只在真的有 <br/> 時參與比較：沒有 <br/> 就只有一段＝全文，
   * max(n/2, n) 會等於 n＝形同沒有上限，整個微調對那 203 條會失效。
   * 已自帶 style=（作者手設 --note-max 或 max-width）者不動：作者的明示優先，這也讓本微調冪等。
   * class 以空白切開後逐項比對，不用 /note/ 子字串（避免吃到 footnote／note-x）。跳過程式碼。
   *
   * ⚠ 收尾的 </span> 要**數深度**找，不能用非貪婪比到第一個 </span>：實測語料 430 條小註中
   * 有 16 條內含巢狀 <span>（.glyph 缺字、.nowrap 不斷行群組），非貪婪只會數到內層那個
   * 收尾為止，字數偏低、上限被壓窄。這種錯不會報錯，只會讓那 16 條多折一行。
   * 只在開頭標籤插入 style、其餘原文一字不動（不重組內容，避免動到巢狀結構）。
   *
   * 長註自帶保險：上限與字數等比，6000 字的註得到 3000em＝形同無上限，
   * 仍在段落寬度處自然折行——viewer.css 註解警告的「固定上限把長註壓成又窄又高的一柱」
   * 在這裡不成立，因為這個上限根本不固定。 */
  function noteMaxWidth(md) {
    // 自 from 起數 <span>/</span> 深度，回傳與外層配對的那個 </span> 的位置（找不到回 -1）
    function matchingClose(s, from) {
      var tok = /<span\b[^>]*>|<\/span\s*>/gi, depth = 1, t;
      tok.lastIndex = from;
      while ((t = tok.exec(s))) {
        if (t[0].charAt(1) === '/') { if (--depth === 0) return t.index; }
        else depth++;
      }
      return -1;
    }
    return withCodeMasked(md, function (s) {
      var open = /<span([^>]*)>/g, m, out = '', last = 0;
      while ((m = open.exec(s))) {
        var attrs = m[1];
        var cls = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/);
        if (!cls || cls[1].trim().split(/\s+/).indexOf('note') < 0) continue;
        if (/\bstyle\s*=/.test(attrs)) continue;                  // 作者已明示 → 不動
        var end = matchingClose(s, open.lastIndex);
        if (end < 0) continue;                                    // 沒收尾 → 不動，不吞內容
        // 依手插的 <br/> 切成半行，各自去掉標籤後數字；沒有 <br/> 就只有一段
        var segs = s.slice(open.lastIndex, end).split(/<br\s*\/?>/i)
          .map(function (x) { return x.replace(/<[^>]*>/g, '').length; });
        var n = segs.reduce(function (a, b) { return a + b; }, 0);   // 不計 <br/> 等標籤
        if (!n) continue;
        var cap = Math.ceil(n / 2);
        if (segs.length > 1) cap = Math.max(cap, Math.max.apply(null, segs));   // 不窄於作者切出的最長半行
        out += s.slice(last, m.index) + '<span' + attrs + ' style="max-width: ' + cap + 'em">';
        last = open.lastIndex;
      }
      return out + s.slice(last);
    });
  }

  // 依序套用的微調清單（之後要新增就往這裡加一個函式）
  // repairLatexMath 放最後：它產出的 $$ 區塊不再被其他微調（如 spaceBareTilde 的 ~）加工。
  var TWEAKS = [
    inlineTagList,
    bareTagList,
    headerizeLabels,
    spaceBareTilde,
    spaceCjkBold,
    noteMaxWidth,
    repairLatexMath
  ];

  function apply(md) {
    var text = String(md == null ? '' : md);
    for (var i = 0; i < TWEAKS.length; i++) {
      try { text = TWEAKS[i](text); }
      catch (e) { console.error('[md-tweaks] 第 ' + i + ' 個微調失敗，略過：', e); }
    }
    return text;
  }

  window.MdTweaks = { apply: apply, tweaks: TWEAKS };
})(window);
