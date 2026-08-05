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
scripts/sync-copies.sh              # ①前端＋②route → InProgress 鏡像／③upload.js 與④public/upload/ 護欄（不同步）／⑤驗 8 個借來的共用件
routes/upload.js                    # POST /api/upload?folder=markdown-reader（家族共用最小版：權威版＝ nodeapp-webapp-family/routes-upload.js，byte-identical；含檔名消毒 sanitizeUploadName，§3.4）
routes/markdown-reader.js           # GET /files、POST /clear
public/apps/markdown-reader/        # 前端（服務於 /apps/markdown-reader/）
├─ index.html · markdown-reader.css · markdown-reader.js · markdown-reader-lib.js
├─ md-tweaks.js                     # 渲染前 .md 內容微調（window.MdTweaks；**Tags**→行內碼、單一 ~ 補空白、LaTeX 區塊 → $$、.note 依字數補 max-width）
├─ config.json                      # app 設定（列印、內文/code 字型 viewFont/printFont/codeFont/codePrintFont）
├─ viewer.css                       # zero-md shadow DOM 內容樣式（github 風通用；code 複製鈕；列印 SVG 深→淺反轉）
├─ viewer-newsprint.css             # newsprint 閱讀風皮膚層（疊在 github-markdown 之上）
├─ newsprint-fonts.css · fonts/pt-serif/   # PT Serif（自託管）+ Noto Serif TC/JP（懶載）
├─ side-tool.css · side-tool.js · i18n.js · locales/{zh-Hant,en,ja}.js   # （樣式＋行為：check 微回饋、矮視窗溢出收納；權威版＝家族 repo，§5.5）
├─ thinking-dot.css                 # 共用載入點 utility（權威版＝獨立 repo thinking-dot 的副本；.thinking-dot + @keyframes thinking-pulse）
├─ filter-clear.css · filter-clear.js  # §5.12 篩選框「清除」× 鈕 utility（自 local-reader 複製、byte-identical）；宿主＝側欄 #nav-filter
public/lib/adp-col/mdFormater.js    # 文體格式化器（toggle 開啟時套用）
public/upload/markdown-reader/      # 上傳檔案（內容不進版控）
icons/                              # App icon：M＋箭頭雙層 mask 徽章、favicon set、PWA manifest
```

> **App icon 有下游共用**：`icons/`（「M＋箭頭」品牌圖）與 [`markdown-library`](https://github.com/scottgfhong310/markdown-library) 共用一組——
> markdown-library 的 `icons/` 是**從這裡複製**的（它只另改 `manifest.json` 的 name/start_url/scope）。**在這裡換圖時，記得一併同步 markdown-library 那份**（兩支 markdown 家族 app 共用同一品牌識別，owner 決定）。
>
> **`local-reader` 已不在下游**：2026-07-22 起它改用**自己的「資料夾＋目錄樹」品牌圖**（權威版在 local-reader repo，見其「複製件登記」）；
> 幾何語法仍沿用 M＋箭頭系統（open-polyline、stroke 10、圓端點、tile 漸層/圓角、綠 `#5fcfa0`）故同血緣，但**換圖時不再需要同步它**。

## 複製件登記（共用件改版時靠這份找同步點）

