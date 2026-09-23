const crypto = require('crypto');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function randomCode(len = 6) {
  const digits = '0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += digits[crypto.randomInt(0, digits.length)];
  return out;
}

function invoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

function normalizeWaNumber(input) {
  if (!input) return null;
  let n = String(input).replace(/[^0-9]/g, '');
  if (n.startsWith('0')) n = '62' + n.slice(1);
  if (!n.startsWith('62')) n = '62' + n;
  return n;
}

function rupiah(n) {
  const num = Number(n) || 0;
  return 'Rp' + num.toLocaleString('id-ID');
}

module.exports = { slugify, randomCode, invoiceNumber, normalizeWaNumber, rupiah };
