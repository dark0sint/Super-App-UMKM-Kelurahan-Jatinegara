const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'ubah-secret-ini-di-file-env';
const EXPIRES_IN = '30d'; // token berumur panjang karena login tanpa password (WA OTP) jarang diulang

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
