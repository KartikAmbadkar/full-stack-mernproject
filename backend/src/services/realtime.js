// Tells everyone watching a show that some seats changed state.
// status is one of: available, held, booked
function emitSeats(io, showId, seats, status) {
  if (!io || !seats || !seats.length) return;
  io.to(`show:${showId}`).emit('seats:update', { showId: String(showId), seats, status });
}

module.exports = { emitSeats };
