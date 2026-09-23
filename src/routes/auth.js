const express = require('express');
const db = require('../db');
const { randomCode, normalizeWaNumber } = require('../utils/helpers');
const { signToken } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const OTP_DEBUG = String(process.env.OTP_DEBUG_MODE || 'true') === 'true';

// Kirim kode OTP ke nomor WhatsApp (mode simulasi bila belum ada gateway resmi)
router.post('/otp/request', (req, res) => {
  const wa_number = normalizeWaNumber(req.body.wa_number);
  if (!wa_number || wa_number.length < 8) {
    return res.status(400).json({ error: 'Nomor WhatsApp tidak valid.' });
  }
  const code = randomCode(6);
  const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO otp_codes (wa_number, code, expires_at) VALUES (?, ?, ?)').run(wa_number, code, expires_at);

  // TODO produksi: ganti bagian ini dengan panggilan ke gateway WA resmi (mis. Fonnte/Wablas/Qontak)
  // menggunakan process.env.OTP_GATEWAY_URL & OTP_GATEWAY_TOKEN, kirim `code` ke `wa_number`.
  console.log(`[OTP] Kode untuk ${wa_number}: ${code} (berlaku 5 menit)`);

  const payload = { message: 'Kode OTP telah dikirim ke WhatsApp Anda.', wa_number };
  if (OTP_DEBUG) payload.debug_code = code; // hanya aktif saat OTP_DEBUG_MODE=true, matikan saat produksi nyata
  res.json(payload);
});

// Verifikasi OTP -> login jika sudah terdaftar, atau daftar otomatis jika nomor baru
router.post('/otp/verify', (req, res) => {
  const wa_number = normalizeWaNumber(req.body.wa_number);
  const { code, name } = req.body;
  if (!wa_number || !code) return res.status(400).json({ error: 'Nomor WA dan kode OTP wajib diisi.' });

  const otp = db.prepare(`
    SELECT * FROM otp_codes
    WHERE wa_number = ? AND code = ? AND used = 0 AND expires_at > datetime('now')
    ORDER BY id DESC LIMIT 1
  `).get(wa_number, code);

  if (!otp) return res.status(400).json({ error: 'Kode OTP salah atau sudah kedaluwarsa.' });

  db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(otp.id);

  let user = db.prepare('SELECT * FROM users WHERE wa_number = ?').get(wa_number);
  if (!user) {
    const info = db.prepare('INSERT INTO users (wa_number, name, role) VALUES (?, ?, ?)')
      .run(wa_number, name || 'Pelaku UMKM', 'pelaku_umkm');
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  }

  const token = signToken({ uid: user.id, role: user.role });
  const umkm = db.prepare('SELECT * FROM umkm_profiles WHERE user_id = ?').get(user.id) || null;
  res.json({ token, user: { id: user.id, name: user.name, wa_number: user.wa_number, role: user.role }, umkm });
});

// Login sidik jari/biometrik: menyimpan referensi credential WebAuthn dari perangkat pengguna.
// Setelah didaftarkan sekali (butuh OTP), login berikutnya cukup pakai sidik jari/Face ID perangkat
// (proses kriptografi WebAuthn dilakukan di sisi frontend/browser, endpoint ini menyimpan/menghubungkannya).
router.post('/biometric/register', requireAuth, (req, res) => {
  const { credential_id } = req.body;
  if (!credential_id) return res.status(400).json({ error: 'credential_id wajib diisi.' });
  db.prepare('UPDATE users SET webauthn_credential = ? WHERE id = ?').run(credential_id, req.user.id);
  res.json({ message: 'Login sidik jari berhasil diaktifkan untuk akun ini.' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, name: req.user.name, wa_number: req.user.wa_number, role: req.user.role },
    umkm: req.umkm,
  });
});

module.exports = router;
