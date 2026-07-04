/**
 * markdown-reader
 * ---------------
 * 後端 handler，搭配 public/apps/markdown-reader 前端使用。
 *
 * 上傳沿用既有的 /api/upload?folder=markdown-reader（routes/upload.js）：
 *   檔案落在 public/upload/markdown-reader/，指定 folder 時保留原檔名 → 同名直接覆寫。
 *
 * 本 router 額外提供「列表」與「清空」兩支 API：
 *   GET  /api/markdown-reader/files  → 列出 upload/markdown-reader/ 下的可見檔案
 *   POST /api/markdown-reader/clear  → 刪除該資料夾下所有可見檔案（保留資料夾與隱藏檔）
 *
 * 安全限制：
 *   - 操作目標固定為 public/upload/markdown-reader，不接受任何外部路徑參數
 *   - 只處理一般檔案，跳過隱藏檔（.DS_Store、.gitkeep…）與子目錄
 */

const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');   // GITHUB_DIR 解析用（existsSync）

const router = express.Router();

// 固定的上傳資料夾（與前端、/api/upload?folder=markdown-reader 對齊）
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'upload', 'markdown-reader');

// 只處理可見檔案，略過 .DS_Store / .gitkeep 等隱藏檔
function isVisible(name) {
  return typeof name === 'string' && name.length > 0 && name[0] !== '.';
}

