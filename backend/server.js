require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./src/config/db');
const createApp = require('./src/app');
const { corsOrigin } = require('./src/config/cors');
const { releaseExpiredHolds } = require('./src/services/seatService');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;
const OBJECT_ID = /^[a-f\d]{24}$/i;

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    logger.error('JWT_SECRET is missing or too short. Set a long random value in .env');
    process.exit(1);
  }

  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Real-time seat availability: clients join a room per show and receive seat updates.
  const io = new Server(server, { cors: { origin: corsOrigin } });
  app.set('io', io);

  io.on('connection', (socket) => {
    socket.on('join-show', (showId) => {
      if (typeof showId === 'string' && OBJECT_ID.test(showId)) socket.join(`show:${showId}`);
    });
    socket.on('leave-show', (showId) => {
      if (typeof showId === 'string') socket.leave(`show:${showId}`);
    });
  });

  // Free seats whose payment hold ran out, and tell everyone watching that show.
  const sweeper = setInterval(() => {
    releaseExpiredHolds(io).catch((err) => logger.error('Hold sweep failed: ' + err.message));
  }, 30 * 1000);

  server.listen(PORT, () => logger.info(`IMovies API listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`));

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    clearInterval(sweeper);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection: ' + (err && err.stack ? err.stack : err)));

start().catch((err) => {
  logger.error('Failed to start: ' + err.message);
  process.exit(1);
});
