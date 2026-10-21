// Loads demo data: an admin, a customer, three theatres, eight films and five days of shows.
// Run with `npm run seed` (adds data) or `npm run seed:reset` (wipes the collections first).
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Movie = require('./models/Movie');
const Theatre = require('./models/Theatre');
const Show = require('./models/Show');
const Seat = require('./models/Seat');
const Booking = require('./models/Booking');
const Payment = require('./models/Payment');
const Notification = require('./models/Notification');
const showService = require('./services/showService');
const { localDateKey, localTime } = require('./utils/helpers');

const MOVIES = [
  { title: 'Monsoon Express', genre: 'Thriller', language: 'Hindi', duration: 134, certificate: 'U/A', rating: 8.1, description: 'A night train, a stolen ledger and eleven strangers who each need it to reach Mumbai alive.' },
  { title: 'The Last Reel', genre: 'Drama', language: 'English', duration: 118, certificate: 'U', rating: 7.8, description: 'A projectionist in a closing single-screen cinema screens one final film for the town that grew up in the dark.' },
  { title: 'Neon Harbour', genre: 'Sci-Fi', language: 'English', duration: 151, certificate: 'U/A', rating: 8.4, description: 'In a port city that runs on light, a dock inspector finds a ship that has not yet arrived.' },
  { title: 'Paper Lanterns', genre: 'Romance', language: 'Tamil', duration: 125, certificate: 'U', rating: 7.5, description: 'Two lantern makers from rival streets share one festival week and one very small workshop.' },
  { title: 'Dust & Diesel', genre: 'Action', language: 'Hindi', duration: 142, certificate: 'U/A', rating: 7.2, description: 'A highway convoy, a broken-down tanker and four hours before the toll gate closes.' },
  { title: 'Orbit Nine', genre: 'Sci-Fi', language: 'Telugu', duration: 160, certificate: 'U/A', rating: 8.0, description: 'The ninth crew to reach the relay station is the first to find someone already home.' },
  { title: 'Grandma’s Cricket Club', genre: 'Comedy', language: 'Hindi', duration: 109, certificate: 'U', rating: 7.9, description: 'Six grandmothers, one dusty ground and a league that never expected them to win a match.' },
  { title: 'Salt Road', genre: 'Drama', language: 'Malayalam', duration: 128, certificate: 'U/A', rating: 8.2, description: 'A salt trader walks the coast road home and settles every debt he has left behind.' }
];

// Six screens per theatre so films do not compete for the same screen at the same time.
const FORMATS = ['Dolby Atmos', '4K laser', 'Large format', 'Standard', 'Standard', 'Recliner'];
const screens = () => FORMATS.map((format, i) => ({ name: `Screen ${i + 1}`, format }));
// Replace the city and addresses with your own when you move past demo data.
const THEATRES = [
  { name: 'IMovies Central', city: 'Sample City', address: 'Central Mall, Main Road', screens: screens() },
  { name: 'IMovies Riverside', city: 'Sample City', address: 'Riverside Plaza', screens: screens() },
  { name: 'IMovies Skyline', city: 'Sample City', address: 'Skyline Tower, Level 5', screens: screens() }
];

const TIMES = [[10, 15], [13, 30], [16, 45], [19, 30], [22, 30]];

async function run() {
  await connectDB();

  if (process.argv.includes('--reset')) {
    await Promise.all([User, Movie, Theatre, Show, Seat, Booking, Payment, Notification].map((m) => m.deleteMany({})));
    console.log('Collections cleared');
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@imovies.test').toLowerCase();
  const userEmail = (process.env.SEED_USER_EMAIL || 'user@imovies.test').toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const userPassword = process.env.SEED_USER_PASSWORD || 'User@12345';

  if (!(await User.exists({ email: adminEmail }))) await User.create({ name: 'IMovies Admin', email: adminEmail, password: adminPassword, role: 'admin' });
  if (!(await User.exists({ email: userEmail }))) await User.create({ name: 'Demo Customer', email: userEmail, password: userPassword, role: 'user' });

  const theatres = [];
  for (const t of THEATRES) {
    // eslint-disable-next-line no-await-in-loop
    theatres.push((await Theatre.findOne({ name: t.name, city: t.city })) || (await Theatre.create(t)));
  }

  const movies = [];
  for (const m of MOVIES) {
    // eslint-disable-next-line no-await-in-loop
    movies.push((await Movie.findOne({ title: m.title })) || (await Movie.create({ ...m, releaseDate: new Date(Date.now() - 7 * 864e5) })));
  }

  // Five days of shows. Every film plays in two of the three theatres, at a few of the five time slots.
  let created = 0;
  const today = localDateKey();
  for (let d = 0; d < 5; d++) {
    const dateStr = localDateKey(new Date(Date.now() + d * 864e5));
    for (let mi = 0; mi < movies.length; mi++) {
      for (let ti = 0; ti < theatres.length; ti++) {
        if ((mi + 1 + ti) % 3 === 2) continue;
        const slots = TIMES.filter((_, i) => (mi * 7 + ti * 3 + d + i) % 5 < 3);
        for (const [hh, mm] of slots) {
          const start = localTime(dateStr, hh, mm);
          if (start <= new Date() && dateStr === today) continue;
          try {
            // eslint-disable-next-line no-await-in-loop
            await showService.createShow({ movieId: movies[mi]._id, theatreId: theatres[ti]._id, screen: theatres[ti].screens[mi % theatres[ti].screens.length].name, startTime: start });
            created++;
          } catch (err) {
            if (err.statusCode !== 409) throw err; // 409 means the show already exists from an earlier run
          }
        }
      }
    }
  }

  console.log(`Seed complete: ${movies.length} movies, ${theatres.length} theatres, ${created} new shows`);
  console.log(`Admin:    ${adminEmail} / ${adminPassword}`);
  console.log(`Customer: ${userEmail} / ${userPassword}`);
  console.log('Change these passwords before using the app anywhere public.');
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
