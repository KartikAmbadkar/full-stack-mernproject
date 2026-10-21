const mongoose = require('mongoose');
const logger = require('../utils/logger');

module.exports = async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  logger.info('MongoDB connected');
  mongoose.connection.on('error', (err) => logger.error('MongoDB error: ' + err.message));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
};
