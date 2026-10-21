const crypto = require('crypto');

// Stand-in for a real payment gateway (Razorpay, Stripe, PayU...).
// Replace the body of charge() with a call to the gateway SDK; the rest of the booking flow stays the same.
// Outside production, pass simulate: 'failure' to test the failed-payment path.
async function charge({ amount, method, simulate }) {
  if (simulate === 'failure' && process.env.NODE_ENV !== 'production') {
    return { ok: false, reason: 'Payment declined by the bank (simulated)' };
  }
  if (!(amount > 0)) return { ok: false, reason: 'Invalid amount' };
  return { ok: true, transactionId: 'TXN' + crypto.randomBytes(8).toString('hex').toUpperCase(), method };
}

module.exports = { charge };
