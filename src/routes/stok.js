const express = require('express');
const db = require('../db');
const { requireAuth, requireUmkm } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireUmkm);

router.get('/produk', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE umkm_id = ? ORDER BY id DESC').all(req.umkm.id);
  res.json({ products });
});

router.post('/produk', (req, res) => {
  const { name, category, price, cost_price, stock_qty, min_stock, unit, photo_url } = req.body;
  if (!name || price === undefined) return res.status(400).json({ error: 'Nama dan harga jual produk wajib diisi.' });
  const info = db.prepare(`
    INSERT INTO products (umkm_id, name, category, price, cost_price, stock_qty, min_stock, unit, photo_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.umkm.id, name, category || null, price, cost_price || 0, stock_qty || 0, min_stock ?? 5, unit || 'pcs', photo_url || null);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ product });
});

router.put('/produk/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const fields = ['name', 'category', 'price', 'cost_price', 'min_stock', 'unit', 'photo_url', 'is_active'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (setClause) {
    db.prepare(`UPDATE products SET ${setClause} WHERE id = ?`).run(...Object.values(updates), product.id);
  }
  res.json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(product.id) });
});

router.delete('/produk/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(product.id);
  res.json({ message: 'Produk dinonaktifkan.' });
});

// Catat pergerakan stok (barang masuk / keluar / penyesuaian manual)
router.post('/produk/:id/movement', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const { type, qty, note } = req.body; // type: masuk | keluar | penyesuaian
  if (!['masuk', 'keluar', 'penyesuaian'].includes(type) || !qty) {
    return res.status(400).json({ error: 'Jenis pergerakan dan jumlah wajib diisi dengan benar.' });
  }
  let newQty = product.stock_qty;
  if (type === 'masuk') newQty += Number(qty);
  else if (type === 'keluar') newQty -= Number(qty);
  else newQty = Number(qty); // penyesuaian = set langsung ke jumlah ini

  if (newQty < 0) return res.status(400).json({ error: 'Stok tidak boleh menjadi negatif.' });

  db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, product.id);
  db.prepare('INSERT INTO stock_movements (product_id, type, qty, note) VALUES (?, ?, ?, ?)').run(product.id, type, qty, note || null);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
  res.json({
    product: updated,
    low_stock_warning: updated.stock_qty <= updated.min_stock,
  });
});

router.get('/produk/:id/riwayat', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND umkm_id = ?').get(req.params.id, req.umkm.id);
  if (!product) return res.status(404).json({ error: 'Produk tidak ditemukan.' });
  const riwayat = db.prepare('SELECT * FROM stock_movements WHERE product_id = ? ORDER BY id DESC LIMIT 100').all(product.id);
  res.json({ riwayat });
});

// Notifikasi produk yang stoknya sudah menipis (stock_qty <= min_stock)
router.get('/menipis', (req, res) => {
  const list = db.prepare('SELECT * FROM products WHERE umkm_id = ? AND is_active = 1 AND stock_qty <= min_stock ORDER BY stock_qty ASC').all(req.umkm.id);
  res.json({ total: list.length, produk: list });
});

module.exports = router;
