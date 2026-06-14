# markdown-reader — Session context

拖拉上傳、閱讀與列印 Markdown 的單頁 WebApp（以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染）+ 輕量 Express 後端（上傳 / 列表 / 清空）。

本 app 屬於 **nodeapp WebApp 家族**；共同規範與流程在
<https://github.com/scottgfhong310/nodeapp-webapp-family>（`DESIGN_GUIDELINES.md` 規範、`WORKFLOW.md` 流程）。**改動前請先讀那兩份，照其中 canon 做。**

## 結構

```
app.js                              # Express 入口：port 3000；/ → 302 /apps/markdown-reader/
routes/upload.js                    # POST /api/upload?folder=markdown-reader（共用最小版）
routes/markdown-reader.js           # GET /files、POST /clear
public/apps/markdown-reader/        # 前端（服務於 /apps/markdown-reader/）
├─ index.html · markdown-reader.css · markdown-reader.js · markdown-reader-lib.js
├─ viewer.css                       # zero-md shadow DOM 內容樣式（github 風通用）
├─ viewer-newsprint.css             # newsprint 閱讀風皮膚層（疊在 github-markdown 之上）
├─ newsprint-fonts.css · fonts/pt-serif/   # PT Serif（自託管）+ Noto Serif TC/JP（懶載）
├─ side-tool.css · i18n.js · locales/{zh-Hant,en,ja}.js
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
- **文體格式化（MdFormater）預設關閉**（顯示原文）；側邊 `auto_fix_high` toggle 切換，**下載永遠是原檔**。
- **API 信封**：一律 `{ ok }`；jQuery 3.7.1，後端不依賴 lodash。
