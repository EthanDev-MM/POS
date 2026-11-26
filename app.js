'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const K = 'pos_v2';
const blank = () => ({ shop: 'My Shop', cur: 'Ks', low: 5, qr: '', products: [], sales: [], ts: 0 });
let D, cart = {}, disc = 0, tab = 'sell', range = '7', sb = null, user = null, timer;
try { D = JSON.parse(localStorage.getItem(K) || localStorage.getItem('pos_v1')); } catch (e) {}
D = Object.assign(blank(), D || {});
const fmt = n => Math.round(n).toLocaleString() + ' ' + D.cur;
const prod = id => D.products.find(p => p.id === id);
const day = t => new Date(t).toDateString();

/* ---------- storage + cloud sync (last-write-wins, one JSON document per user) ---------- */
function local() { try { localStorage.setItem(K, JSON.stringify(D)); } catch (e) { toast('Storage full'); } }
function save() { D.ts = Date.now(); local(); clearTimeout(timer); timer = setTimeout(push, 1500); }
function setS(s) { $('#sy').className = 'dot ' + s; $('#sy').title = s; }
async function push() {
  if (!sb || !user) return;
  setS('syncing');
  const { error } = await sb.from('pos_data').upsert({ user_id: user.id, data: D, updated_at: new Date().toISOString() });
  setS(error ? 'error' : 'synced');
}
async function pull() {
  setS('syncing');
  const { data, error } = await sb.from('pos_data').select('data').eq('user_id', user.id).maybeSingle();
  if (error) return setS('error');
  if (data && (data.data.ts || 0) > D.ts) { D = Object.assign(blank(), data.data); local(); } else await push();
  setS('synced'); view();
}
function initCloud() {
  const c = window.POS_CONFIG || {};
  if (!c.url || !c.key || !window.supabase) return;
  sb = window.supabase.createClient(c.url, c.key);
  sb.auth.getSession().then(({ data }) => {
    user = data.session && data.session.user;
    if (user) pull(); else if (!sessionStorage.skip) authM();
    view();
  });
  window.addEventListener('online', push);
}
function authM() {
  modal(`<h3>Sign in</h3><p class="mut">Sync your shop across all your devices.</p>
    <input id="em" class="in" type="email" placeholder="Email" autocomplete="email">
    <input id="pw" class="in" type="password" placeholder="Password (6+ chars)" autocomplete="current-password">
    <button class="btn" onclick="auth('in')">Sign in</button>
    <button class="btn alt" onclick="auth('up')">Create account</button>
    <button class="btn alt" onclick="sessionStorage.skip=1;closeM()">Continue offline</button>`);
}
async function auth(mode) {
  const email = $('#em').value.trim(), password = $('#pw').value;
  const { data, error } = mode === 'in' ? await sb.auth.signInWithPassword({ email, password })
                                        : await sb.auth.signUp({ email, password });
  if (error) return toast(error.message);
  if (!data.session) return toast('Check your email to confirm, then sign in');
  user = data.session.user; closeM(); toast('Signed in'); pull();
}
async function signOut() {
  await sb.auth.signOut(); user = null; localStorage.removeItem(K); D = blank(); cart = {}; setS(''); view(); authM();
}

/* ---------- ui helpers ---------- */
function modal(h) { $('#md').innerHTML = h; $('#ov').style.display = 'flex'; }
function closeM() { $('#ov').style.display = 'none'; }
function toast(t) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); setTimeout(() => e.classList.remove('on'), 2200); }
function dl(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
}
$('#nav').onclick = e => { if (e.target.dataset.t) { tab = e.target.dataset.t; view(); } };
function view() {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
  $('#hd').textContent = D.shop;
  ({ sell: sellV, items: itemsV, report: reportV, set: setV })[tab]();
}

