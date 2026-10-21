const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, pagination } = require('../utils/helpers');
const seatService = require('../services/seatService');
const paymentService = require('../services/paymentService');
const { emitSeats } = require('../services/realtime');
const { notify } = require('../services/notify');

// POST /api/payments  { bookingId, method: "upi"|"card"|"netbanking", simulate?: "success"|"failure" }
exports.pay = asyncHandler(async (req, res) => {
  const { bookingId, method, simulate } = req.body;
  const io = req.app.get('io');

  const booking = await Booking.findById(bookingId).select('+holdToken');
  if (!booking || String(booking.user) !== String(req.user._id)) throw new ApiError(404, 'Booking not found');
  if (booking.status !== 'pending') throw new ApiError(400, `This booking is ${booking.status} and cannot be paid`);

  if (booking.holdExpiresAt <= new Date()) {
    await seatService.releaseByToken(booking.holdToken);
    booking.status = 'expired';
    await booking.save();
    emitSeats(io, booking.show, booking.seats, 'available');
    throw new ApiError(410, 'Your seat hold has expired. Please pick your seats again');
  }

  const result = await paymentService.charge({ amount: booking.total, method, simulate });

  // Failed payment: record it, release the seats, and let the user try again.
  if (!result.ok) {
    await Payment.create({ booking: booking._id, user: req.user._id, amount: booking.total, method, status: 'failed', failureReason: result.reason });
    await seatService.releaseByToken(booking.holdToken);
    booking.status = 'failed';
    await booking.save();
    emitSeats(io, booking.show, booking.seats, 'available');
    await notify(req.user._id, { type: 'payment_failed', title: 'Payment failed', message: `Payment for booking ${booking.bookingCode} did not go through. Your seats were released.`, booking: booking._id });
    throw new ApiError(402, result.reason || 'Payment failed');
  }

  // Successful payment: turn the hold into a sale. If the hold was lost in the meantime, nothing is kept.
  const confirmed = await seatService.confirmHold({ token: booking.holdToken, bookingId: booking._id, count: booking.seats.length });
  if (!confirmed) {
    await seatService.releaseByBooking(booking._id);
    await seatService.releaseByToken(booking.holdToken);
    await Payment.create({ booking: booking._id, user: req.user._id, amount: booking.total, method, status: 'refunded', transactionId: result.transactionId, failureReason: 'Seats were no longer held', refundedAt: new Date() });
    booking.status = 'expired';
    await booking.save();
    emitSeats(io, booking.show, booking.seats, 'available');
    throw new ApiError(409, 'Your seats were released before payment finished. You have not been charged');
  }

  const payment = await Payment.create({ booking: booking._id, user: req.user._id, amount: booking.total, method, status: 'success', transactionId: result.transactionId });
  booking.status = 'confirmed';
  booking.payment = payment._id;
  booking.paidAt = new Date();
  booking.holdExpiresAt = undefined;
  booking.holdToken = undefined;
  await booking.save();

  emitSeats(io, booking.show, booking.seats, 'booked');
  await notify(req.user._id, { type: 'booking_confirmed', title: 'Booking confirmed', message: `Booking ${booking.bookingCode} is confirmed. Seats ${booking.seats.join(', ')}.`, booking: booking._id });

  res.status(201).json({ success: true, data: { booking: booking.toObject(), payment } });
});

exports.mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = { user: req.user._id };
  const [data, total] = await Promise.all([
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('booking', 'bookingCode seats showTime').lean(),
    Payment.countDocuments(filter)
  ]);
  res.json({ success: true, data, pagination: pagination(page, limit, total) });
});
