'use strict';
// Tests for We Smoke N Vape backend. Run: npm test
process.env.ADMIN_USER = 'testadmin';
process.env.ADMIN_PASS = 'testpass123';
const { server } = require('../server.js');

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.log('  ✗ FAIL: ' + name); }
}
function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = require('http').request({
      port: 3411, method, path,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}), ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        let j = null; try { j = JSON.parse(b); } catch (e) {}
        resolve({ status: res.statusCode, json: j, raw: b });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const fs = require('fs');
  const contentPath = __dirname + '/../data/content.json';
  const backup = fs.readFileSync(contentPath, 'utf8'); // restore after tests
  await new Promise(r => server.listen(3411, r));
  console.log('public content');
  let res = await req('GET', '/api/content');
  ok(res.status === 200 && res.json.ok, 'GET /api/content works');
  ok(res.json.content.deals.length === 2, 'seeded with 2 deals');
  ok(res.json.content.gallery.length === 22, 'seeded with 22 gallery photos');
  ok(res.json.content.hours.monday.open === '9:00 AM', 'hours seeded');
  ok(res.json.content.shop.name === 'We Smoke N Vape', 'shop name seeded');

  console.log('admin auth');
  res = await req('POST', '/api/admin/login', { username: 'testadmin', password: 'wrong' });
  ok(res.status === 401 && !res.json.ok, 'wrong password rejected');
  res = await req('POST', '/api/admin/login', { username: 'testadmin', password: 'testpass123' });
  ok(res.status === 200 && res.json.ok && res.json.token, 'correct login returns token');
  const token = res.json.token;
  res = await req('POST', '/api/admin/save', { type: 'deals', deals: [] });
  ok(res.status === 401, 'save without token rejected');

  console.log('admin deals');
  const deal = { title: 'Test Deal', desc: 'desc', price: '$9.99', img: 'images/deal-1.jpg' };
  res = await req('POST', '/api/admin/save', { type: 'deals', deals: [deal] }, token);
  ok(res.status === 200 && res.json.content.deals.length === 1, 'deal saved');
  ok(res.json.content.deals[0].title === 'Test Deal', 'deal title kept');
  res = await req('GET', '/api/content');
  ok(res.json.content.deals[0].title === 'Test Deal', 'public content reflects deal change');

  console.log('admin hours');
  res = await req('POST', '/api/admin/save', { type: 'hours', hours: { monday: { open: '10:00 AM', close: '11:00 PM', closed: false } } }, token);
  ok(res.status === 200 && res.json.content.hours.monday.open === '10:00 AM', 'monday hours updated');
  ok(res.json.content.hours.tuesday.open === '9:00 AM', 'other days untouched');

  console.log('admin gallery');
  res = await req('POST', '/api/admin/save', { type: 'gallery', gallery: [{ img: 'uploads/x.jpg', caption: 'hi' }] }, token);
  ok(res.status === 200 && res.json.content.gallery.length === 1, 'gallery replaced');

  console.log('admin shop');
  res = await req('POST', '/api/admin/save', { type: 'shop', shop: { announcement: 'SALE TODAY', reviewCount: 100 } }, token);
  ok(res.status === 200 && res.json.content.shop.announcement === 'SALE TODAY', 'announcement saved');
  ok(res.json.content.shop.reviewCount === 100, 'review count saved');
  ok(res.json.content.shop.name === 'We Smoke N Vape', 'other shop fields untouched');

  console.log('admin upload');
  const tiny = 'data:image/jpeg;base64,' + Buffer.from('fakejpegdata').toString('base64');
  res = await req('POST', '/api/admin/upload', { dataUrl: tiny }, token);
  ok(res.status === 200 && res.json.ok && res.json.url.startsWith('uploads/'), 'photo upload works');
  const upUrl = res.json.url;
  res = await req('POST', '/api/admin/upload', { dataUrl: 'not-an-image' }, token);
  ok(res.status === 400, 'non-image upload rejected');
  res = await req('POST', '/api/admin/delete-upload', { url: upUrl }, token);
  ok(res.status === 200 && res.json.ok, 'uploaded photo deleted');
  res = await req('POST', '/api/admin/delete-upload', { url: '../../../etc/passwd' }, token);
  ok(res.status === 400, 'path traversal on delete rejected');

  console.log('static files');
  res = await req('GET', '/');
  ok(res.status === 200 && res.raw.includes('WE SMOKE'), 'homepage serves');
  ok(!res.raw.includes('user-scalable=no'), 'pinch-to-zoom allowed on phones');
  ok(res.raw.includes('Explore products'), '"Explore products" CTA (not "Shop the menu")');
  ok(!res.raw.includes('Shop the menu'), 'old "Shop the menu" wording gone');
  ok(res.raw.includes('id="menu-btn"'), 'mobile menu button present');
  ok(res.raw.includes('id="today-status"'), 'live open/closed status pill present');
  ok(res.raw.includes('id="see-more"'), '"see more photos" expander present');
  ok(!res.raw.includes('<title>We Smoke N Vape — Dallas, TX | Open Til 1 AM</title>'), 'title makes no fixed closing-time claim');
  res = await req('GET', '/admin');
  ok(res.status === 301, '/admin redirects to /admin/ (keeps styles working)');
  res = await req('GET', '/admin/');
  ok(res.status === 200 && res.raw.includes('Admin Login'), 'admin page serves');
  ok(res.raw.includes('class="wrap hidden"'), 'admin panel hidden until login');
  res = await req('GET', '/admin/admin.css');
  ok(res.status === 200 && res.raw.includes('.hidden'), 'admin css serves');
  res = await req('GET', '/admin/admin.js');
  ok(res.status === 200 && res.raw.includes('Admin panel logic'), 'admin js serves');

  // restore seed content
  fs.writeFileSync(contentPath, backup);
  console.log(`\n${passed} passed, ${failed} failed`);
  server.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
