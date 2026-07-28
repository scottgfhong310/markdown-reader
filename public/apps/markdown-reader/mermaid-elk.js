/**
 * mermaid-elk.js — 讓 zero-md 的 mermaid 圖改用 ELK 排版（家族共用 utility，byte-identical 同步）
 *
 * 為什麼需要：mermaid 主套件只內建 dagre 一種排版引擎。ELK（`@mermaid-js/layout-elk`）是**獨立套件**，
 * 必須在 render 前呼叫 `mermaid.registerLayoutLoaders()` 註冊進去，圖裡的
 * `--- config: { layout: elk } ---` 才吃得到；沒註冊時 mermaid **靜默退回 dagre**（不報錯、不留痕）。
 *
 * 怎麼做到：zero-md v3 的 `load(options)` 接受「載入器覆寫」——`options.mermaid` 就是
 * 「去哪裡拿 mermaid 模組」的那個函式。本檔把它換成「先註冊 ELK 再回傳 mermaid」的版本。
 *
 * **一定要在第一張 mermaid 圖 render 之前呼叫**：zero-md 把 mermaid 模組存成**模組級單例**
 * （`h ||= await loader()`），任何一張圖畫過之後，全頁所有 zero-md 實例都重用那個沒有 ELK 的實例，
 * 再覆寫也沒用。
 *
 * 依賴：無（原生 dynamic import）。mermaid／elk 皆走 jsDelivr，與 zero-md 自己的慣例一致。
 *
 * 用法：
 *   1. index.html 在**控制器之前**載入本檔（與其他共用 utility 並列即可）。
 *   2. 控制器在**首次** `viewer.render()` 之前串一段：
 *        return window.MermaidElk ? MermaidElk.install(viewer) : null;
 *      回傳 Promise，可直接接進既有的 then 鏈；重複呼叫是安全的（每個元素只裝一次）。
 *
 * 失敗行為（刻意）：ELK 載不到 → console.warn 後**照樣回傳 mermaid**，圖用 dagre 畫出來；
 * `install()` 任何錯誤都吞掉並 resolve(false)。失敗面與原生 zero-md 相同——
 * 只有 mermaid 本身載不到才會影響 render，多掛的 ELK 不會把閱讀器一起拖下水。
 */
(function (window) {
  'use strict';

  // 與 zero-md v3 內建載入器同源、同大版本（zero-md 取 mermaid@11 的 esm build）
  var MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  var ELK_URL = 'https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs';

  var enginePromise = null;   // 全頁只載一次；zero-md 的載入器也只會被呼叫一次

  function warn(msg, err) {
    console.warn('[mermaid-elk] ' + msg, (err && err.message) || err || '');
  }

  // 回傳「已註冊 ELK 的 mermaid 模組」；ELK 出事就回傳沒註冊的 mermaid（退回 dagre）
  function engine() {
    if (!enginePromise) {
      enginePromise = import(MERMAID_URL).then(function (mod) {
        var mermaid = mod.default || mod;
        return import(ELK_URL).then(function (elkMod) {
          try {
            mermaid.registerLayoutLoaders(elkMod.default || elkMod);
          } catch (err) {
            warn('registerLayoutLoaders 失敗，改用 dagre 排版：', err);
          }
          return mermaid;
        }, function (err) {
          warn('ELK 載入失敗，改用 dagre 排版：', err);
          return mermaid;
        });
      });
    }
    return enginePromise;
  }

  // 把 ELK 載入器裝進一個 <zero-md> 元素；回傳 Promise<boolean>（是否裝上）
  function install(el) {
    if (!el) return Promise.resolve(false);
    if (el.__mermaidElk) return el.__mermaidElk;

    var defined = (window.customElements && customElements.whenDefined)
      ? customElements.whenDefined('zero-md')
      : Promise.resolve();

    el.__mermaidElk = defined.then(function () {
      if (typeof el.load !== 'function') throw new Error('zero-md load() 不存在');
      // 覆寫載入器；其餘（marked／hljs／katex…）沿用 zero-md 預設值
      return el.load({ mermaid: engine });
    }).then(function () {
      return true;
    }, function (err) {
      warn('安裝失敗，mermaid 退回 dagre 排版：', err);
      return false;
    });

    return el.__mermaidElk;
  }

  window.MermaidElk = { install: install, MERMAID_URL: MERMAID_URL, ELK_URL: ELK_URL };
})(window);
