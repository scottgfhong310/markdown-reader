# markdown-reader — 設計文件（DESIGN）

> 拖拉上傳、即時閱讀與列印 Markdown 的單頁 WebApp。本文件說明架構、資料流與各子系統的設計取捨；逐步使用說明見 [README.md](README.md)。

---

## 1. 定位

把 `.md` / `.txt` **拖拉上傳**到伺服器資料夾 `public/upload/markdown-reader/`，立即以 `zero-md` 渲染閱讀並可列印。內容與程式碼分離。沒有 page header / footer，所有操作集中在**右側浮動工具列**。

與姊妹作 **markdown-library** 共用同一套「渲染 / 主題 / 閱讀風格 / i18n / 列印 / 版型」核心，唯一根本差異是**讀入方式**：本作＝上傳；library＝策劃式文庫＋網址深連結。

---

## 2. 技術棧（皆以 `<script>` / `<link>` 引入，無 build step）

| 相依 | 用途 |
|---|---|
| `zero-md@3` | Web Component，內部 `marked` + `highlight.js`，渲染進 **shadow DOM** |
| `github-markdown-css@5` | 內容 light / dark 主題 |
| `highlight.js@11` styles | 程式碼區塊 light / dark 配色 |
| Materialize 1.0 | Sidenav / Toast / Modal |
| jQuery 3.7 · Lodash 4 | DOM 事件 · `_.escape` 等 |
| PT Serif（自託管）/ Noto Serif TC·JP（懶載） | newsprint 閱讀風字型 |
| Noto Sans Siddham · Charis SIL · Gentium Plus（Google Fonts） | 悉曇字形＋拉丁轉寫 |
| Express | 靜態檔 ＋ 兩支 API ＋ 共用 upload |

---

## 3. 檔案職責

| 檔案 | 角色 |
|---|---|
| `index.html` | 純結構：側欄、空狀態、`<zero-md>` 樣式分層 template、右側工具、config modal |
| `markdown-reader.js` | **控制器（glue）**：主題 / 風格 / i18n / 格式化 / 列印 / 渲染 / 開檔 / 清單 / 上傳 / 拖拉 / config 面板 |
| `markdown-reader-lib.js` | **純邏輯庫** `MarkdownReaderLib`：伺服器溝通（upload / list / clear）、讀檔、下載、`fetchConfig`、檔名/時間戳工具（不碰 DOM） |
| `md-tweaks.js` | `MdTweaks`：**渲染前**對 .md 原文做純字串微調 |
| `i18n.js` + `locales/{zh-Hant,en,ja}.js` | 極簡多語引擎 ＋ 字典 |
| `markdown-reader.css` | app 外殼：版面、主題 CSS 變數、側欄、空狀態、載入動畫 |
| `viewer.css` | **zero-md shadow DOM 內**的內容樣式（含列印規則與版型 class） |
| `viewer-newsprint.css` | newsprint 閱讀風皮膚（疊在 github-markdown 上） |
| `newsprint-fonts.css` | PT Serif 自託管 ＋ Noto Serif 懶載 |
| `side-tool.css` | 右側工具列定位 ＋ config modal 主題 |
| `thinking-dot.css` | 載入中脈動點 |
| `config.json` | app 設定：列印分頁 / 字型 / printScale |

---

## 4. 資料流（開一個檔）

```
檔名（上傳回應 / 側欄點擊）
  └─ L.fetchText(name) ─────────────► state.text   ← 原文（下載永遠用這份）
        └─ 顯示前處理（只影響顯示，不改 state.text）
             1. MdTweaks.apply(md)          純字串微調
             2. 若格式化開：MdFormater.format(md)
        └─ 注入 <script type="text/markdown"> slot → viewer.render()
        └─ 渲染後：注入程式碼複製鈕、套用字型 / 列印設定
```

**核心不變式**：`state.text` 恆為原始檔，所以「下載」拿到的永遠是原檔（不含微調 / 格式化）。

---

## 5. 子系統

### 5.1 zero-md 與 shadow DOM 樣式分層
`index.html` 的 `<zero-md><template>` 內，樣式**依序**載入（後者覆寫前者）：
1. `<link id="md-md-css">` github-markdown light/dark（JS 切 href）
2. `<link id="md-hl-css">` highlight.js light/dark
3. `viewer.css`（自訂內容樣式 ＋ `@media print`）
4. `<link id="md-skin-css" media>` newsprint 皮膚（github 風時 `media="not all"` 停用）
5. `<style id="md-font">` config 字型覆寫
6. `<style id="md-print-scale">` 列印字級放大

`@font-face` 在**主文件**宣告，shadow DOM 內容亦可使用。

### 5.2 主題 light / dark
`<html data-theme>` ＋ CSS 變數（markdown-reader.css 定義 light/dark 兩組）；viewer host `data-mode` 讓 newsprint 皮膚跟著切；內容主題切 `md-md-css` / `md-hl-css` 的 href。記憶於 `localStorage('markdown-reader-theme')`，`<head>` 內有防閃爍 inline script。列印時 `beforeprint` 強制 light、`afterprint` 還原。

