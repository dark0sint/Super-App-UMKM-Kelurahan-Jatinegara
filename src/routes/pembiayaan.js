const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/ajukan', requireAuth, requireUmkm, (req, res) => {
  const { jenis, jumlah_diajukan, tenor_bulan, tujuan } = req.body;
  if (!['modal_usaha', 'pembiayaan_mikro'].includes(jenis) || !jumlah_diajukan) {
    return res.status(400).json({ error: 'Jenis pengajuan dan jumlah wajib diisi.' });
  }
  const info = db.prepare(`
    INSERT INTO pembiayaan_requests (umkm_id, jenis, jumlah_diajukan, tenor_bulan, tujuan)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.umkm.id, jenis, jumlah_diajukan, tenor_bulan || null, tujuan || null);
  const pengajuan = db.prepare('SELECT * FROM pembiayaan_requests WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ pengajuan });
});

router.get('/', requireAuth, requireUmkm, (req, res) => {
  const list = db.prepare('SELECT * FROM pembiayaan_requests WHERE umkm_id = ? ORDER BY id DESC').all(req.umkm.id);
  res.json({ pengajuan: list });
});

router.get('/:id', requireAuth, requireUmkm, (req, res) => {
  const item = db.prepare('SELECT * FROM pembiayaan_requests WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!item) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  res.json({ pengajuan: item });
});

// Verifikasi/keputusan oleh admin kelurahan / pengelola BUMDes
router.put('/:id/status', requireAuth, requireRole('admin'), (req, res) => {
  const { status, catatan_admin } = req.body;
  if (!['diajukan', 'diproses', 'disetujui', 'ditolak', 'cair'].includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }
  const item = db.prepare('SELECT * FROM pembiayaan_requests WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
  db.prepare(`UPDATE pembiayaan_requests SET status = ?, catatan_admin = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, catatan_admin || null, item.id);
  res.json({ pengajuan: db.prepare('SELECT * FROM pembiayaan_requests WHERE id = ?').get(item.id) });
});

module.exports = router;
