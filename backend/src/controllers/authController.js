const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// Anyone can register, but only as a customer. Admin accounts are created by the seed script or by another admin.
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  const user = await User.create({ name, email, password });
  res.status(201).json({ success: true, token: signToken(user), user });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  const ok = user && user.active && (await user.comparePassword(password));
  if (!ok) throw new ApiError(401, 'Incorrect email or password');
  res.json({ success: true, token: signToken(user), user });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: req.user });
});