### 5.3 閱讀風格 github / newsprint
side tool `newspaper` toggle：啟用 / 停用 `md-skin-css`（viewer-newsprint.css，報紙襯線紙感）。記憶於 `localStorage('markdown-reader-style')`。

**dark 下兩風同畫布（2026-07-17 收斂）**：newsprint 的 light 保留原本的紙感底（`#f3f2ee`），但 dark 原本是「暖調紙夜」`#1b1813`——它與 app 的 `.viewer-card`（`--card-bg: #0f1115`）不同色，文件會像一塊貼在冷色頁面上的暖色紙，接縫外露。現改為墨色（text / link / rule / quote）續留暖調襯線性格、**底色全部對齊 GitHub 閱讀風**：

| token | 值 | 說明 |
|---|---|---|
| `--np-bg` | `var(--card-bg, #0f1115)` | 吃 app 的 `:root` token——自訂屬性會穿透 shadow DOM 邊界繼承進來，所以皮膚檔不必寫死任一支 app 的配色，維持家族六份 byte-identical |
| `--np-code-bg` / `--np-thead-bg` / `--np-row-alt` | `#151b23` | ＝ github-markdown-css dark 的 canvas-subtle |

結果：dark 下切換 github ↔ newsprint 只換字體與墨色，畫布不動。

### 5.4 i18n
`i18n.js`：register 式、屬性綁定 `data-i18n` / `-html` / `-title` / `-doctitle`、程式內 `I18n.t(key, params)`。`DEFAULT='zh-Hant'`；初始語系解析順序 `?lang=` → `localStorage('lang')` → 瀏覽器語言 → `zh-Hant`。side tool `translate` 依註冊順序（zh-Hant → en → ja）循環，派發 `document` 事件 `i18n:changed`，控制器據此重繪由 JS 產生的動態文字。

### 5.5 config.json
`MarkdownReaderLib.fetchConfig()` → `mergeConfig()`：缺檔 / 壞檔 / 缺鍵都回後備預設，**永不 reject**。欄位：
- `print.{keepTableTogether, keepListTogether, pageBreakBeforeH1, allowBlockBreak, allowRowBreak}`
- `viewFont / printFont / codeFont / codePrintFont`：`{ apply, family, size }`
- `printScale`：列印字級放大倍率（預設 1.25）

控制器在載入時把設定轉成 viewer 的 host 屬性與字型 `<style>`。

### 5.6 列印管線
- **@page**：`#print-runtime-style` 動態寫入 `size`（方向）＋頁尾（左下檔名、右下頁碼）。
- **內容分頁**（viewer.css `@media print`）：
  - 預設保護：`h1–h6` 不落頁尾、`p/blockquote/pre` 整塊不切、`table tr` 單列不切＋`thead` 跨頁重印。
  - host 屬性開關：`data-print-keep`（`table` / `list` 整塊不切）、`data-print-break`（`h1` 換頁）、`data-print-allow`（`block` / `row` 放寬保護）。
  - 來源：config.json 為預設，**config 面板**（`localStorage('markdown-reader-print')`）覆寫。
- **列印字級放大**：side tool toggle → `md-print-scale` 寫 `@media print` 的字級 × `printScale`。
- **`.no-print` / `.screen-only`**：螢幕可讀、列印 `display:none`。
- 深底 inline-style SVG 在列印反白為淺底（屬性選擇器）；複製鈕列印隱藏。
- **dark 列印黑底修正（2026-07-18，`markdown-reader.css` `@media print`）**：`:root { color-scheme: dark }` 讓瀏覽器把畫布塗成 UA 預設深色（Chrome ＝ `#121212`），是 UA 層畫布、`html{background:#fff!important}` 蓋不到 → dark 列印整頁黑底、只有內容區白。補 `:root{color-scheme:light!important}`＋關掉 `body` 主題過渡（`transition:none`，否則列印取樣在過渡起點抓到深色）。家族級說明見 DESIGN_GUIDELINES §5.1。
- **等寬字列印用 Regular（`viewer.css` `@media print`）**：螢幕 Sarasa Light 印在紙上偏淡，列印改 `'等距更紗黑體 TC'`（＝Regular）＋`font-weight:400`（macOS 上英文名只配得到 Light 字面）。詳見 DESIGN_GUIDELINES §4.4。
- **code block 列印（`viewer.css` `@media print`）**：`overflow:visible; white-space:pre-wrap`（螢幕的 `overflow-x:auto` 在紙上會**裁掉過長的行**、內容無聲遺失）＋細外框＋淡底。
- **blockquote 列印縮排寫死＋常駐 `media="print"` github 樣式（防 CDN race）**：`beforeprint` 換 github 樣式表 href 觸發 CDN 重載，冷抓取時列印取樣抓到「github 全失」空窗、blockquote 退回瀏覽器預設「內縮貼線」。治本是 `index.html` 常駐兩條 `media="print"` 的 light github/hljs `<link>`（見 DESIGN_GUIDELINES §4.3）；`viewer.css` `@media print` 另把 blockquote 縮排寫死為第二層防禦。

