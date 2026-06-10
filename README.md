# markdown-reader

> 🌐 **Pick a language view — expand one.** **English** shows all three (English · 繁體中文 · 日本語); **繁體中文** shows Chinese + Japanese; **日本語** shows Japanese only.

<details open>
<summary><b>English</b> — shows English · 繁體中文 · 日本語</summary>

### English

A drag-and-drop single-page web app to **read and print Markdown**. It renders with [`zero-md`](https://github.com/zerodevx/zero-md), backed by a lightweight Express server for upload / list / clear.

- 📥 **Drag & drop upload** — drop `.md` / `.txt` files anywhere on the page to upload and read; **same name overwrites**
- 🌗 **Light / Dark** toggle (saved in localStorage)
- 🌐 **Multilingual UI** — English / 繁體中文 / 日本語 (default English, saved in localStorage)
- 🖨️ **Print** — portrait / landscape, forced black-on-white
- ✨ **Formatting toggle** — optionally apply CJK / Buddhist-text formatting (`MdFormater`) or show the raw file
- 🗂️ File-list sidebar, download original, clear page, empty folder

> Third-party front-end libraries (zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js) load from CDN — no bundling or build step.

#### Quick start

Requires Node.js 18+.

```bash
npm install
npm start
# open http://localhost:3001/apps/markdown-reader/
```

Set `PORT` to change the port: `PORT=8080 npm start`.

#### Directory structure

```
markdown-reader/
├── server.js                         # Standalone Express server (static + 2 APIs)
├── package.json
├── routes/
│   ├── upload.js                     # POST /api/upload?folder=markdown-reader (multer, multi-file, overwrite)
│   └── markdown-reader.js            # GET /files, POST /clear
└── public/
    ├── apps/markdown-reader/         # Front end
    │   ├── index.html                # DOM / zero-md rendering & events
    │   ├── markdown-reader-lib.js    # MarkdownReaderLib: upload / list / clear / download
    │   ├── viewer.css                # zero-md (shadow DOM) content styles
    │   ├── side-tool.css             # Right-side floating toolbar
    │   └── README.md                 # In-app details
    ├── lib/adp-col/mdFormater.js     # Text formatter (used when the toggle is on)
    └── upload/markdown-reader/       # Uploaded files (contents are git-ignored)
```

#### API

| Method / Path | Description |
|---|---|
| `POST /api/upload?folder=markdown-reader` | Upload (form field `myFiles`, multi-file; keeps the original name when `folder` is set → overwrites) |
| `GET /api/markdown-reader/files` | List visible files in `public/upload/markdown-reader/` as `{ name, size, mtime }` (newest first) |
| `POST /api/markdown-reader/clear` | Delete all visible files in that folder (keeps the folder & hidden files) |

Static read: `/upload/markdown-reader/<name>`.

#### Notes

- The front end calls APIs with **absolute paths** (`/api/...`, `/upload/...`, `/lib/adp-col/mdFormater.js`), so it must be served from the **site root** by this project's Node server. **Not GitHub-Pages-compatible** (static hosting can't run the upload / list / clear APIs).
- `MdFormater` is designed for CJK / Buddhist-scripture text (half→full-width punctuation, line-break normalization). Applied to general technical docs it may alter punctuation or affect tables / code — use the side `auto_fix_high` toggle to show the raw file anytime. **Download is always the original file.**

### 繁體中文

拖拉上傳、閱讀與列印 **Markdown** 的單頁 WebApp。以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染內容，搭配輕量的 Express 後端處理上傳 / 列表 / 清空。

- 📥 **拖拉上傳** — 把 `.md` / `.txt` 等檔案拖到頁面任意位置即上傳並閱讀，**同名覆寫**
- 🌗 **Light / Dark** 切換（記憶於 localStorage）
- 🌐 **多語介面** — English / 繁體中文 / 日本語（預設 English，記憶於 localStorage）
- 🖨️ **列印** — 直向 / 橫向切換，列印時強制白底黑字
- ✨ **文體格式化 toggle** — 可選擇套用佛典文體格式化（`MdFormater`）或顯示原文
- 🗂️ 多檔側欄清單、下載原始檔、清除畫面、清空資料夾

> 第三方前端庫（zero-md、Materialize、jQuery、Lodash、github-markdown-css、highlight.js）皆由 CDN 載入，無需打包或建置步驟。

#### 快速開始

需求：Node.js 18+。

```bash
npm install
npm start
# 開啟 http://localhost:3001/apps/markdown-reader/
```

可用環境變數 `PORT` 指定埠號：`PORT=8080 npm start`。

#### 目錄結構

