const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');
const { invoiceNumber, rupiah } = require('../utils/helpers');

const router = express.Router();

// Buat transaksi penjualan baru (mendukung offline: kirim client_uuid agar tidak dobel saat sinkron)
router.post('/transaksi', requireAuth, requireUmkm, (req, res) => {
  const { items, payment_method, customer_name, client_uuid } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Minimal 1 produk harus ada dalam transaksi.' });
  }

  if (client_uuid) {
    const existing = db.prepare('SELECT * FROM sales WHERE client_uuid = ?').get(client_uuid);
    if (existing) {
      const existingItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(existing.id);
      return res.status(200).json({ sale: existing, items: existingItems, duplicate: true });
    }
  }

  const umkmId = req.umkm.id;
  const runSale = db.transaction(() => {
    let total = 0;
    let totalModal = 0;
    const resolvedItems = [];

    for (const it of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(it.product_id, umkmId);
      if (!product) throw new Error(`Produk id ${it.product_id} tidak ditemukan.`);
      if (product.stock_qty < it.qty) throw new Error(`Stok ${product.name} tidak mencukupi (sisa ${product.stock_qty}).`);

      const subtotal = product.price * it.qty;
      total += subtotal;
      totalModal += (product.cost_price || 0) * it.qty;

      db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(it.qty, product.id);
      db.prepare('INSERT INTO stock_movements (product_id, type, qty, note) VALUES (?, ?, ?, ?)')
        .run(product.id, 'keluar', it.qty, 'Penjualan kasir');

      resolvedItems.push({ product_id: product.id, product_name: product.name, qty: it.qty, price: product.price, cost_price: product.cost_price || 0, subtotal });
    }

    const invoice_no = invoiceNumber();
    const payment_status = payment_method === 'qris' ? 'menunggu' : 'lunas';
    const saleInfo = db.prepare(`
      INSERT INTO sales (umkm_id, invoice_no, total_amount, total_modal, payment_method, payment_status, customer_name, client_uuid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(umkmId, invoice_no, total, totalModal, payment_method || 'tunai', payment_status, customer_name || null, client_uuid || null);

    const saleId = saleInfo.lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO sale_items (sale_id, product_id, product_name, qty, price, cost_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    resolvedItems.forEach(it => insertItem.run(saleId, it.product_id, it.product_name, it.qty, it.price, it.cost_price, it.subtotal));

    // Catat otomatis ke pencatatan keuangan (pemasukan) — hanya jika sudah lunas (tunai). QRIS dicatat saat webhook paid.
    if (payment_status === 'lunas') {
      db.prepare(`
        INSERT INTO transactions (umkm_id, type, category, amount, description, payment_method, ref_sale_id)
        VALUES (?, 'pemasukan', 'Penjualan', ?, ?, ?, ?)
      `).run(umkmId, total, `Penjualan ${invoice_no}`, payment_method || 'tunai', saleId);
    }

    return { saleId, invoice_no, total, payment_status, resolvedItems };
  });

  let result;
  try {
    result = runSale();
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.saleId);
  res.status(201).json({ sale, items: result.resolvedItems, struk_digital_url: `/struk/${sale.id}` });
});

router.get('/transaksi', requireAuth, requireUmkm, (req, res) => {
  const sales = db.prepare('SELECT * FROM sales WHERE umkm_id = ? ORDER BY id DESC LIMIT 200').all(req.umkm.id);
  res.json({ sales });
});

router.get('/transaksi/:id', requireAuth, requireUmkm, (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!sale) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  res.json({ sale, items });
});

// Struk digital publik — bisa dibuka siapa saja lewat tautan (tanpa perlu login), untuk dibagikan ke pembeli
router.get('/struk/:id/public', (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, u.business_name, u.address FROM sales s
    JOIN umkm_profiles u ON u.id = s.umkm_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Struk tidak ditemukan.' });
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  res.json({
    toko: sale.business_name,
    alamat: sale.address,
    invoice_no: sale.invoice_no,
    tanggal: sale.created_at,
    pembayaran: sale.payment_method,
    status: sale.payment_status,
    pelanggan: sale.customer_name,
    items: items.map(it => ({ nama: it.product_name, qty: it.qty, harga: it.price, harga_format: rupiah(it.price), subtotal: it.subtotal, subtotal_format: rupiah(it.subtotal) })),
    total: sale.total_amount,
    total_format: rupiah(sale.total_amount),
  });
});

module.exports = router;
