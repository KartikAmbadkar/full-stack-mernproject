# IMovies backend

REST API and real-time seat service for the IMovies cinema booking system.
Stack: Node.js, Express 4, MongoDB with Mongoose, JWT, bcryptjs, socket.io, multer.

## Run it

Requirements: Node.js 18 or newer and a running MongoDB (local or Atlas).

```bash
cd backend
npm install
cp .env.example .env        # then set MONGO_URI and a long JWT_SECRET
npm run seed                # demo admin, customer, theatres, films and five days of shows
npm run dev                 # http://localhost:5000/api/health
```

Seed accounts (change the passwords before any public use):

| Role     | Email               | Password     |
| -------- | ------------------- | ------------ |
| Admin    | admin@imovies.test  | Admin@12345  |
| Customer | user@imovies.test   | User@12345   |

`npm run seed:reset` empties every collection first.

## Project layout

```
server.js                 starts HTTP + socket.io, seat-hold sweeper, graceful shutdown
src/app.js                middleware stack and route mounting
src/config/               database connection, CORS rules
src/models/               User, Movie, Theatre, Show, Seat, Booking, Payment, Notification
src/middleware/           auth (JWT + roles), validation, rate limits, sanitizing, uploads, errors
src/controllers/          request handlers
src/services/             seat locking, booking cancel, show creation, payments, notifications
src/routes/               URL tables with input validation
src/seed.js               demo data
```

## How booking works

1. `POST /api/bookings` holds the chosen seats for `HOLD_MINUTES` (default 7) and returns a `pending` booking with the price.
2. `POST /api/payments` charges it. Success turns the hold into a sale and the booking becomes `confirmed`. Failure releases the seats and the booking becomes `failed`.
3. A seat can only be claimed by a conditional database update (available, or held with an expired hold), so two people cannot get the same seat. If any seat in a request is lost, everything claimed in that attempt is released and the API answers `409`.
4. Every 30 seconds the server frees expired holds and marks their pending bookings `expired`.
5. `POST /api/bookings/:id/cancel` frees the seats and marks the payment `refunded`. Customers can cancel until `CANCEL_CUTOFF_MINUTES` (default 60) before the show.

Payments go through `src/services/paymentService.js`, a stand-in gateway. Outside production, send `"simulate": "failure"` to test the failed-payment path. To take real payments, replace `charge()` with a Razorpay or Stripe call.

## Real-time seats

Connect with socket.io, join a show, and listen for updates:

```js
const socket = io('http://localhost:5000');
socket.emit('join-show', showId);
socket.on('seats:update', ({ showId, seats, status }) => { /* status: available | held | booked */ });
```

## Endpoints

Send the token as `Authorization: Bearer <token>`. Every response is `{ success, data?, message?, pagination? }`; errors are `{ success:false, message, details? }`.

| Method | Path | Access | Purpose |
| ------ | ---- | ------ | ------- |
| POST | /api/auth/register | public | Create a customer account |
| POST | /api/auth/login | public | Sign in, returns a JWT |
| GET | /api/auth/me | signed in | Current user |
| GET | /api/movies | public | Search and filter: `q, genre, language, theatre, city, date, page, limit` |
| GET | /api/movies/:id | public | Movie details |
| POST / PUT / DELETE | /api/movies(/:id) | admin | Create, edit, delete (multipart with a `poster` image, or JSON) |
| GET | /api/theatres | public | List theatres (`city` filter) |
| POST / PUT / DELETE | /api/theatres(/:id) | admin | Manage theatres and screens |
| GET | /api/shows | public | Shows: `movie, theatre, city, date`, includes seats left |
| GET | /api/shows/:id | public | One show |
| GET | /api/shows/:id/seats | public | Seat map with live status |
| POST / PUT / DELETE | /api/shows(/:id) | admin | Create (builds seats), reprice, reschedule, cancel (`status:"cancelled"` refunds bookings), delete |
| POST | /api/bookings | signed in | Hold seats: `{ showId, seats:["F5","F6"] }` |
| GET | /api/bookings/mine | signed in | History: `type=upcoming|past|all` |
| GET | /api/bookings/:id | owner or admin | One booking |
| POST | /api/bookings/:id/cancel | owner or admin | Cancel and refund |
| POST | /api/payments | signed in | Pay: `{ bookingId, method:"upi|card|netbanking" }` |
| GET | /api/payments/mine | signed in | Payment history |
| GET | /api/notifications | signed in | Notifications and unread count |
| PATCH | /api/notifications/:id/read, /read-all | signed in | Mark as read |
| GET | /api/admin/stats | admin | Revenue, seats sold, bookings, last 7 days |
| GET | /api/admin/bookings, /users | admin | Paginated lists |
| PATCH | /api/admin/users/:id | admin | Change role or deactivate |

## Security

Passwords are bcrypt hashed (cost 12). JWTs expire (`JWT_EXPIRES_IN`) and the user is reloaded on every request, so deactivated accounts lose access at once. Registration can only create customers. Role checks run in middleware on every admin route. Other protections: helmet headers, CORS allow-list in production, JSON body limit, removal of `$`-operator keys from input, express-validator on every route, rate limits (300 requests per 15 minutes overall, 20 per 15 minutes on sign-in, 40 per 10 minutes on bookings and payments), upload limits (2 MB, JPG/PNG/WebP only, random file names), and errors that hide internals in production.

## Testing with Postman

1. `POST /api/auth/login` with the seed customer, copy `token`.
2. Set the collection's Authorization to Bearer Token.
3. `GET /api/shows?date=YYYY-MM-DD`, pick a show id.
4. `POST /api/bookings`, then `POST /api/payments` with the returned booking id. Try it twice with the same seats to see the `409`, and with `"simulate":"failure"` to see the `402`.

## Not done yet

- The frontend in the parent folder still uses sample data. It needs to call these endpoints and subscribe to `seats:update`.
- No automated tests yet. The seat-locking and payment paths are the ones to cover first.
- The payment gateway is simulated.
