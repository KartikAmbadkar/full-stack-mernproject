const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Put after a list of express-validator checks. Fails with 422 and a per-field message list.
module.exports = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, details[0].message, details));
};
