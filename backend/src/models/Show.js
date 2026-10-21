const mongoose = require('mongoose');

const showSchema = new mongoose.Schema(
  {
    movie: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie', required: true },
    theatre: { type: mongoose.Schema.Types.ObjectId, ref: 'Theatre', required: true },
    screen: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    price: {
      silver: { type: Number, default: 180, min: 0 },
      gold: { type: Number, default: 260, min: 0 },
      premium: { type: Number, default: 380, min: 0 }
    },
    rows: { type: Number, default: 10, min: 3, max: 26 },
    cols: { type: Number, default: 12, min: 4, max: 30 },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' }
  },
  { timestamps: true }
);

// Indexes for show filtering by film, theatre and day.
showSchema.index({ movie: 1, startTime: 1 });
showSchema.index({ theatre: 1, screen: 1, startTime: 1 });
showSchema.index({ status: 1, startTime: 1 });

module.exports = mongoose.model('Show', showSchema);
