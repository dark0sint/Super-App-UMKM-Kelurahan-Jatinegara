require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// Memastikan database & tabel siap sebelum route dipakai
require('./src/db');

const authRoutes = require('./src/routes/auth');
const keuanganRoutes = require('./src/routes/keuangan');
const stokRoutes = require('./src/routes/stok');
const kasirRoutes = require('./src/routes/kasir');
const qrisRoutes = require('./src/routes/qris');
const pembiayaanRoutes = require('./src/routes/pembiayaan');
const katalogRoutes = require('./src/routes/katalog');
const marketplaceRoutes = require('./src/routes/marketplace');
const logistikRoutes = require('./src/routes/logistik');
const edukasiRoutes = require('./src/routes/edukasi');
const syncRoutes = require('./src/routes/sync');
const adminRoutes = require('./src/routes/admin');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('tiny'));

// ---- API ----
app.use('/api/auth', authRoutes);
app.use('/api/keuangan', keuanganRoutes);
app.use('/api/stok', stokRoutes);
app.use('/api/kasir', kasirRoutes);
app.use('/api/qris', qrisRoutes);
app.use('/api/pembiayaan', pembiayaanRoutes);
app.use('/api/katalog', katalogRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/logistik', logistikRoutes);
app.use('/api/edukasi', edukasiRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: process.env.APP_NAME || 'Super App UMKM Kelurahan Jatinegara', time: new Date().toISOString() });
});

// ---- Frontend (PWA statis) ----
app.use(express.static(path.join(__dirname, 'public')));

// Halaman toko publik & struk digital dilayani oleh index.html (routing ditangani di app.js sisi klien)
app.get(['/toko/:slug', '/struk/:id'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Penanganan error umum agar server tidak crash dan pesan tetap ramah pengguna
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan pada server. Silakan coba lagi.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 ${process.env.APP_NAME || 'Super App UMKM Kelurahan Jatinegara'} berjalan di http://localhost:${PORT}\n`);
});