### 5.7 右側工具列（13 顆）
`menu · paste · mode · lang · style · format · orientation · print · print-scale · config · download · clear-page · clear`。以 side-tool.css 的 `.side-tools` flex 容器垂直居中堆疊，順序＝DOM 順序（家族 §5.5〔正統〕class 版）；開啟側欄時整排隱藏、收起再淡入。各 toggle 狀態分別持久化（見 §7）。

### 5.8 config 設定面板（modal）
`settings` icon → Materialize modal，5 個列印分頁 checkbox。勾選**即時**套用（`applyPrintSettings()` 設 host 屬性）並存 `localStorage('markdown-reader-print')`；config.json 為預設、面板覆寫。

### 5.9 文體格式化（MdFormater）
side tool `auto_fix_high` toggle。以動態 `import('/lib/adp-col/mdFormater.js')` 載入，**載不到自動退回原文**。開：渲染前對佛典文體格式化；關：原文。記憶於 `localStorage('markdown-reader-format')`。下載永遠是原檔。

### 5.10 md-tweaks（渲染前微調）
`MdTweaks.apply`：純字串、以 NUL 佔位**遮罩程式碼**後再轉換。目前四項：`**Tags**` 後的 hashtag 收成單行行內碼、**無標題的純 hashtag 區塊**也收成單行（以空行分隔的區塊整塊只有 tag 才處理；`#x` 與跳脫 `\#x` 皆吃、輸出去跳脫）、裸 `~` 補空白（避免 GFM 誤判刪除線）、CJK 全形括號緊貼 `**` 補空白（避免 marked flanking 規則認不出粗體分隔符）。新增微調＝加一個純函式到 `TWEAKS` 陣列。

### 5.11 程式碼複製鈕
渲染後在 shadow DOM 內把每個 `<pre>` 包進 `.code-wrap` 並加 `.copy-btn`；hover 才現身、觸控裝置常顯、列印隱藏。

### 5.12 內容版型 class（viewer.css，與主題無關，自適應 light/dark × github/newsprint）
- `.right-table-wrap`：序號（左大字）＋說明（右對齊）的無框表。
- `.siddham`：悉曇字形，`::after` 以 `attr(data-latin)` 在字形後接括號讀音（灰色斜體）。
- `.glyph`：缺字以 SVG（`/lib/Typeface/svgs/`）經 `mask` + `background-color: currentColor` 當「文字色」呈現，1em 見方、隨內文色（light/dark 皆正確）。列印另有去底例外（`@media print` 還原 `background-color` 否則會消失）。
- `.note`：行內小註（小字）。
- `.no-print` / `.screen-only`：螢幕顯示、列印隱藏。
- `.nowrap`：群組不斷行（把音譯詞＋缺字包起來，避免行尾被拆）。

### 5.13 渲染韌性
zero-md 以 MutationObserver 觀察 markdown slot；設完 `textContent` 後**讓出一個 macrotask** 再 `render()`，否則會讀到舊內容。`render()` 冷啟動時 promise 偶爾不 resolve（內部等外部 CDN 樣式 `<link>` 的 load）；控制器以 **timeout race 重試**，直到某次 render 回報 `body:true`（不能只看 `.markdown-body` 非空——切檔時舊內容仍在會誤判成功）。

---

## 6. 後端 API（`routes/markdown-reader.js`，掛載於 `/api/markdown-reader`）

| 方法 / 路徑 | 說明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | 上傳（共用 `routes/upload.js`，欄位 `myFiles`，指定 folder 時保留原檔名 → 同名覆寫） |
| `GET /api/markdown-reader/files` | 列出資料夾可見檔 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 刪除資料夾內所有可見檔（保留資料夾與隱藏檔） |

靜態讀檔：`/upload/markdown-reader/<name>`。

---

## 7. localStorage 鍵

`markdown-reader-theme` · `-style` · `-format` · `-printscale` · `-print`（config 面板覆寫物件）· `lang`（i18n 引擎共用）。

---

## 8. 與 markdown-library 的關係

共用：渲染 / 主題 / 風格 / i18n / config / 列印 / 版型 class / 字型 / 渲染韌性 / md-tweaks。差異：

| 面向 | markdown-reader | markdown-library |
|---|---|---|
| 讀入 | 拖拉**上傳**到 `/upload/markdown-reader/` | **策劃式文庫**，網址深連結 `?doc/?uidx/?mymd/?attach` |
| 可寫 | 可上傳 / 清空 | 主頁**唯讀**；另有獨立編輯頁 `edit.html` 維護 corpus |
| 特有工具 | `config`（列印面板）、`clear-page` / `clear` | `plain`（在新分頁開啟去 `-Thinking` 的純淨版） |
