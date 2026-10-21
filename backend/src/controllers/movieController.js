const fs = require('fs');
const path = require('path');
const Movie = require('../models/Movie');
const Show = require('../models/Show');
const Seat = require('../models/Seat');
const Theatre = require('../models/Theatre');
const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { dayRange, paginate, pagination, pick, escapeRegex } = require('../utils/helpers');

const FIELDS = ['title', 'description', 'genre', 'language', 'duration', 'certificate', 'rating', 'releaseDate', 'status'];
const exact = (v) => new RegExp(`^${escapeRegex(v)}$`, 'i');

function removePosterFile(posterPath) {
  if (!posterPath || !posterPath.startsWith('/uploads/')) return;
  const file = path.join(__dirname, '..', '..', 'uploads', path.basename(posterPath));
  fs.unlink(file, () => {});
}

// GET /api/movies?q=&genre=&language=&theatre=&city=&date=YYYY-MM-DD&status=&page=&limit=
exports.list = asyncHandler(async (req, res) => {
  const { q, genre, language, theatre, city, date, status } = req.query;
  const { page, limit, skip } = paginate(req.query);

  const filter = { status: status || 'now_showing' };
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };
  if (genre) filter.genre = exact(genre);
  if (language) filter.language = exact(language);

  // Theatre, city and date filters work through the shows that exist for each movie.
  if (theatre || city || date) {
    const showFilter = { status: 'active' };
    if (date) {
      const { start, end } = dayRange(date);
      showFilter.startTime = { $gte: new Date(Math.max(start.getTime(), Date.now())), $lt: end };
    } else {
      showFilter.startTime = { $gte: new Date() };
    }
    if (theatre) showFilter.theatre = theatre;
    if (city) {
      const ids = await Theatre.find({ city: exact(city) }).distinct('_id');
      showFilter.theatre = theatre ? { $in: ids.filter((id) => String(id) === theatre) } : { $in: ids };
    }
    filter._id = { $in: await Show.distinct('movie', showFilter) };
  }

  const [data, total] = await Promise.all([
    Movie.find(filter).sort({ releaseDate: -1, title: 1 }).skip(skip).limit(limit).lean(),
    Movie.countDocuments(filter)
  ]);
  res.json({ success: true, data, pagination: pagination(page, limit, total) });
});

exports.get = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id).lean();
  if (!movie) throw new ApiError(404, 'Movie not found');
  res.json({ success: true, data: movie });
});

exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (req.file) data.poster = `/uploads/${req.file.filename}`;
  const movie = await Movie.create(data);
  res.status(201).json({ success: true, data: movie });
});

exports.update = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) {
    if (req.file) removePosterFile(`/uploads/${req.file.filename}`);
    throw new ApiError(404, 'Movie not found');
  }
  Object.assign(movie, pick(req.body, FIELDS));
  if (req.file) {
    removePosterFile(movie.poster);
    movie.poster = `/uploads/${req.file.filename}`;
  }
  await movie.save();
  res.json({ success: true, data: movie });
});

// A movie that already has bookings is archived so booking history stays intact. Otherwise it is removed with its shows.
exports.remove = asyncHandler(async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  if (!movie) throw new ApiError(404, 'Movie not found');

  if (await Booking.exists({ movie: movie._id })) {
    movie.status = 'archived';
    await movie.save();
    return res.json({ success: true, message: 'This movie has bookings, so it was archived instead of deleted', data: movie });
  }

  const showIds = await Show.find({ movie: movie._id }).distinct('_id');
  await Seat.deleteMany({ show: { $in: showIds } });
  await Show.deleteMany({ movie: movie._id });
  removePosterFile(movie.poster);
  await movie.deleteOne();
  res.json({ success: true, message: 'Movie deleted' });
});
