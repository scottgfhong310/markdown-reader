# markdown-reader — Session context

拖拉上傳、閱讀與列印 Markdown 的單頁 WebApp（以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染）+ 輕量 Express 後端（上傳 / 列表 / 清空）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

> **歷史**（2026-07-16）：原本掛在這裡的「Read Markdown under nodeapp/GitHub」本地目錄瀏覽功能
> （`hub` 側鍵＋雙欄 modal＋`/github-list`、`/github-file` 兩支唯讀 API）已**獨立成
> [`local-reader`](https://github.com/scottgfhong310/local-reader)**（唯讀瀏覽本地目錄樹下的 `.md` / `.json`，private）。
> markdown-reader 回歸單純的上傳／閱讀／列印本職，不再有任何「讀本機其他目錄」的功能。要那個功能請用 local-reader。

## 結構

```
app.js                              # Express 入口：port 3000；/ → 302 /apps/markdown-reader/
routes/upload.js                    # POST /api/upload?folder=markdown-reader（共用最小版；含檔名消毒 sanitizeUploadName，§3.4）
routes/markdown-reader.js           # GET /files、POST /clear
public/apps/markdown-reader/        # 前端（服務於 /apps/markdown-reader/）
├─ index.html · markdown-reader.css · markdown-reader.js · markdown-reader-lib.js
├─ md-tweaks.js                     # 渲染前 .md 內容微調（window.MdTweaks；**Tags**→行內碼、單一 ~ 補空白）
├─ config.json                      # app 設定（列印、內文/code 字型 viewFont/printFont/codeFont/codePrintFont）
├─ viewer.css                       # zero-md shadow DOM 內容樣式（github 風通用；code 複製鈕；列印 SVG 深→淺反轉）
├─ viewer-newsprint.css             # newsprint 閱讀風皮膚層（疊在 github-markdown 之上）
├─ newsprint-fonts.css · fonts/pt-serif/   # PT Serif（自託管）+ Noto Serif TC/JP（懶載）
├─ side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
├─ thinking-dot.css                 # 共用載入點 utility（與 markdown-library 同步的副本；.thinking-dot + @keyframes thinking-pulse）
├─ filter-clear.css · filter-clear.js  # §5.12 篩選框「清除」× 鈕 utility（自 local-reader 複製、byte-identical）；宿主＝側欄 #nav-filter
public/lib/adp-col/mdFormater.js    # 文體格式化器（toggle 開啟時套用）
public/upload/markdown-reader/      # 上傳檔案（內容不進版控）
icons/                              # App icon：M＋箭頭雙層 mask 徽章、favicon set、PWA manifest
```

> **App icon 有下游共用**：`icons/`（「M＋箭頭」品牌圖）與 [`local-reader`](https://github.com/scottgfhong310/local-reader) 共用一組——
> local-reader 的 `icons/` 是**從這裡複製**的（它只另改 `manifest.json` 的 name/start_url/scope）。**在這裡換圖時，記得一併同步 local-reader 那份**（兩支 markdown 家族 app 共用同一品牌識別，owner 決定）。

## 複製件登記（共用件改版時靠這份找同步點）

| 檔案 | 來源 / 權威版本 |
|---|---|
| `i18n.js` | 家族共用 i18n 引擎（各 app 同款；改版需同步全部複製點） |
| `side-tool.css` | 家族 §5.5〔正統〕flex `.side-tools` 版 |
| `thinking-dot.css` | `markdown-library` 那份為準（家族 §4.6，byte-identical） |
| `md-tweaks.js` | `markdown-library` 那份為準（byte-identical） |
| `filter-clear.css`、`filter-clear.js` | 家族 §5.12，`local-reader` 那份為準（byte-identical） |
| `public/lib/adp-col/mdFormater.js` | adp-col 孵化器產出（與 `markdown-library` 同份 byte-identical） |
| `viewer.css`、`viewer-newsprint.css`、`newsprint-fonts.css`、`fonts/pt-serif/` | **本 app 為源頭**（zero-md 內容樣式層）；`local-reader` 自此複製、byte-identical（`markdown-library` 的 `viewer.css`/`newsprint-fonts.css` 已加內容相依版型而分岔） |
| `icons/`（「M＋箭頭」品牌圖 + favicon/PWA） | **本 app 為源頭**；`local-reader` / `markdown-library` 自此複製、byte-identical（換圖時一併同步下游） |

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/markdown-reader/
```

## 本 app 的 canon 重點

- **可嵌入 lib** `markdown-reader-lib.js`：與伺服器溝通 / 下載 / 檔名工具，純邏輯不碰 DOM（`window.MarkdownReaderLib`）；`markdown-reader.js` 才是碰 DOM 的控制器。
- **絕對路徑**：前端用 `/api/...`、`/upload/...`、`/lib/...`，須由本專案 Node server 從站台根提供（**不相容 GitHub Pages 純靜態**）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。
- **主題**：CSS 變數 light/dark，預設 dark；同步切換 zero-md 的 github-markdown / highlight.js 樣式表。
- **閱讀風格（reading style）**：與 light/dark 正交的第二軸，側邊 `newspaper` toggle（`#setting-style`，狀態存 `localStorage('markdown-reader-style')`，預設 `github`）。`newsprint` 風以 `viewer-newsprint.css` 疊在 github-markdown 之上換成襯線紙感，明暗跟著主題走（host `data-mode`）：**light 為 newsprint 原本的紙感**（`#f3f2ee`）；**dark 為「暖墨紙夜」——墨色維持暖調襯線性格，但畫布與 code／表格底色一律對齊 GitHub 閱讀風**（`--np-bg: var(--card-bg, #0f1115)`，自訂屬性穿透 shadow DOM 邊界繼承；code／表頭／斑馬列 `#151b23` ＝ github-markdown-css dark 的 canvas-subtle），故 dark 下切換兩風時畫布不變、只換字體與墨色。皮膚 link 以 `media="not all"` 停用、字型懶載。
- **貼上存檔**：側邊 `edit_note`（`#setting-paste`）開 modal 貼上 .md 文字，**第一個標題＝檔名**（`deriveFilename`，純邏輯在 lib：剝行內 markdown、消毒禁字、上限 80 碼位；ATX 任意層級＋setext `=`，先去 fenced code）；存檔走**既有 `/api/upload` 上傳管線**（文字包成 File，後端零改動），同名以 `resolveCollision` 尾附時間戳避開（不覆寫）、無標題擋下存檔；完成後直接開啟新檔。
- **文體格式化（MdFormater）預設關閉**（顯示原文）；側邊 `auto_fix_high` toggle 切換，**下載永遠是原檔**。
- **內容微調 `md-tweaks.js`**（`window.MdTweaks`）：渲染前對 .md 原文做純字串微調（依序套用、只影響顯示、下載仍原檔）；目前 ①`**Tags**`→行內碼 ②單一 `~` 補空白防誤判刪除線 ③CJK 粗體鄰全形開括號補空白（`**「粗體」**` 與 `**粗體**（`；GFM/marked flanking）。由 `renderCurrentContent` 在 `formatMd` 前套用。
- **config 驅動字型**：`config.json` 的 `viewFont`/`printFont`/`codeFont`/`codePrintFont`（`apply/family/size`）覆寫內文與 code/pre 字型，注入 template 的 `<style id="md-font">`（shadow DOM），`!important` 蓋過 github/newsprint；預設 `apply:false`。
- **列印字級放大**：側邊 toggle `#setting-print-scale`（`format_size`）；開啟時注入 template 的 `<style id="md-print-scale">` 一條 `@media print{.markdown-body{font-size:calc(<base> * <factor>) !important;}}`，倍率＝`config.printScale`（預設 `1.25`＝125%、可調），用來抵銷「一張 A4 印 N 頁」的縮小。狀態存 `localStorage('markdown-reader-printscale')`；只影響列印。
- **程式碼複製鈕**：render 後 `addCopyButtons` 在 shadow DOM 為每個 `<pre>` 包 `.code-wrap` 加複製鈕（inline SVG、hover 現身、列印隱藏、i18n `tool.copyCode`）。
- **render 韌性**：zero-md `render()` 冷啟動時 promise 偶爾不 resolve（內部等外部 CDN 樣式 `<link>` 的 load 事件）。`renderUntilBody` 以 timeout race 重試。**成功條件 `= res.body || bodyPainted()`**（`res.body` 是「原文 hash 有變」旗標、非「已渲染」；冷啟動超過 race 1200ms 時被丟棄、此後永遠 `false`、`#loading` 卡住不退）——`bodyPainted()` 比對 `.markdown-body[data-hash]` 與 slot 原文 hash；不能只看 `.markdown-body` 非空（切換文件時舊內容仍在、hash 不同不誤判）。**根因鏈另一環**：`applySkinToLink` 對皮膚 link **兩態都設 `href`**（只用 `media` 切換啟用/停用）——github 風若留無 `href` 的 `<link rel=stylesheet>`，zero-md 的 `stamp()` 會 `await` 一個永不觸發的 load 事件而吊死首次 render（無 href → load/error 皆不觸發；`media="not all"` ＋ 有 href → load 照樣觸發）。設完 `<script>` slot 後讓出一個 macrotask 再 render（zero-md 以 MutationObserver 觀察 slot，立即 render 會讀到舊值）。詳見家族 §4.3。
- **載入動畫**：`#loading` 覆蓋層（Claude 風「思考中」呼吸脈動點 + 文字）；脈動點本體（`.thinking-dot` + `@keyframes thinking-pulse`）來自共用 **`thinking-dot.css`** utility（token 驅動；本 app 唯讀消費、以 `#loading .thinking-dot { --td-color: var(--accent) }` 套色；調校在 markdown-library 的 demo，見家族 §4.6）。`openFile` 抓檔／渲染期間 `showLoading()`（180ms 延遲防閃爍）、完成後 `hideLoading()`，取代原本在 viewer 內渲染 `md.loading` 文字。列印隱藏、i18n `loading`。
- **API 信封**：一律 `{ ok }`；jQuery 3.7.1，後端不依賴 lodash。
