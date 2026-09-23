const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');

const router = express.Router();

router.get('/kurir', requireAuth, (req, res) => {
  const list = db.prepare('SELECT * FROM kurir WHERE is_active = 1').all();
  res.json({ kurir: list });
});

// Estimasi ongkir sederhana berbasis jarak — cocok untuk kurir/ojek desa lokal (bukan API eksternal)
function estimasiOngkir(jarakKm) {
  const tarifDasar = 5000;
  const tarifPerKm = 2000;
  return Math.round(tarifDasar + tarifPerKm * Math.max(0, jarakKm || 0));
}

router.post('/order', requireAuth, requireUmkm, (req, res) => {
  const { sale_id, penerima, no_hp_penerima, alamat_tujuan, jarak_km, catatan } = req.body;
  if (!penerima || !alamat_tujuan) return res.status(400).json({ error: 'Nama penerima dan alamat tujuan wajib diisi.' });
  const ongkir = estimasiOngkir(jarak_km);
  const info = db.prepare(`
    INSERT INTO delivery_orders (umkm_id, sale_id, penerima, no_hp_penerima, alamat_tujuan, jarak_km, ongkir, catatan)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.umkm.id, sale_id || null, penerima, no_hp_penerima || null, alamat_tujuan, jarak_km || null, ongkir, catatan || null);
  const order = db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ order });
});

router.get('/order', requireAuth, requireUmkm, (req, res) => {
  const list = db.prepare('SELECT * FROM delivery_orders WHERE umkm_id = ? ORDER BY id DESC').all(req.umkm.id);
  res.json({ order: list });
});

router.put('/order/:id/status', requireAuth, requireUmkm, (req, res) => {
  const order = db.prepare('SELECT * FROM delivery_orders WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!order) return res.status(404).json({ error: 'Order pengiriman tidak ditemukan.' });
  const { status, kurir_id } = req.body;
  if (!['menunggu', 'diambil', 'diantar', 'selesai', 'batal'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }
  db.prepare(`UPDATE delivery_orders SET status = ?, kurir_id = COALESCE(?, kurir_id), updated_at = datetime('now') WHERE id = ?`)
    .run(status, kurir_id || null, order.id);
  res.json({ order: db.prepare('SELECT * FROM delivery_orders WHERE id = ?').get(order.id) });
});

module.exports = router;