/* ---------- SELL ---------- */
function sellV() {
  $('#m').innerHTML = '<input id="q" class="in" placeholder="Search item..." oninput="grid()"><div id="grid" class="grid"></div><div id="cart" class="card"></div>';
  grid(); cartV();
}
function grid() {
  const q = ($('#q').value || '').toLowerCase();
  const l = D.products.filter(p => p.name.toLowerCase().includes(q));
  $('#grid').innerHTML = l.map(p => `<button class="item ${p.stock === 0 ? 'out' : ''}" onclick="chg('${p.id}',1)">
    <b>${esc(p.name)}</b><br><small>${fmt(p.price)}${p.stock !== null ? ' · ' + p.stock + ' left' : ''}</small></button>`).join('')
    || '<small>No items yet. Add some in the Items tab.</small>';
}
function chg(id, d) {
  const p = prod(id), q = (cart[id] || 0) + d;
  if (p.stock !== null && q > p.stock) return toast('Not enough stock');
  if (q <= 0) delete cart[id]; else cart[id] = q;
  cartV();
}
const sub = () => Object.keys(cart).reduce((a, id) => a + prod(id).price * cart[id], 0);
const total = () => Math.max(0, sub() - disc);
function cartV() {
  const ids = Object.keys(cart);
  $('#cart').innerHTML = ids.length ? ids.map(id => { const p = prod(id);
    return `<div class="row"><span>${esc(p.name)}<br><small>${fmt(p.price)}</small></span><span class="qty">
    <button onclick="chg('${id}',-1)">−</button><b>${cart[id]}</b><button onclick="chg('${id}',1)">+</button></span></div>`; }).join('') +
    `<div class="row"><span>Discount</span><input class="in" style="width:120px;margin:0" type="number" min="0" value="${disc || ''}"
      placeholder="0" onchange="disc=Math.min(sub(),+this.value||0);cartV()"></div>
    <div class="row"><b>Total</b><b>${fmt(total())}</b></div>
    <button class="btn" onclick="payM()">Charge ${fmt(total())}</button>
    <button class="btn alt" onclick="cart={};disc=0;cartV()">Clear</button>` : '<small>Cart is empty. Tap an item to add it.</small>';
}
function payM() {
  const t = total(); let m = 'Cash';
  modal(`<h3>Payment</h3><div class="big">${fmt(t)}</div><div class="seg" id="pm">
    ${['Cash', 'QR', 'Card'].map(x => `<button data-m="${x}" class="${x === m ? 'on' : ''}">${x}</button>`).join('')}</div>
    <div id="pd"></div><button class="btn" id="ok">Confirm payment</button><button class="btn alt" onclick="closeM()">Cancel</button>`);
  const draw = () => {
    document.querySelectorAll('#pm button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('#pd').innerHTML = m === 'Cash' ? '<input id="rc" class="in" type="number" placeholder="Cash received"><div id="ch" class="mut"></div>'
      : m === 'QR' ? (D.qr ? `<img class="qr" src="${D.qr}" alt="QR">` : '<p class="mut">Upload your payment QR in Settings.</p>')
      : '<p class="mut">Take the card payment on your terminal, then confirm.</p>';
    if (m === 'Cash') $('#rc').oninput = e => $('#ch').textContent = 'Change: ' + fmt(Math.max(0, e.target.value - t));
  };
  $('#pm').onclick = e => { if (e.target.dataset.m) { m = e.target.dataset.m; draw(); } };
  $('#ok').onclick = () => finish(m, m === 'Cash' ? +($('#rc').value || 0) : t);
  draw();
}
function finish(pay, recv) {
  const lines = Object.keys(cart).map(id => { const p = prod(id);
    if (p.stock !== null) p.stock -= cart[id];
    return { id, name: p.name, price: p.price, cost: p.cost, qty: cart[id] }; });
  const s = { id: uid(), t: Date.now(), lines, sub: sub(), disc, total: total(), pay, recv };
  D.sales.push(s); save(); cart = {}; disc = 0; receipt(s); view();
}
function receipt(s) {
  modal(`<div class="rcpt"><b>${esc(D.shop)}</b><br>${new Date(s.t).toLocaleString()}<br>#${s.id}<hr>` +
    s.lines.map(l => `${esc(l.name)}<br>&nbsp;&nbsp;${l.qty} x ${l.price} = ${l.qty * l.price}`).join('<br>') +
    `<hr>Subtotal ${fmt(s.sub)}<br>${s.disc ? 'Discount -' + fmt(s.disc) + '<br>' : ''}<b>TOTAL ${fmt(s.total)}</b><br>
    Paid by ${esc(s.pay)}${s.pay === 'Cash' && s.recv > s.total ? '<br>Change ' + fmt(s.recv - s.total) : ''}<br><br>Thank you!</div>
    <button class="btn" onclick="print()">Print</button><button class="btn alt" onclick="closeM()">Close</button>`);
}

/* ---------- ITEMS ---------- */
function itemsV() {
  $('#m').innerHTML = `<button class="btn" style="margin:0 0 12px" onclick="itemM()">+ Add item</button>` +
    (D.products.map(p => `<div class="card row" onclick="itemM('${p.id}')"><span><b>${esc(p.name)}</b><br>
    <small>Cost ${fmt(p.cost)} · Stock ${p.stock === null ? '∞' : p.stock}</small></span><b>${fmt(p.price)}</b></div>`).join('')
    || '<p class="mut">No items yet.</p>');
}
function itemM(id) {
  const p = id ? prod(id) : { name: '', price: '', cost: '', stock: null };
  modal(`<h3>${id ? 'Edit' : 'New'} item</h3>
    <input id="n" class="in" placeholder="Name" value="${esc(p.name)}">
    <input id="pr" class="in" type="number" placeholder="Selling price" value="${p.price}">
    <input id="co" class="in" type="number" placeholder="Cost (optional)" value="${p.cost}">
    <input id="st" class="in" type="number" placeholder="Stock (empty = unlimited)" value="${p.stock === null ? '' : p.stock}">
    <button class="btn" onclick="saveItem('${id || ''}')">Save</button>
    ${id ? `<button class="btn red" onclick="delItem('${id}')">Delete</button>` : ''}
    <button class="btn alt" onclick="closeM()">Cancel</button>`);
}
function saveItem(id) {
  const name = $('#n').value.trim(), price = parseFloat($('#pr').value);
  if (!name || isNaN(price) || price < 0) return toast('Name and a valid price are required');
  const o = { name, price, cost: parseFloat($('#co').value) || 0, stock: $('#st').value === '' ? null : Math.max(0, parseInt($('#st').value)) };
  if (id) Object.assign(prod(id), o); else D.products.push({ id: uid(), ...o });
  save(); closeM(); view();
}
function delItem(id) {
  if (confirm('Delete this item? Past sales are kept.')) { D.products = D.products.filter(p => p.id !== id); delete cart[id]; save(); closeM(); view(); }
}

/* ---------- DASHBOARD ---------- */
function reportV() {
  const now = Date.now(), days = range === 'all' ? 1e5 : +range;
  const start = range === 'all' ? 0 : new Date(new Date().setHours(0, 0, 0, 0)).getTime() - (days - 1) * 864e5;
  const S = D.sales.filter(s => s.t >= start);
  const profit = s => s.lines.reduce((a, l) => a + (l.price - l.cost) * l.qty, 0) - (s.disc || 0);
  const rev = S.reduce((a, s) => a + s.total, 0), pf = S.reduce((a, s) => a + profit(s), 0);
  const by = (k, f) => { const o = {}; S.forEach(s => f(s).forEach(([n, v]) => o[n] = (o[n] || 0) + v)); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
  const pays = by('p', s => [[s.pay, s.total]]), top = by('i', s => s.lines.map(l => [l.name, l.price * l.qty])).slice(0, 5);
  const n = range === 'all' || range === '30' ? 30 : 7, pts = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now - i * 864e5);
    pts.push({ l: n > 10 ? (i % 5 === 0 ? d.getDate() : '') : d.toLocaleDateString(undefined, { weekday: 'short' }),
               v: D.sales.filter(s => day(s.t) === d.toDateString()).reduce((a, s) => a + s.total, 0) }); }
  const mx = Math.max(1, ...pts.map(p => p.v)), w = 300 / n;
  const bars = (arr) => arr.map(([k, v]) => `<div style="margin:8px 0"><div class="row" style="padding:0;border:0"><span>${esc(k)}</span><b>${fmt(v)}</b></div>
    <div class="bar"><i style="width:${Math.round(v / (arr[0][1] || 1) * 100)}%"></i></div></div>`).join('') || '<small>No data</small>';
  const low = D.products.filter(p => p.stock !== null && p.stock <= D.low);
  $('#m').innerHTML = `<div class="seg" id="rg">${[['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['all', 'All']]
      .map(([v, l]) => `<button data-r="${v}" class="${range === v ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="kpis"><div class="kpi"><small>Revenue</small><b>${fmt(rev)}</b></div><div class="kpi"><small>Profit</small><b>${fmt(pf)}</b></div>
    <div class="kpi"><small>Orders</small><b>${S.length}</b></div><div class="kpi"><small>Avg order</small><b>${fmt(S.length ? rev / S.length : 0)}</b></div></div>
    <div class="card"><h3>Revenue by day</h3><svg viewBox="0 0 300 118" class="chart">${pts.map((p, i) => { const h = p.v / mx * 90;
      return `<rect x="${i * w + 2}" y="${100 - h}" width="${w - 4}" height="${h}" rx="3" fill="var(--p)"/><text x="${i * w + w / 2}" y="113" font-size="8" text-anchor="middle" fill="#6b7280">${p.l}</text>`; }).join('')}</svg></div>
    <div class="card"><h3>Payment methods</h3>${bars(pays)}</div>
    <div class="card"><h3>Top items</h3>${bars(top)}</div>
    <div class="card"><h3>Low stock</h3>${low.map(p => `<div class="row"><span>${esc(p.name)}</span><b>${p.stock}</b></div>`).join('') || '<small>All good</small>'}</div>
    <div class="card"><h3>Recent sales</h3>${S.slice(-15).reverse().map(s => `<div class="row" onclick="receipt(D.sales.find(x=>x.id==='${s.id}'))">
      <span>${new Date(s.t).toLocaleString()}<br><small>${esc(s.pay)}</small></span><b>${fmt(s.total)}</b></div>`).join('') || '<small>No sales</small>'}</div>
    <button class="btn alt" onclick="csv()">Export all sales (CSV)</button>`;
  $('#rg').onclick = e => { if (e.target.dataset.r) { range = e.target.dataset.r; reportV(); } };
}
function csv() {
  const r = [['date', 'sale_id', 'item', 'qty', 'price', 'discount', 'total', 'payment']];
  D.sales.forEach(s => s.lines.forEach(l => r.push([new Date(s.t).toISOString(), s.id, '"' + l.name.replace(/"/g, '""') + '"', l.qty, l.price, s.disc || 0, s.total, s.pay])));
  dl('sales.csv', '\uFEFF' + r.map(x => x.join(',')).join('\n'), 'text/csv');
}

/* ---------- SETTINGS ---------- */
function setV() {
  $('#m').innerHTML = `<div class="card"><h3>Shop</h3>
    <input id="sn" class="in" value="${esc(D.shop)}" placeholder="Shop name"><input id="cu" class="in" value="${esc(D.cur)}" placeholder="Currency (Ks, THB, $)">
    <input id="lw" class="in" type="number" value="${D.low}" placeholder="Low-stock alert at">
    <button class="btn" onclick="D.shop=$('#sn').value||D.shop;D.cur=$('#cu').value||D.cur;D.low=+$('#lw').value||0;save();view();toast('Saved')">Save</button></div>
    <div class="card"><h3>Payment QR</h3><p class="mut">Upload your KBZPay / Wave / PromptPay QR. It is shown at checkout.</p>
    ${D.qr ? `<img class="qr" src="${D.qr}" alt="QR">` : ''}<input type="file" accept="image/*" class="in" onchange="qrUp(this)">
    ${D.qr ? '<button class="btn alt" onclick="D.qr=\'\';save();setV()">Remove QR</button>' : ''}</div>
    <div class="card"><h3>Account &amp; sync</h3>${sb ? (user ? `<p>${esc(user.email)}</p><button class="btn alt" onclick="push().then(()=>toast('Synced'))">Sync now</button>
      <button class="btn alt" onclick="signOut()">Sign out</button>` : '<button class="btn" onclick="authM()">Sign in</button>')
      : '<p class="mut">Cloud sync is off. Add your Supabase URL and key in config.js to turn it on.</p>'}</div>
    <div class="card"><h3>Backup</h3><button class="btn alt" onclick="dl('pos-backup.json',JSON.stringify(D),'application/json')">Download backup</button>
    <input type="file" accept=".json" class="in" onchange="restore(this)"></div>
    <button class="btn red" onclick="if(confirm('Delete ALL local data?')){localStorage.removeItem(K);D=blank();save();view()}">Reset local data</button>`;
}
function qrUp(el) {
  const f = el.files[0]; if (!f) return; const img = new Image();
  img.onload = () => { const s = Math.min(1, 400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    D.qr = c.toDataURL('image/png'); save(); setV(); };
  img.src = URL.createObjectURL(f);
}
function restore(el) {
  const f = el.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { D = Object.assign(blank(), JSON.parse(r.result)); save(); view(); toast('Restored'); } catch (e) { toast('Invalid file'); } };
  r.readAsText(f);
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
initCloud(); view();
