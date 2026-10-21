const mongoose = require('mongoose');

const screenSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    format: { type: String, trim: true, default: 'Standard' }
  },
  { _id: false }
);

const theatreSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Theatre name is required'], trim: true, maxlength: 80 },
    city: { type: String, required: [true, 'City is required'], trim: true },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    screens: { type: [screenSchema], validate: [(v) => v.length > 0, 'Add at least one screen'] }
  },
  { timestamps: true }
);

theatreSchema.index({ city: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Theatre', theatreSchema);
