const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const { corsOrigin } = require('./config/cors');
const { apiLimiter } = require('./middleware/rateLimit');
const sanitize = require('./middleware/sanitize');
const { notFound, errorHandler } = require('./middleware/error');

module.exports = function createApp() {
  const app = express();
  const frontendPath = path.join(__dirname, '../../frontend');

  app.use(express.static(frontendPath));

  // Serve the homepage
  app.get('/', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
  });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '100kb' }));
  app.use(sanitize);
  if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', (req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));

  app.use('/api', apiLimiter);
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { index: false }));

  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/movies', require('./routes/movieRoutes'));
  app.use('/api/theatres', require('./routes/theatreRoutes'));
  app.use('/api/shows', require('./routes/showRoutes'));
  app.use('/api/bookings', require('./routes/bookingRoutes'));
  app.use('/api/payments', require('./routes/paymentRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/admin', require('./routes/adminRoutes'));

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
