# markdown-reader

[English](README.md) · [中文](README.zh-Hant.md) · **日本語**

ドラッグ&ドロップで **Markdown を閲覧・印刷**する単一ページ Web アプリ。[`zero-md`](https://github.com/zerodevx/zero-md) でレンダリングし、アップロード / 一覧 / 消去を軽量な Express サーバーが担います。

- 📥 **ドラッグ&ドロップ** — `.md` / `.txt` をページ上にドロップしてアップロード・閲覧（**同名は上書き**）
- 🌗 **ライト / ダーク** 切替（localStorage に保存）
- 🌐 **多言語 UI** — English / 繁體中文 / 日本語（既定は English、localStorage に保存）
- 🖨️ **印刷** — 縦 / 横、印刷時は白地に黒字
- ✨ **整形トグル** — 仏典向けの文体整形（`MdFormater`）の適用 / 原文表示を切替
- 🗂️ ファイル一覧サイドバー、原本ダウンロード、表示クリア、フォルダ消去

> フロントエンドのライブラリ（zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js）は CDN から読み込みます。バンドルやビルドは不要です。

## クイックスタート

要件：Node.js 18+。

```bash
npm install
npm start
# http://localhost:3001/apps/markdown-reader/ を開く
```

`PORT` でポートを変更：`PORT=8080 npm start`。

## ディレクトリ構成

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

## API

| メソッド / パス | 説明 |
|---|---|
| `POST /api/upload?folder=markdown-reader` | アップロード（フォームフィールド `myFiles`、複数。`folder` 指定時は原名を保持 → 上書き） |
| `GET /api/markdown-reader/files` | `public/upload/markdown-reader/` 内の可視ファイルを `{ name, size, mtime }` で一覧（新しい順） |
| `POST /api/markdown-reader/clear` | フォルダ内の可視ファイルをすべて削除（フォルダと隠しファイルは保持） |

静的読み取り：`/upload/markdown-reader/<name>`。

## 注意事項

- フロントエンドは**絶対パス**（`/api/...`、`/upload/...`、`/lib/adp-col/mdFormater.js`）で API を呼ぶため、本プロジェクトの Node サーバーで**サイトのルート**から配信する必要があります。**GitHub Pages 非対応**（静的ホスティングではアップロード / 一覧 / 消去 API を実行できません）。
- `MdFormater` は仏典向け文体（半角→全角の句読点、改行の正規化など）用です。一般的な技術文書に適用すると句読点が変わったり表 / コードに影響する場合があります。サイドの `auto_fix_high` トグルでいつでも原文表示に切替可能。**ダウンロードは常に原本です。**

## ライセンス

[MIT](./LICENSE) © 2026 Scott G.F. Hong
