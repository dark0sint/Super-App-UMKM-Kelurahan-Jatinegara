/* Super App UMKM Kelurahan Jatinegara — frontend SPA (vanilla JS, tanpa build step) */

const API_BASE = '';
const state = {
  token: localStorage.getItem('umkm_token') || null,
  user: JSON.parse(localStorage.getItem('umkm_user') || 'null'),
  umkm: JSON.parse(localStorage.getItem('umkm_profile') || 'null'),
};

function saveSession({ token, user, umkm }) {
  if (token) { state.token = token; localStorage.setItem('umkm_token', token); }
  if (user) { state.user = user; localStorage.setItem('umkm_user', JSON.stringify(user)); }
  state.umkm = umkm || null;
  localStorage.setItem('umkm_profile', JSON.stringify(state.umkm));
}
function clearSession() {
  state.token = null; state.user = null; state.umkm = null;
  localStorage.removeItem('umkm_token'); localStorage.removeItem('umkm_user'); localStorage.removeItem('umkm_profile');
}

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function rupiah(n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); }
function tanggal(s) { return new Date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); }

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error('OFFLINE');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

/* ---------------------------------------------------------------------- */
/* ROUTING                                                                 */
/* ---------------------------------------------------------------------- */

const routes = {
  '/dashboard': viewDashboard,
  '/keuangan': viewKeuangan,
  '/stok': viewStok,
  '/kasir': viewKasir,
  '/kasir/riwayat': viewKasirRiwayat,
  '/pembiayaan': viewPembiayaan,
  '/katalog': viewKatalog,
  '/marketplace': viewMarketplace,
  '/logistik': viewLogistik,
  '/edukasi/perizinan': viewPerizinan,
  '/edukasi/belajar': viewBelajar,
  '/admin': viewAdmin,
};

const NAV = [
  { group: 'Ringkasan', items: [ ['/dashboard', '🏠', 'Dashboard'] ] },
  { group: 'Pengelolaan Usaha', items: [
    ['/keuangan', '📒', 'Keuangan'],
    ['/stok', '📦', 'Stok'],
    ['/kasir', '🧾', 'Kasir (POS)'],
    ['/kasir/riwayat', '🕘', 'Riwayat Kasir'],
  ]},
  { group: 'Pembayaran & Modal', items: [
    ['/pembiayaan', '💰', 'Kemitraan BUMDes'],
  ]},
  { group: 'Pemasaran & Logistik', items: [
    ['/katalog', '🔗', 'Katalog Digital'],
    ['/marketplace', '🏪', 'Pasar Bersama'],
    ['/logistik', '🚚', 'Logistik Kolektif'],
  ]},
  { group: 'Pendampingan', items: [
    ['/edukasi/perizinan', '📋', 'Perizinan'],
    ['/edukasi/belajar', '🎓', 'Pojok Belajar'],
  ]},
];