| 檔案 | 來源 / 權威版本 |
|---|---|
| `mermaid-elk.js` | 家族 repo 根那份為準（byte-identical；zero-md 的 mermaid 改走 ELK 排版，見家族 §4.3。**控制器須在首次 `render()` 前呼叫 `MermaidElk.install(viewer)`**——已插在 `renderUntilBody()` 內） |
| `i18n.js` | 家族 repo `nodeapp-webapp-family/i18n.js`（權威版，byte-identical；`locales/*.js` 各 app 自維護） |
| `side-tool.css` | 家族 §5.5〔正統〕flex `.side-tools` 版 |
| `thinking-dot.css` | 獨立 repo `thinking-dot` 那份為準（家族 §4.6，byte-identical） |
| `md-tweaks.js` | `markdown-library` 那份為準（byte-identical）。共 6 份複製件。**同步與稽核都在權威版 repo、且都是自動的**：`bash scripts/sync-copies.sh` 的 ⑤ 會把它推進本 app（含本 app 的 InProgress 鏡像）、⑥ 再跑 `node scripts/test-md-tweaks.js` 驗這 6 份。⚠ **推完本 repo 會有未提交變更**（那支腳本不碰 git），要在這裡自己 commit |
| `filter-clear.css`、`filter-clear.js` | 家族 §5.12，`local-reader` 那份為準（byte-identical） |
| `public/lib/adp-col/mdFormater.js` | adp-col 孵化器產出（與 `markdown-library` 同份 byte-identical） |
| `viewer.css`、`viewer-newsprint.css`、`newsprint-fonts.css`、`fonts/pt-serif/` | **本 app 為源頭**（zero-md 內容樣式層）；`local-reader` 自此複製、byte-identical。`markdown-library` 的 `viewer.css` **2026-08-03 起規則集合已與本份完全相同**（`right-table-wrap` 回流本份、`.note` 的 `width:115px` 由該 app 移除），差異只剩區塊順序與註解措辭（列印段一句註解各自指向自己的控制器，屬正常）——稽核用「忽略註解＋排序後 diff」比對，勿再當內容分岔。⚠ **`.note` 一律不設固定寬度**〔owner 2026-08-03 說明〕：它是行內小註、**寬度隨字數而變**；`width:115px` 是舊 mdx 的做法，本 app 起手時即刻意不帶，現行做法是作者**在內容長度約 1/2 處手插 `<br/>`**（調適方便）。硬寬度會與手插的 `<br/>` 疊加成三、四行，**因此不要「補回」它**。改以 **`text-wrap: balance`**（把已折行的小註各行長度自動勻分，＝手插 `<br/>` 想達成的效果；只有一行時無作用，故零風險）＋ **`--note-max` token（預設 `none`）**：要「中等長度自動兩行」時才於容器或該註設 `--note-max: 14em`，**一律用 `em` 不用 `px`**（px 不跟著列印字級放大與 `config` 換字型走）。實測 255 條小註／472 個半行字數極不均（中位 13、長尾逾 2000），**任何固定上限都會把長註壓成又窄又高的一柱**（16em 時 44% 半行被再次斷開），故不預設開啟。⚠ **「不預設開啟」自 2026-08-05 起只對 CSS 那一層成立**：`md-tweaks.js` 的微調 #5（`noteMaxWidth`）會在**渲染前**依字數自動補 `style="max-width: ##em"`，**只有自帶 `style=` 的小註會被跳過**，所以畫面上小註幾乎都有上限。上面那句顧慮**仍然沒有被違反**——微調給的上限**與字數等比、不是固定值**（6000 字的註得到 3000em＝形同無上限），正是為了避開「長註被壓成一柱」。⚠ **`newsprint-fonts.css`／`fonts/pt-serif/` 也不是分岔點**：原記「字型子集不同」，2026-08-03 實查為誤——4 支 woff2 三支 md5 全同、4 組 `@font-face` 與 `unicode-range` 逐字相同，只差檔頭一句註解指向各自的控制器 |
| `icons/`（「M＋箭頭」品牌圖 + favicon/PWA） | **本 app 為源頭**；`markdown-library` 自此複製、byte-identical（換圖時一併同步下游，`manifest.json` 各自有 name/start_url/scope 故不同步）。`local-reader` **2026-07-22 起已分家**、改用自有品牌圖，不再是下游 |

## 執行 / 驗證

```bash
npm install && node app.js          # → http://localhost:3000/apps/markdown-reader/
bash scripts/sync-copies.sh         # 回灌 InProgress ＋ 驗 8 個借來的共用件（不一致回非 0）
```

**別手動 `cp -R` 整包**——本 app 的鏡像有兩個不能碰的東西，腳本已內建護欄：

- **`routes/upload.js` 絕不推過去**。本 repo 這份是家族**共用最小版**（164 行，只服務本 app）、
  與家族權威版 `nodeapp-webapp-family/routes-upload.js` byte-identical；InProgress 那份是
  **多 app 共用版**（297 行，服務整個孵化器）。推過去等於讓其他 app 的上傳一起壞
  （家族 canon「回灌時不要蓋掉 InProgress 的 `app.js` / `upload.js`」）。**③ 因此驗兩件事**：
  本 repo 這份仍等於家族權威版，且 InProgress 那份**仍與它不同**——
  相同才要擔心（**警告不算失敗**，全新環境本來就可能相同，當成錯誤會誤報）。
