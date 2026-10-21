const rateLimit = require('express-rate-limit');

const json = (message) => (req, res) => res.status(429).json({ success: false, message });

// General limit for every /api route.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many requests. Please slow down and try again in a few minutes')
});

// Stricter limit for sign-in and registration to slow down password guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many sign-in attempts. Please try again in 15 minutes')
});

// Booking and payment actions.
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many booking attempts. Please wait a few minutes')
});

module.exports = { apiLimiter, authLimiter, bookingLimiter };
