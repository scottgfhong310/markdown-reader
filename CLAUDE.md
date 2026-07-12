# markdown-reader — Session context

拖拉上傳、閱讀與列印 Markdown 的單頁 WebApp（以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染）+ 輕量 Express 後端（上傳 / 列表 / 清空）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

## 結構

```
app.js                              # Express 入口：port 3000；/ → 302 /apps/markdown-reader/
routes/upload.js                    # POST /api/upload?folder=markdown-reader（共用最小版；含檔名消毒 sanitizeUploadName，§3.4）
routes/markdown-reader.js           # GET /files、POST /clear；GET /github-list、GET /github-file
                                    #   唯讀瀏覽根：nodeapp/GitHub 全樹、nodeapp 頂層、txf-neo、
                                    #   Claude memory（MEMORY_PROJECTS 清單：GitHub / nodeapp /
                                    #   InProgress-markdown-reader / InProgress-upload 各專案的
                                    #   ~/.claude/projects/<絕對路徑轉 dash>/memory，併於單一 memory 節點下）
public/apps/markdown-reader/        # 前端（服務於 /apps/markdown-reader/）
├─ index.html · markdown-reader.css · markdown-reader.js · markdown-reader-lib.js
├─ md-tweaks.js                     # 渲染前 .md 內容微調（window.MdTweaks；**Tags**→行內碼、單一 ~ 補空白）
├─ config.json                      # app 設定（列印、內文/code 字型 viewFont/printFont/codeFont/codePrintFont）
├─ viewer.css                       # zero-md shadow DOM 內容樣式（github 風通用；code 複製鈕；列印 SVG 深→淺反轉）
├─ viewer-newsprint.css             # newsprint 閱讀風皮膚層（疊在 github-markdown 之上）
├─ newsprint-fonts.css · fonts/pt-serif/   # PT Serif（自託管）+ Noto Serif TC/JP（懶載）
├─ side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
├─ thinking-dot.css                 # 共用載入點 utility（與 markdown-library 同步的副本；.thinking-dot + @keyframes thinking-pulse）
public/lib/adp-col/mdFormater.js    # 文體格式化器（toggle 開啟時套用）
public/upload/markdown-reader/      # 上傳檔案（內容不進版控）
```

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/markdown-reader/
```

## 本 app 的 canon 重點

- **可嵌入 lib** `markdown-reader-lib.js`：與伺服器溝通 / 下載 / 檔名工具，純邏輯不碰 DOM（`window.MarkdownReaderLib`）；`markdown-reader.js` 才是碰 DOM 的控制器。
- **絕對路徑**：前端用 `/api/...`、`/upload/...`、`/lib/...`，須由本專案 Node server 從站台根提供（**不相容 GitHub Pages 純靜態**）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。
- **主題**：CSS 變數 light/dark，預設 dark；同步切換 zero-md 的 github-markdown / highlight.js 樣式表。
- **閱讀風格（reading style）**：與 light/dark 正交的第二軸，側邊 `newspaper` toggle（`#setting-style`，狀態存 `localStorage('markdown-reader-style')`，預設 `github`）。`newsprint` 風以 `viewer-newsprint.css` 疊在 github-markdown 之上換成襯線紙感，明暗跟著主題走（host `data-mode`，dark 為衍生的「暖調紙夜」）；皮膚 link 以 `media="not all"` 停用、字型懶載。
- **貼上存檔**：側邊 `edit_note`（`#setting-paste`）開 modal 貼上 .md 文字，**第一個標題＝檔名**（`deriveFilename`，純邏輯在 lib：剝行內 markdown、消毒禁字、上限 80 碼位；ATX 任意層級＋setext `=`，先去 fenced code）；存檔走**既有 `/api/upload` 上傳管線**（文字包成 File，後端零改動），同名以 `resolveCollision` 尾附時間戳避開（不覆寫）、無標題擋下存檔；完成後直接開啟新檔。
- **文體格式化（MdFormater）預設關閉**（顯示原文）；側邊 `auto_fix_high` toggle 切換，**下載永遠是原檔**。
- **內容微調 `md-tweaks.js`**（`window.MdTweaks`）：渲染前對 .md 原文做純字串微調（依序套用、只影響顯示、下載仍原檔）；目前 ①`**Tags**`→行內碼 ②單一 `~` 補空白防誤判刪除線 ③CJK 粗體鄰全形開括號補空白（`**「粗體」**` 與 `**粗體**（`；GFM/marked flanking）。由 `renderCurrentContent` 在 `formatMd` 前套用。
- **config 驅動字型**：`config.json` 的 `viewFont`/`printFont`/`codeFont`/`codePrintFont`（`apply/family/size`）覆寫內文與 code/pre 字型，注入 template 的 `<style id="md-font">`（shadow DOM），`!important` 蓋過 github/newsprint；預設 `apply:false`。
- **列印字級放大**：側邊 toggle `#setting-print-scale`（`format_size`）；開啟時注入 template 的 `<style id="md-print-scale">` 一條 `@media print{.markdown-body{font-size:calc(<base> * <factor>) !important;}}`，倍率＝`config.printScale`（預設 `1.25`＝125%、可調），用來抵銷「一張 A4 印 N 頁」的縮小。狀態存 `localStorage('markdown-reader-printscale')`；只影響列印。
- **程式碼複製鈕**：render 後 `addCopyButtons` 在 shadow DOM 為每個 `<pre>` 包 `.code-wrap` 加複製鈕（inline SVG、hover 現身、列印隱藏、i18n `tool.copyCode`）。
- **render 韌性**：zero-md 冷啟動 `render()` 偶不 resolve → `renderUntilBody` timeout-race 重試到 `body:true`；設 slot 後讓出 macrotask 再 render。
- **載入動畫**：`#loading` 覆蓋層（Claude 風「思考中」呼吸脈動點 + 文字）；脈動點本體（`.thinking-dot` + `@keyframes thinking-pulse`）來自共用 **`thinking-dot.css`** utility（token 驅動；本 app 唯讀消費、以 `#loading .thinking-dot { --td-color: var(--accent) }` 套色；調校在 markdown-library 的 demo，見家族 §4.6）。`openFile` 抓檔／渲染期間 `showLoading()`（180ms 延遲防閃爍）、完成後 `hideLoading()`，取代原本在 viewer 內渲染 `md.loading` 文字。列印隱藏、i18n `loading`。
- **API 信封**：一律 `{ ok }`；jQuery 3.7.1，後端不依賴 lodash。
