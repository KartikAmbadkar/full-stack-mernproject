const mongoose = require('mongoose');

// One document per seat per show. Status changes are made with conditional updates
// (see seatService) so two people can never end up holding the same seat.
const seatSchema = new mongoose.Schema({
  show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
  label: { type: String, required: true }, // e.g. "F7"
  row: { type: String, required: true },
  number: { type: Number, required: true },
  tier: { type: String, enum: ['silver', 'gold', 'premium'], required: true },
  price: { type: Number, required: true },
  status: { type: String, enum: ['available', 'held', 'booked'], default: 'available' },
  heldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  heldUntil: { type: Date },
  heldToken: { type: String },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }
});

// Indexes for seat availability lookups and the expired-hold sweep.
seatSchema.index({ show: 1, label: 1 }, { unique: true });
seatSchema.index({ show: 1, status: 1 });
seatSchema.index({ status: 1, heldUntil: 1 });
seatSchema.index({ heldToken: 1 }, { sparse: true });
seatSchema.index({ booking: 1 }, { sparse: true });

module.exports = mongoose.model('Seat', seatSchema);
