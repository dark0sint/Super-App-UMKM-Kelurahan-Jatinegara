const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireUmkm);

// Catat pemasukan/pengeluaran manual (di luar transaksi kasir yang sudah otomatis tercatat)
router.post('/transaksi', (req, res) => {
  const { type, category, amount, description, payment_method, client_uuid } = req.body;
  if (!['pemasukan', 'pengeluaran'].includes(type) || !amount) {
    return res.status(400).json({ error: 'Jenis (pemasukan/pengeluaran) dan jumlah wajib diisi.' });
  }

  // Idempotensi untuk mendukung mode offline: jika client_uuid sudah pernah dikirim, kembalikan data lama
  if (client_uuid) {
    const existing = db.prepare('SELECT * FROM transactions WHERE client_uuid = ?').get(client_uuid);
    if (existing) return res.status(200).json({ transaksi: existing, duplicate: true });
  }

  const info = db.prepare(`
    INSERT INTO transactions (umkm_id, type, category, amount, description, payment_method, client_uuid)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.umkm.id, type, category || null, amount, description || null, payment_method || 'tunai', client_uuid || null);

  const transaksi = db.prepare('SELECT * FROM transactions WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ transaksi });
});

router.get('/transaksi', (req, res) => {
  const { dari, sampai, type } = req.query;
  let sql = 'SELECT * FROM transactions WHERE umkm_id = ?';
  const params = [req.umkm.id];
  if (dari) { sql += ' AND date(created_at) >= date(?)'; params.push(dari); }
  if (sampai) { sql += ' AND date(created_at) <= date(?)'; params.push(sampai); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  sql += ' ORDER BY id DESC LIMIT 500';
  res.json({ transaksi: db.prepare(sql).all(...params) });
});

router.delete('/transaksi/:id', (req, res) => {
  const t = db.prepare('SELECT * FROM transactions WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!t) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
  if (t.ref_sale_id) return res.status(400).json({ error: 'Transaksi dari kasir tidak bisa dihapus manual, batalkan lewat riwayat kasir.' });
  db.prepare('DELETE FROM transactions WHERE id = ?').run(t.id);
  res.json({ message: 'Transaksi dihapus.' });
});

// Ringkasan untung-rugi otomatis — tanpa perlu tahu rumus akuntansi
router.get('/ringkasan', (req, res) => {
  const period = req.query.period === 'bulanan' ? 'bulanan' : 'harian';
  const dateExpr = period === 'bulanan' ? "strftime('%Y-%m', created_at)" : "date(created_at)";

  const rows = db.prepare(`
    SELECT ${dateExpr} AS periode,
           SUM(CASE WHEN type = 'pemasukan' THEN amount ELSE 0 END) AS total_pemasukan,
           SUM(CASE WHEN type = 'pengeluaran' THEN amount ELSE 0 END) AS total_pengeluaran
    FROM transactions
    WHERE umkm_id = ?
    GROUP BY periode
    ORDER BY periode DESC
    LIMIT 30
  `).all(req.umkm.id);

  const hasil = rows.map(r => ({
    periode: r.periode,
    total_pemasukan: r.total_pemasukan || 0,
    total_pengeluaran: r.total_pengeluaran || 0,
    laba_rugi: (r.total_pemasukan || 0) - (r.total_pengeluaran || 0),
  }));

  const totalKeseluruhan = db.prepare(`
    SELECT SUM(CASE WHEN type = 'pemasukan' THEN amount ELSE 0 END) AS masuk,
           SUM(CASE WHEN type = 'pengeluaran' THEN amount ELSE 0 END) AS keluar
    FROM transactions WHERE umkm_id = ?
  `).get(req.umkm.id);

  res.json({
    period,
    rekap: hasil,
    total_pemasukan: totalKeseluruhan.masuk || 0,
    total_pengeluaran: totalKeseluruhan.keluar || 0,
    laba_rugi_total: (totalKeseluruhan.masuk || 0) - (totalKeseluruhan.keluar || 0),
    kesimpulan: ((totalKeseluruhan.masuk || 0) - (totalKeseluruhan.keluar || 0)) >= 0 ? 'untung' : 'rugi',
  });
});

module.exports = router;
