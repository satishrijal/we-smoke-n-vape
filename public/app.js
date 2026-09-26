'use strict';
/* We Smoke N Vape — public site. Everything renders from /api/content. */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CONTENT = null;

/* ---------- age gate ---------- */
(function () {
  try { if (localStorage.getItem('wsnv_age') === '1') { $('#age-gate').remove(); return; } } catch (e) {}
  $('#age-yes').onclick = () => {
    try { localStorage.setItem('wsnv_age', '1'); } catch (e) {}
    $('#age-gate').remove();
  };
  $('#age-no').onclick = () => $('#age-msg').classList.remove('hidden');
})();

/* ---------- fixed catalog cards (photos baked in) ---------- */
const VAPE_CARDS = [
  { img: 'images/vape-wall.jpg', tag: 'Best seller', name: 'Disposable Vapes', desc: '100+ flavors on the wall — all the top brands, always fresh.', price: 'from $14.99' },
  { img: 'images/eliquid.jpg', name: 'E-Liquids', desc: 'Freebase & nic salts in every strength and flavor.', price: 'from $9.99' },
  { img: 'images/devices.jpg', name: 'Pods & Devices', desc: 'Starter kits, pod systems, mods, coils & chargers.', price: 'from $19.99' },
];
const MORE_CARDS = [
  { img: 'images/glass.jpg', name: 'Glass', desc: 'Hand pipes, rigs & water pipes — a full wall of glass.', price: 'from $12.99' },
  { img: 'images/hookah.jpg', name: 'Hookah & Shisha', desc: 'Hookahs, charcoal & premium shisha flavors.', price: 'from $24.99' },
  { img: 'images/cbd.jpg', name: 'CBD & Wellness', desc: 'Gummies, oils, topicals & pet treats.', price: 'from $9.99' },
  { img: 'images/accessories.jpg', name: 'Accessories', desc: 'Grinders, trays, torches, wraps, papers & more.', price: 'from $2.99' },
];

function productCard(c) {
  return `<div class="card">
    <div class="card-img" style="background-image:url('${esc(c.img)}')">${c.tag ? `<span class="card-tag">${esc(c.tag)}</span>` : ''}</div>
    <div class="card-body"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><span class="card-price">${esc(c.price)}</span></div>
  </div>`;
}

/* ---------- gallery slideshow ---------- */
let slideIdx = 0, slideTimer = null;
function showSlide(i) {
  const n = CONTENT.gallery.length;
  if (!n) return;
  slideIdx = (i + n) % n;
  $('#slides').style.transform = `translateX(-${slideIdx * 100}%)`;
  document.querySelectorAll('#dots span').forEach((d, j) => d.classList.toggle('on', j === slideIdx));
}
function startAuto() {
  clearInterval(slideTimer);
  slideTimer = setInterval(() => showSlide(slideIdx + 1), 5000);
}

