const crypto = require('crypto');

const tzOffset = () => Number(process.env.TZ_OFFSET_MINUTES ?? 330);

// Start and end (UTC Dates) of a calendar day in the cinema's time zone. dateStr is YYYY-MM-DD.
function dayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - tzOffset() * 60000);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

// The calendar date (YYYY-MM-DD) in the cinema's time zone.
function localDateKey(date = new Date()) {
  return new Date(date.getTime() + tzOffset() * 60000).toISOString().slice(0, 10);
}

// A moment on a cinema-local date, returned as a UTC Date.
function localTime(dateStr, hh, mm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - tzOffset() * 60000);
}

function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
  return { page, limit, skip: (page - 1) * limit };
}

function pagination(page, limit, total) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}

function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function randomCode(prefix, length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return prefix + out;
}

module.exports = { dayRange, localDateKey, localTime, paginate, pagination, pick, escapeRegex, randomCode, tzOffset };
