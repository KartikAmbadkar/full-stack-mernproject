const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// One place that turns every failure into the same JSON shape: { success:false, message, details? }
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {
    status = 422;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    const fields = Object.keys(err.keyValue || {});
    message = fields.length ? `${fields.join(', ')} is already in use` : 'That value is already in use';
  } else if (err.name === 'MulterError') {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Poster must be 2 MB or smaller' : err.message;
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body is too large';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Request body is not valid JSON';
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${err.stack || err.message}`);
    if (process.env.NODE_ENV === 'production') message = 'Something went wrong. Please try again';
  }

  res.status(status).json({ success: false, message, ...(details ? { details } : {}) });
}

module.exports = { notFound, errorHandler };
