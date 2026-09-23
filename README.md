# Super App UMKM Kelurahan Jatinegara

Aplikasi web + API terpadu untuk pelaku UMKM di Kelurahan Jatinegara, Kota Administrasi
Jakarta Timur. Backend: Node.js + Express + SQLite (satu file database, tanpa perlu server
database terpisah). Frontend: Progressive Web App (PWA) ringan tanpa proses build, bisa
dipasang di layar HP seperti aplikasi biasa dan tetap bisa dipakai saat sinyal hilang.

## Peta fitur → kode

| Kelompok | Fitur | Rute API | Halaman |
|---|---|---|---|
| Operasional | Pencatatan keuangan otomatis (untung/rugi) | `src/routes/keuangan.js` | Menu **Keuangan** |
| Operasional | Manajemen stok + notifikasi stok menipis | `src/routes/stok.js` | Menu **Stok** |
| Operasional | Kasir digital (POS) + struk digital/cetak | `src/routes/kasir.js` | Menu **Kasir** |
| Pembayaran | Integrasi QRIS | `src/routes/qris.js` | Muncul saat bayar QRIS di Kasir |
| Pembayaran | Kemitraan BUMDes & LPD (pengajuan modal) | `src/routes/pembiayaan.js` | Menu **Kemitraan BUMDes** |
| Pemasaran | Katalog produk digital (tautan toko) | `src/routes/katalog.js` | Menu **Katalog Digital** |
| Pemasaran | Pasar Bersama (marketplace desa) | `src/routes/marketplace.js` | Menu **Pasar Bersama** |
| Pemasaran | Logistik kolektif (kurir/ojek desa) | `src/routes/logistik.js` | Menu **Logistik Kolektif** |
| Pendampingan | Panduan NIB / Halal / P-IRT | `src/routes/edukasi.js` | Menu **Perizinan** |
| Pendampingan | Pojok Belajar (video/tips hemat kuota) | `src/routes/edukasi.js` | Menu **Pojok Belajar** |
| Teknis | Mode offline + sinkron otomatis | `src/routes/sync.js`, `public/offline.js`, `public/sw.js` | Berjalan otomatis di semua menu |
| Teknis | Login tanpa password (OTP WhatsApp / biometrik) | `src/routes/auth.js` | Halaman awal (login) |

## Menjalankan di server

Butuh **Node.js versi 18 ke atas**.

```bash
# 1. Salin/upload folder ini ke server, lalu masuk ke foldernya
cd super-app-umkm-jatinegara

# 2. Pasang dependency
npm install

# 3. Siapkan file konfigurasi
cp .env.example .env
# lalu edit .env: ganti JWT_SECRET dengan teks acak yang panjang & rahasia

# 4. Jalankan
npm start
```

Aplikasi akan aktif di `http://ALAMAT-SERVER:3000` (port bisa diubah lewat `PORT` di `.env`).
Database SQLite otomatis dibuat di `data/umkm.db` beserta data awal (panduan perizinan,
materi belajar, dan 2 akun kurir contoh) pada saat pertama kali dijalankan.

Agar aplikasi tetap berjalan di server produksi, disarankan pakai process manager, misalnya:

```bash
npm install -g pm2
pm2 start server.js --name umkm-jatinegara
pm2 save
pm2 startup
```

