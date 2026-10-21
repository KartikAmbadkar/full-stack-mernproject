// Lets controllers be async functions without try/catch: rejections go to the central error handler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
