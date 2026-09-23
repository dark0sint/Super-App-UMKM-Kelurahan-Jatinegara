const express = require('express');
const db = require('../db');
const { slugify } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Buat / perbarui profil usaha (dipakai juga sebagai onboarding awal)
router.put('/profil', requireAuth, (req, res) => {
  const { business_name, category, address, description, photo_url, is_public, bank_account, ewallet_account } = req.body;
  if (!business_name) return res.status(400).json({ error: 'Nama usaha wajib diisi.' });

  let umkm = db.prepare('SELECT * FROM umkm_profiles WHERE user_id = ?').get(req.user.id);

  if (!umkm) {
    let slug = slugify(business_name);
    const exists = db.prepare('SELECT id FROM umkm_profiles WHERE slug = ?').get(slug);
    if (exists) slug = `${slug}-${req.user.id}`;
    const info = db.prepare(`
      INSERT INTO umkm_profiles (user_id, business_name, category, address, description, photo_url, slug, is_public, bank_account, ewallet_account)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, business_name, category || null, address || null, description || null, photo_url || null, slug, is_public ? 1 : 0, bank_account || null, ewallet_account || null);
    umkm = db.prepare('SELECT * FROM umkm_profiles WHERE id = ?').get(info.lastInsertRowid);
  } else {
    db.prepare(`
      UPDATE umkm_profiles SET business_name=?, category=?, address=?, description=?, photo_url=?, is_public=?, bank_account=?, ewallet_account=?
      WHERE id = ?
    `).run(business_name, category || null, address || null, description || null, photo_url || null, is_public ? 1 : 0, bank_account || null, ewallet_account || null, umkm.id);
    umkm = db.prepare('SELECT * FROM umkm_profiles WHERE id = ?').get(umkm.id);
  }
  res.json({ umkm, storefront_url: `/toko/${umkm.slug}` });
});

router.get('/saya', requireAuth, (req, res) => {
  if (!req.umkm) return res.json({ umkm: null, products: [] });
  const products = db.prepare('SELECT * FROM products WHERE umkm_id = ? ORDER BY id DESC').all(req.umkm.id);
  res.json({ umkm: req.umkm, storefront_url: `/toko/${req.umkm.slug}`, products });
});

// Storefront publik (tautan yang bisa dibagikan ke WhatsApp/media sosial) — tidak butuh login
router.get('/publik/:slug', (req, res) => {
  const umkm = db.prepare('SELECT * FROM umkm_profiles WHERE slug = ? AND is_public = 1').get(req.params.slug);
  if (!umkm) return res.status(404).json({ error: 'Toko tidak ditemukan atau belum dipublikasikan.' });
  const products = db.prepare('SELECT id, name, category, price, unit, photo_url, stock_qty FROM products WHERE umkm_id = ? AND is_active = 1 ORDER BY id DESC').all(umkm.id);
  res.json({
    umkm: {
      business_name: umkm.business_name,
      category: umkm.category,
      address: umkm.address,
      description: umkm.description,
      photo_url: umkm.photo_url,
    },
    products,
  });
});

module.exports = router;
