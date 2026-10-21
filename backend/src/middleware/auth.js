const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Requires a valid Bearer token. Loads the user fresh so deactivated accounts lose access immediately.
const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw new ApiError(401, 'Please sign in to continue');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new ApiError(401, 'Your session has expired. Please sign in again');
  }

  const user = await User.findById(payload.id);
  if (!user || !user.active) throw new ApiError(401, 'This account is no longer available');
  req.user = user;
  next();
});

// Role gate: restrictTo('admin') after protect.
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to do this'));
  next();
};

module.exports = { protect, restrictTo };
