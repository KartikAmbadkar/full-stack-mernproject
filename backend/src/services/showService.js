const Show = require('../models/Show');
const Movie = require('../models/Movie');
const Theatre = require('../models/Theatre');
const Seat = require('../models/Seat');
const ApiError = require('../utils/ApiError');
const seatService = require('./seatService');

const CLEANING_BUFFER_MIN = 15;

async function findOverlap({ theatreId, screen, start, end, ignoreId }) {
  const filter = { theatre: theatreId, screen, status: 'active', startTime: { $lt: end }, endTime: { $gt: start } };
  if (ignoreId) filter._id = { $ne: ignoreId };
  return Show.findOne(filter).select('_id startTime').lean();
}

// Creates a show and its seat map. Refuses a time that clashes with another show on the same screen.
async function createShow({ movieId, theatreId, screen, startTime, price, rows, cols }) {
  const [movie, theatre] = await Promise.all([Movie.findById(movieId), Theatre.findById(theatreId)]);
  if (!movie) throw new ApiError(404, 'Movie not found');
  if (!theatre) throw new ApiError(404, 'Theatre not found');
  if (!theatre.screens.some((s) => s.name === screen)) throw new ApiError(400, `${theatre.name} has no screen named "${screen}"`);

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) throw new ApiError(400, 'Start time is not a valid date');
  const end = new Date(start.getTime() + (movie.duration + CLEANING_BUFFER_MIN) * 60000);

  if (await findOverlap({ theatreId, screen, start, end })) throw new ApiError(409, 'That screen already has a show at this time');

  const data = { movie: movie._id, theatre: theatre._id, screen, startTime: start, endTime: end };
  if (price) data.price = price;
  if (rows) data.rows = rows;
  if (cols) data.cols = cols;

  const show = await Show.create(data);
  try {
    await seatService.generateSeats(show);
  } catch (err) {
    await Seat.deleteMany({ show: show._id });
    await Show.deleteOne({ _id: show._id });
    throw err;
  }
  return show;
}

module.exports = { createShow, findOverlap, CLEANING_BUFFER_MIN };