```
markdown-reader/
├── server.js                         # 獨立 Express 伺服器（靜態 + 兩支 API）
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

#### API

| 方法 / 路徑 | 說明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | 上傳（form 欄位 `myFiles`，多檔，指定 folder 時保留原檔名 → 同名覆寫） |
| `GET /api/markdown-reader/files` | 列出 `public/upload/markdown-reader/` 內可見檔案 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 刪除該資料夾內所有可見檔案（保留資料夾與隱藏檔） |

靜態讀檔：`/upload/markdown-reader/<name>`。

#### 注意事項

- 前端以**絕對路徑**呼叫 API（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`），須由本專案的 Node 伺服器服務於**站台根目錄**。**不適用 GitHub Pages**（純靜態無法執行上傳 / 列表 / 清空 API）。
- `MdFormater` 專為佛典文體設計（半形→全形標點、換行正規化等），套用在一般技術文件可能改動標點或影響表格 / 程式碼；用側邊 `auto_fix_high` toggle 可隨時關閉顯示原文，**下載永遠是原始檔**。

### 日本語

ドラッグ&ドロップで **Markdown を閲覧・印刷**する単一ページ Web アプリ。[`zero-md`](https://github.com/zerodevx/zero-md) でレンダリングし、アップロード / 一覧 / 消去を軽量な Express サーバーが担います。

- 📥 **ドラッグ&ドロップ** — `.md` / `.txt` をページ上にドロップしてアップロード・閲覧（**同名は上書き**）
- 🌗 **ライト / ダーク** 切替（localStorage に保存）
- 🌐 **多言語 UI** — English / 繁體中文 / 日本語（既定は English、localStorage に保存）
- 🖨️ **印刷** — 縦 / 横、印刷時は白地に黒字
- ✨ **整形トグル** — 仏典向けの文体整形（`MdFormater`）の適用 / 原文表示を切替
- 🗂️ ファイル一覧サイドバー、原本ダウンロード、表示クリア、フォルダ消去

> フロントエンドのライブラリ（zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js）は CDN から読み込みます。バンドルやビルドは不要です。

#### クイックスタート

要件：Node.js 18+。

```bash
npm install
npm start
# http://localhost:3001/apps/markdown-reader/ を開く
```

`PORT` でポートを変更：`PORT=8080 npm start`。

#### ディレクトリ構成

```
markdown-reader/
├── server.js                         # スタンドアロン Express サーバー（静的 + 2 API）
├── package.json
├── routes/
│   ├── upload.js                     # POST /api/upload?folder=markdown-reader（multer、複数、上書き）
│   └── markdown-reader.js            # GET /files、POST /clear
└── public/
    ├── apps/markdown-reader/         # フロントエンド
    │   ├── index.html                # DOM / zero-md の描画・イベント
    │   ├── markdown-reader-lib.js    # MarkdownReaderLib：アップロード / 一覧 / 消去 / ダウンロード
    │   ├── viewer.css                # zero-md（shadow DOM）コンテンツのスタイル
    │   ├── side-tool.css             # 右側フローティングツールバー
    │   └── README.md                 # アプリ内部の詳細
    ├── lib/adp-col/mdFormater.js     # 文体整形（トグル ON 時に使用）
    └── upload/markdown-reader/       # アップロード先（内容はバージョン管理外）
```

#### API

| メソッド / パス | 説明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | アップロード（フォームフィールド `myFiles`、複数。`folder` 指定時は原名を保持 → 上書き） |
| `GET /api/markdown-reader/files` | `public/upload/markdown-reader/` 内の可視ファイルを `{ name, size, mtime }` で一覧（新しい順） |
| `POST /api/markdown-reader/clear` | フォルダ内の可視ファイルをすべて削除（フォルダと隠しファイルは保持） |

静的読み取り：`/upload/markdown-reader/<name>`。

#### 注意事項

- フロントエンドは**絶対パス**（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`）で API を呼ぶため、本プロジェクトの Node サーバーで**サイトのルート**から配信する必要があります。**GitHub Pages 非対応**（静的ホスティングではアップロード / 一覧 / 消去 API を実行できません）。
- `MdFormater` は仏典向け文体（半角→全角の句読点、改行の正規化など）用です。一般的な技術文書に適用すると句読点が変わったり表 / コードに影響する場合があります。サイドの `auto_fix_high` トグルでいつでも原文表示に切替可能。**ダウンロードは常に原本です。**

</details>

<details>
<summary><b>繁體中文</b> — 顯示 繁體中文 · 日本語</summary>

### 繁體中文

拖拉上傳、閱讀與列印 **Markdown** 的單頁 WebApp。以 [`zero-md`](https://github.com/zerodevx/zero-md) 渲染內容，搭配輕量的 Express 後端處理上傳 / 列表 / 清空。

- 📥 **拖拉上傳** — 把 `.md` / `.txt` 等檔案拖到頁面任意位置即上傳並閱讀，**同名覆寫**
- 🌗 **Light / Dark** 切換（記憶於 localStorage）
- 🌐 **多語介面** — English / 繁體中文 / 日本語（預設 English，記憶於 localStorage）
- 🖨️ **列印** — 直向 / 橫向切換，列印時強制白底黑字
- ✨ **文體格式化 toggle** — 可選擇套用佛典文體格式化（`MdFormater`）或顯示原文
- 🗂️ 多檔側欄清單、下載原始檔、清除畫面、清空資料夾

> 第三方前端庫（zero-md、Materialize、jQuery、Lodash、github-markdown-css、highlight.js）皆由 CDN 載入，無需打包或建置步驟。

#### 快速開始

需求：Node.js 18+。

```bash
npm install
npm start
# 開啟 http://localhost:3001/apps/markdown-reader/
```

可用環境變數 `PORT` 指定埠號：`PORT=8080 npm start`。

#### 目錄結構

```
markdown-reader/
├── server.js                         # 獨立 Express 伺服器（靜態 + 兩支 API）
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

#### API

| 方法 / 路徑 | 說明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | 上傳（form 欄位 `myFiles`，多檔，指定 folder 時保留原檔名 → 同名覆寫） |
| `GET /api/markdown-reader/files` | 列出 `public/upload/markdown-reader/` 內可見檔案 `{ name, size, mtime }`（新→舊） |
| `POST /api/markdown-reader/clear` | 刪除該資料夾內所有可見檔案（保留資料夾與隱藏檔） |

靜態讀檔：`/upload/markdown-reader/<name>`。

#### 注意事項

- 前端以**絕對路徑**呼叫 API（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`），須由本專案的 Node 伺服器服務於**站台根目錄**。**不適用 GitHub Pages**（純靜態無法執行上傳 / 列表 / 清空 API）。
- `MdFormater` 專為佛典文體設計（半形→全形標點、換行正規化等），套用在一般技術文件可能改動標點或影響表格 / 程式碼；用側邊 `auto_fix_high` toggle 可隨時關閉顯示原文，**下載永遠是原始檔**。

### 日本語

ドラッグ&ドロップで **Markdown を閲覧・印刷**する単一ページ Web アプリ。[`zero-md`](https://github.com/zerodevx/zero-md) でレンダリングし、アップロード / 一覧 / 消去を軽量な Express サーバーが担います。

- 📥 **ドラッグ&ドロップ** — `.md` / `.txt` をページ上にドロップしてアップロード・閲覧（**同名は上書き**）
- 🌗 **ライト / ダーク** 切替（localStorage に保存）
- 🌐 **多言語 UI** — English / 繁體中文 / 日本語（既定は English、localStorage に保存）
- 🖨️ **印刷** — 縦 / 横、印刷時は白地に黒字
- ✨ **整形トグル** — 仏典向けの文体整形（`MdFormater`）の適用 / 原文表示を切替
- 🗂️ ファイル一覧サイドバー、原本ダウンロード、表示クリア、フォルダ消去

> フロントエンドのライブラリ（zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js）は CDN から読み込みます。バンドルやビルドは不要です。

#### クイックスタート

要件：Node.js 18+。

```bash
npm install
npm start
# http://localhost:3001/apps/markdown-reader/ を開く
```

`PORT` でポートを変更：`PORT=8080 npm start`。

#### ディレクトリ構成

```
markdown-reader/
├── server.js                         # スタンドアロン Express サーバー（静的 + 2 API）
├── package.json
├── routes/
│   ├── upload.js                     # POST /api/upload?folder=markdown-reader（multer、複数、上書き）
│   └── markdown-reader.js            # GET /files、POST /clear
└── public/
    ├── apps/markdown-reader/         # フロントエンド
    │   ├── index.html                # DOM / zero-md の描画・イベント
    │   ├── markdown-reader-lib.js    # MarkdownReaderLib：アップロード / 一覧 / 消去 / ダウンロード
    │   ├── viewer.css                # zero-md（shadow DOM）コンテンツのスタイル
    │   ├── side-tool.css             # 右側フローティングツールバー
    │   └── README.md                 # アプリ内部の詳細
    ├── lib/adp-col/mdFormater.js     # 文体整形（トグル ON 時に使用）
    └── upload/markdown-reader/       # アップロード先（内容はバージョン管理外）
```

#### API

| メソッド / パス | 説明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | アップロード（フォームフィールド `myFiles`、複数。`folder` 指定時は原名を保持 → 上書き） |
| `GET /api/markdown-reader/files` | `public/upload/markdown-reader/` 内の可視ファイルを `{ name, size, mtime }` で一覧（新しい順） |
| `POST /api/markdown-reader/clear` | フォルダ内の可視ファイルをすべて削除（フォルダと隠しファイルは保持） |

静的読み取り：`/upload/markdown-reader/<name>`。

#### 注意事項

- フロントエンドは**絶対パス**（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`）で API を呼ぶため、本プロジェクトの Node サーバーで**サイトのルート**から配信する必要があります。**GitHub Pages 非対応**（静的ホスティングではアップロード / 一覧 / 消去 API を実行できません）。
- `MdFormater` は仏典向け文体（半角→全角の句読点、改行の正規化など）用です。一般的な技術文書に適用すると句読点が変わったり表 / コードに影響する場合があります。サイドの `auto_fix_high` トグルでいつでも原文表示に切替可能。**ダウンロードは常に原本です。**

</details>

<details>
<summary><b>日本語</b> — 日本語のみ</summary>

### 日本語

ドラッグ&ドロップで **Markdown を閲覧・印刷**する単一ページ Web アプリ。[`zero-md`](https://github.com/zerodevx/zero-md) でレンダリングし、アップロード / 一覧 / 消去を軽量な Express サーバーが担います。

- 📥 **ドラッグ&ドロップ** — `.md` / `.txt` をページ上にドロップしてアップロード・閲覧（**同名は上書き**）
- 🌗 **ライト / ダーク** 切替（localStorage に保存）
- 🌐 **多言語 UI** — English / 繁體中文 / 日本語（既定は English、localStorage に保存）
- 🖨️ **印刷** — 縦 / 横、印刷時は白地に黒字
- ✨ **整形トグル** — 仏典向けの文体整形（`MdFormater`）の適用 / 原文表示を切替
- 🗂️ ファイル一覧サイドバー、原本ダウンロード、表示クリア、フォルダ消去

> フロントエンドのライブラリ（zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js）は CDN から読み込みます。バンドルやビルドは不要です。

#### クイックスタート

要件：Node.js 18+。

```bash
npm install
npm start
# http://localhost:3001/apps/markdown-reader/ を開く
```

`PORT` でポートを変更：`PORT=8080 npm start`。

#### ディレクトリ構成

```
markdown-reader/
├── server.js                         # スタンドアロン Express サーバー（静的 + 2 API）
├── package.json
├── routes/
│   ├── upload.js                     # POST /api/upload?folder=markdown-reader（multer、複数、上書き）
│   └── markdown-reader.js            # GET /files、POST /clear
└── public/
    ├── apps/markdown-reader/         # フロントエンド
    │   ├── index.html                # DOM / zero-md の描画・イベント
    │   ├── markdown-reader-lib.js    # MarkdownReaderLib：アップロード / 一覧 / 消去 / ダウンロード
    │   ├── viewer.css                # zero-md（shadow DOM）コンテンツのスタイル
    │   ├── side-tool.css             # 右側フローティングツールバー
    │   └── README.md                 # アプリ内部の詳細
    ├── lib/adp-col/mdFormater.js     # 文体整形（トグル ON 時に使用）
    └── upload/markdown-reader/       # アップロード先（内容はバージョン管理外）
```

#### API

| メソッド / パス | 説明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | アップロード（フォームフィールド `myFiles`、複数。`folder` 指定時は原名を保持 → 上書き） |
| `GET /api/markdown-reader/files` | `public/upload/markdown-reader/` 内の可視ファイルを `{ name, size, mtime }` で一覧（新しい順） |
| `POST /api/markdown-reader/clear` | フォルダ内の可視ファイルをすべて削除（フォルダと隠しファイルは保持） |

静的読み取り：`/upload/markdown-reader/<name>`。

#### 注意事項

- フロントエンドは**絶対パス**（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`）で API を呼ぶため、本プロジェクトの Node サーバーで**サイトのルート**から配信する必要があります。**GitHub Pages 非対応**（静的ホスティングではアップロード / 一覧 / 消去 API を実行できません）。
- `MdFormater` は仏典向け文体（半角→全角の句読点、改行の正規化など）用です。一般的な技術文書に適用すると句読点が変わったり表 / コードに影響する場合があります。サイドの `auto_fix_high` トグルでいつでも原文表示に切替可能。**ダウンロードは常に原本です。**

</details>

---

## License

[MIT](LICENSE)
