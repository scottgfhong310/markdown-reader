/**
 * markdown-reader — 獨立執行的 Express 伺服器
 *
 * 提供：
 *   - 靜態檔（public/）→ 應用在 /apps/markdown-reader/
 *   - 上傳 API：/api/upload?folder=markdown-reader（routes/upload.js）
 *   - 列表 / 清空 API：/api/markdown-reader（routes/markdown-reader.js）
 *
 * 啟動： npm install && npm start
 *        預設 http://localhost:3000/apps/markdown-reader/
 */

const express = require('express');
const path = require('path');

const uploadRouter = require('./routes/upload');
const markdownReaderRouter = require('./routes/markdown-reader');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/upload', uploadRouter);
app.use('/api/markdown-reader', markdownReaderRouter);

// 根路徑導向應用頁
app.get('/', (req, res) => res.redirect('/apps/markdown-reader/'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`markdown-reader →  http://localhost:${PORT}/apps/markdown-reader/`);
});
