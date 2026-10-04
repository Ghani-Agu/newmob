// Minimal storefront server. No dependencies.
//   GET  /api/store          public store data (hero + products)
//   PUT  /api/store          save store data        (x-admin-key required)
//   POST /api/upload?name=   upload an image/video  (x-admin-key required)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const STORE_FILE = path.join(ROOT, 'data', 'store.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const MAX_JSON = 1024 * 1024; // 1 MB
const MAX_UPLOAD = 200 * 1024 * 1024; // 200 MB

if (!process.env.ADMIN_PASSWORD) {
  console.warn('ADMIN_PASSWORD is not set, using "admin". Set it before going live.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
};
// SVG is left out on purpose: an uploaded SVG can carry script.
const UPLOAD_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.mp4', '.webm']);

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Payload too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function validateStore(store) {
  if (!store || typeof store !== 'object') return 'Body must be an object';
  const hero = store.hero;
  if (!hero || !['slider', 'video'].includes(hero.mode)) return 'hero.mode must be "slider" or "video"';
  if (!Array.isArray(hero.slides)) return 'hero.slides must be an array';
  if (!hero.video || typeof hero.video !== 'object') return 'hero.video must be an object';
  if (!Array.isArray(store.products)) return 'products must be an array';
  return null;
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/store' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, fs.readFileSync(STORE_FILE));
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    return isAdmin(req) ? send(res, 200, { ok: true }) : send(res, 401, { error: 'Wrong password' });
  }

  if (url.pathname === '/api/store' && req.method === 'PUT') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });
    let store;
    try {
      store = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8'));
    } catch (err) {
      return send(res, err.status || 400, { error: err.status ? err.message : 'Invalid JSON' });
    }
    const problem = validateStore(store);
    if (problem) return send(res, 400, { error: problem });
    const tmp = STORE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2) + '\n');
    fs.renameSync(tmp, STORE_FILE);
    return send(res, 200, { ok: true });
  }

  if (url.pathname === '/api/upload' && req.method === 'POST') {
    if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });
    const original = path.basename(url.searchParams.get('name') || '');
    const ext = path.extname(original).toLowerCase();
    if (!UPLOAD_EXT.has(ext)) return send(res, 400, { error: `File type not allowed: ${ext || 'none'}` });
    let data;
    try {
      data = await readBody(req, MAX_UPLOAD);
    } catch (err) {
      return send(res, err.status || 400, { error: err.message });
    }
    if (!data.length) return send(res, 400, { error: 'Empty file' });
    const stem = path.basename(original, path.extname(original)).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'file';
    const name = `${Date.now()}-${stem}${ext}`;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), data);
    return send(res, 201, { url: `/uploads/${name}` });
  }

  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found', 'text/plain');
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };

    // Range requests let browsers seek and stream hero videos.
    const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (range) {
      const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
        return res.end();
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }

    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error(err);
      send(res, 500, { error: 'Server error' });
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  try {
    serveStatic(req, res, url);
  } catch {
    send(res, 400, 'Bad request', 'text/plain');
  }
});

server.listen(PORT, () => console.log(`newmob running on http://localhost:${PORT}  (admin: /admin)`));
