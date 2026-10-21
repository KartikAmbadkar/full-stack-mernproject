const Booking = require('../models/Booking');
const Show = require('../models/Show');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, pagination, randomCode } = require('../utils/helpers');
const seatService = require('../services/seatService');
const bookingService = require('../services/bookingService');
const { emitSeats } = require('../services/realtime');

const POPULATE = [
  { path: 'movie', select: 'title poster genre language duration' },
  { path: 'theatre', select: 'name city' },
  { path: 'show', select: 'screen startTime' }
];

// POST /api/bookings  { showId, seats: ["F5","F6"] }
// Holds the seats for HOLD_MINUTES and returns a pending booking. Payment turns it into a confirmed one.
exports.create = asyncHandler(async (req, res) => {
  const { showId } = req.body;
  const labels = [...new Set(req.body.seats.map((s) => String(s).toUpperCase()))];

  const max = Number(process.env.MAX_SEATS || 8);
  if (labels.length > max) throw new ApiError(400, `You can book up to ${max} seats at a time`);

  const show = await Show.findById(showId);
  if (!show || show.status !== 'active') throw new ApiError(404, 'This show is not available');
  if (show.startTime <= new Date()) throw new ApiError(400, 'This show has already started');

  const minutes = Number(process.env.HOLD_MINUTES || 7);
  const hold = await seatService.holdSeats({ showId: show._id, labels, userId: req.user._id, minutes });

  try {
    const subtotal = hold.seats.reduce((sum, s) => sum + s.price, 0);
    const fee = labels.length * Number(process.env.BOOKING_FEE || 20);
    const booking = await Booking.create({
      bookingCode: randomCode('IM'),
      user: req.user._id,
      show: show._id,
      movie: show.movie,
      theatre: show.theatre,
      showTime: show.startTime,
      seats: hold.seats.map((s) => s.label).sort(),
      subtotal,
      fee,
      total: subtotal + fee,
      status: 'pending',
      holdExpiresAt: hold.until,
      holdToken: hold.token
    });
    emitSeats(req.app.get('io'), show._id, booking.seats, 'held');
    const out = booking.toObject();
    delete out.holdToken;
    res.status(201).json({ success: true, data: out });
  } catch (err) {
    await seatService.releaseByToken(hold.token);
    throw err;
  }
});

// GET /api/bookings/mine?type=upcoming|past|all&page=&limit=
exports.mine = asyncHandler(async (req, res) => {
  const { type = 'all' } = req.query;
  const { page, limit, skip } = paginate(req.query);
  const now = new Date();

  const filter = { user: req.user._id };
  if (type === 'upcoming') {
    filter.status = 'confirmed';
    filter.showTime = { $gte: now };
  } else if (type === 'past') {
    filter.$or = [{ status: { $in: ['cancelled', 'failed', 'expired'] } }, { status: 'confirmed', showTime: { $lt: now } }];
  } else {
    filter.status = { $in: ['confirmed', 'cancelled', 'pending'] };
  }

  const sort = type === 'upcoming' ? { showTime: 1 } : { createdAt: -1 };
  const [data, total] = await Promise.all([
    Booking.find(filter).sort(sort).skip(skip).limit(limit).populate(POPULATE).lean(),
    Booking.countDocuments(filter)
  ]);
  res.json({ success: true, data, pagination: pagination(page, limit, total) });
});

exports.get = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate(POPULATE).populate('payment', 'method status transactionId').lean();
  if (!booking || (String(booking.user) !== String(req.user._id) && req.user.role !== 'admin')) throw new ApiError(404, 'Booking not found');
  res.json({ success: true, data: booking });
});

// POST /api/bookings/:id/cancel
exports.cancel = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id).select('+holdToken');
  const isOwner = booking && String(booking.user) === String(req.user._id);
  if (!booking || (!isOwner && req.user.role !== 'admin')) throw new ApiError(404, 'Booking not found');
  if (!['confirmed', 'pending'].includes(booking.status)) throw new ApiError(400, `This booking is already ${booking.status}`);

  if (booking.status === 'confirmed' && req.user.role !== 'admin') {
    const cutoff = Number(process.env.CANCEL_CUTOFF_MINUTES || 60);
    if (booking.showTime.getTime() - Date.now() < cutoff * 60000) {
      throw new ApiError(400, `Bookings can be cancelled up to ${cutoff} minutes before the show starts`);
    }
  }

  await bookingService.cancelBooking(booking, { io: req.app.get('io'), reason: isOwner ? 'cancelled by you' : 'cancelled by an administrator' });
  const out = booking.toObject();
  delete out.holdToken;
  res.json({ success: true, message: 'Booking cancelled', data: out });
});
