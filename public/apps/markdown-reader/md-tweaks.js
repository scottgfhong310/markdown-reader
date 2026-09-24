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
  //
  // ⚠ 還原必須**重複做到不再變動**，不可只做一趟。三趟遮罩是依序做的，而第三趟的
  // inline 正則 /`[^`\n]*`/ 會吃到「已含佔位符」的文字：內文寫「用單一反引號包住三個
  // 反引號」時（` ```math `），``` 先在第一趟被換成 NUL#NUL，外層那對單反引號隨後把它
  // 連同佔位符整段收進 stash——於是 stash 裡出現內含佔位符的片段。String.replace
  // **不會再掃描替換後的內容**，只做一趟就會讓內層佔位符（實體 NUL）殘留到輸出。
  // 那個 NUL 不寫進磁碟、不觸發家族「原始碼不得含 NUL」那條稽核，但它會進 DOM。
  //
  // 內層索引必定小於外層（stash 只增不減，內層是更早那趟推進去的），故巢狀深度不超過
  // 遮罩趟數；MAX_RESTORE 是病態輸入（原文自己就含 NUL 數字 NUL）的保險，不是正常路徑。
  // 認不得的索引原樣留著（不是換成字面的 "undefined"），迴圈以「字串不再變動」收斂。
  function withCodeMasked(md, transform) {
    var stash = [], NUL = String.fromCharCode(0), MAX_RESTORE = 8;
    function keep(m) { stash.push(m); return NUL + (stash.length - 1) + NUL; }
    var out = String(md == null ? '' : md)
      .replace(/```[\s\S]*?```/g, keep)   // ``` fenced code
      .replace(/~~~[\s\S]*?~~~/g, keep)   // ~~~ fenced code
      .replace(/`[^`\n]*`/g, keep);       // inline code
    out = transform(out);
    var ph = new RegExp(NUL + '(\\d+)' + NUL, 'g');
    for (var pass = 0; pass < MAX_RESTORE; pass++) {
      var prev = out;
      out = out.replace(ph, function (m, i) { return i in stash ? stash[i] : m; });
      if (out === prev) break;
    }
    return out;
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
    /* 禁則（kinsoku）修正〔2026-09-13〕：上限剛好切在「不可置於行首」的標點前面時，
     * 瀏覽器會把前一個字一起帶到下一行，於是兩行變三行。實例（T1185B）：
     *   「而也切，下同」6 字 → 3em → 應為 而也切／，下同，但「，」不可起行
     *   → 實際 而也／切，下／同（1280px 實測 3 行；上限 +1em 即回到 2 行）。
     * 「輕呼，下同」5 字 → 3em 不受影響：逗號落在第一行尾。
     * 同理，「不可置於行尾」的開括號落在第一行最後一格時會被推到下一行。
     * 解法：把切點往後推過行首禁則字、往前退過行尾禁則字，上限取兩行較長的那一行。
     * 只用於沒有手插 <br/> 的小註——有 <br/> 時每個半行都不寬於上限，不會再折行。 */
    var NO_START = /[、。，．：；？！）」』】〕〉》〗〙〛｝ー…‥・％,.:;?!)\]}]/;
    var NO_END = /[（「『【〔〈《〖〘〚｛(\[{]/;
    function kinsokuCap(text, cap) {
      var n = text.length, k = cap;
      while (k < n && NO_START.test(text.charAt(k))) k++;
      while (k > 0 && k < n && NO_END.test(text.charAt(k - 1))) k--;
      return Math.max(k, n - k, 1);
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
        else cap = kinsokuCap(s.slice(open.lastIndex, end).replace(/<[^>]*>/g, ''), cap);
        out += s.slice(last, m.index) + '<span' + attrs + ' style="max-width: ' + cap + 'em">';
        last = open.lastIndex;
      }
      return out + s.slice(last);
    });
  }

  /* 微調 8：<span class="siddham" data-latin="…"> 逐音節拆分〔owner 2026-09-21〕
   *   <span class="siddham" data-latin="bu̲ ṅva">𑖤𑗜𑖒𑖿𑖪</span>
   *   → <span class="siddham sy-split" data-latin="bu̲ ṅva"><span class="sy" data-latin="bu̲">𑖤𑗜</span><span class="sy" data-latin="ṅva">𑖒𑖿𑖪</span></span>
   * 讀音仍由 viewer.css 的 ::after 畫（不可選取 ⇒ 複製／搜尋拿到的仍是純悉曇，與拆分前相同）；
   * 逐音節或整行由 viewer 的 host 屬性 data-siddham 決定——**兩種顯示用的是同一份 markup**，
   * 外層的 data-latin 原樣留著給整行模式用，所以切換不必重新渲染。
   *
   * 音節＝一個基字＋其後的組合記號（\p{M}／\p{Cf}）；virama（U+115BF）把下一個基字黏進
   * 同一個音節（𑖒𑖿𑖪 是一個音節）。⚠ 不可改用 Intl.Segmenter：它的連寫規則（GB9c）
   * 只涵蓋少數印度文字、不含悉曇，會把 𑖒𑖿｜𑖪 拆成兩段。
   * 空白與悉曇標點（U+115C1–U+115D7，𑗂 等）原樣留著、不佔讀音——實測語料 17 個
   * 「對不上」全是 𑗂 造成的，扣掉之後 76/76 逐一對上。
   *
   * ⚠ 音節數 ≠ 讀音數時**不猜對位**：加 sy-mismatch（＋data-sy-count="音節/讀音"）、
   * 內容不拆，viewer.css 退回整行讀音並加標記。對錯位的讀音長得跟對的一模一樣。
   * 內容含標籤（<）、沒有 data-latin、或一個悉曇字都沒有的 span 不動；已處理過的不再處理（冪等）。
   * 字形拆進多個 inline 元素實測不影響成形（語料 77 串，寬度差 ≤ 0.07px）。跳過程式碼。 */
  function siddhamSyllables(md) {
    var VIRAMA = 0x115BF;
    function isMark(ch) { return /[\p{M}\p{Cf}]/u.test(ch); }
    function isPassThrough(cp, ch) {           // 空白、悉曇標點、悉曇區以外的字：不成音節
      return /\s/.test(ch) || (cp >= 0x115C1 && cp <= 0x115D7) || cp < 0x11580 || cp > 0x115FF;
    }
    function attr(attrs, name) {
      var m = attrs.match(new RegExp('\\s' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')'));
      return m ? (m[1] != null ? m[1] : m[2]) : null;
    }
    // 內容 → [{ syl:true, text } | { syl:false, text }]
    function segment(text) {
      var out = [], cur = null;
      Array.from(text).forEach(function (ch) {
        var cp = ch.codePointAt(0);
        if (isMark(ch) && cur && cur.syl) { cur.text += ch; cur.last = cp; return; }
        if (!isPassThrough(cp, ch)) {
          if (cur && cur.syl && cur.last === VIRAMA) { cur.text += ch; cur.last = cp; return; }
          cur = { syl: true, text: ch, last: cp }; out.push(cur); return;
        }
        cur = { syl: false, text: ch }; out.push(cur);
      });
      return out;
    }
    return withCodeMasked(md, function (s) {
      return s.replace(/<span(\s[^>]*)>([^<]*)<\/span\s*>/g, function (whole, attrs, body) {
        var cls = attr(attrs, 'class');
        if (cls == null) return whole;
        var list = cls.trim().split(/\s+/);
        if (list.indexOf('siddham') < 0 || list.indexOf('sy-split') >= 0 || list.indexOf('sy-mismatch') >= 0) return whole;
        var latin = attr(attrs, 'data-latin');
        if (latin == null || !latin.trim()) return whole;
        var parts = segment(body);
        var syls = parts.filter(function (p) { return p.syl; });
        if (!syls.length) return whole;
        var toks = latin.trim().split(/\s+/);
        var head = attrs.replace(/(\sclass\s*=\s*)(["'])([^"']*)\2/, function (m, pre, q, v) {
          return pre + q + v + (syls.length === toks.length ? ' sy-split' : ' sy-mismatch') + q;
        });
        if (syls.length !== toks.length) {
          return '<span' + head + ' data-sy-count="' + syls.length + '/' + toks.length + '">' + body + '</span>';
        }
        var k = 0;
        return '<span' + head + '>' + parts.map(function (p) {
          if (!p.syl) return p.text;
          return '<span class="sy" data-latin="' + toks[k++].replace(/"/g, '&quot;') + '">' + p.text + '</span>';
        }).join('') + '</span>';
      });
    });
  }

  /* 微調 9：「標點凡例」引言區塊＋其後的分隔線，包進 <div class="no-print">〔owner 2026-09-21〕
   *   > **標點凡例**               <div class="no-print">
   *   > ……                  →
   *                                > **標點凡例**
   *   ---                          > ……
   *
   *                                ---
   *
   *                                </div>
   * 凡例是給讀者的整理說明、不是經文本身，列印時不要（viewer.css 的 .no-print 在 @media print 隱藏）。
   * 語料 33 份裡 29 份已由作者手包，本微調把那個慣例自動化：
   *   · 觸發：一個以「標點凡例」開頭的引言區塊（`>` 後可帶 #／** 標記），且在空行之後緊接 `---`；
   *     沒有分隔線就不動——結構與 owner 指定的不同，不猜它的範圍。
   *   · 已包好的（前一個非空行就是 <div class="no-print">）不動 ⇒ 冪等，手包的 29 份輸出與原文逐位元組相同。
   *   · 引言區塊＝連續的 `>` 行（空行即結束）；原文行一字不動，只在前後加行。跳過程式碼。 */
  function noPrintLegend(md) {
    var HEAD = /^ {0,3}>\s*(?:#{1,6}\s*)?(?:\*\*)?標點凡例/;
    var HR = /^ {0,3}-{3,}\s*$/;
    var OPEN = /^\s*<div\s+class\s*=\s*["'][^"']*\bno-print\b[^"']*["']\s*>\s*$/;
    function bare(l) { return l.replace(/\r$/, ''); }
    return withCodeMasked(md, function (s) {
      var lines = s.split('\n'), out = [], i = 0;
      while (i < lines.length) {
        if (!HEAD.test(bare(lines[i]))) { out.push(lines[i++]); continue; }
        var j = i;
        while (j < lines.length && /^ {0,3}>/.test(bare(lines[j]))) j++;
        var k = j;
        while (k < lines.length && !bare(lines[k]).trim()) k++;
        var p = out.length - 1;
        while (p >= 0 && !bare(out[p]).trim()) p--;
        var wrapped = p >= 0 && OPEN.test(bare(out[p]));
        if (k === j || k >= lines.length || !HR.test(bare(lines[k])) || wrapped) {
          out = out.concat(lines.slice(i, j)); i = j; continue;
        }
        out.push('<div class="no-print">', '');
        out = out.concat(lines.slice(i, j));
        out.push('', lines[k], '', '</div>');
        // HTML 區塊（CommonMark type 6）在空行才結束：</div> 後緊接文字的話，那段會被吞進 HTML 區塊、不再當 markdown 渲染
        if (k + 1 < lines.length && bare(lines[k + 1]).trim()) out.push('');
        i = k + 1;
      }
      return out.join('\n');
    });
  }

  /* 微調 10：典籍目錄——單獨一行 <!-- toc --> 換成本檔 ##／### 標題的目錄〔owner 2026-09-24〕
   *   <!-- toc -->   →   <nav class="sutra-toc">
   *                       <div class="toc-title">目錄</div>
   *                       <div class="toc-item toc-h3"><span class="toc-text">一、問答立義・二經一論證文</span><span class="toc-ref"><span class="toc-leader"></span><span class="toc-code">[T2428_.77.0381b20]</span></span></div>
   *                       …
   *                       </nav>
   * · 觸發是**明示的**：只有作者寫了標記才產生。不以「檔內有段落編號」自動判斷——
   *   那會連音譯詞表（2,176 個編號）、跨檔目錄、字彙整理一起加上目錄。標記寫在哪一行，目錄就在哪一行
   *  （典籍的開頭是 No.／# 題／標點凡例／撰號，「目錄該在哪」推不出來，由作者定）。
   *   沒有這個微調的地方，HTML 註解本來就不顯示——標記本身是無害的。
   * · 收 ## 與 ###、不收 #（# 是文件題名，列進去只會多一個唯一的根）。
   * · **只收標記之後的標題**〔owner 2026-09-24 改；原為「前後都收」〕：目錄列的是它後面的內容。
   *   實例：目錄頁寫成 `## 卽身成佛義`／<!-- toc -->／分頁／正文 時，前後都收會把目錄頁自己的題名列進目錄，
   *   而且多出來的那一個 ## 會讓底下全部 ### 縮排。標記之後一個 ##／### 都沒有 → 標記原樣留著。
   * · 段落編號＝**標題之後第一個**「行首的」編號（沿用 十住心論目錄.md 的口徑）：
   *   父標題（其下直接是子標題、自己沒有段落）因此沿用第一個子節的編號，不會空著。
   *   只認行首——段落編號在語料裡一律是段首；行中的 [T…] 是引用別處，不是這一段的位置。
   *   兩種編號都認：SAT 頁欄行 [T2428_.77.0381b20] 與 CBETA 段號 [T0220-575-001]／[T1185A-001-002-03]。
   *   標題之後再也沒有編號時，那一列只有標題、沒有點線。
   * · 目錄**不是** markdown 標題（用 <nav>／<div>）：寫成 #### 目錄 的話，它自己會變成文件的一個標題，
   *   下一個掃標題的工具會把它當內容。點線引導由 viewer.css 畫（文字的 ..... 在 CJK／比例字型下對不齊）。
   *   點線＋編號包成一個 .toc-ref：窄螢幕上標題放不下時兩者要**一起**換到下一行（分開包的話點線留在上一行、編號單獨掉下去）。
   * · 標題文字：標籤原樣保留（<span class="note"> 小註照樣是小註，且後面的微調會照常處理它）；
   *   markdown 的 **粗體**／`碼`／[文字](網址) 轉成 HTML——<nav> 是 HTML 區塊，裡面的 markdown 不會被解析。
   * · 自己追蹤 ```／~~~ 圍欄、不用 withCodeMasked：遮罩會把標題裡的 `碼` 換成佔位符，還原後在 HTML 區塊裡
   *   顯示成字面的反引號。圍欄內的 #／標記一律不算。
   * · 冪等：標記被換掉之後就不存在了。第一期不做點擊跳轉。 */
  function sutraToc(md) {
    var MARK = /^[ \t]*<!--[ \t]*toc[ \t]*-->[ \t]*$/i;
    var HEAD = /^ {0,3}(#{2,3})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
    var CODE = /^[ \t]*\[([A-Z]{1,2}\d{3,4}[A-Za-z_]?(?:\.\d{2}\.\d{4}[a-z]\d{2}|(?:-\d{2,4}){2,3}))\]/;
    var FENCE = /^ {0,3}(`{3,}|~{3,})/;
    function inline(s) {
      return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .trim();
    }
    var src = String(md);
    var lines = src.split('\n'), inFence = null, marks = [], heads = [], codes = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].replace(/\r$/, ''), f = l.match(FENCE);
      if (inFence) {
        if (f && f[1].charAt(0) === inFence.charAt(0) && f[1].length >= inFence.length && !l.slice(f[0].length).trim()) inFence = null;
        continue;
      }
      if (f) { inFence = f[1]; continue; }
      if (MARK.test(l)) { marks.push(i); continue; }
      var h = l.match(HEAD);
      if (h && h[2].trim()) { heads.push({ at: i, level: h[1].length, text: inline(h[2]) }); continue; }
      var c = l.match(CODE);
      if (c) codes.push({ at: i, code: c[1] });
    }
    if (!marks.length || !heads.length) return src;
    var k = 0;
    var items = heads.map(function (h) {
      while (k < codes.length && codes[k].at < h.at) k++;
      var code = k < codes.length ? codes[k].code : null;
      return { at: h.at, html: '<div class="toc-item toc-h' + h.level + '"><span class="toc-text">' + h.text + '</span>' +
        (code ? '<span class="toc-ref"><span class="toc-leader"></span><span class="toc-code">[' + code + ']</span></span>' : '') + '</div>' };
    });
    marks.forEach(function (m) {
      var mine = items.filter(function (it) { return it.at > m; }).map(function (it) { return it.html; });
      if (!mine.length) return;                                   // 標記之後沒有 ##／### → 標記原樣留著
      // HTML 區塊（CommonMark type 6）在空行才結束：<nav> 內不得有空行，前後各要一個空行
      lines[m] = ['', '<nav class="sutra-toc">', '<div class="toc-title">目錄</div>'].concat(mine, ['</nav>', '']).join('\n');
    });
    return lines.join('\n');
  }

  // 依序套用的微調清單（之後要新增就往這裡加一個函式）
  // repairLatexMath 放最後：它產出的 $$ 區塊不再被其他微調（如 spaceBareTilde 的 ~）加工。
  // sutraToc 放最前：它讀的是作者寫的原文標題，而它抄進目錄的小註／悉曇 span 要與正文一樣被後面的微調處理。
  var TWEAKS = [
    sutraToc,
    inlineTagList,
    bareTagList,
    headerizeLabels,
    spaceBareTilde,
    spaceCjkBold,
    noteMaxWidth,
    siddhamSyllables,
    noPrintLegend,
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

  // withCodeMasked 一併導出：它的不變量（identity transform 必須逐位元組還原原檔）
  // 是 scripts/test-md-tweaks.js 的驗收條件，而該不變量正是巢狀佔位符那個 bug 破掉的東西。
  // 不導出就只能透過 apply() 間接觀察，而 apply() 本來就會改動文字、驗不了「逐位元組還原」。
  window.MdTweaks = { apply: apply, tweaks: TWEAKS, withCodeMasked: withCodeMasked };
})(window);
