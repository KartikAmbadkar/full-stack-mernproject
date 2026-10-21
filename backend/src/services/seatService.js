const crypto = require('crypto');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const { emitSeats } = require('./realtime');

const UNSET_HOLD = { heldBy: '', heldUntil: '', heldToken: '' };

// Rows are split roughly 30% silver, 40% gold, 30% premium (rows A-C, D-G, H-J for a 10 row hall).
function tierFor(rowIndex, rows) {
  const silverEnd = Math.ceil(rows * 0.3);
  const goldEnd = Math.ceil(rows * 0.7);
  return rowIndex < silverEnd ? 'silver' : rowIndex < goldEnd ? 'gold' : 'premium';
}

async function generateSeats(show) {
  const docs = [];
  for (let r = 0; r < show.rows; r++) {
    const row = String.fromCharCode(65 + r);
    const tier = tierFor(r, show.rows);
    for (let n = 1; n <= show.cols; n++) {
      docs.push({ show: show._id, label: row + n, row, number: n, tier, price: show.price[tier] });
    }
  }
  await Seat.insertMany(docs, { ordered: true });
  return docs.length;
}

// Holds seats for a user while they pay. Each seat is claimed with its own conditional update
// (only if it is still available, or its old hold has expired), so two buyers can never get the same seat.
// If any seat is lost, every seat claimed in this attempt is released and the caller gets a 409.
async function holdSeats({ showId, labels, userId, minutes }) {
  const now = new Date();
  const token = crypto.randomBytes(16).toString('hex');
  const until = new Date(now.getTime() + minutes * 60000);

  const result = await Seat.updateMany(
    { show: showId, label: { $in: labels }, $or: [{ status: 'available' }, { status: 'held', heldUntil: { $lt: now } }] },
    { $set: { status: 'held', heldBy: userId, heldUntil: until, heldToken: token } }
  );

  if (result.modifiedCount !== labels.length) {
    await releaseByToken(token);
    throw new ApiError(409, 'Some of those seats were just taken. Please choose different seats');
  }

  const seats = await Seat.find({ heldToken: token }).select('label price tier').lean();
  return { token, until, seats };
}

async function releaseByToken(token) {
  return Seat.updateMany({ heldToken: token, status: 'held' }, { $set: { status: 'available' }, $unset: UNSET_HOLD });
}

// Turns a hold into a sale. Succeeds only if every held seat is still ours and the hold has not run out.
async function confirmHold({ token, bookingId, count }) {
  const result = await Seat.updateMany(
    { heldToken: token, status: 'held', heldUntil: { $gte: new Date() } },
    { $set: { status: 'booked', booking: bookingId }, $unset: UNSET_HOLD }
  );
  return result.modifiedCount === count;
}

// Frees seats that belong to a booking (used on cancellation and on a failed confirmation).
async function releaseByBooking(bookingId) {
  return Seat.updateMany({ booking: bookingId }, { $set: { status: 'available' }, $unset: { ...UNSET_HOLD, booking: '' } });
}

// Frees seats whose hold ran out and marks the matching pending bookings as expired.
// Pass showId to limit the sweep to one show (used before serving a seat map).
async function releaseExpiredHolds(io, showId) {
  const now = new Date();
  const filter = { status: 'held', heldUntil: { $lt: now } };
  if (showId) filter.show = showId;

  const expired = await Seat.find(filter).select('show label').lean();
  if (expired.length) {
    await Seat.updateMany(
      { _id: { $in: expired.map((s) => s._id) }, status: 'held', heldUntil: { $lt: now } },
      { $set: { status: 'available' }, $unset: UNSET_HOLD }
    );
    const byShow = {};
    expired.forEach((s) => {
      const key = String(s.show);
      (byShow[key] = byShow[key] || []).push(s.label);
    });
    Object.keys(byShow).forEach((id) => emitSeats(io, id, byShow[id], 'available'));
  }
  await Booking.updateMany({ status: 'pending', holdExpiresAt: { $lt: now } }, { $set: { status: 'expired' } });
  return expired.length;
}

module.exports = { tierFor, generateSeats, holdSeats, releaseByToken, confirmHold, releaseByBooking, releaseExpiredHolds };
