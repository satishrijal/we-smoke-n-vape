'use strict';
/* Admin panel logic */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let TOKEN = null, C = null, editingDeal = null, pendingPhoto = null;

const status = m => { $('#status').textContent = m; setTimeout(() => $('#status').textContent = '', 3000); };
async function api(path, body) {
  const r = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify(body || {})
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

/* ---------- login ---------- */
$('#l-btn').onclick = doLogin;
$('#l-pass').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
async function doLogin() {
  $('#l-err').textContent = '';
  try {
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('#l-user').value, password: $('#l-pass').value }) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'Login failed');
    TOKEN = d.token;
    try { sessionStorage.setItem('wsnv_admin', TOKEN); } catch (e) {}
    const c = await fetch('/api/content').then(x => x.json());
    C = c.content;
    $('#login').classList.add('hidden'); $('#panel').classList.remove('hidden');
    renderAll();
  } catch (e) { $('#l-err').textContent = e.message; }
}
$('#logout').onclick = () => { TOKEN = null; try { sessionStorage.removeItem('wsnv_admin'); } catch (e) {} location.reload(); };
// restore session
try {
  const t = sessionStorage.getItem('wsnv_admin');
  if (t) { TOKEN = t; $('#l-user').value = ''; $('#l-pass').focus(); }
} catch (e) {}

/* ---------- tabs ---------- */
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('on'));
  b.classList.add('on');
  document.querySelectorAll('.tab').forEach(t => t.classList.add('hidden'));
  $('#tab-' + b.dataset.tab).classList.remove('hidden');
});

/* ---------- photo upload (resized in browser) ---------- */
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      let w = img.width, h = img.height;
      if (w > max || h > max) { const r = max / Math.max(w, h); w = Math.round(w * r); h = Math.round(h * r); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(cv.toDataURL('image/jpeg', 0.82));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
async function uploadPhoto(file) {
  const dataUrl = await fileToDataUrl(file);
  const d = await api('/api/admin/upload', { dataUrl });
  return d.url;
}

/* ---------- deals ---------- */
function renderDeals() {
  $('#deal-list').innerHTML = C.deals.map(d => `
    <div class="item">
      <img src="../${esc(d.img)}">
      <div><b>${esc(d.title)}</b><p>${esc(d.desc)}</p><span class="badge">${esc(d.price)}</span></div>
      <div class="acts"><button data-e="${d.id}" class="btn dim sm">Edit</button><button data-x="${d.id}" class="btn danger sm">✕</button></div>
    </div>`).join('') || '<p class="muted">No deals yet.</p>';
  $('#deal-list').querySelectorAll('[data-e]').forEach(b => b.onclick = () => editDeal(b.dataset.e));
  $('#deal-list').querySelectorAll('[data-x]').forEach(b => b.onclick = () => delDeal(b.dataset.x));
}
function editDeal(id) {
  const d = C.deals.find(x => x.id === id); if (!d) return;
  editingDeal = id; pendingPhoto = null;
  $('#deal-form-title').textContent = 'Edit deal';
  $('#d-title').value = d.title; $('#d-desc').value = d.desc; $('#d-price').value = d.price;
  $('#d-preview').src = '../' + d.img; $('#d-preview').classList.remove('hidden');
  $('#d-photo-label').textContent = 'Keep current photo';
  $('#d-cancel').classList.remove('hidden');
  window.scrollTo({ top: document.body.scrollHeight });
}
$('#d-cancel').onclick = resetDealForm;
function resetDealForm() {
  editingDeal = null; pendingPhoto = null;
  $('#deal-form-title').textContent = 'Add a deal';
  $('#d-title').value = $('#d-desc').value = $('#d-price').value = '';
  $('#d-photo').value = ''; $('#d-preview').classList.add('hidden');
  $('#d-photo-label').textContent = 'Choose photo'; $('#d-cancel').classList.add('hidden');
}
$('#d-photo').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  $('#d-photo-label').textContent = 'Uploading…';
  try { pendingPhoto = await uploadPhoto(f); $('#d-preview').src = '../' + pendingPhoto; $('#d-preview').classList.remove('hidden'); $('#d-photo-label').textContent = 'Photo ready ✓'; }
  catch (err) { $('#d-photo-label').textContent = 'Upload failed — try again'; }
};
$('#d-save').onclick = async () => {
  const title = $('#d-title').value.trim();
  if (!title) return status('Give the deal a title');
  $('#d-save').disabled = true;
  try {
    let img = pendingPhoto;
    if (editingDeal) img = img || C.deals.find(x => x.id === editingDeal).img;
    if (!img) throw new Error('Add a photo first');
    const deal = { id: editingDeal || undefined, title, desc: $('#d-desc').value.trim(), price: $('#d-price').value.trim(), img };
    let deals;
    if (editingDeal) deals = C.deals.map(x => x.id === editingDeal ? { ...x, ...deal, id: editingDeal } : x);
    else deals = [...C.deals, { ...deal, id: 'd' + Date.now().toString(36) }];
    const d = await api('/api/admin/save', { type: 'deals', deals });
    C = d.content; resetDealForm(); renderDeals(); status('Deal saved ✓');
  } catch (e) { status(e.message); }
  $('#d-save').disabled = false;
};
async function delDeal(id) {
  if (!confirm('Delete this deal?')) return;
  const d = await api('/api/admin/save', { type: 'deals', deals: C.deals.filter(x => x.id !== id) });
  C = d.content; renderDeals(); status('Deleted');
}

