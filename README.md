# markdown-reader

**English** · [中文](README.zh-Hant.md) · [日本語](README.ja.md)

A drag-and-drop single-page web app to **read and print Markdown**. It renders with [`zero-md`](https://github.com/zerodevx/zero-md), backed by a lightweight Express server for upload / list / clear.

- 📥 **Drag & drop upload** — drop `.md` / `.txt` files anywhere on the page to upload and read; **same name overwrites**
- 📝 **Paste to save** — paste raw Markdown text in a modal; the **first heading becomes the filename**, saved to `/upload/markdown-reader` and opened right away (a timestamp is appended on name clashes — nothing is overwritten; saving is blocked until the text has a heading)
- 🌗 **Light / Dark** toggle (saved in localStorage)
- 🌐 **Multilingual UI** — English / 繁體中文 / 日本語 (default English, saved in localStorage)
- 🖨️ **Print** — portrait / landscape, forced black-on-white
- ✨ **Formatting toggle** — optionally apply CJK / Buddhist-text formatting (`MdFormater`) or show the raw file
- 🗂️ File-list sidebar, download original, clear page, empty folder
- 📰 **Reading style & print** — GitHub ↔ Newsprint reading skin, print font-scale, and a per-page-break **settings panel** (keep tables/lists together, page-break before H1, allow block/row breaks)
- 📐 **Content conventions** — HTML classes usable in the `.md`: `.siddham` (glyph + romanization), `.glyph` (gaiji SVG), `.note`, `.right-table-wrap`, `.no-print`, `.nowrap`

> Third-party front-end libraries (zero-md, Materialize, jQuery, Lodash, github-markdown-css, highlight.js) load from CDN — no bundling or build step.

## Quick start

Requires Node.js 18+.

```bash
npm install
npm start
# open http://localhost:3000/apps/markdown-reader/
```

Set `PORT` to change the port: `PORT=8080 npm start`.

## Directory structure

```
markdown-reader/
├── app.js                            # Standalone Express server (static + 2 APIs)
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

## API

| Method / Path | Description |
|---|---|
| `POST /api/upload?folder=markdown-reader` | Upload (form field `myFiles`, multi-file; keeps the original name when `folder` is set → overwrites) |
| `GET /api/markdown-reader/files` | List visible files in `public/upload/markdown-reader/` as `{ name, size, mtime }` (newest first) |
| `POST /api/markdown-reader/clear` | Delete all visible files in that folder (keeps the folder & hidden files) |

Static read: `/upload/markdown-reader/<name>`.

## Notes

- The front end calls APIs with **absolute paths** (`/api/...`, `/upload/...`, `/lib/adp-col/mdFormater.js`), so it must be served from the **site root** by this project's Node server. **Not GitHub-Pages-compatible** (static hosting can't run the upload / list / clear APIs).
- `MdFormater` is designed for CJK / Buddhist-scripture text (half→full-width punctuation, line-break normalization). Applied to general technical docs it may alter punctuation or affect tables / code — use the side `auto_fix_high` toggle to show the raw file anytime. **Download is always the original file.**

## License

[MIT](./LICENSE) © 2026 Scott G.F. Hong
