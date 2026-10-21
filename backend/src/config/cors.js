// In production only the origins listed in CLIENT_ORIGIN may call the API.
// In development any origin is accepted so the frontend can be opened from a file or a local server.
const allowed = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin || process.env.NODE_ENV !== 'production' || allowed.includes(origin)) return callback(null, true);
  const err = new Error('Origin not allowed by CORS');
  err.statusCode = 403;
  return callback(err);
}

module.exports = { corsOrigin };
