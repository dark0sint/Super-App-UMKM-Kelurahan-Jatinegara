const db = require('../db');
const { verifyToken } = require('../utils/jwt');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
  try {
    const payload = verifyToken(token);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang.' });
    req.user = user;
    req.umkm = db.prepare('SELECT * FROM umkm_profiles WHERE user_id = ?').get(user.id) || null;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesi kedaluwarsa, silakan login ulang.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki akses ke fitur ini.' });
    }
    next();
  };
}

// Memastikan pengguna sudah punya profil UMKM sebelum mengakses fitur operasional usaha
function requireUmkm(req, res, next) {
  if (!req.umkm) {
    return res.status(400).json({ error: 'Lengkapi profil usaha Anda terlebih dahulu di menu Katalog.' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireUmkm };
