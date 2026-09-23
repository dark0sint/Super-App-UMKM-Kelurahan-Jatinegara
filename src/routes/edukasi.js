const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');

const router = express.Router();

// Panduan langkah demi langkah perizinan (bisa diakses tanpa login agar mudah disebarluaskan)
router.get('/perizinan/:jenis', (req, res) => {
  const jenis = req.params.jenis.toUpperCase();
  if (!['NIB', 'HALAL', 'PIRT'].includes(jenis)) return res.status(400).json({ error: 'Jenis perizinan tidak dikenal.' });
  const steps = db.prepare('SELECT * FROM perizinan_panduan WHERE jenis = ? ORDER BY urutan ASC').all(jenis);
  res.json({ jenis, langkah: steps.map(s => ({ ...s, syarat: JSON.parse(s.syarat || '[]') })) });
});

router.get('/perizinan/:jenis/progress', requireAuth, requireUmkm, (req, res) => {
  const jenis = req.params.jenis.toUpperCase();
  const progress = db.prepare('SELECT * FROM perizinan_progress WHERE umkm_id = ? AND jenis = ?').get(req.umkm.id, jenis);
  res.json({ progress: progress ? { ...progress, step_selesai: JSON.parse(progress.step_selesai) } : { jenis, step_selesai: [], status: 'belum_mulai' } });
});

router.put('/perizinan/:jenis/progress', requireAuth, requireUmkm, (req, res) => {
  const jenis = req.params.jenis.toUpperCase();
  const { step_selesai, status } = req.body; // step_selesai: array of urutan yang sudah dicentang
  const totalSteps = db.prepare('SELECT COUNT(*) AS n FROM perizinan_panduan WHERE jenis = ?').get(jenis).n;
  const derivedStatus = status || ((step_selesai || []).length >= totalSteps && totalSteps > 0 ? 'selesai' : (step_selesai || []).length > 0 ? 'proses' : 'belum_mulai');

  const existing = db.prepare('SELECT * FROM perizinan_progress WHERE umkm_id = ? AND jenis = ?').get(req.umkm.id, jenis);
  if (existing) {
    db.prepare(`UPDATE perizinan_progress SET step_selesai = ?, status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(JSON.stringify(step_selesai || []), derivedStatus, existing.id);
  } else {
    db.prepare(`INSERT INTO perizinan_progress (umkm_id, jenis, step_selesai, status) VALUES (?, ?, ?, ?)`)
      .run(req.umkm.id, jenis, JSON.stringify(step_selesai || []), derivedStatus);
  }
  res.json({ message: 'Progres tersimpan.', status: derivedStatus });
});

// Pojok Belajar UMKM — konten ringan (hemat kuota): tips teks, video singkat, artikel
router.get('/materi', (req, res) => {
  const { kategori } = req.query;
  let sql = 'SELECT * FROM edukasi_materi';
  const params = [];
  if (kategori) { sql += ' WHERE kategori = ?'; params.push(kategori); }
  sql += ' ORDER BY id DESC';
  res.json({ materi: db.prepare(sql).all(...params) });
});

module.exports = router;
