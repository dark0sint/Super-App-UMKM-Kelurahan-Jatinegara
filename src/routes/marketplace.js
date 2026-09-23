const express = require('express');
const db = require('../db');

const router = express.Router();

// Daftar seluruh UMKM yang sudah mempublikasikan tokonya
router.get('/', (req, res) => {
  const { kategori, q } = req.query;
  let sql = 'SELECT id, business_name, category, address, photo_url, slug FROM umkm_profiles WHERE is_public = 1';
  const params = [];
  if (kategori) { sql += ' AND category = ?'; params.push(kategori); }
  if (q) { sql += ' AND business_name LIKE ?'; params.push(`%${q}%`); }
  sql += ' ORDER BY id DESC';
  const umkmList = db.prepare(sql).all(...params);
  res.json({ total: umkmList.length, umkm: umkmList });
});

// Cari produk unggulan lintas UMKM (untuk pembeli luar kelurahan)
router.get('/produk', (req, res) => {
  const { q, kategori } = req.query;
  let sql = `
    SELECT p.id, p.name, p.category, p.price, p.unit, p.photo_url,
           u.business_name, u.slug AS umkm_slug, u.address
    FROM products p
    JOIN umkm_profiles u ON u.id = p.umkm_id
    WHERE p.is_active = 1 AND u.is_public = 1
  `;
  const params = [];
  if (q) { sql += ' AND p.name LIKE ?'; params.push(`%${q}%`); }
  if (kategori) { sql += ' AND p.category = ?'; params.push(kategori); }
  sql += ' ORDER BY p.id DESC LIMIT 200';
  const produk = db.prepare(sql).all(...params);
  res.json({ total: produk.length, produk });
});

module.exports = router;
