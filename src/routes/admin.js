const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/umkm', (req, res) => {
  const list = db.prepare(`
    SELECT u.*, us.name AS pemilik, us.wa_number
    FROM umkm_profiles u JOIN users us ON us.id = u.user_id
    ORDER BY u.id DESC
  `).all();
  res.json({ umkm: list });
});

router.get('/pembiayaan', (req, res) => {
  const list = db.prepare(`
    SELECT p.*, u.business_name FROM pembiayaan_requests p
    JOIN umkm_profiles u ON u.id = p.umkm_id
    ORDER BY p.id DESC
  `).all();
  res.json({ pengajuan: list });
});

router.get('/ringkasan', (req, res) => {
  const totalUmkm = db.prepare('SELECT COUNT(*) AS n FROM umkm_profiles').get().n;
  const totalPublik = db.prepare('SELECT COUNT(*) AS n FROM umkm_profiles WHERE is_public = 1').get().n;
  const totalOmzet = db.prepare('SELECT SUM(total_amount) AS s FROM sales').get().s || 0;
  const totalPengajuanAktif = db.prepare(`SELECT COUNT(*) AS n FROM pembiayaan_requests WHERE status IN ('diajukan','diproses')`).get().n;
  res.json({ totalUmkm, totalPublik, totalOmzet, totalPengajuanAktif });
});

module.exports = router;
