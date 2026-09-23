const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');
const { invoiceNumber } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireUmkm);

// Frontend menyimpan aksi (transaksi kasir, catatan keuangan, pergerakan stok) di IndexedDB saat offline,
// lalu mengirim semuanya sekaligus ke sini begitu koneksi internet kembali.
// Setiap item wajib punya client_uuid unik agar tidak tercatat dobel (idempoten) jika sync diulang.
router.post('/batch', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items harus berupa array.' });

  const results = items.map(item => {
    try {
      switch (item.entity) {
        case 'transaksi_keuangan': {
          const p = item.payload;
          if (item.client_uuid) {
            const existing = db.prepare('SELECT * FROM transactions WHERE client_uuid = ?').get(item.client_uuid);
            if (existing) return { client_uuid: item.client_uuid, status: 'duplicate', id: existing.id };
          }
          const info = db.prepare(`
            INSERT INTO transactions (umkm_id, type, category, amount, description, payment_method, client_uuid)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(req.umkm.id, p.type, p.category || null, p.amount, p.description || null, p.payment_method || 'tunai', item.client_uuid || null);
          return { client_uuid: item.client_uuid, status: 'ok', id: info.lastInsertRowid };
        }
        case 'stok_movement': {
          const p = item.payload;
          const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(p.product_id, req.umkm.id);
          if (!product) return { client_uuid: item.client_uuid, status: 'error', error: 'Produk tidak ditemukan' };
          let newQty = product.stock_qty;
          if (p.type === 'masuk') newQty += Number(p.qty);
          else if (p.type === 'keluar') newQty -= Number(p.qty);
          else newQty = Number(p.qty);
          if (newQty < 0) newQty = 0;
          db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, product.id);
          db.prepare('INSERT INTO stock_movements (product_id, type, qty, note) VALUES (?, ?, ?, ?)').run(product.id, p.type, p.qty, p.note || 'Sinkron offline');
          return { client_uuid: item.client_uuid, status: 'ok', id: product.id };
        }
        case 'penjualan': {
          const p = item.payload;
          if (item.client_uuid) {
            const existing = db.prepare('SELECT * FROM sales WHERE client_uuid = ?').get(item.client_uuid);
            if (existing) return { client_uuid: item.client_uuid, status: 'duplicate', id: existing.id };
          }
          let total = 0;
          const resolved = [];
          for (const it of p.items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(it.product_id, req.umkm.id);
            if (!product) throw new Error('Produk tidak ditemukan saat sinkron: ' + it.product_id);
            const subtotal = product.price * it.qty;
            total += subtotal;
            db.prepare('UPDATE products SET stock_qty = MAX(0, stock_qty - ?) WHERE id = ?').run(it.qty, product.id);
            resolved.push({ product_id: product.id, product_name: product.name, qty: it.qty, price: product.price, subtotal });
          }
          const invoice_no = invoiceNumber();
          const saleInfo = db.prepare(`
            INSERT INTO sales (umkm_id, invoice_no, total_amount, payment_method, payment_status, customer_name, client_uuid)
            VALUES (?, ?, ?, ?, 'lunas', ?, ?)
          `).run(req.umkm.id, invoice_no, total, p.payment_method || 'tunai', p.customer_name || null, item.client_uuid || null);
          const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, qty, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)');
          resolved.forEach(it => insertItem.run(saleInfo.lastInsertRowid, it.product_id, it.product_name, it.qty, it.price, it.subtotal));
          db.prepare(`INSERT INTO transactions (umkm_id, type, category, amount, description, payment_method, ref_sale_id) VALUES (?, 'pemasukan', 'Penjualan', ?, ?, ?, ?)`)
            .run(req.umkm.id, total, `Penjualan ${invoice_no} (sinkron offline)`, p.payment_method || 'tunai', saleInfo.lastInsertRowid);
          return { client_uuid: item.client_uuid, status: 'ok', id: saleInfo.lastInsertRowid, invoice_no };
        }
        default:
          return { client_uuid: item.client_uuid, status: 'error', error: 'entity tidak dikenal' };
      }
    } catch (e) {
      return { client_uuid: item.client_uuid, status: 'error', error: e.message };
    }
  });

  res.json({ results, server_time: new Date().toISOString() });
});

router.get('/status', (req, res) => {
  res.json({ server_time: new Date().toISOString() });
});

module.exports = router;
