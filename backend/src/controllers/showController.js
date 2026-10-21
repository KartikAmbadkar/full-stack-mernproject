const Show = require('../models/Show');
const Seat = require('../models/Seat');
const Movie = require('../models/Movie');
const Theatre = require('../models/Theatre');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dayRange, paginate, pagination, escapeRegex } = require('../utils/helpers');
const showService = require('../services/showService');
const seatService = require('../services/seatService');
const bookingService = require('../services/bookingService');

// GET /api/shows?movie=&theatre=&city=&date=YYYY-MM-DD
exports.list = asyncHandler(async (req, res) => {
  const { movie, theatre, city, date } = req.query;
  const { page, limit, skip } = paginate({ ...req.query, limit: req.query.limit || 50 });

  const filter = { status: 'active' };
  if (movie) filter.movie = movie;
  if (theatre) filter.theatre = theatre;
  if (date) {
    const { start, end } = dayRange(date);
    filter.startTime = { $gte: new Date(Math.max(start.getTime(), Date.now())), $lt: end };
  } else {
    filter.startTime = { $gte: new Date() };
  }
  if (city) {
    const ids = await Theatre.find({ city: new RegExp(`^${escapeRegex(city)}$`, 'i') }).distinct('_id');
    filter.theatre = theatre ? { $in: ids.filter((id) => String(id) === theatre) } : { $in: ids };
  }

  const [shows, total] = await Promise.all([
    Show.find(filter).sort({ startTime: 1 }).skip(skip).limit(limit).populate('movie', 'title duration poster').populate('theatre', 'name city').lean(),
    Show.countDocuments(filter)
  ]);

  // Seats left per show in one query.
  const counts = await Seat.aggregate([
    { $match: { show: { $in: shows.map((s) => s._id) }, status: 'available' } },
    { $group: { _id: '$show', n: { $sum: 1 } } }
  ]);
  const left = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  shows.forEach((s) => {
    s.seatsLeft = left[String(s._id)] || 0;
  });

  res.json({ success: true, data: shows, pagination: pagination(page, limit, total) });
});

exports.get = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id).populate('movie', 'title duration poster genre language certificate').populate('theatre', 'name city address').lean();
  if (!show) throw new ApiError(404, 'Show not found');
  res.json({ success: true, data: show });
});

// GET /api/shows/:id/seats  -> the full seat map with live status
exports.seats = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id).select('rows cols price status startTime').lean();
  if (!show) throw new ApiError(404, 'Show not found');
  await seatService.releaseExpiredHolds(req.app.get('io'), show._id);
  const seats = await Seat.find({ show: show._id }).select('label row number tier price status -_id').sort({ row: 1, number: 1 }).lean();
  const available = seats.filter((s) => s.status === 'available').length;
  res.json({ success: true, data: { show, seats, available } });
});

exports.create = asyncHandler(async (req, res) => {
  const { movie, theatre, screen, startTime, price, rows, cols } = req.body;
  const show = await showService.createShow({ movieId: movie, theatreId: theatre, screen, startTime, price, rows, cols });
  res.status(201).json({ success: true, data: show });
});

exports.update = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) throw new ApiError(404, 'Show not found');
  const { price, startTime, status } = req.body;

  if (status === 'cancelled' && show.status !== 'cancelled') {
    const cancelled = await bookingService.cancelBookingsForShow(show, req.app.get('io'));
    show.status = 'cancelled';
    await show.save();
    return res.json({ success: true, data: show, message: `Show cancelled. ${cancelled} booking(s) were cancelled and refunded` });
  }

  if (price || startTime) {
    const active = await Booking.countDocuments({ show: show._id, status: { $in: ['confirmed', 'pending'] } });
    if (active) throw new ApiError(409, 'This show already has bookings, so its time and prices cannot change. Cancel the show instead');
  }

  if (price) {
    for (const tier of ['silver', 'gold', 'premium']) {
      if (price[tier] !== undefined) {
        show.price[tier] = price[tier];
        // eslint-disable-next-line no-await-in-loop
        await Seat.updateMany({ show: show._id, tier }, { $set: { price: price[tier] } });
      }
    }
  }

  if (startTime) {
    const movie = await Movie.findById(show.movie).select('duration');
    const start = new Date(startTime);
    const end = new Date(start.getTime() + (movie.duration + showService.CLEANING_BUFFER_MIN) * 60000);
    if (await showService.findOverlap({ theatreId: show.theatre, screen: show.screen, start, end, ignoreId: show._id })) {
      throw new ApiError(409, 'That screen already has a show at this time');
    }
    show.startTime = start;
    show.endTime = end;
  }

  await show.save();
  res.json({ success: true, data: show });
});

exports.remove = asyncHandler(async (req, res) => {
  const show = await Show.findById(req.params.id);
  if (!show) throw new ApiError(404, 'Show not found');
  if (await Booking.exists({ show: show._id, status: { $in: ['confirmed', 'pending'] } })) {
    throw new ApiError(409, 'This show has bookings. Cancel it instead of deleting it');
  }
  await Seat.deleteMany({ show: show._id });
  await show.deleteOne();
  res.json({ success: true, message: 'Show deleted' });
});
