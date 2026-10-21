const Theatre = require('../models/Theatre');
const Show = require('../models/Show');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { pick, escapeRegex } = require('../utils/helpers');

const FIELDS = ['name', 'city', 'address', 'screens'];

exports.list = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.city) filter.city = new RegExp(`^${escapeRegex(req.query.city)}$`, 'i');
  const data = await Theatre.find(filter).sort({ city: 1, name: 1 }).lean();
  res.json({ success: true, data });
});

exports.get = asyncHandler(async (req, res) => {
  const theatre = await Theatre.findById(req.params.id).lean();
  if (!theatre) throw new ApiError(404, 'Theatre not found');
  res.json({ success: true, data: theatre });
});

exports.create = asyncHandler(async (req, res) => {
  const theatre = await Theatre.create(pick(req.body, FIELDS));
  res.status(201).json({ success: true, data: theatre });
});

exports.update = asyncHandler(async (req, res) => {
  const theatre = await Theatre.findById(req.params.id);
  if (!theatre) throw new ApiError(404, 'Theatre not found');
  Object.assign(theatre, pick(req.body, FIELDS));
  await theatre.save();
  res.json({ success: true, data: theatre });
});

exports.remove = asyncHandler(async (req, res) => {
  const theatre = await Theatre.findById(req.params.id);
  if (!theatre) throw new ApiError(404, 'Theatre not found');
  if (await Show.exists({ theatre: theatre._id })) throw new ApiError(409, 'This theatre still has shows. Remove or cancel them first');
  await theatre.deleteOne();
  res.json({ success: true, message: 'Theatre deleted' });
});
