# markdown-reader — 閱讀與列印 Markdown

以拖拉方式上傳並閱讀 Markdown 檔案的單頁 WebApp。以 `zero-md` 渲染內容，支援 light / dark 切換與列印（直向 / 橫向）。功能對齊 `mdx/index.html`，但把「讀入 Markdown」的方式簡化為「拖拉上傳到伺服器資料夾」。

---

## 目錄結構

```
apps/markdown-reader/
├── index.html               # 主程式（DOM / zero-md 呈現與事件）
├── markdown-reader-lib.js   # MarkdownReaderLib：上傳 / 列表 / 清空 / 下載等工具
├── side-tool.css            # 右側浮動工具列樣式
└── README.md
```

對應後端與資料：

```
routes/markdown-reader.js         # GET /files、POST /clear
public/upload/markdown-reader/    # 上傳檔案存放處（同名覆寫）
```

---

## 外部相依

| 套件 | 用途 |
|------|------|
| `zero-md@3` | 將 Markdown 渲染為帶 GitHub 樣式的 HTML |
| `github-markdown-css@5` | zero-md 內容的 light / dark 主題 |
| `highlight.js@11` styles | 程式碼區塊的 light / dark 配色 |
| `Materialize 1.0.0` | UI 元件（Sidenav、Toast） |
| `jQuery 4.0.0` | DOM 操作與事件 |
| `Lodash 4` | `_.escape` 等小工具 |

> 主要功能皆以 library / `<script>` 的方式引入 `index.html`，符合「以 Library 引入」的要求。

---

## 使用方式

1. **上傳**：把 `.md` / `.markdown` / `.txt` 等檔案拖拉到頁面任意位置（或點擊空狀態選檔）。
   檔案會上傳到 `/upload/markdown-reader`，**檔名相同則直接覆寫**。
2. **閱讀**：上傳後立即在頁面渲染；多檔時可由右上角 `menu` 開啟側欄清單切換。
3. **右側工具列（side tools）**：
   | 圖示 | 功能 |
   |------|------|
   | `menu` | 開啟檔案清單側欄（開啟時其餘工具會隱藏，收起後再出現） |
   | `dark_mode` / `light_mode` | 切換頁面 light / dark（記憶於 localStorage） |
   | `auto_fix_high` | 文體格式化開關（toggle，開啟時 accent 色；記憶於 localStorage） |
   | `crop_portrait` / `crop_landscape` | 切換列印方向（直向 / 橫向） |
   | `print` | 呼叫瀏覽器列印 |
   | `download` | 下載目前開啟的 Markdown（原始檔，不含格式化） |
   | `clear` | 清除頁面內容（回到初始畫面，不刪除檔案） |
   | `delete_sweep` | 清空 `/upload/markdown-reader` 下所有檔案 |

---

## 後端 API

由 `routes/markdown-reader.js` 提供，於 `app.js` 掛載於 `/api/markdown-reader`：

| 方法 / 路徑 | 說明 |
|------------|------|
| `POST /api/upload?folder=markdown-reader` | 上傳（沿用既有 `routes/upload.js`，form 欄位 `myFiles`，同名覆寫） |
| `GET /api/markdown-reader/files` | 列出資料夾內可見檔案 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 刪除資料夾內所有可見檔案（保留資料夾與隱藏檔） |

靜態讀檔：`/upload/markdown-reader/<name>`（由 `express.static` 提供）。

---

## 文體格式化（MdFormater）

可用側邊 `auto_fix_high` 這顆 **toggle** 開關文體格式化：開啟時以 `/lib/adp-col/mdFormater.js` 的 `MdFormater` 對內容做佛典文體格式化（換行正規化、半形→全形標點、段落標題標記等）後再渲染；關閉時顯示原文。

- 開關狀態記憶於 `localStorage`（`markdown-reader-format`），**預設為開**；切換時會即時重渲目前檔案。
- `MdFormater` 以動態 `import()` 載入；若該檔載不到，會自動退回顯示原文，不影響閱讀。
- **下載永遠是原始檔**（不含格式化），與 mdx 的行為一致。
- 注意：`MdFormater` 專為佛典文體設計，套用在一般技術文件可能改動標點或影響表格 / 程式碼區塊——這時把 toggle 關掉即可看原文。

## 與 mdx 的差異

- **讀入方式**：mdx 以 `docs.js` / URL 參數路由載入；本 app 改為「拖拉上傳 → 從伺服器資料夾讀取」。
- **主題**：mdx 為固定深色（螢幕）；本 app 提供 light / dark 切換。
- **版面**：沒有 page header / footer，只保留右側 `side tools` 與檔案清單側欄。
- **格式化**：mdx 僅 `doc` 模式套用 `MdFormater`；本 app 以側邊 toggle 控制（預設開，可隨時關掉看原文）。
