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
        var tokens = block.match(/#[^\s`]+/g);
        if (!tokens || !tokens.length) return whole;
        // block 去掉 tag / 項目符號 / 反引號 / 空白後若還有東西，代表不是純 tag 區 → 不動
        if (block.replace(/#[^\s`]+/g, '').replace(/[-*`\s]/g, '')) return whole;
        // 不補尾端換行：block 後原本的換行仍在，由它收尾（避免多一個空行）
        return head + '\n\n' + tokens.map(function (t) { return '`' + t + '`'; }).join(' ');
      }
    );
  }

  /* 微調 2：把「前後皆無空白的單一 ~」補成 ` ~ `（前後各一個空白）。
   *   Option 1~Option 7   →   Option 1 ~ Option 7
   * 否則成對的單一 ~ 會被 GFM 當刪除線分隔符（~text~）。
   * 保護：跳過程式碼（``` / ~~~ fenced 與 `…` inline），且不動刻意的雙波浪 ~~刪除線~~
   *      （單 ~ 緊鄰另一個 ~ 時不處理）。 */
  function spaceBareTilde(md) {
    var stash = [];
    var NUL = String.fromCharCode(0);   // placeholder 邊界：不含 ~（不被下面 tilde 規則動到）、也不撞內文
    function keep(m) { stash.push(m); return NUL + (stash.length - 1) + NUL; }
    var out = String(md == null ? '' : md)
      .replace(/```[\s\S]*?```/g, keep)   // ``` fenced code
      .replace(/~~~[\s\S]*?~~~/g, keep)   // ~~~ fenced code
      .replace(/`[^`\n]*`/g, keep);       // inline code
    out = out.replace(/(?<=[^\s~])~(?=[^\s~])/g, ' ~ ');
    var re = new RegExp(NUL + '(\\d+)' + NUL, 'g');
    return out.replace(re, function (m, i) { return stash[+i]; });
  }

  // 依序套用的微調清單（之後要新增就往這裡加一個函式）
  var TWEAKS = [
    inlineTagList,
    spaceBareTilde
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
