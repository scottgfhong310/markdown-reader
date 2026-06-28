# markdown-reader

[English](README.md) · **中文** · [日本語](README.ja.md)

拖拉上傳、閱讀與列印 **Markdown** 的單頁 WebApp。以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染內容，搭配輕量的 Express 後端處理上傳 / 列表 / 清空。

- 📥 **拖拉上傳** — 把 `.md` / `.txt` 等檔案拖到頁面任意位置即上傳並閱讀，**同名覆寫**
- 🌗 **Light / Dark** 切換（記憶於 localStorage）
- 🌐 **多語介面** — English / 繁體中文 / 日本語（預設 English，記憶於 localStorage）
- 🖨️ **列印** — 直向 / 橫向切換，列印時強制白底黑字
- ✨ **文體格式化 toggle** — 可選擇套用佛典文體格式化（`MdFormater`）或顯示原文
- 🗂️ 多檔側欄清單、下載原始檔、清除畫面、清空資料夾
- 📰 **閱讀風格與列印** — GitHub ↔ 報紙（Newsprint）閱讀皮膚、列印字級放大，以及列印分頁**設定面板**（表格/清單不跨頁、H1 換頁、放寬小區塊/表格列跨頁）
- 📐 **內容版型** — 可在 `.md` 內使用的 HTML class：`.siddham`（字形＋拉丁轉寫）、`.glyph`（缺字 SVG）、`.note`、`.right-table-wrap`、`.no-print`、`.nowrap`

> 第三方前端庫（zero-md、Materialize、jQuery、Lodash、github-markdown-css、highlight.js）皆由 CDN 載入，無需打包或建置步驟。

## 快速開始

需求：Node.js 18+。

```bash
npm install
npm start
# 開啟 http://localhost:3000/apps/markdown-reader/
```

可用環境變數 `PORT` 指定埠號：`PORT=8080 npm start`。

## 目錄結構

```
markdown-reader/
├── app.js                            # 獨立 Express 伺服器（靜態 + 兩支 API）
├── package.json
├── routes/
│   ├── upload.js                     # POST /api/upload?folder=markdown-reader（multer，多檔，同名覆寫）
│   └── markdown-reader.js            # GET /files、POST /clear
└── public/
    ├── apps/markdown-reader/         # 前端
    │   ├── index.html                # DOM / zero-md 呈現與事件
    │   ├── markdown-reader-lib.js    # MarkdownReaderLib：上傳 / 列表 / 清空 / 下載
    │   ├── viewer.css                # zero-md（shadow DOM）內容樣式
    │   ├── side-tool.css             # 右側浮動工具列
    │   └── README.md                 # 應用內部細節說明
    ├── lib/adp-col/mdFormater.js     # 文體格式化器（toggle 開啟時使用）
    └── upload/markdown-reader/       # 上傳檔案存放處（內容不入版控）
```

## API

| 方法 / 路徑 | 說明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | 上傳（form 欄位 `myFiles`，多檔，指定 folder 時保留原檔名 → 同名覆寫） |
| `GET /api/markdown-reader/files` | 列出 `public/upload/markdown-reader/` 內可見檔案 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 刪除該資料夾內所有可見檔案（保留資料夾與隱藏檔） |

靜態讀檔：`/upload/markdown-reader/<name>`。

## 注意事項

- 前端以**絕對路徑**呼叫 API（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`），須由本專案的 Node 伺服器服務於**站台根目錄**。**不適用 GitHub Pages**（純靜態無法執行上傳 / 列表 / 清空 API）。
- `MdFormater` 專為佛典文體設計（半形→全形標點、換行正規化等），套用在一般技術文件可能改動標點或影響表格 / 程式碼；用側邊 `auto_fix_high` toggle 可隨時關閉顯示原文，**下載永遠是原始檔**。

## License

[MIT](./LICENSE) © 2026 Scott G.F. Hong
