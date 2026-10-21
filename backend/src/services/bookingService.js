const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const seatService = require('./seatService');
const { emitSeats } = require('./realtime');
const { notify } = require('./notify');

// Cancels one booking: frees its seats, refunds a successful payment, tells the user.
// booking must have been loaded with .select('+holdToken') so pending holds can be released.
async function cancelBooking(booking, { io, reason, type = 'booking_cancelled', title = 'Booking cancelled' } = {}) {
  const wasConfirmed = booking.status === 'confirmed';

  if (wasConfirmed) {
    await seatService.releaseByBooking(booking._id);
    await Payment.updateMany({ booking: booking._id, status: 'success' }, { $set: { status: 'refunded', refundedAt: new Date() } });
  } else if (booking.status === 'pending' && booking.holdToken) {
    await seatService.releaseByToken(booking.holdToken);
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  if (reason) booking.cancelReason = reason;
  await booking.save();

  emitSeats(io, booking.show, booking.seats, 'available');

  const refundNote = wasConfirmed ? ` A refund of ₹${booking.total} will go back to your original payment method.` : '';
  await notify(booking.user, {
    type,
    title,
    message: `Booking ${booking.bookingCode} was cancelled${reason ? ` (${reason})` : ''}.${refundNote}`,
    booking: booking._id
  });
  return booking;
}

async function cancelBookingsForShow(show, io) {
  const bookings = await Booking.find({ show: show._id, status: { $in: ['confirmed', 'pending'] } }).select('+holdToken');
  for (const b of bookings) {
    // eslint-disable-next-line no-await-in-loop
    await cancelBooking(b, { io, reason: 'the show was cancelled', type: 'show_cancelled', title: 'Show cancelled' });
  }
  return bookings.length;
}

module.exports = { cancelBooking, cancelBookingsForShow };
