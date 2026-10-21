const User = require('../models/User');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { paginate, pagination, tzOffset } = require('../utils/helpers');

// GET /api/admin/stats
exports.stats = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [users, movies, upcomingShows, confirmed, totals, perDay] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Movie.countDocuments({ status: 'now_showing' }),
    Show.countDocuments({ status: 'active', startTime: { $gte: new Date() } }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, revenue: { $sum: '$total' }, seatsSold: { $sum: { $size: '$seats' } } } }
    ]),
    Booking.aggregate([
      { $match: { status: 'confirmed', paidAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: `${tzOffset() >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(tzOffset()) / 60)).padStart(2, '0')}:${String(Math.abs(tzOffset()) % 60).padStart(2, '0')}` } }, bookings: { $sum: 1 }, revenue: { $sum: '$total' } } },
      { $sort: { _id: 1 } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      customers: users,
      activeMovies: movies,
      upcomingShows,
      confirmedBookings: confirmed,
      revenue: totals[0] ? totals[0].revenue : 0,
      seatsSold: totals[0] ? totals[0].seatsSold : 0,
      last7Days: perDay.map((d) => ({ date: d._id, bookings: d.bookings, revenue: d.revenue }))
    }
  });
});

// GET /api/admin/bookings?status=&page=&limit=
exports.bookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const [data, total] = await Promise.all([
    Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('user', 'name email').populate('movie', 'title').populate('theatre', 'name').lean(),
    Booking.countDocuments(filter)
  ]);
  res.json({ success: true, data, pagination: pagination(page, limit, total) });
});

// GET /api/admin/users
exports.users = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const [data, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments()
  ]);
  res.json({ success: true, data, pagination: pagination(page, limit, total) });
});

// PATCH /api/admin/users/:id  { active?, role? }
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  if (String(user._id) === String(req.user._id)) throw new ApiError(400, 'You cannot change your own role or status');
  if (req.body.active !== undefined) user.active = req.body.active;
  if (req.body.role !== undefined) user.role = req.body.role;
  await user.save();
  res.json({ success: true, data: user });
});
