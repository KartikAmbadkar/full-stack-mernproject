const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    show: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatre: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre', required: true },
    showTime: { type: Date, required: true },
    seats: { type: [String], required: true },
    subtotal: { type: Number, required: true },
    fee: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'failed', 'expired'], default: 'pending' },
    holdExpiresAt: { type: Date },
    holdToken: { type: String, select: false },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    paidAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String }
  },
  { timestamps: true }
);

// Indexes for booking history and per-show lookups.
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ user: 1, status: 1, showTime: 1 });
bookingSchema.index({ show: 1, status: 1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
