# KaTeX（自託管 / vendored）

zero-md v3 內建 KaTeX 渲染數學公式。這個資料夾放的是**樣式與字型**的自託管副本。

- **版本：`0.18.1`**（取自 `https://cdn.jsdelivr.net/npm/katex@0.18.1/dist/`）
- **內容**：`katex.min.css`（**原檔未改一個位元組**）＋ `katex-fonts.css`（只有 20 條 `@font-face`
  的抽出版，逐字擷取自前者）＋ `fonts/` 的 **20 個 `.woff2`**。
  CSS 內的 `src: url(fonts/…)` 是相對路徑，維持 `katex.min.css` 與 `fonts/` 的相對位置即可直接用，
  不需要改 CSS。
- **為何只收 woff2**：CSS 的 `src` 依序列 woff2 → woff → ttf，瀏覽器取**第一個支援的格式**；
  現代瀏覽器一律命中 woff2，故另外 40 個 `.woff`/`.ttf`（約 800KB）不進版控、實際上也不會被請求
  （只有 woff2 全無支援的古董瀏覽器才會去要它們而 404，屆時退回系統襯線字）。
- **為何自託管**：公式字型不再依賴 CDN——KaTeX 的 `@font-face` 設 `font-display: block`，抓字型
  期間公式會先隱形；抓不到就整組退成 `Times New Roman`（`.katex` 的後備堆疊），而排版 metrics 仍
  照 Computer Modern 算、間距會走樣。自託管同時把字型版本**釘死**，不隨 CDN 的 `katex@0` 浮動。

## ⚠️ 兩份 CSS 缺一不可（shadow DOM 的坑）

- `katex.min.css` → 放進 `<zero-md>` 的 `<template>`：`.katex` 的版面規則必須在 **shadow tree 內**
  才作用得到（主文件 CSS 穿不進 shadow DOM）。
- `katex-fonts.css` → 放進主文件 `<head>`：**shadow tree 內的 `@font-face` 不會註冊**，字型必須由
  主文件宣告。實測（Chrome，2026-07-25）：同一段公式在主文件有這份 CSS 時量到 **48.70px**、沒有時
  **45.99px**——後者是字型抓不到、掉到 `.katex` 後備堆疊的 **Times New Roman**（版面 metrics 仍照
  Computer Modern 算，所以「看起來還好、其實不是那套字」）。

只放 template 那份 → 公式永遠是 Times；只放 `<head>` 那份 → 公式沒有版面規則。

## ⚠️ 這不等於離線可用

**KaTeX 的「引擎」仍由 zero-md 從 CDN 載入**（`katex@0/dist/katex.mjs`，浮動版本），zero-md 本體與
marked 也都在 CDN。CDN 全斷時公式不會退成 Times，而是根本不會渲染。這裡自託管的只有樣式與字型。

因此引擎浮動到新的 minor 版時，**請一併把這裡升上去**，避免字型／CSS 與引擎版本落差。

## 重新同步（升版時）

```bash
V=0.18.1                                   # 改成要升的版本
curl -o katex.min.css "https://cdn.jsdelivr.net/npm/katex@$V/dist/katex.min.css"
curl -s "https://data.jsdelivr.com/v1/packages/npm/katex@$V?structure=flat" \
  | python3 -c "import sys,json;print('\n'.join(x['name'] for x in json.load(sys.stdin)['files'] if x['name'].startswith('/dist/fonts/') and x['name'].endswith('.woff2')))" \
  | while read n; do curl -s -o "fonts/$(basename $n)" "https://cdn.jsdelivr.net/npm/katex@$V$n"; done
```

改版後四支 app（`markdown-reader` / `markdown-library` / `local-reader` / `session-journal`）與
InProgress 鏡像的這包要一起同步，保持 byte-identical（同 `side-tool.css` / `thinking-dot.css` 慣例）。
家族慣例見 `nodeapp-webapp-family/DESIGN_GUIDELINES.md` §4.3。