function currentPath() {
  return location.hash.replace(/^#/, '') || '/dashboard';
}

async function router() {
  // Halaman publik: toko/:slug dan struk/:id dilayani lewat pathname asli (bukan hash)
  if (location.pathname.startsWith('/toko/')) return renderPublicStorefront(location.pathname.split('/toko/')[1]);
  if (location.pathname.startsWith('/struk/')) return renderPublicReceipt(location.pathname.split('/struk/')[1]);

  if (!state.token) return renderAuth();

  const path = currentPath();
  renderShell(path);
  const view = routes[path] || viewDashboard;
  const mount = document.getElementById('view');
  mount.innerHTML = '<div class="empty">Memuat...</div>';
  try {
    await view(mount);
  } catch (e) {
    mount.innerHTML = `<div class="empty">Gagal memuat halaman: ${e.message}</div>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => { router(); setupConnectivity(); });

/* ---------------------------------------------------------------------- */
/* SHELL (sidebar + topbar + bottom tabbar)                               */
/* ---------------------------------------------------------------------- */

function renderShell(activePath) {
  const app = document.getElementById('app');
  const isAdmin = state.user && state.user.role === 'admin';
  const navHtml = NAV.map(g => `
    <div class="nav-group">
      <div class="nav-label">${g.group}</div>
      ${g.items.map(([p, icon, label]) => `
        <a href="#${p}" class="nav-item ${activePath === p ? 'active' : ''}"><span>${icon}</span><span>${label}</span></a>
      `).join('')}
    </div>
  `).join('') + (isAdmin ? `
    <div class="nav-group">
      <div class="nav-label">Admin Kelurahan</div>
      <a href="#/admin" class="nav-item ${activePath === '/admin' ? 'active' : ''}"><span>🛠️</span><span>Panel Admin</span></a>
    </div>` : '');

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">Super App UMKM<small>Kelurahan Jatinegara</small></div>
      ${navHtml}
      <div class="footer-note">
        <div>${state.user ? state.user.name : ''}</div>
        <a href="#" id="btn-logout" style="color:#E3A008;">Keluar</a>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div>
          <h1>${NAV.flatMap(g => g.items).find(i => i[0] === activePath)?.[2] || 'Dashboard'}</h1>
          <div class="sub">${state.umkm ? state.umkm.business_name : 'Lengkapi profil usaha Anda'}</div>
        </div>
        <span id="conn-badge" class="badge-online"><span class="dot"></span> Online</span>
      </div>
      <div id="view"></div>
    </main>
    <nav class="tabbar">
      <a href="#/dashboard" class="${activePath === '/dashboard' ? 'active' : ''}"><span class="icon">🏠</span>Home</a>
      <a href="#/kasir" class="${activePath === '/kasir' ? 'active' : ''}"><span class="icon">🧾</span>Kasir</a>
      <a href="#/stok" class="${activePath === '/stok' ? 'active' : ''}"><span class="icon">📦</span>Stok</a>
      <a href="#/keuangan" class="${activePath === '/keuangan' ? 'active' : ''}"><span class="icon">📒</span>Uang</a>
      <a href="#/marketplace" class="${activePath === '/marketplace' ? 'active' : ''}"><span class="icon">🏪</span>Pasar</a>
    </nav>
  `;
  document.getElementById('btn-logout').addEventListener('click', (e) => {
    e.preventDefault(); clearSession(); router();
  });
  updateConnBadge();
}

function updateConnBadge() {
  const el = document.getElementById('conn-badge');
  if (!el) return;
  if (navigator.onLine) { el.classList.remove('offline'); el.innerHTML = '<span class="dot"></span> Online'; }
  else { el.classList.add('offline'); el.innerHTML = '<span class="dot"></span> Offline (data akan disinkron otomatis)'; }
}

function setupConnectivity() {
  window.addEventListener('online', async () => {
    updateConnBadge();
    const r = await OfflineDB.trySync(API_BASE, state.token);
    if (r.synced > 0) toast(`${r.synced} data berhasil disinkronkan.`, 'success');
  });
  window.addEventListener('offline', updateConnBadge);
  if (navigator.onLine && state.token) OfflineDB.trySync(API_BASE, state.token);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

/* ---------------------------------------------------------------------- */
/* AUTH VIEW — Login tanpa password (OTP WhatsApp)                        */
/* ---------------------------------------------------------------------- */

function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="brand-mark">Super App <span>UMKM</span></div>
        <p class="desc">Kelurahan Jatinegara, Jakarta Timur. Masuk cukup pakai nomor WhatsApp — tanpa perlu bikin atau mengingat kata sandi.</p>
        <div id="auth-step-1">
          <div class="field"><label>Nama usaha / nama Anda</label><input id="in-name" placeholder="mis. Warung Bu Yanti" /></div>
          <div class="field"><label>Nomor WhatsApp</label><input id="in-wa" placeholder="08xxxxxxxxxx" inputmode="numeric" /></div>
          <button class="btn gold" id="btn-request-otp" style="width:100%">Kirim kode OTP</button>
        </div>
        <div id="auth-step-2" style="display:none">
          <p class="muted" style="font-size:13px" id="otp-info"></p>
          <div class="field"><label>Kode OTP (6 digit)</label><input id="in-otp" inputmode="numeric" maxlength="6" /></div>
          <button class="btn gold" id="btn-verify-otp" style="width:100%">Masuk</button>
          <button class="btn outline" id="btn-back" style="width:100%;margin-top:8px">Ganti nomor</button>
        </div>
      </div>
    </div>
  `;

  let waNumber = '';
  document.getElementById('btn-request-otp').addEventListener('click', async () => {
    waNumber = document.getElementById('in-wa').value.trim();
    if (!waNumber) return toast('Nomor WhatsApp wajib diisi.', 'error');
    try {
      const data = await api('/api/auth/otp/request', { method: 'POST', body: { wa_number: waNumber }, auth: false });
      document.getElementById('auth-step-1').style.display = 'none';
      document.getElementById('auth-step-2').style.display = 'block';
      document.getElementById('otp-info').textContent = data.debug_code
        ? `Mode demo: kode OTP Anda adalah ${data.debug_code} (berlaku 5 menit).`
        : `Kode OTP telah dikirim ke ${data.wa_number} lewat WhatsApp.`;
    } catch (e) { toast(e.message, 'error'); }
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('auth-step-1').style.display = 'block';
    document.getElementById('auth-step-2').style.display = 'none';
  });

  document.getElementById('btn-verify-otp').addEventListener('click', async () => {
    const code = document.getElementById('in-otp').value.trim();
    const name = document.getElementById('in-name').value.trim();
    try {
      const data = await api('/api/auth/otp/verify', { method: 'POST', body: { wa_number: waNumber, code, name }, auth: false });
      saveSession(data);
      location.hash = '#/dashboard';
      router();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------------- */
/* DASHBOARD                                                               */
/* ---------------------------------------------------------------------- */

async function viewDashboard(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const [ringkasan, menipis, sales] = await Promise.all([
    api('/api/keuangan/ringkasan?period=harian'),
    api('/api/stok/menipis'),
    api('/api/kasir/transaksi'),
  ]);
  const labaClass = ringkasan.laba_rugi_total >= 0 ? 'accent-green' : 'accent-red';
  mount.innerHTML = `
    <div class="grid grid-3">
      <div class="card accent-green"><h3>Total Pemasukan</h3><div class="big">${rupiah(ringkasan.total_pemasukan)}</div></div>
      <div class="card accent-red"><h3>Total Pengeluaran</h3><div class="big">${rupiah(ringkasan.total_pengeluaran)}</div></div>
      <div class="card ${labaClass}"><h3>${ringkasan.kesimpulan === 'untung' ? 'Untung Bersih' : 'Rugi Bersih'}</h3><div class="big">${rupiah(Math.abs(ringkasan.laba_rugi_total))}</div></div>
    </div>

    <div class="section-title">Stok menipis (${menipis.total})</div>
    ${menipis.total === 0 ? '<div class="card muted">Semua stok aman.</div>' : `
      <div class="card"><table><thead><tr><th>Produk</th><th>Sisa</th><th>Batas Minimum</th></tr></thead><tbody>
        ${menipis.produk.map(p => `<tr><td>${p.name}</td><td>${p.stock_qty} ${p.unit}</td><td>${p.min_stock} ${p.unit}</td></tr>`).join('')}
      </tbody></table></div>`}

    <div class="section-title">Transaksi kasir terbaru</div>
    ${sales.sales.length === 0 ? '<div class="card muted">Belum ada transaksi kasir.</div>' : `
      <div class="card"><table><thead><tr><th>Invoice</th><th>Tanggal</th><th>Metode</th><th>Status</th><th>Total</th></tr></thead><tbody>
        ${sales.sales.slice(0, 8).map(s => `<tr><td class="mono">${s.invoice_no}</td><td>${tanggal(s.created_at)}</td><td>${s.payment_method}</td><td>${statusPill(s.payment_status)}</td><td>${rupiah(s.total_amount)}</td></tr>`).join('')}
      </tbody></table></div>`}
  `;
}

function renderOnboarding(mount) {
  mount.innerHTML = `
    <div class="card" style="max-width:480px">
      <h3>Selamat datang!</h3>
      <p class="muted">Sebelum mulai memakai kasir, stok, dan fitur usaha lainnya, lengkapi dulu profil usaha Anda.</p>
      <a href="#/katalog" class="btn gold">Lengkapi Profil Usaha</a>
    </div>
  `;
}

function statusPill(status) {
  const map = { lunas: 'ok', menunggu: 'warn', kadaluarsa: 'bad', diajukan: 'neutral', diproses: 'warn', disetujui: 'ok', ditolak: 'bad', cair: 'ok', menunggu_kurir: 'neutral' };
  return `<span class="pill ${map[status] || 'neutral'}">${status}</span>`;
}

/* ---------------------------------------------------------------------- */
/* KEUANGAN                                                                */
/* ---------------------------------------------------------------------- */

async function viewKeuangan(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const [ringkasan, riwayat] = await Promise.all([
    api('/api/keuangan/ringkasan?period=harian'),
    api('/api/keuangan/transaksi'),
  ]);

  mount.innerHTML = `
    <div class="grid grid-3">
      <div class="card accent-green"><h3>Pemasukan</h3><div class="big">${rupiah(ringkasan.total_pemasukan)}</div></div>
      <div class="card accent-red"><h3>Pengeluaran</h3><div class="big">${rupiah(ringkasan.total_pengeluaran)}</div></div>
      <div class="card ${ringkasan.kesimpulan === 'untung' ? 'accent-green' : 'accent-red'}"><h3>Untung / Rugi</h3><div class="big">${rupiah(Math.abs(ringkasan.laba_rugi_total))} <span class="muted" style="font-size:13px">(${ringkasan.kesimpulan})</span></div></div>
    </div>

    <div class="section-title">Catat transaksi manual</div>
    <div class="card" style="max-width:520px">
      <div class="row">
        <div class="field"><label>Jenis</label><select id="k-type"><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select></div>
        <div class="field"><label>Jumlah (Rp)</label><input id="k-amount" type="number" placeholder="0" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Kategori</label><input id="k-category" placeholder="mis. Bahan baku, Listrik" /></div>
        <div class="field"><label>Metode</label><select id="k-method"><option value="tunai">Tunai</option><option value="transfer">Transfer</option><option value="qris">QRIS</option></select></div>
      </div>
      <div class="field"><label>Keterangan</label><input id="k-desc" placeholder="Opsional" /></div>
      <button class="btn gold" id="btn-add-trx">Simpan Transaksi</button>
    </div>

    <div class="section-title">Riwayat transaksi</div>
    <div class="card">
      ${riwayat.transaksi.length === 0 ? '<div class="empty">Belum ada transaksi.</div>' : `
      <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori</th><th>Keterangan</th><th>Jumlah</th></tr></thead><tbody>
        ${riwayat.transaksi.map(t => `<tr><td>${tanggal(t.created_at)}</td><td>${t.type === 'pemasukan' ? '🟢 Pemasukan' : '🔴 Pengeluaran'}</td><td>${t.category || '-'}</td><td>${t.description || '-'}</td><td>${rupiah(t.amount)}</td></tr>`).join('')}
      </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-add-trx').addEventListener('click', async () => {
    const payload = {
      type: document.getElementById('k-type').value,
      amount: Number(document.getElementById('k-amount').value),
      category: document.getElementById('k-category').value,
      payment_method: document.getElementById('k-method').value,
      description: document.getElementById('k-desc').value,
    };
    if (!payload.amount) return toast('Jumlah wajib diisi.', 'error');

    if (!navigator.onLine) {
      await OfflineDB.queueAction('transaksi_keuangan', payload);
      toast('Offline: transaksi disimpan sementara dan akan disinkron otomatis.', 'success');
      return viewKeuangan(mount);
    }
    try {
      await api('/api/keuangan/transaksi', { method: 'POST', body: payload });
      toast('Transaksi tersimpan.', 'success');
      viewKeuangan(mount);
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------------- */
/* STOK                                                                    */
/* ---------------------------------------------------------------------- */

async function viewStok(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const { products } = await api('/api/stok/produk');
  await OfflineDB.setCache('products', products);

  mount.innerHTML = `
    <div class="section-title">Tambah produk / bahan baku</div>
    <div class="card" style="max-width:600px">
      <div class="row">
        <div class="field"><label>Nama produk</label><input id="s-name" /></div>
        <div class="field"><label>Kategori</label><input id="s-category" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Harga jual (Rp)</label><input id="s-price" type="number" /></div>
        <div class="field"><label>Harga modal (Rp)</label><input id="s-cost" type="number" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Stok awal</label><input id="s-stock" type="number" value="0" /></div>
        <div class="field"><label>Batas stok menipis</label><input id="s-min" type="number" value="5" /></div>
        <div class="field"><label>Satuan</label><input id="s-unit" value="pcs" /></div>
      </div>
      <button class="btn gold" id="btn-add-produk">Simpan Produk</button>
    </div>

    <div class="section-title">Daftar produk (${products.length})</div>
    <div class="card">
      ${products.length === 0 ? '<div class="empty">Belum ada produk.</div>' : `
      <table><thead><tr><th>Produk</th><th>Harga</th><th>Stok</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        ${products.map(p => `
          <tr>
            <td>${p.name}<div class="muted" style="font-size:12px">${p.category || ''}</div></td>
            <td>${rupiah(p.price)}</td>
            <td>${p.stock_qty} ${p.unit}</td>
            <td>${p.stock_qty <= p.min_stock ? '<span class="pill bad">Menipis</span>' : '<span class="pill ok">Aman</span>'}</td>
            <td>
              <button class="btn small outline" data-in="${p.id}">+Masuk</button>
              <button class="btn small outline" data-out="${p.id}">-Keluar</button>
            </td>
          </tr>`).join('')}
      </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-add-produk').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('s-name').value,
      category: document.getElementById('s-category').value,
      price: Number(document.getElementById('s-price').value),
      cost_price: Number(document.getElementById('s-cost').value || 0),
      stock_qty: Number(document.getElementById('s-stock').value || 0),
      min_stock: Number(document.getElementById('s-min').value || 5),
      unit: document.getElementById('s-unit').value || 'pcs',
    };
    if (!payload.name || !payload.price) return toast('Nama dan harga jual wajib diisi.', 'error');
    try {
      await api('/api/stok/produk', { method: 'POST', body: payload });
      toast('Produk ditambahkan.', 'success');
      viewStok(mount);
    } catch (e) { toast(e.message, 'error'); }
  });

  mount.querySelectorAll('[data-in]').forEach(btn => btn.addEventListener('click', () => movementPrompt(mount, btn.dataset.in, 'masuk')));
  mount.querySelectorAll('[data-out]').forEach(btn => btn.addEventListener('click', () => movementPrompt(mount, btn.dataset.out, 'keluar')));
}

async function movementPrompt(mount, productId, type) {
  const qty = prompt(type === 'masuk' ? 'Jumlah barang masuk:' : 'Jumlah barang keluar:');
  if (!qty || isNaN(Number(qty))) return;
  const payload = { product_id: Number(productId), type, qty: Number(qty), note: 'Manual' };
  if (!navigator.onLine) {
    await OfflineDB.queueAction('stok_movement', payload);
    toast('Offline: pergerakan stok disimpan sementara.', 'success');
    return viewStok(mount);
  }
  try {
    const res = await api(`/api/stok/produk/${productId}/movement`, { method: 'POST', body: { type, qty: Number(qty), note: 'Manual' } });
    if (res.low_stock_warning) toast(`⚠️ Stok ${res.product.name} sudah menipis!`, 'error');
    else toast('Stok diperbarui.', 'success');
    viewStok(mount);
  } catch (e) { toast(e.message, 'error'); }
}

/* ---------------------------------------------------------------------- */
/* KASIR (POS)                                                             */
/* ---------------------------------------------------------------------- */

let kasirCart = [];

async function viewKasir(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  let products;
  try {
    ({ products } = await api('/api/stok/produk'));
    await OfflineDB.setCache('products', products);
  } catch (e) {
    products = (await OfflineDB.getCache('products')) || [];
  }
  products = products.filter(p => p.is_active);

  mount.innerHTML = `
    <div class="grid grid-2">
      <div>
        <div class="section-title">Pilih produk</div>
        <div class="card">
          <div class="grid grid-2" id="produk-grid">
            ${products.map(p => `
              <button class="btn outline" data-add="${p.id}" style="justify-content:space-between;text-align:left">
                <span>${p.name}<br><span class="muted" style="font-size:12px">${rupiah(p.price)} · sisa ${p.stock_qty} ${p.unit}</span></span>
              </button>`).join('') || '<div class="empty">Belum ada produk. Tambahkan dulu di menu Stok.</div>'}
          </div>
        </div>
      </div>
      <div>
        <div class="section-title">Keranjang</div>
        <div class="card" id="cart-box"></div>
      </div>
    </div>
  `;

  mount.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const p = products.find(x => x.id == btn.dataset.add);
    const item = kasirCart.find(x => x.product_id === p.id);
    if (item) item.qty += 1; else kasirCart.push({ product_id: p.id, name: p.name, price: p.price, qty: 1, max: p.stock_qty });
    renderCart();
  }));

  renderCart();

  function renderCart() {
    const box = document.getElementById('cart-box');
    if (kasirCart.length === 0) {
      box.innerHTML = '<div class="empty">Keranjang kosong.</div>';
      return;
    }
    const total = kasirCart.reduce((s, i) => s + i.price * i.qty, 0);
    box.innerHTML = `
      <table><thead><tr><th>Produk</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead><tbody>
        ${kasirCart.map((i, idx) => `
          <tr><td>${i.name}</td><td>${i.qty}</td><td>${rupiah(i.price * i.qty)}</td>
          <td><button class="btn small outline" data-remove="${idx}">Hapus</button></td></tr>`).join('')}
      </tbody></table>
      <div style="margin-top:10px;font-weight:700;font-size:17px">Total: ${rupiah(total)}</div>
      <div class="field" style="margin-top:12px"><label>Nama pelanggan (opsional)</label><input id="c-customer" /></div>
      <div class="field"><label>Metode pembayaran</label><select id="c-method"><option value="tunai">Tunai</option><option value="qris">QRIS</option></select></div>
      <button class="btn gold" id="btn-bayar" style="width:100%">Proses Pembayaran</button>
    `;
    box.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
      kasirCart.splice(Number(btn.dataset.remove), 1); renderCart();
    }));
    document.getElementById('btn-bayar').addEventListener('click', prosesBayar);
  }

  async function prosesBayar() {
    const payload = {
      items: kasirCart.map(i => ({ product_id: i.product_id, qty: i.qty })),
      payment_method: document.getElementById('c-method').value,
      customer_name: document.getElementById('c-customer').value,
    };

    if (!navigator.onLine) {
      await OfflineDB.queueAction('penjualan', payload);
      toast('Offline: transaksi disimpan & akan disinkron otomatis saat online.', 'success');
      kasirCart = [];
      return viewKasir(mount);
    }

    try {
      const res = await api('/api/kasir/transaksi', { method: 'POST', body: payload });
      kasirCart = [];
      if (payload.payment_method === 'qris') {
        await tampilkanQris(mount, res.sale.id);
      } else {
        toast(`Transaksi ${res.sale.invoice_no} berhasil.`, 'success');
        window.open(`/struk/${res.sale.id}`, '_blank');
        viewKasir(mount);
      }
    } catch (e) { toast(e.message, 'error'); }
  }
}

async function tampilkanQris(mount, saleId) {
  const res = await api('/api/qris/generate', { method: 'POST', body: { sale_id: saleId } });
  const box = document.getElementById('view');
  box.innerHTML = `
    <div class="card" style="max-width:360px;text-align:center;margin:0 auto">
      <h3>Scan QRIS untuk membayar</h3>
      <img src="${res.qr_image}" style="width:260px;height:260px;margin:12px auto" />
      <div id="qris-status" class="pill warn">Menunggu pembayaran...</div>
      <div class="muted" style="margin-top:10px;font-size:13px">QR berlaku sampai ${tanggal(res.expires_at)}</div>
      <button class="btn outline" style="margin-top:14px" id="btn-cancel-qris">Kembali ke Kasir</button>
    </div>
  `;
  document.getElementById('btn-cancel-qris').addEventListener('click', () => viewKasir(box));

  const poll = setInterval(async () => {
    try {
      const s = await api(`/api/qris/status/${res.qris_payment_id}`);
      if (s.status === 'paid') {
        clearInterval(poll);
        document.getElementById('qris-status').outerHTML = '<div class="pill ok">Pembayaran diterima ✔</div>';
        toast('Pembayaran QRIS berhasil.', 'success');
      }
    } catch (e) { /* diamkan, coba lagi */ }
  }, 4000);
}

async function viewKasirRiwayat(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const { sales } = await api('/api/kasir/transaksi');
  mount.innerHTML = `
    <div class="card">
      ${sales.length === 0 ? '<div class="empty">Belum ada transaksi.</div>' : `
      <table><thead><tr><th>Invoice</th><th>Tanggal</th><th>Metode</th><th>Status</th><th>Total</th><th>Struk</th></tr></thead><tbody>
        ${sales.map(s => `<tr><td class="mono">${s.invoice_no}</td><td>${tanggal(s.created_at)}</td><td>${s.payment_method}</td><td>${statusPill(s.payment_status)}</td><td>${rupiah(s.total_amount)}</td><td><a href="/struk/${s.id}" target="_blank" class="btn small outline">Lihat</a></td></tr>`).join('')}
      </tbody></table>`}
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* PEMBIAYAAN / KEMITRAAN BUMDES                                           */
/* ---------------------------------------------------------------------- */

async function viewPembiayaan(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const { pengajuan } = await api('/api/pembiayaan');
  mount.innerHTML = `
    <div class="section-title">Ajukan modal usaha / pembiayaan mikro</div>
    <div class="card" style="max-width:520px">
      <div class="field"><label>Jenis pengajuan</label>
        <select id="p-jenis"><option value="modal_usaha">Modal Usaha (BUMDes)</option><option value="pembiayaan_mikro">Pembiayaan Mikro (LPD)</option></select>
      </div>
      <div class="row">
        <div class="field"><label>Jumlah diajukan (Rp)</label><input id="p-jumlah" type="number" /></div>
        <div class="field"><label>Tenor (bulan)</label><input id="p-tenor" type="number" placeholder="mis. 12" /></div>
      </div>
      <div class="field"><label>Tujuan penggunaan dana</label><textarea id="p-tujuan" rows="3"></textarea></div>
      <button class="btn gold" id="btn-ajukan">Ajukan Sekarang</button>
    </div>

    <div class="section-title">Riwayat pengajuan</div>
    <div class="card">
      ${pengajuan.length === 0 ? '<div class="empty">Belum ada pengajuan.</div>' : `
      <table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Jumlah</th><th>Status</th><th>Catatan Admin</th></tr></thead><tbody>
        ${pengajuan.map(p => `<tr><td>${tanggal(p.created_at)}</td><td>${p.jenis === 'modal_usaha' ? 'Modal Usaha' : 'Pembiayaan Mikro'}</td><td>${rupiah(p.jumlah_diajukan)}</td><td>${statusPill(p.status)}</td><td>${p.catatan_admin || '-'}</td></tr>`).join('')}
      </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-ajukan').addEventListener('click', async () => {
    const payload = {
      jenis: document.getElementById('p-jenis').value,
      jumlah_diajukan: Number(document.getElementById('p-jumlah').value),
      tenor_bulan: Number(document.getElementById('p-tenor').value) || null,
      tujuan: document.getElementById('p-tujuan').value,
    };
    if (!payload.jumlah_diajukan) return toast('Jumlah pengajuan wajib diisi.', 'error');
    try {
      await api('/api/pembiayaan/ajukan', { method: 'POST', body: payload });
      toast('Pengajuan terkirim, tunggu verifikasi admin kelurahan.', 'success');
      viewPembiayaan(mount);
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------------- */
/* KATALOG (profil usaha + storefront)                                    */
/* ---------------------------------------------------------------------- */

async function viewKatalog(mount) {
  const data = state.umkm ? await api('/api/katalog/saya') : { umkm: null };
  const u = data.umkm || {};
  mount.innerHTML = `
    <div class="section-title">Profil usaha</div>
    <div class="card" style="max-width:560px">
      <div class="field"><label>Nama usaha</label><input id="pr-name" value="${u.business_name || ''}" /></div>
      <div class="row">
        <div class="field"><label>Kategori</label><input id="pr-cat" value="${u.category || ''}" placeholder="mis. Kuliner, Kerajinan" /></div>
        <div class="field"><label>Alamat</label><input id="pr-addr" value="${u.address || ''}" /></div>
      </div>
      <div class="field"><label>Deskripsi singkat</label><textarea id="pr-desc" rows="3">${u.description || ''}</textarea></div>
      <div class="row">
        <div class="field"><label>Rekening bank (untuk QRIS/transfer)</label><input id="pr-bank" value="${u.bank_account || ''}" /></div>
        <div class="field"><label>Dompet digital</label><input id="pr-ewallet" value="${u.ewallet_account || ''}" /></div>
      </div>
      <div class="field">
        <label><input type="checkbox" id="pr-public" ${u.is_public ? 'checked' : ''} /> Tampilkan toko saya di Pasar Bersama (publik)</label>
      </div>
      <button class="btn gold" id="btn-save-profil">Simpan Profil</button>
      ${u.slug ? `<div class="muted" style="margin-top:10px;font-size:13px">Tautan toko: <a href="/toko/${u.slug}" target="_blank">${location.origin}/toko/${u.slug}</a></div>` : ''}
    </div>

    ${data.products ? `
    <div class="section-title">Produk di katalog (${data.products.length})</div>
    <div class="card">
      ${data.products.length === 0 ? '<div class="empty">Belum ada produk. Tambahkan di menu Stok.</div>' : `
      <div class="grid grid-2">
        ${data.products.map(p => `<div class="product-card"><div class="name">${p.name}</div><div class="muted">${p.category || ''}</div><div class="price">${rupiah(p.price)}</div></div>`).join('')}
      </div>`}
    </div>` : ''}
  `;

  document.getElementById('btn-save-profil').addEventListener('click', async () => {
    const payload = {
      business_name: document.getElementById('pr-name').value,
      category: document.getElementById('pr-cat').value,
      address: document.getElementById('pr-addr').value,
      description: document.getElementById('pr-desc').value,
      bank_account: document.getElementById('pr-bank').value,
      ewallet_account: document.getElementById('pr-ewallet').value,
      is_public: document.getElementById('pr-public').checked,
    };
    if (!payload.business_name) return toast('Nama usaha wajib diisi.', 'error');
    try {
      const res = await api('/api/katalog/profil', { method: 'PUT', body: payload });
      saveSession({ umkm: res.umkm });
      toast('Profil usaha tersimpan.', 'success');
      router();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------------- */
/* MARKETPLACE DESA (Pasar Bersama)                                       */
/* ---------------------------------------------------------------------- */

async function viewMarketplace(mount) {
  const { umkm } = await api('/api/marketplace', { auth: false });
  mount.innerHTML = `
    <div class="section-title">UMKM terdaftar di Pasar Bersama (${umkm.length})</div>
    <div class="grid grid-3">
      ${umkm.length === 0 ? '<div class="empty">Belum ada UMKM yang mempublikasikan tokonya.</div>' : umkm.map(u => `
        <a class="card" href="/toko/${u.slug}" target="_blank" style="text-decoration:none;color:inherit">
          <h3>${u.category || 'UMKM'}</h3>
          <div style="font-weight:700;font-size:16px">${u.business_name}</div>
          <div class="muted" style="font-size:13px">${u.address || ''}</div>
        </a>`).join('')}
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* LOGISTIK KOLEKTIF                                                      */
/* ---------------------------------------------------------------------- */

async function viewLogistik(mount) {
  if (!state.umkm) return renderOnboarding(mount);
  const [{ order }, { kurir }] = await Promise.all([api('/api/logistik/order'), api('/api/logistik/kurir')]);
  mount.innerHTML = `
    <div class="section-title">Buat permintaan pengiriman</div>
    <div class="card" style="max-width:520px">
      <div class="row">
        <div class="field"><label>Nama penerima</label><input id="l-penerima" /></div>
        <div class="field"><label>No. HP penerima</label><input id="l-hp" /></div>
      </div>
      <div class="field"><label>Alamat tujuan</label><textarea id="l-alamat" rows="2"></textarea></div>
      <div class="field"><label>Perkiraan jarak (km)</label><input id="l-jarak" type="number" step="0.1" /></div>
      <button class="btn gold" id="btn-order">Buat Order Pengiriman</button>
    </div>

    <div class="section-title">Kurir / ojek desa aktif</div>
    <div class="card">
      <table><thead><tr><th>Nama</th><th>No. WA</th><th>Kendaraan</th></tr></thead><tbody>
        ${kurir.map(k => `<tr><td>${k.name}</td><td>${k.wa_number}</td><td>${k.kendaraan}</td></tr>`).join('')}
      </tbody></table>
    </div>

    <div class="section-title">Riwayat pengiriman</div>
    <div class="card">
      ${order.length === 0 ? '<div class="empty">Belum ada order pengiriman.</div>' : `
      <table><thead><tr><th>Penerima</th><th>Tujuan</th><th>Ongkir</th><th>Status</th></tr></thead><tbody>
        ${order.map(o => `<tr><td>${o.penerima}</td><td>${o.alamat_tujuan}</td><td>${rupiah(o.ongkir)}</td><td>${statusPill(o.status)}</td></tr>`).join('')}
      </tbody></table>`}
    </div>
  `;

  document.getElementById('btn-order').addEventListener('click', async () => {
    const payload = {
      penerima: document.getElementById('l-penerima').value,
      no_hp_penerima: document.getElementById('l-hp').value,
      alamat_tujuan: document.getElementById('l-alamat').value,
      jarak_km: Number(document.getElementById('l-jarak').value) || null,
    };
    if (!payload.penerima || !payload.alamat_tujuan) return toast('Nama penerima dan alamat wajib diisi.', 'error');
    try {
      await api('/api/logistik/order', { method: 'POST', body: payload });
      toast('Order pengiriman dibuat.', 'success');
      viewLogistik(mount);
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------------------------------------------------------------------- */
/* EDUKASI — PERIZINAN                                                     */
/* ---------------------------------------------------------------------- */

async function viewPerizinan(mount) {
  mount.innerHTML = `
    <div class="row" style="margin-bottom:14px">
      <button class="btn outline" data-jenis="NIB">NIB</button>
      <button class="btn outline" data-jenis="HALAL">Sertifikasi Halal</button>
      <button class="btn outline" data-jenis="PIRT">P-IRT</button>
    </div>
    <div id="perizinan-box" class="card"><div class="empty">Pilih salah satu jenis perizinan di atas.</div></div>
  `;
  mount.querySelectorAll('[data-jenis]').forEach(btn => btn.addEventListener('click', () => loadPanduan(btn.dataset.jenis)));

  async function loadPanduan(jenis) {
    const { langkah } = await api(`/api/edukasi/perizinan/${jenis}`, { auth: false });
    let progress = { step_selesai: [] };
    if (state.umkm) {
      try { ({ progress } = await api(`/api/edukasi/perizinan/${jenis}/progress`)); } catch (e) {}
    }
    const box = document.getElementById('perizinan-box');
    box.innerHTML = `
      <h3 style="margin-top:0">Langkah pengurusan ${jenis}</h3>
      ${langkah.map(l => `
        <div class="field" style="border-bottom:1px solid var(--line);padding-bottom:10px">
          <label style="display:flex;gap:8px;align-items:flex-start">
            <input type="checkbox" data-step="${l.urutan}" ${progress.step_selesai.includes(l.urutan) ? 'checked' : ''} style="margin-top:4px" ${state.umkm ? '' : 'disabled'} />
            <span><strong>${l.urutan}. ${l.judul}</strong><br><span class="muted" style="font-size:13px">${l.deskripsi || ''}</span>
            ${l.syarat.length ? `<br><span class="muted" style="font-size:12px">Syarat: ${l.syarat.join(', ')}</span>` : ''}</span>
          </label>
        </div>`).join('')}
      ${langkah[0]?.link_resmi ? `<a href="${langkah[0].link_resmi}" target="_blank" class="btn outline" style="margin-top:10px">Buka situs resmi</a>` : ''}
    `;
    box.querySelectorAll('[data-step]').forEach(cb => cb.addEventListener('change', async () => {
      if (!state.umkm) return toast('Lengkapi profil usaha untuk menyimpan progres.', 'error');
      const checked = Array.from(box.querySelectorAll('[data-step]:checked')).map(x => Number(x.dataset.step));
      await api(`/api/edukasi/perizinan/${jenis}/progress`, { method: 'PUT', body: { step_selesai: checked } });
      toast('Progres tersimpan.', 'success');
    }));
  }
}

async function viewBelajar(mount) {
  const { materi } = await api('/api/edukasi/materi', { auth: false });
  mount.innerHTML = `
    <div class="grid grid-2">
      ${materi.map(m => `
        <div class="card">
          <span class="pill neutral">${m.kategori}</span>
          <div style="font-weight:700;margin-top:8px">${m.judul}</div>
          <div class="muted" style="font-size:13.5px;margin-top:4px">${m.deskripsi || ''}</div>
          ${m.konten_url ? `<a class="btn small outline" style="margin-top:10px" href="${m.konten_url}" target="_blank">Tonton (${m.ukuran_mb || '-'} MB)</a>` : ''}
        </div>`).join('')}
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* ADMIN                                                                   */
/* ---------------------------------------------------------------------- */

async function viewAdmin(mount) {
  if (!state.user || state.user.role !== 'admin') { mount.innerHTML = '<div class="empty">Khusus admin kelurahan.</div>'; return; }
  const [ringkasan, umkmList, pembiayaan] = await Promise.all([
    api('/api/admin/ringkasan'), api('/api/admin/umkm'), api('/api/admin/pembiayaan'),
  ]);
  mount.innerHTML = `
    <div class="grid grid-3">
      <div class="card"><h3>Total UMKM Terdaftar</h3><div class="big">${ringkasan.totalUmkm}</div></div>
      <div class="card"><h3>UMKM Publik di Pasar Bersama</h3><div class="big">${ringkasan.totalPublik}</div></div>
      <div class="card"><h3>Total Omzet Tercatat</h3><div class="big">${rupiah(ringkasan.totalOmzet)}</div></div>
    </div>

    <div class="section-title">Pengajuan pembiayaan (${ringkasan.totalPengajuanAktif} aktif)</div>
    <div class="card">
      <table><thead><tr><th>UMKM</th><th>Jenis</th><th>Jumlah</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
        ${pembiayaan.pengajuan.map(p => `
          <tr>
            <td>${p.business_name}</td><td>${p.jenis}</td><td>${rupiah(p.jumlah_diajukan)}</td><td>${statusPill(p.status)}</td>
            <td>
              <select data-pid="${p.id}" class="admin-status">
                ${['diajukan', 'diproses', 'disetujui', 'ditolak', 'cair'].map(s => `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('')}
      </tbody></table>
    </div>

    <div class="section-title">Daftar UMKM</div>
    <div class="card">
      <table><thead><tr><th>Nama Usaha</th><th>Pemilik</th><th>No. WA</th><th>Publik?</th></tr></thead><tbody>
        ${umkmList.umkm.map(u => `<tr><td>${u.business_name}</td><td>${u.pemilik}</td><td>${u.wa_number}</td><td>${u.is_public ? 'Ya' : 'Tidak'}</td></tr>`).join('')}
      </tbody></table>
    </div>
  `;

  mount.querySelectorAll('.admin-status').forEach(sel => sel.addEventListener('change', async () => {
    try {
      await api(`/api/pembiayaan/${sel.dataset.pid}/status`, { method: 'PUT', body: { status: sel.value } });
      toast('Status pengajuan diperbarui.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }));
}

/* ---------------------------------------------------------------------- */
/* HALAMAN PUBLIK — Storefront & Struk digital (tanpa login)              */
/* ---------------------------------------------------------------------- */

async function renderPublicStorefront(slug) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty">Memuat toko...</div>';
  try {
    const { umkm, products } = await api(`/api/katalog/publik/${slug}`, { auth: false });
    app.innerHTML = `
      <div style="width:100%">
        <div class="storefront-hero">
          <div class="cat">${umkm.category || 'UMKM Kelurahan Jatinegara'}</div>
          <h1>${umkm.business_name}</h1>
          <div class="muted" style="color:#D7DEDF">${umkm.address || ''}</div>
        </div>
        <div class="storefront-body">
          <p>${umkm.description || ''}</p>
          <div class="section-title">Produk</div>
          <div class="grid grid-3">
            ${products.map(p => `
              <div class="product-card">
                <div class="name">${p.name}</div>
                <div class="muted" style="font-size:12.5px">${p.category || ''}</div>
                <div class="price">${rupiah(p.price)}</div>
              </div>`).join('') || '<div class="empty">Belum ada produk.</div>'}
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty">${e.message}</div>`;
  }
}

async function renderPublicReceipt(id) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="empty">Memuat struk...</div>';
  try {
    const r = await api(`/api/kasir/struk/${id}/public`, { auth: false });
    app.innerHTML = `
      <div style="width:100%;background:var(--paper);min-height:100vh">
        <div class="receipt">
          <div style="text-align:center;font-weight:700">${r.toko}</div>
          <div style="text-align:center;font-size:11.5px" class="muted">${r.alamat || ''}</div>
          <hr/>
          <div class="r-row"><span>${r.invoice_no}</span><span>${r.status}</span></div>
          <div class="r-row muted"><span>${new Date(r.tanggal).toLocaleString('id-ID')}</span></div>
          <hr/>
          ${r.items.map(it => `
            <div class="r-row"><span>${it.nama} x${it.qty}</span><span>${it.subtotal_format}</span></div>
          `).join('')}
          <hr/>
          <div class="r-row total"><span>TOTAL</span><span>${r.total_format}</span></div>
          <div class="r-row muted" style="margin-top:6px"><span>Bayar: ${r.pembayaran}</span></div>
          <hr/>
          <div style="text-align:center;font-size:11.5px">Terima kasih telah belanja di UMKM Kelurahan Jatinegara 🙏</div>
        </div>
        <div style="text-align:center;margin-bottom:30px">
          <button class="btn outline" onclick="window.print()">Cetak / Simpan PDF</button>
        </div>
      </div>
    `;
  } catch (e) {
    app.innerHTML = `<div class="empty">${e.message}</div>`;
  }
}
