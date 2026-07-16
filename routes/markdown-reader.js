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

module.exports = router;