/* ---------- render ---------- */
function render() {
  const c = CONTENT, s = c.shop;

  document.title = `${s.name} — Dallas, TX | Open Til 1 AM`;
  $('#nav-call').href = 'tel:' + s.phoneHref;
  $('#bar-call').href = 'tel:' + s.phoneHref;
  $('#visit-call').href = 'tel:' + s.phoneHref;
  $('#hero-dir').href = s.mapsUrl; $('#visit-dir').href = s.mapsUrl; $('#bar-dir').href = s.mapsUrl;
  $('#hero-rating').textContent = s.rating; $('#hero-reviews').textContent = s.reviewCount;
  $('#hero-tagline').textContent = s.tagline;
  $('#hero-hours').textContent = s.closingBadge;
  $('#rating-num').textContent = s.rating; $('#rating-count').textContent = s.reviewCount;
  $('#reviews-link').href = s.reviewsUrl;
  $('#visit-address').textContent = s.address;
  $('#foot-name').textContent = s.name;
  $('#loyalty-phone').textContent = s.phone;
  $('#loyalty-btn').href = 'sms:' + s.phoneHref + '?body=' + encodeURIComponent('JOIN');
  $('#map').src = 'https://www.google.com/maps?q=' + encodeURIComponent(s.address) + '&output=embed';
  $('#year').textContent = new Date().getFullYear();

  if (s.announcement) { $('#announce').textContent = '📢 ' + s.announcement; $('#announce').classList.remove('hidden'); }

  // marquee
  const items = [s.closingBadge.toUpperCase(), `${s.rating} ★ RATED`, 'VAPES · GLASS · HOOKAH · CBD', 'IN-STORE PICKUP', s.address.toUpperCase()];
  $('#marquee-track').innerHTML = (items.concat(items)).map(t => `<span>◆ ${esc(t)}</span>`).join('');

  // cards
  $('#vape-cards').innerHTML = VAPE_CARDS.map(productCard).join('');
  $('#more-cards').innerHTML = MORE_CARDS.map(productCard).join('');

  // deals
  $('#deal-cards').innerHTML = c.deals.length ? c.deals.map(d => `
    <div class="card">
      <div class="card-img" style="background-image:url('${esc(d.img)}')"><span class="card-tag">🔥 DEAL</span></div>
      <div class="card-body"><h3>${esc(d.title)}</h3><p>${esc(d.desc)}</p><span class="deal-price">${esc(d.price)}</span></div>
    </div>`).join('')
    : '<p style="color:var(--muted)">New deals dropping soon — check back or text JOIN to get them first.</p>';

  // reviews
  $('#review-cards').innerHTML = (c.reviews || []).map(r => `
    <div class="card review-card"><div class="stars">★★★★★</div><p>"${esc(r.text)}"</p><div class="who">— ${esc(r.name)}</div></div>`).join('');

  // hours
  const days = [['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'], ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'], ['sunday', 'Sunday']];
  const today = (new Date().getDay() + 6) % 7; // monday=0
  $('#hours-table').innerHTML = days.map(([k, label], i) => {
    const h = c.hours[k] || {};
    const txt = h.closed ? '<span class="closed">Closed</span>' : `${esc(h.open)} – ${esc(h.close)}`;
    return `<div class="hour-row${i === today ? ' today' : ''}"><span>${label}</span><span>${txt}</span></div>`;
  }).join('');

  // gallery
  const g = c.gallery;
  $('#slides').innerHTML = g.map(p => `<img src="${esc(p.img)}" alt="${esc(p.caption || 'shop photo')}" loading="lazy">`).join('');
  $('#dots').innerHTML = g.map((_, i) => `<span data-i="${i}"></span>`).join('');
  $('#gallery-grid').innerHTML = g.map((p, i) => `<img src="${esc(p.img)}" alt="${esc(p.caption || '')}" loading="lazy" data-i="${i}">`).join('');
  document.querySelectorAll('#dots span').forEach(d => d.onclick = e => { e.stopPropagation(); showSlide(+d.dataset.i); startAuto(); });
  $('#slide-prev').onclick = e => { e.stopPropagation(); showSlide(slideIdx - 1); startAuto(); };
  $('#slide-next').onclick = e => { e.stopPropagation(); showSlide(slideIdx + 1); startAuto(); };
  const openLB = src => { $('#lightbox-img').src = src; $('#lightbox').classList.remove('hidden'); };
  document.querySelectorAll('#slides img, #gallery-grid img').forEach(im => im.onclick = () => openLB(im.src));
  $('#lightbox-x').onclick = () => $('#lightbox').classList.add('hidden');
  $('#lightbox').onclick = e => { if (e.target.id === 'lightbox') $('#lightbox').classList.add('hidden'); };
  showSlide(0); startAuto();
}

fetch('/api/content').then(r => r.json()).then(d => { CONTENT = d.content; render(); })
  .catch(() => { document.querySelector('.hero-sub') && ($('#hero-tagline').textContent = "Dallas' 5-star smoke shop"); });
