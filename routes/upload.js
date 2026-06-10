const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const _ = require('lodash');
const fsSync = require('fs'); // for existsSync

// 全域上傳紀錄
const uploadHistory = [];
let uploadSeq = 1;

// 產生 yyyyMMdd 子資料夾
function getDateFolder() {
  const now = new Date();
  return (
    now.getFullYear().toString() +
    _.padStart((now.getMonth() + 1).toString(), 2, '0') +
    _.padStart(now.getDate().toString(), 2, '0')
  );
}

// 產生 hhmmssfff_ 前綴
function getTimePrefix() {
  const now = new Date();
  return (
    _.padStart(now.getHours().toString(), 2, '0') +
    _.padStart(now.getMinutes().toString(), 2, '0') +
    _.padStart(now.getSeconds().toString(), 2, '0') +
    _.padStart(now.getMilliseconds().toString(), 3, '0') +
    '_'
  );
}

// 驗證使用者指定的資料夾名稱，避免路徑穿越攻擊
function sanitizeFolder(name) {
  if (!name || typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  // 不可含路徑分隔字元、null byte，且不可為 . 或 ..
  if (path.basename(trimmed) !== trimmed) return null;
  if (/^\.+$/.test(trimmed)) return null;
  if (/[\/\\\0]/.test(trimmed)) return null;
  return trimmed;
}

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const custom = sanitizeFolder(req.query.folder);
      const folder = custom || getDateFolder();
      let uploadPath = path.join(__dirname, '../public/upload', folder);

      switch (folder) {
        case 'my-markdown': {
          // 特例：my-markdown 資料夾直接放在 public/lib 目錄下
          uploadPath = path.join(__dirname, '../public/lib/markdown');
          break;
        }
        case 'my-attach': {
          // 特例：my-attach 資料夾直接放在 public/lib 目錄下
          uploadPath = path.join(__dirname, '../public/lib/attach');
          break;
        }
        default: {
          // 其他資料夾放在 public/upload 下的子資料夾
        }
      }

      await fs.mkdir(uploadPath, {
        recursive: true
      });
      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },
  filename: function (req, file, cb) {
    let originalName = file.originalname;
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch (e) {
      // fallback: 保持原樣
    }
    // 指定 folder 時保留原檔名；否則加上時間前綴避免衝突
    const custom = sanitizeFolder(req.query.folder);
    cb(null, custom ? originalName : getTimePrefix() + originalName);
  }
});

const upload = multer({
  storage: storage
}).array('myFiles', 20);

router.post('/', function (req, res) {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(500).json({
        success: false,
        error: 'Multer error: ' + err.message
      });
    } else if (err) {
      return res.status(500).json({
        success: false,
        error: 'File upload error: ' + err.message
      });
    }
    const now = new Date();
    const uploadDate = now.toISOString();
    // 回傳上傳後的檔案資訊
    const files = (req.files || []).map(f => {
      // 修正 originalname 亂碼
      let originalName = f.originalname;
      try {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      } catch (e) {}
      // 新增到全域上傳紀錄
      const record = {
        seq: uploadSeq++,
        originalname: originalName,
        filename: f.filename,
        date: uploadDate
      };
      uploadHistory.push(record);
      return {
        originalname: originalName,
        filename: f.filename,
        size: f.size,
        path: f.path.replace(/\\/g, '/').replace(/^.*public\//, '/'),
        date: uploadDate
      };
    });
    res.json({
      success: true,
      uploadDate,
      files,
      uploadHistory
    });
  });
});

function renderHistoryTbody(history) {
  let rows = '';
  if (history && history.length > 0) {
    // 依日期降序
    const sorted = history.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (const item of sorted) {
      rows += `<tr>` +
        `<td>${item.seq}</td>` +
        `<td>${item.originalname}</td>` +
        `<td>${item.filename}</td>` +
        `<td>${item.date ? item.date.replace('T', ' ').replace(/\..*$/, '') : '-'}</td>` +
        `<td><a href="#" class="delete-file" data-filename="${encodeURIComponent(item.filename)}"><i class="material-icons red-text">delete</i></a></td>` +
        `</tr>`;
    }
  } else {
    rows = '<tr><td colspan="5">尚無上傳紀錄</td></tr>';
  }
  return `<tbody>${rows}</tbody>`;
}

router.get('/history', function (req, res) {
  if (req.query.htmx === '1') {
    res.send(renderHistoryTbody(uploadHistory));
  } else {
    res.json({
      success: true,
      uploadHistory
    });
  }
});

router.post('/delete', async function (req, res) {
  const {
    filename
  } = req.body;
  if (!filename) return res.status(400).json({
    success: false,
    error: 'No filename provided'
  });
  const idx = uploadHistory.findIndex(item => item.filename === filename);
  if (idx === -1) return res.status(404).json({
    success: false,
    error: 'File not found in history'
  });
  try {
    const folder = uploadHistory[idx].date.substr(0, 10).replace(/-/g, '');
    const filePath = path.join(__dirname, '../public/upload', folder, filename);
    if (fsSync.existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    uploadHistory.splice(idx, 1);
    if (req.query.htmx === '1') {
      res.send(renderHistoryTbody(uploadHistory));
    } else {
      return res.json({
        success: true,
        uploadHistory
      });
    }
  } catch (e) {
    if (req.query.htmx === '1') {
      res.send(renderHistoryTbody(uploadHistory));
    } else {
      return res.status(500).json({
        success: false,
        error: e.message
      });
    }
  }
});

module.exports = router;