- **`public/upload/markdown-reader/` 從不觸碰**：使用者上傳的內容（不進版控），
  獨立版少量 sample、鏡像是實際在用的檔案。

> `rsync` 不刪檔，所以 ① 的 `diff -rq` 不是廢話：它抓的是**鏡像裡的殘留檔**
> （獨立版已刪、鏡像還留著）。上述護欄與共用件漂移都以反向驗證確認會如實出聲。
>
> ⚠ `md-tweaks.js` 在 ⑤ 是**只驗不抓**——它的權威版是 `markdown-library`，
> 由**該 repo** 的 `sync-copies.sh` ⑤ 推過來。要改就去那邊改完再跑它的腳本，**別在這裡就地改**。

## 本 app 的 canon 重點

- **可嵌入 lib** `markdown-reader-lib.js`：與伺服器溝通 / 下載 / 檔名工具，純邏輯不碰 DOM（`window.MarkdownReaderLib`）；`markdown-reader.js` 才是碰 DOM 的控制器。
- **絕對路徑**：前端用 `/api/...`、`/upload/...`、`/lib/...`，須由本專案 Node server 從站台根提供（**不相容 GitHub Pages 純靜態**）。
- **i18n**：`i18n.js` 引擎 + `locales/*.js`，`data-i18n` 屬性，預設 `zh-Hant`。
- **主題**：CSS 變數 light/dark，預設 dark；同步切換 zero-md 的 github-markdown / highlight.js 樣式表。
- **閱讀風格（reading style）**：與 light/dark 正交的第二軸，側邊 `newspaper` toggle（`#setting-style`，狀態存 `localStorage('markdown-reader-style')`，預設 `github`）。`newsprint` 風以 `viewer-newsprint.css` 疊在 github-markdown 之上換成襯線紙感，明暗跟著主題走（host `data-mode`）：**light 為 newsprint 原本的紙感**（`#f3f2ee`）；**dark 為「暖墨紙夜」——墨色維持暖調襯線性格，但畫布與 code／表格底色一律對齊 GitHub 閱讀風**（`--np-bg: var(--card-bg, #0f1115)`，自訂屬性穿透 shadow DOM 邊界繼承；code／表頭／斑馬列 `#151b23` ＝ github-markdown-css dark 的 canvas-subtle），故 dark 下切換兩風時畫布不變、只換字體與墨色。皮膚 link 以 `media="not all"` 停用、字型懶載。
- **貼上存檔**：側邊 `edit_note`（`#setting-paste`）開 modal 貼上 .md 文字，**第一個標題＝檔名**（`deriveFilename`，純邏輯在 lib：剝行內 markdown、消毒禁字、上限 80 碼位；ATX 任意層級＋setext `=`，先去 fenced code）；存檔走**既有 `/api/upload` 上傳管線**（文字包成 File，後端零改動），同名以 `resolveCollision` 尾附時間戳避開（不覆寫）、無標題擋下存檔；完成後直接開啟新檔。
- **文體格式化（MdFormater）預設關閉**（顯示原文）；側邊 `auto_fix_high` toggle 切換，**下載永遠是原檔**。
- **內容微調 `md-tweaks.js`**（`window.MdTweaks`）：渲染前對 .md 原文做純字串微調（依序套用、只影響顯示、下載仍原檔）；目前 ①`**Tags**`→行內碼 ②單一 `~` 補空白防誤判刪除線 ③CJK 粗體鄰全形開括號補空白（`**「粗體」**` 與 `**粗體**（`；GFM/marked flanking）④LaTeX 區塊公式 `\[…\]`／被吃掉反斜線的裸 `[…]` → `$$…$$`（KaTeX 只認 `$` 系列），順手修行尾 `\`→`\\`、數字後 `%`→`\%`、裸中文包 `\text{}`；行內 `\(…\)`→`$…$` ⑤`<span class="note">` 依字數補 `style="max-width: ##em"`（值＝**max(內容字數 ÷ 2 進位, 最長半行)**；CJK 一字約一 em，取一半即折兩行＋`text-wrap: balance` 勻分，＝把「作者手插 `<br/>`」的慣例自動化。**「最長半行」只在真的有手插 `<br/>` 時參與**〔否則一段＝全文，`max(n/2,n)=n` 形同無上限、微調靜默失效〕，作用是不讓作者切出的半行再被折斷。**不計內層標籤**、**已自帶 `style=` 者不動**〔作者明示優先，亦即冪等〕、**收尾 `</span>` 數深度找**〔語料 16 條含巢狀 `<span>`，非貪婪會把上限壓窄且不報錯〕）。由 `renderCurrentContent` 在 `formatMd` 前套用。
  - **程式碼遮罩 `withCodeMasked`**（除 ① 外全部共用）：三趟遮罩（``` fenced → `~~~` fenced → `` `inline` ``）換成 NUL 佔位，套完 transform 再還原。⚠ **還原是迴圈、跑到字串不再變動**〔2026-08-05 修〕——第三趟的 inline 正則會吃到已含佔位符的文字，而 `String.replace` 不會再掃描替換後的內容，只做一趟會讓**實體 NUL** 殘留到輸出並進 DOM。**這個 NUL 不寫進磁碟，家族「原始碼不得含 NUL」那條稽核抓不到**；而六個微調全走這支函式，會一起中招、沒有對照組。回歸稽核在權威版 repo（`markdown-library/scripts/test-md-tweaks.js`），設計說明見該 repo `DESIGN.md` §7.8／§7.8.1。