// GET /api/markdown-reader/files — 列出資料夾內容（依修改時間新→舊）
router.get('/files', async (req, res) => {
  try {
    const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
    const files = [];
    for (const ent of entries) {
      if (!ent.isFile() || !isVisible(ent.name)) continue;
      const stat = await fs.stat(path.join(UPLOAD_DIR, ent.name));
      files.push({ name: ent.name, size: stat.size, mtime: stat.mtimeMs });
    }
    files.sort((a, b) => b.mtime - a.mtime);
    return res.json({ ok: true, files });
  } catch (err) {
    // 資料夾尚未建立 → 視為空清單
    if (err.code === 'ENOENT') return res.json({ ok: true, files: [] });
    console.error('[markdown-reader] GET /files failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/markdown-reader/clear — 清空資料夾下所有可見檔案
router.post('/clear', async (req, res) => {
  try {
    let entries;
    try {
      entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
    } catch (err) {
      if (err.code === 'ENOENT') return res.json({ ok: true, removed: 0, files: [] });
      throw err;
    }
    const removed = [];
    for (const ent of entries) {
      if (!ent.isFile() || !isVisible(ent.name)) continue;
      await fs.unlink(path.join(UPLOAD_DIR, ent.name));
      removed.push(ent.name);
    }
    console.log('[markdown-reader] POST /clear → removed', removed.length, 'file(s)');
    return res.json({ ok: true, removed: removed.length, files: removed });
  } catch (err) {
    console.error('[markdown-reader] POST /clear failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== 瀏覽 nodeapp/GitHub 下的 .md（唯讀） =====
// 根目錄解析：由本檔往上找名為 GitHub 的資料夾（含「自己就在 GitHub 內」的情況），
// 讓 InProgress（nodeapp/InProgress/routes → nodeapp/GitHub）與獨立 bundle
// （nodeapp/GitHub/markdown-reader/routes → nodeapp/GitHub）兩種佈局都解析正確。
const GITHUB_DIR = (function () {
  let d = __dirname;
  for (let i = 0; i < 6; i++) {
    d = path.dirname(d);
    if (path.basename(d) === 'GitHub') return d;                 // bundle：repo 本身就在 GitHub/ 下
    const cand = path.join(d, 'GitHub');
    if (fsSync.existsSync(cand)) return cand;                    // InProgress：nodeapp/GitHub 為兄弟層
  }
  return path.resolve(__dirname, '..', '..', 'GitHub');          // 後備（原行為）
})();
const MD_RE = /\.(md|markdown|mdown|mkd|mkdn|mdwn|mdtxt|text|txt)$/i;
const SKIP_DIRS = new Set(['node_modules', '.git', '.bak', '.vscode', '.claude', 'dist', 'coverage', '__pycache__', 'venv']);

function withinDir(baseDir, abs) {
  return abs === baseDir || abs.startsWith(baseDir + path.sep);
}

// 遞迴列 .md（跳過 node_modules/.git/隱藏夾）；回相對 baseDir 的 posix 路徑
async function walkMd(dir, out, baseDir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return; throw e; }
  for (const ent of entries) {
    if (ent.name[0] === '.' || SKIP_DIRS.has(ent.name)) continue;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      await walkMd(abs, out, baseDir);
    } else if (ent.isFile() && MD_RE.test(ent.name)) {
      const stat = await fs.stat(abs);
      out.push({ path: path.relative(baseDir, abs).split(path.sep).join('/'), size: stat.size, mtime: stat.mtimeMs });
    }
  }
}

// 相對路徑消毒：非空、每段非 . / .. / 隱藏、不含 \ \0、.md 白名單
function sanitizeMdRel(p) {
  let s = String(p == null ? '' : p).trim().replace(/^\/+/, '');
  if (!s || /\0/.test(s)) return null;
  const parts = s.split('/');
  for (const seg of parts) {
    if (!seg || seg === '.' || seg === '..' || seg[0] === '.' || /[\\]/.test(seg)) return null;
  }
  s = parts.join('/');
  return MD_RE.test(s) ? s : null;
}

// nodeapp 根（GitHub 的上一層）：只列「直接放在 nodeapp/ 下」的 .md，不遞迴其子專案
const NODEAPP_DIR = path.resolve(GITHUB_DIR, '..');
// txf-neo：與 nodeapp 同層的專案根，整棵遞迴（比照 GitHub）；不存在時回空清單
const TXF_DIR = path.resolve(NODEAPP_DIR, '..', 'txf-neo');

async function listNodeappMd() {
  const out = [];
  let entries;
  try { entries = await fs.readdir(NODEAPP_DIR, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return out; throw e; }
  for (const ent of entries) {
    if (!ent.isFile() || ent.name[0] === '.' || !MD_RE.test(ent.name)) continue;
    const stat = await fs.stat(path.join(NODEAPP_DIR, ent.name));
    out.push({ name: ent.name, size: stat.size, mtime: stat.mtimeMs });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

// GET /api/markdown-reader/github-list — 列 nodeapp/GitHub 全部 ＋ nodeapp 頂層 ＋ txf-neo 全部
router.get('/github-list', async (req, res) => {
  try {
    const files = [];
    await walkMd(GITHUB_DIR, files, GITHUB_DIR);
    files.sort((a, b) => a.path.localeCompare(b.path));
    const nodeappFiles = await listNodeappMd();
    const txfFiles = [];
    await walkMd(TXF_DIR, txfFiles, TXF_DIR);
    txfFiles.sort((a, b) => a.path.localeCompare(b.path));
    return res.json({ ok: true, files, nodeappFiles, txfFiles });
  } catch (err) {
    console.error('[markdown-reader] GET /github-list failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/markdown-reader/github-file?path=<rel>[&root=nodeapp|txf-neo] — 讀單一 .md（回純文字）
// root=nodeapp 時 path 限單一檔名（nodeapp 頂層檔）；root=txf-neo 相對 txf-neo/；預設 root＝GitHub/。
router.get('/github-file', async (req, res) => {
  const rel = sanitizeMdRel(req.query.path);
  if (!rel) return res.status(400).json({ ok: false, error: '不允許的路徑' });
  const root = req.query.root || '';
  if (root && root !== 'nodeapp' && root !== 'txf-neo') return res.status(400).json({ ok: false, error: '不允許的 root' });
  const isNodeapp = root === 'nodeapp';
  if (isNodeapp && rel.indexOf('/') >= 0) return res.status(400).json({ ok: false, error: '不允許的路徑' });
  const baseDir = isNodeapp ? NODEAPP_DIR : (root === 'txf-neo' ? TXF_DIR : GITHUB_DIR);
  const abs = path.join(baseDir, rel);
  if (!withinDir(baseDir, abs)) return res.status(400).json({ ok: false, error: '路徑越界' });
  try {
    const text = await fs.readFile(abs, 'utf8');
    return res.type('text/markdown; charset=utf-8').send(text);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ ok: false, error: '檔案不存在' });
    console.error('[markdown-reader] GET /github-file failed:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