Lalu arahkan domain melalui reverse proxy (Nginx) ke `http://127.0.0.1:3000` dan aktifkan
HTTPS (mis. lewat Certbot/Let's Encrypt) — wajib untuk PWA (service worker) dan biometrik (WebAuthn).

## Akun admin awal

Nomor WhatsApp admin kelurahan default: `628000000000` (lihat `src/seed.js`). Login lewat
halaman utama menggunakan nomor ini untuk masuk sebagai admin dan mengakses **Panel Admin**
(verifikasi pengajuan pembiayaan, rekap UMKM). Segera ganti/tambah admin sesuai kebutuhan
lewat database setelah deploy.

## Hal penting sebelum dipakai sungguhan (produksi)

Beberapa bagian sengaja dibuat dalam **mode simulasi** karena butuh kerja sama pihak ketiga
yang harus didaftarkan oleh pengelola kelurahan/BUMDes:

1. **OTP WhatsApp** (`src/routes/auth.js`) — saat ini kode OTP hanya dicetak di log server
   (dan ikut dikirim di response API jika `OTP_DEBUG_MODE=true` di `.env`, untuk memudahkan
   uji coba). Untuk produksi nyata, hubungkan ke gateway WhatsApp resmi (mis. Fonnte, Wablas,
   atau Qontak) pada bagian yang ditandai `TODO produksi` di file tersebut, lalu set
   `OTP_DEBUG_MODE=false`.
2. **QRIS** (`src/routes/qris.js`) — payload QRIS yang dibuat saat ini adalah simulasi agar
   alur bisa dicoba end-to-end. Untuk transaksi nyata yang dananya benar-benar masuk ke
   rekening/dompet digital pelaku UMKM, payload harus diganti dengan payload resmi dari
   PJSP/bank penyalur QRIS (mis. lewat API Midtrans, Xendit, atau bank mitra BUMDes), dan
   endpoint `/api/qris/webhook` diarahkan sebagai webhook resmi dari penyedia tersebut.
3. **Login sidik jari (biometrik)** — endpoint `POST /api/auth/biometric/register` menyimpan
   referensi credential; implementasi penuh WebAuthn di sisi browser (pendaftaran & verifikasi
   sidik jari/Face ID perangkat) perlu ditambahkan di frontend sesuai kebutuhan perangkat yang
   dipakai warga (umumnya sudah didukung langsung oleh HP modern lewat API WebAuthn browser).

## Mode offline

Saat sinyal internet hilang, transaksi kasir, catatan keuangan manual, dan pergerakan stok
tetap bisa diinput — data disimpan sementara di `IndexedDB` peramban (`public/offline.js`).
Begitu koneksi kembali (event `online` di browser), data otomatis dikirim ke
`POST /api/sync/batch` dan dicocokkan lewat `client_uuid` supaya tidak tercatat dobel.

## Struktur folder

```
server.js                 Entry point Express
src/db.js                 Skema SQLite + koneksi database
src/seed.js               Data awal (panduan perizinan, materi belajar, kurir, admin)
src/middleware/auth.js     Middleware JWT & pengecekan role/profil usaha
src/utils/                Helper (JWT, slug, nomor invoice, format rupiah)
src/routes/*.js            Seluruh endpoint API per modul fitur
public/index.html          Shell HTML
public/app.js              Seluruh logika SPA (routing, tampilan, panggilan API)
public/offline.js          Antrean IndexedDB + sinkronisasi otomatis
public/sw.js                Service worker (app shell offline)
public/style.css           Desain visual aplikasi
data/umkm.db                Database SQLite (dibuat otomatis, sertakan dalam backup rutin!)
```

## Referensi singkat API

Semua endpoint berawalan `/api`. Endpoint yang butuh login mengirim header
`Authorization: Bearer <token>` (token didapat dari `/api/auth/otp/verify`).

```
POST  /api/auth/otp/request          { wa_number }
POST  /api/auth/otp/verify           { wa_number, code, name }
GET   /api/auth/me

POST  /api/keuangan/transaksi        { type, amount, category, description, payment_method }
GET   /api/keuangan/transaksi
GET   /api/keuangan/ringkasan?period=harian|bulanan

GET   /api/stok/produk
POST  /api/stok/produk
POST  /api/stok/produk/:id/movement  { type: masuk|keluar|penyesuaian, qty, note }
GET   /api/stok/menipis

POST  /api/kasir/transaksi           { items:[{product_id, qty}], payment_method, customer_name }
GET   /api/kasir/transaksi
GET   /api/kasir/struk/:id/public    (publik, tanpa login)

POST  /api/qris/generate             { sale_id }
GET   /api/qris/status/:id
POST  /api/qris/webhook              { qris_payment_id, status }   (dipanggil PJSP/gateway)

POST  /api/pembiayaan/ajukan         { jenis, jumlah_diajukan, tenor_bulan, tujuan }
GET   /api/pembiayaan
PUT   /api/pembiayaan/:id/status     (khusus admin)

PUT   /api/katalog/profil            { business_name, category, address, is_public, ... }
GET   /api/katalog/publik/:slug      (publik, tanpa login)

GET   /api/marketplace                (publik)
GET   /api/marketplace/produk         (publik)

POST  /api/logistik/order            { penerima, alamat_tujuan, jarak_km, ... }
GET   /api/logistik/kurir

GET   /api/edukasi/perizinan/:jenis   (NIB|HALAL|PIRT, publik)
PUT   /api/edukasi/perizinan/:jenis/progress
GET   /api/edukasi/materi             (publik)

POST  /api/sync/batch                { items:[{entity, client_uuid, payload}] }

GET   /api/admin/umkm                (khusus admin)
GET   /api/admin/pembiayaan          (khusus admin)
GET   /api/admin/ringkasan           (khusus admin)
```

## Contoh uji cepat lewat curl

```bash
# Minta OTP (mode demo akan menampilkan debug_code)
curl -X POST http://localhost:3000/api/auth/otp/request -H "Content-Type: application/json" \
  -d '{"wa_number":"081234567890"}'

# Verifikasi OTP -> dapatkan token
curl -X POST http://localhost:3000/api/auth/otp/verify -H "Content-Type: application/json" \
  -d '{"wa_number":"081234567890","code":"123456","name":"Warung Bu Yanti"}'
```
