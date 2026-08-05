#!/bin/bash
# sync-copies.sh — 把本 repo 的前端＋route 同步到 InProgress 鏡像，並驗證借來的共用件。
#
# 三種方向不要混淆：
#   ①② **往外推到 InProgress 鏡像**（本 repo 是權威）
#   ③④ **護欄：刻意不同步的東西**（推過去會破壞孵化器）
#   ⑤   **只驗不抓**（借來的共用件，權威在別處——該不該更新是上游的決定，
#        自動拉會讓一次無意的上游改動悄悄流進來）
#
# ⚠️ **本 app 的鏡像有兩個不能碰的東西**：
#
#   ③ **`routes/upload.js` 絕不推過去**。本 repo 這份是家族**共用最小版**（只服務
#      markdown-reader）；InProgress 那份是**多 app 共用版**（近兩倍長，服務整個孵化器）。
#      推過去等於讓其他 app 的上傳一起壞掉——家族 canon「回灌時不要蓋掉 InProgress 的
#      app.js / upload.js」講的就是這件事。**兩邊本來就該不一樣。**
#   ④ **`public/upload/markdown-reader/` 從不觸碰**。那是使用者上傳的內容（不進版控）：
#      獨立版只有少量 sample、InProgress 是實際在用的檔案。
#
# **回灌不是一次性的**（WORKFLOW.md Path A 的 A4）：GitHub 版是權威，
# 之後每次改前端都要再跑一次，否則 3001 上跑的是舊版。
# 這支腳本存在的理由就是「別靠記性」。
#
# 用法：bash scripts/sync-copies.sh
set -u
G=/Users/Shared/nodeapp/GitHub
I=/Users/Shared/nodeapp/InProgress
APP=markdown-reader
SRC=$G/$APP/public/apps/$APP
DST=$I/public/apps/$APP
EXCLUDE=(--exclude=.claude --exclude=.bak)
FAIL=0

echo "=== ① 前端 → InProgress 鏡像（排除 .claude/ 與 .bak/）==="
if [ ! -d "$SRC" ]; then
  echo "  FAIL  來源不存在：$SRC"; FAIL=1
else
  mkdir -p "$DST"
  rsync -a "${EXCLUDE[@]}" "$SRC/" "$DST/"
  # rsync 不刪檔，所以這個 diff 不是廢話：它抓的是**鏡像裡的殘留檔**
  #（獨立版已刪、鏡像還留著）。
  if diff -rq -x '.claude' -x '.bak' "$SRC" "$DST" > /dev/null; then
    echo "  OK  與獨立版逐檔相同（$(find "$SRC" -type f -not -path '*/.bak/*' | wc -l | tr -d ' ') 個檔）"
  else
    echo "  MISMATCH  以下有差異："
    diff -rq -x '.claude' -x '.bak' "$SRC" "$DST"
    FAIL=1
  fi
fi

echo "=== ② route → InProgress ==="
if cp "$G/$APP/routes/$APP.js" "$I/routes/$APP.js" && diff -q "$G/$APP/routes/$APP.js" "$I/routes/$APP.js" > /dev/null; then
  echo "  OK  routes/$APP.js 相同"
else
  echo "  MISMATCH  routes/$APP.js"; FAIL=1
fi
echo "  註：route 有變更時 **3001 常駐 server 要重啟**（純靜態改動則不必）。"

echo "=== ③ routes/upload.js 護欄（應為「兩邊不同」——相同才要擔心）==="
FAMU=$G/nodeapp-webapp-family/routes-upload.js
# 3a 本 repo 這份要等於家族權威版
if diff -q "$G/$APP/routes/upload.js" "$FAMU" > /dev/null 2>&1; then
  echo "  OK  本 repo 的 routes/upload.js ＝ 家族權威版 routes-upload.js（byte-identical）"
