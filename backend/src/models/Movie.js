const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1200, default: '' },
    genre: { type: String, required: [true, 'Genre is required'], trim: true },
    language: { type: String, required: [true, 'Language is required'], trim: true },
    duration: { type: Number, required: [true, 'Duration in minutes is required'], min: 30, max: 300 },
    certificate: { type: String, enum: ['U', 'U/A', 'A'], default: 'U/A' },
    rating: { type: Number, min: 0, max: 10, default: 0 },
    poster: { type: String, default: '' },
    releaseDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['now_showing', 'upcoming', 'archived'], default: 'now_showing' }
  },
  { timestamps: true }
);

// Indexes for movie search and filtering.
movieSchema.index({ title: 1 });
movieSchema.index({ status: 1, genre: 1, language: 1 });
movieSchema.index({ releaseDate: -1 });

module.exports = mongoose.model('Movie', movieSchema);