/* ---------- gallery ---------- */
function renderGallery() {
  $('#gal-grid').innerHTML = C.gallery.map(p => `
    <div class="gitem">
      <img src="../${esc(p.img)}">
      <input value="${esc(p.caption || '')}" placeholder="Caption…" data-c="${p.id}" maxlength="120">
      <button data-x="${p.id}" class="gx">✕</button>
    </div>`).join('');
  $('#gal-grid').querySelectorAll('[data-x]').forEach(b => b.onclick = () => delPhoto(b.dataset.x));
  $('#gal-grid').querySelectorAll('[data-c]').forEach(inp => inp.onchange = async () => {
    const gal = C.gallery.map(p => p.id === inp.dataset.c ? { ...p, caption: inp.value } : p);
    const d = await api('/api/admin/save', { type: 'gallery', gallery: gal });
    C = d.content; status('Caption saved ✓');
  });
}
async function delPhoto(id) {
  if (!confirm('Remove this photo?')) return;
  const p = C.gallery.find(x => x.id === id);
  const d = await api('/api/admin/save', { type: 'gallery', gallery: C.gallery.filter(x => x.id !== id) });
  C = d.content;
  if (p && p.img.startsWith('uploads/')) { try { await api('/api/admin/delete-upload', { url: p.img }); } catch (e) {} }
  renderGallery(); status('Removed');
}
$('#g-add').onchange = async e => {
  const files = [...e.target.files]; if (!files.length) return;
  status('Uploading ' + files.length + ' photos…');
  try {
    const urls = [];
    for (const f of files) urls.push(await uploadPhoto(f));
    const gal = [...C.gallery, ...urls.map(u => ({ id: 'g' + Math.random().toString(36).slice(2, 9), img: u, caption: '' }))];
    const d = await api('/api/admin/save', { type: 'gallery', gallery: gal });
    C = d.content; renderGallery(); status('Photos added ✓');
  } catch (err) { status('Upload failed: ' + err.message); }
  e.target.value = '';
};

/* ---------- hours ---------- */
const DAYS = [['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']];
function renderHours() {
  $('#hours-form').innerHTML = DAYS.map(([k, label]) => {
    const h = C.hours[k] || {};
    return `<div class="hrow"><b>${label}</b>
      <input type="time" data-k="${k}" data-f="open" value="${to24(h.open)}">
      <span>to</span>
      <input type="time" data-k="${k}" data-f="close" value="${to24(h.close)}">
      <label class="chk"><input type="checkbox" data-k="${k}" data-f="closed" ${h.closed ? 'checked' : ''}> Closed</label>
    </div>`;
  }).join('');
}
function to24(t) { // "9:00 AM" -> "09:00"
  const m = String(t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return '';
  let h = +m[1] % 12; if (/pm/i.test(m[3])) h += 12;
  return String(h).padStart(2, '0') + ':' + m[2];
}
function from24(t) { // "09:00" -> "9:00 AM"
  if (!t) return '';
  let [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}
$('#h-save').onclick = async () => {
  const hours = {};
  DAYS.forEach(([k]) => {
    hours[k] = {
      open: from24(document.querySelector(`[data-k="${k}"][data-f="open"]`).value) || '9:00 AM',
      close: from24(document.querySelector(`[data-k="${k}"][data-f="close"]`).value) || '1:00 AM',
      closed: document.querySelector(`[data-k="${k}"][data-f="closed"]`).checked
    };
  });
  const d = await api('/api/admin/save', { type: 'hours', hours });
  C = d.content; status('Hours saved ✓');
};

/* ---------- shop ---------- */
function renderShop() {
  const s = C.shop;
  for (const k of ['name', 'tagline', 'phone', 'phoneHref', 'address', 'mapsUrl', 'reviewsUrl', 'instagramUrl', 'rating', 'closingBadge', 'announcement'])
    $('#s-' + k).value = s[k] || '';
  $('#s-reviewCount').value = s.reviewCount || 0;
}
$('#s-save').onclick = async () => {
  const shop = {};
  for (const k of ['name', 'tagline', 'phone', 'phoneHref', 'address', 'mapsUrl', 'reviewsUrl', 'instagramUrl', 'rating', 'closingBadge', 'announcement'])
    shop[k] = $('#s-' + k).value;
  shop.reviewCount = +$('#s-reviewCount').value || 0;
  const d = await api('/api/admin/save', { type: 'shop', shop });
  C = d.content; status('Shop info saved ✓');
};

/* ---------- reviews ---------- */
function renderReviews() {
  $('#rev-list').innerHTML = C.reviews.map((r, i) => `
    <div class="item"><div><p>"${esc(r.text)}"</p><span class="muted">— ${esc(r.name)}</span></div>
    <div class="acts"><button data-x="${i}" class="btn danger sm">✕</button></div></div>`).join('') || '<p class="muted">No reviews yet.</p>';
  $('#rev-list').querySelectorAll('[data-x]').forEach(b => b.onclick = async () => {
    const revs = C.reviews.filter((_, i) => i !== +b.dataset.x);
    const d = await api('/api/admin/save', { type: 'reviews', reviews: revs });
    C = d.content; renderReviews(); status('Removed');
  });
}
$('#r-add').onclick = async () => {
  const text = $('#r-text').value.trim(); if (!text) return status('Write the review text');
  const revs = [...C.reviews, { text, name: $('#r-name').value.trim() || 'Google review' }];
  const d = await api('/api/admin/save', { type: 'reviews', reviews: revs });
  C = d.content; $('#r-text').value = $('#r-name').value = ''; renderReviews(); status('Added ✓');
};

function renderAll() { renderDeals(); renderGallery(); renderHours(); renderShop(); renderReviews(); }
