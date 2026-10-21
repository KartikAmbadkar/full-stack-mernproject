const Notification = require('../models/Notification');
const logger = require('../utils/logger');

// A failed notification must never break a booking, so errors are logged and swallowed.
async function notify(userId, { type = 'info', title, message, booking }) {
  try {
    await Notification.create({ user: userId, type, title, message, booking });
  } catch (err) {
    logger.warn('Could not save notification: ' + err.message);
  }
}

module.exports = { notify };
