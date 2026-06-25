# markdown-reader — 閱讀與列印 Markdown

拖拉上傳、即時閱讀與列印 Markdown 的單頁 WebApp。以 `zero-md` 渲染，內容存於伺服器 `public/upload/markdown-reader/`（與程式碼分離）。無 page header / footer，操作集中在右側浮動工具列。架構細節見 [DESIGN.md](DESIGN.md)。

> 與姊妹作 **markdown-library** 共用同一套渲染 / 主題 / i18n / 列印核心；差別在讀入方式（本作＝上傳，library＝策劃式文庫深連結）。

---

## 功能

- 📥 **拖拉上傳**：`.md` / `.txt` 拖到頁面任意處即上傳並閱讀，**同名覆寫**
- 🌗 **Light / Dark** 切換（記憶於 localStorage）
- 🌐 **三語介面**：繁體中文 / English / 日本語（預設 `zh-Hant`；`translate` 循環切換）
- 📰 **閱讀風格**：GitHub ↔ Newsprint（報紙襯線紙感）toggle
- ✨ **文體格式化**：佛典文體 `MdFormater` toggle（動態載入，載不到退回原文）
- 🖨️ **列印**：直向 / 橫向、列印字級放大、強制白底黑字
- ⚙️ **列印分頁設定面板**：表格 / 清單整塊不切、H1 換頁、放寬小區塊 / 表格列跨頁（即時套用、記憶於本機）
- 🗂️ 多檔側欄、下載原檔、清除畫面、清空資料夾

---

## 使用方式

1. **上傳**：把檔案拖到頁面任意位置（或點空狀態選檔）→ 上傳到 `/upload/markdown-reader`，同名覆寫。
2. **閱讀**：上傳後立即渲染；多檔時由 `menu` 開側欄切換。
3. **右側工具列**（12 顆，由上而下）：

   | 圖示 | 功能 |
   |------|------|
   | `menu` | 開啟檔案清單側欄（開啟時其餘工具隱藏） |
   | `dark_mode` / `light_mode` | 切換 light / dark |
   | `translate` | 切換語系（繁中 → English → 日本語 循環） |
   | `newspaper` | 閱讀風格 GitHub ↔ Newsprint |
   | `auto_fix_high` | 文體格式化開關 |
   | `crop_portrait` / `crop_landscape` | 列印方向 |
   | `print` | 呼叫瀏覽器列印 |
   | `format_size` | 列印字級放大（× `config.printScale`，預設 125%） |
   | `settings` | **列印分頁設定面板**（5 個 toggle，即時套用） |
   | `download` | 下載目前檔案（原檔，不含格式化） |
   | `clear` | 清除頁面內容（不刪檔） |
   | `delete_sweep` | 清空 `/upload/markdown-reader` |

---

## 後端 API（`routes/markdown-reader.js`，掛載於 `/api/markdown-reader`）

| 方法 / 路徑 | 說明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | 上傳（共用 `routes/upload.js`，欄位 `myFiles`，同名覆寫） |
| `GET /api/markdown-reader/files` | 列出可見檔 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 清空資料夾內可見檔 |

靜態讀檔：`/upload/markdown-reader/<name>`。

---

## 設定（`config.json`）

`print.{keepTableTogether, keepListTogether, pageBreakBeforeH1, allowBlockBreak, allowRowBreak}`、`viewFont/printFont/codeFont/codePrintFont`、`printScale`。列印分頁五項可由側邊 `settings` 面板即時切換（記憶於 `localStorage('markdown-reader-print')`，config.json 為預設）。

---

## 內容版型（在 `.md` 內以 HTML class 使用，列印自適應）

| 寫法 | 效果 |
|---|---|
| `<div class="no-print">…</div>` / `<span class="no-print">…</span>` | 螢幕可讀、**列印隱藏**（區塊用法前後留空行） |
| `<span class="siddham" data-latin="oṃ">𑖌𑖼</span>` | 悉曇字形＋括號讀音（拉丁轉寫，需 Google Fonts 字型） |
| `<span class="note">…</span>` | 行內小註 |
| `<div class="right-table-wrap"><table>…</table></div>` | 序號（左大字）＋說明（右對齊）無框表 |

---

## 相依與備註

- 前端庫：`zero-md@3`、`github-markdown-css@5`、`highlight.js@11`、Materialize 1.0、**jQuery 3.7**、Lodash 4；皆 CDN，無 build step。
- 字型：newsprint 自託管 PT Serif；悉曇 `Noto Sans Siddham` ＋ 轉寫 `Charis SIL` / `Gentium Plus`（Google Fonts，需連網，離線退回 serif）。
- 前端以**絕對路徑**呼叫 API，須由本專案 Node 伺服器服務於站台根目錄；**不適用 GitHub Pages**。
