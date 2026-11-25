// Code under test for the audit-test notifier fixture.
// The real behavior worth protecting: a failed confirmation email must never fail the
// booking itself — the caller still answers 200.

const { notifyBookingConfirmed } = require('./booking-notifier');

async function confirmBooking(req, repo) {
  const booking = await repo.confirm(req.id);
  try {
    await notifyBookingConfirmed(booking);
  } catch (err) {
    console.error('confirmation notice failed', err); // <-- the guard a real test must pin
  }
  return { status: 200, booking };
}

module.exports = { confirmBooking };
