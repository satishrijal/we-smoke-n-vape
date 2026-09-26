'use strict';
// We Smoke N Vape — site + admin backend. Zero dependencies.
// Run:  ADMIN_USER=admin ADMIN_PASS=secret node server.js   (PORT env, default 3000)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads');
const CONTENT_FILE = path.join(__dirname, 'data', 'content.json');
const SESSION_TTL = 12 * 3600 * 1000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'smokevape1';

// ---------- content store ----------
let content = null;
function loadContent() {
  try { content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')); }
  catch (e) { content = { shop: {}, hours: {}, deals: [], gallery: [], reviews: [] }; }
}
function saveContent() {
  fs.mkdirSync(path.dirname(CONTENT_FILE), { recursive: true });
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
}
loadContent();

// ---------- admin sessions ----------
const sessions = new Map(); // token -> expiresAt
function newSession() {
  const t = crypto.randomBytes(32).toString('hex');
  sessions.set(t, Date.now() + SESSION_TTL);
  return t;
}
function validSession(req) {
  const h = req.headers['authorization'] || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return false;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return false; }
  return true;
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- helpers ----------
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req, maxBytes) {
  maxBytes = maxBytes || 12 * 1024 * 1024;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > maxBytes) { req.destroy(); reject(new Error('too large')); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
function serveStatic(req, res) {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel === '/admin') { // keep the trailing slash so relative files resolve
    res.writeHead(301, { 'Location': '/admin/' });
    return res.end();
  }
  if (rel === '/') rel = '/index.html';
  if (rel === '/admin/') rel = '/admin/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
    res.end(data);
  });
}
function cleanStr(s, max) {
  s = String(s == null ? '' : s);
  return s.length > max ? s.slice(0, max) : s;
}
function cleanDeal(d) {
  return { id: cleanStr(d.id || crypto.randomBytes(6).toString('hex'), 32), title: cleanStr(d.title, 80), desc: cleanStr(d.desc, 300), price: cleanStr(d.price, 30), img: cleanStr(d.img, 300) };
}
function cleanPhoto(p) {
  return { id: cleanStr(p.id || crypto.randomBytes(6).toString('hex'), 32), img: cleanStr(p.img, 300), caption: cleanStr(p.caption, 120) };
}

// ---------- API ----------
async function handleApi(req, res) {
  const p = new URL(req.url, 'http://x').pathname;

  if (req.method === 'GET' && p === '/api/content') {
    return sendJson(res, 200, { ok: true, content });
  }

  if (req.method === 'POST' && p === '/api/admin/login') {
    let body;
    try { body = await readBody(req, 1e5); } catch (e) { return sendJson(res, 400, { ok: false }); }
    if (safeEq(body.username || '', ADMIN_USER) && safeEq(body.password || '', ADMIN_PASS)) {
      return sendJson(res, 200, { ok: true, token: newSession() });
    }
    return sendJson(res, 401, { ok: false, error: 'Wrong username or password' });
  }

  if (!validSession(req)) return sendJson(res, 401, { ok: false, error: 'Not logged in' });

  if (req.method === 'POST' && p === '/api/admin/upload') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { ok: false, error: 'Bad upload' }); }
    const m = String(body.dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
    if (!m) return sendJson(res, 400, { ok: false, error: 'Not an image' });
    const buf = Buffer.from(m[2], 'base64');
    if (!buf.length || buf.length > 8 * 1024 * 1024) return sendJson(res, 400, { ok: false, error: 'Image too big' });
    const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
    const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
    return sendJson(res, 200, { ok: true, url: 'uploads/' + name });
  }

  if (req.method === 'POST' && p === '/api/admin/delete-upload') {
    let body;
    try { body = await readBody(req, 1e5); } catch (e) { return sendJson(res, 400, { ok: false }); }
    const u = cleanStr(body.url, 300);
    const mm = u.match(/^uploads\/([a-f0-9]+\.(jpg|jpeg|png|webp))$/);
    if (!mm) return sendJson(res, 400, { ok: false, error: 'Bad path' });
    try { fs.unlinkSync(path.join(UPLOAD_DIR, mm[1])); } catch (e) {}
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && p === '/api/admin/save') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { ok: false, error: 'Bad request' }); }
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (body.type === 'deals' && Array.isArray(body.deals)) {
      content.deals = body.deals.slice(0, 20).map(cleanDeal);
    } else if (body.type === 'gallery' && Array.isArray(body.gallery)) {
      content.gallery = body.gallery.slice(0, 100).map(cleanPhoto);
    } else if (body.type === 'hours' && body.hours && typeof body.hours === 'object') {
      for (const d of days) {
        if (!body.hours[d]) continue; // only update days that were sent
        const h = body.hours[d];
        content.hours[d] = { open: cleanStr(h.open, 20) || '9:00 AM', close: cleanStr(h.close, 20) || '1:00 AM', closed: !!h.closed };
      }
    } else if (body.type === 'shop' && body.shop && typeof body.shop === 'object') {
      const s = body.shop, c = content.shop;
      for (const k of ['name', 'tagline', 'phone', 'phoneHref', 'address', 'mapsUrl', 'reviewsUrl', 'instagramUrl', 'rating', 'closingBadge', 'announcement'])
        if (s[k] !== undefined) c[k] = cleanStr(s[k], k === 'announcement' ? 200 : 300);
      if (s.reviewCount !== undefined) c.reviewCount = Math.max(0, parseInt(s.reviewCount) || 0);
    } else if (body.type === 'reviews' && Array.isArray(body.reviews)) {
      content.reviews = body.reviews.slice(0, 12).map(r => ({ text: cleanStr(r.text, 400), name: cleanStr(r.name, 60) }));
    } else {
      return sendJson(res, 400, { ok: false, error: 'Bad section' });
    }
    saveContent();
    return sendJson(res, 200, { ok: true, content });
  }

  return sendJson(res, 404, { ok: false });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res).catch(() => { try { sendJson(res, 500, { ok: false }); } catch (e) {} });
  return serveStatic(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`We Smoke N Vape live on :${PORT}`));
}
module.exports = { server };
