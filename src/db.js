const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'umkm.db');
const isNewDb = !fs.existsSync(DB_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// SKEMA DATABASE
// ---------------------------------------------------------------------------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pelaku_umkm', -- pelaku_umkm | admin | kurir
  webauthn_credential TEXT, -- untuk login sidik jari/biometrik (WebAuthn credential id, opsional)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS umkm_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
  business_name TEXT NOT NULL,
  category TEXT,
  address TEXT,
  description TEXT,
  photo_url TEXT,
  slug TEXT UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  bank_account TEXT,
  ewallet_account TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 5,
  unit TEXT NOT NULL DEFAULT 'pcs',
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type TEXT NOT NULL, -- masuk | keluar | penyesuaian
  qty REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  type TEXT NOT NULL, -- pemasukan | pengeluaran
  category TEXT,
  amount REAL NOT NULL,
  description TEXT,
  payment_method TEXT DEFAULT 'tunai',
  ref_sale_id INTEGER,
  client_uuid TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  invoice_no TEXT NOT NULL UNIQUE,
  total_amount REAL NOT NULL,
  total_modal REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'tunai', -- tunai | qris
  payment_status TEXT NOT NULL DEFAULT 'lunas', -- lunas | menunggu | kadaluarsa
  customer_name TEXT,
  client_uuid TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER,
  product_name TEXT NOT NULL,
  qty REAL NOT NULL,
  price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS qris_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  qris_payload TEXT NOT NULL,
  qr_image TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | expired
  expires_at TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pembiayaan_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  jenis TEXT NOT NULL, -- modal_usaha | pembiayaan_mikro
  jumlah_diajukan REAL NOT NULL,
  tenor_bulan INTEGER,
  tujuan TEXT,
  status TEXT NOT NULL DEFAULT 'diajukan', -- diajukan | diproses | disetujui | ditolak | cair
  catatan_admin TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kurir (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  wa_number TEXT NOT NULL,
  kendaraan TEXT DEFAULT 'motor',
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  sale_id INTEGER,
  penerima TEXT NOT NULL,
  no_hp_penerima TEXT,
  alamat_tujuan TEXT NOT NULL,
  jarak_km REAL,
  ongkir REAL NOT NULL DEFAULT 0,
  kurir_id INTEGER REFERENCES kurir(id),
  status TEXT NOT NULL DEFAULT 'menunggu', -- menunggu | diambil | diantar | selesai | batal
  catatan TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS perizinan_panduan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis TEXT NOT NULL, -- NIB | HALAL | PIRT
  urutan INTEGER NOT NULL,
  judul TEXT NOT NULL,
  deskripsi TEXT,
  syarat TEXT, -- JSON array string
  link_resmi TEXT
);

CREATE TABLE IF NOT EXISTS perizinan_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  umkm_id INTEGER NOT NULL REFERENCES umkm_profiles(id),
  jenis TEXT NOT NULL,
  step_selesai TEXT NOT NULL DEFAULT '[]', -- JSON array of step ids
  status TEXT NOT NULL DEFAULT 'belum_mulai', -- belum_mulai | proses | selesai
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(umkm_id, jenis)
);

CREATE TABLE IF NOT EXISTS edukasi_materi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kategori TEXT NOT NULL, -- video | artikel | tips
  judul TEXT NOT NULL,
  deskripsi TEXT,
  konten_url TEXT,
  durasi_menit INTEGER,
  ukuran_mb REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_umkm ON products(umkm_id);
CREATE INDEX IF NOT EXISTS idx_transactions_umkm ON transactions(umkm_id);
CREATE INDEX IF NOT EXISTS idx_sales_umkm ON sales(umkm_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_delivery_umkm ON delivery_orders(umkm_id);
`);

if (isNewDb) {
  console.log('[DB] Membuat database baru dan mengisi data awal (seed)...');
  require('./seed').runSeed(db);
}

module.exports = db;
