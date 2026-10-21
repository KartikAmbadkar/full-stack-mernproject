// Removes MongoDB operator keys ("$gt", "$where") and dotted keys from user input
// so a request body or query string cannot inject query operators.
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach((key) => {
      if (key.startsWith('$') || key.includes('.')) return;
      out[key] = clean(value[key]);
    });
    return out;
  }
  return value;
}

module.exports = (req, res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) {
    const q = clean(req.query);
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, q);
  }
  if (req.params) req.params = clean(req.params);
  next();
};