- **config 驅動字型**：`config.json` 的 `viewFont`/`printFont`/`codeFont`/`codePrintFont`（`apply/family/size`）覆寫內文與 code/pre 字型，注入 template 的 `<style id="md-font">`（shadow DOM），`!important` 蓋過 github/newsprint；預設 `apply:false`。
- **列印字級放大**：側邊 toggle `#setting-print-scale`（`format_size`）；開啟時注入 template 的 `<style id="md-print-scale">` 一條 `@media print{.markdown-body{font-size:calc(<base> * <factor>) !important;}}`，倍率＝`config.printScale`（預設 `1.25`＝125%、可調），用來抵銷「一張 A4 印 N 頁」的縮小。狀態存 `localStorage('markdown-reader-printscale')`；只影響列印。
- **程式碼複製鈕**：render 後 `addCopyButtons` 在 shadow DOM 為每個 `<pre>` 包 `.code-wrap` 加複製鈕（inline SVG、hover 現身、列印隱藏、i18n `tool.copyCode`）。
- **render 韌性**：zero-md `render()` 冷啟動時 promise 偶爾不 resolve（內部等外部 CDN 樣式 `<link>` 的 load 事件）。`renderUntilBody` 以 timeout race 重試。**成功條件 `= res.body || bodyPainted()`**（`res.body` 是「原文 hash 有變」旗標、非「已渲染」；冷啟動超過 race 1200ms 時被丟棄、此後永遠 `false`、`#loading` 卡住不退）——`bodyPainted()` 比對 `.markdown-body[data-hash]` 與 slot 原文 hash；不能只看 `.markdown-body` 非空（切換文件時舊內容仍在、hash 不同不誤判）。**根因鏈另一環**：`applySkinToLink` 對皮膚 link **兩態都設 `href`**（只用 `media` 切換啟用/停用）——github 風若留無 `href` 的 `<link rel=stylesheet>`，zero-md 的 `stamp()` 會 `await` 一個永不觸發的 load 事件而吊死首次 render（無 href → load/error 皆不觸發；`media="not all"` ＋ 有 href → load 照樣觸發）。設完 `<script>` slot 後讓出一個 macrotask 再 render（zero-md 以 MutationObserver 觀察 slot，立即 render 會讀到舊值）。詳見家族 §4.3。
- **載入動畫**：`#loading` 覆蓋層（Claude 風「思考中」呼吸脈動點 + 文字）；脈動點本體（`.thinking-dot` + `@keyframes thinking-pulse`）來自共用 **`thinking-dot.css`** utility（token 驅動；本 app 唯讀消費、以 `#loading .thinking-dot { --td-color: var(--accent) }` 套色；調校在獨立 app `thinking-dot`，見家族 §4.6）。`openFile` 抓檔／渲染期間 `showLoading()`（180ms 延遲防閃爍）、完成後 `hideLoading()`，取代原本在 viewer 內渲染 `md.loading` 文字。列印隱藏、i18n `loading`。
- **API 信封**：一律 `{ ok }`；jQuery 3.7.1，後端不依賴 lodash。