else
  echo "  MISMATCH  本 repo 的 routes/upload.js 與家族權威版不同"
  echo "            ← 權威版：nodeapp-webapp-family/routes-upload.js（§3.4 最小版）"
  FAIL=1
fi
# 3b InProgress 那份**應該**不同（多 app 共用版）。相同＝可能被誰用本 repo 這份蓋掉了。
if diff -q "$G/$APP/routes/upload.js" "$I/routes/upload.js" > /dev/null 2>&1; then
  echo "  ⚠️  InProgress 的 routes/upload.js 與本 repo 一模一樣。"
  echo "      它本來應該是**多 app 共用版**——請確認它沒有被單 app 版蓋掉，"
  echo "      否則孵化器裡其他 app 的上傳會一起壞。本腳本從不寫入它。"
else
  n_src=$(wc -l < "$G/$APP/routes/upload.js" | tr -d ' ')
  n_dst=$(wc -l < "$I/routes/upload.js" | tr -d ' ')
  echo "  OK  兩邊不同（本 repo 最小版 $n_src 行／鏡像多 app 版 $n_dst 行）——本腳本未觸碰它"
fi

echo "=== ④ public/upload/ 護欄（內容，本腳本從不觸碰）==="
n_g=$(ls "$G/$APP/public/upload/$APP" 2>/dev/null | wc -l | tr -d ' ')
n_i=$(ls "$I/public/upload/$APP" 2>/dev/null | wc -l | tr -d ' ')
echo "  OK  獨立版 $n_g 個／鏡像 $n_i 個——內容非程式碼，兩環境各自演進，未觸碰"

echo "=== ⑤ 借來的共用件：與權威版比對（只驗不抓）==="
check() {  # $1=檔名  $2=權威版絕對路徑  $3=權威版說明
  local a b
  a=$(md5 -q "$SRC/$1" 2>/dev/null) || a=MISSING
  b=$(md5 -q "$2" 2>/dev/null) || b=MISSING
  if [ "$a" = "$b" ] && [ "$a" != "MISSING" ]; then
    printf "  OK        %-22s %s\n" "$1" "$a"
  else
    printf "  MISMATCH  %-22s local=%s auth=%s\n" "$1" "$a" "$b"
    printf "            ← 權威版：%s\n" "$3"
    FAIL=1
  fi
}

FAM=$G/nodeapp-webapp-family
check side-tool.css   "$FAM/side-tool.css"   "nodeapp-webapp-family（§5.5）"
check side-tool.js    "$FAM/side-tool.js"    "nodeapp-webapp-family（§5.5）"
check i18n.js         "$FAM/i18n.js"         "nodeapp-webapp-family（locales/*.js 本 app 自維護，不比）"
check mermaid-elk.js  "$FAM/mermaid-elk.js"  "nodeapp-webapp-family（§4.3；沒註冊會靜默退回 dagre）"
check thinking-dot.css "$G/thinking-dot/public/apps/thinking-dot/thinking-dot.css" "thinking-dot repo（該 utility 的家與調校台）"
check filter-clear.css "$G/local-reader/public/apps/local-reader/filter-clear.css" "local-reader（家族 §5.12）"
check filter-clear.js  "$G/local-reader/public/apps/local-reader/filter-clear.js"  "local-reader（家族 §5.12）"
# md-tweaks.js 的權威版是 markdown-library，**由它的 sync-copies.sh ⑤ 推過來**，
# 這裡只驗。要修就去那邊改完再跑它的腳本，不要在本 repo 就地改。
check md-tweaks.js     "$G/markdown-library/public/apps/markdown-library/md-tweaks.js" "markdown-library（跑該 repo 的 sync-copies.sh ⑤ 推過來；行為稽核見其 scripts/test-md-tweaks.js）"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "全部通過。"
else
  echo "有項目不一致（見上）。⑤ 借來的共用件不自動修正——請到權威版那側改完再同步過來。"
fi
exit "$FAIL"
