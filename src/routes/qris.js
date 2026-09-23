const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');

const router = express.Router();

// Menyusun payload QRIS statis sederhana ala EMV QR (versi ringkas untuk simulasi).
// PENTING: untuk transaksi nyata, payload ini WAJIB diganti dengan payload resmi dari
// PJSP/bank/dompet digital yang menaungi merchant (mis. lewat API Midtrans, Xendit, atau bank penyalur QRIS desa),
// agar dana benar-benar masuk ke rekening/dompet digital pelaku UMKM.
function buildQrisPayload({ merchantName, city, amount, invoiceNo }) {
  return [
    '00020101021226',
    `MERCHANT:${merchantName}`,
    `CITY:${city}`,
    `AMOUNT:${amount}`,
    `REF:${invoiceNo}`,
    '5303360',
    `5406${amount}`,
    '6304FFFF',
  ].join('|');
}

router.post('/generate', requireAuth, requireUmkm, async (req, res) => {
  const { sale_id } = req.body;
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND umkm_id = ?').get(sale_id, req.umkm.id);
  if (!sale) return res.status(404).json({ error: 'Transaksi penjualan tidak ditemukan.' });
  if (sale.payment_method !== 'qris') return res.status(400).json({ error: 'Transaksi ini bukan metode QRIS.' });

  const payload = buildQrisPayload({
    merchantName: req.umkm.business_name,
    city: 'JAKARTA TIMUR',
    amount: sale.total_amount,
    invoiceNo: sale.invoice_no,
  });

  const qrImage = await QRCode.toDataURL(payload, { margin: 1, width: 320 });
  const expires_at = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const info = db.prepare(`
    INSERT INTO qris_payments (sale_id, qris_payload, qr_image, status, expires_at)
    VALUES (?, ?, ?, 'pending', ?)
  `).run(sale.id, payload, qrImage, expires_at);

  res.status(201).json({
    qris_payment_id: info.lastInsertRowid,
    qr_image: qrImage,
    expires_at,
    cek_status_url: `/api/qris/status/${info.lastInsertRowid}`,
  });
});

router.get('/status/:id', requireAuth, (req, res) => {
  const q = db.prepare('SELECT * FROM qris_payments WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Data pembayaran tidak ditemukan.' });
  res.json({ status: q.status, paid_at: q.paid_at, expires_at: q.expires_at });
});

// Simulasi callback dari payment gateway/PJSP saat pembayaran QRIS berhasil.
// Di produksi, endpoint ini diarahkan sebagai webhook resmi dari penyedia QRIS yang dipakai.
router.post('/webhook', (req, res) => {
  const { qris_payment_id, status } = req.body;
  const q = db.prepare('SELECT * FROM qris_payments WHERE id = ?').get(qris_payment_id);
  if (!q) return res.status(404).json({ error: 'Data pembayaran tidak ditemukan.' });

  if (status === 'paid' && q.status !== 'paid') {
    const paid_at = new Date().toISOString();
    db.prepare('UPDATE qris_payments SET status = ?, paid_at = ? WHERE id = ?').run('paid', paid_at, q.id);

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(q.sale_id);
    db.prepare('UPDATE sales SET payment_status = ? WHERE id = ?').run('lunas', sale.id);
    db.prepare(`
      INSERT INTO transactions (umkm_id, type, category, amount, description, payment_method, ref_sale_id)
      VALUES (?, 'pemasukan', 'Penjualan', ?, ?, 'qris', ?)
    `).run(sale.umkm_id, sale.total_amount, `Penjualan ${sale.invoice_no} (QRIS)`, sale.id);
  } else {
    db.prepare('UPDATE qris_payments SET status = ? WHERE id = ?').run(status, q.id);
  }

  res.json({ message: 'Status pembayaran diperbarui.' });
});

module.exports = router;
