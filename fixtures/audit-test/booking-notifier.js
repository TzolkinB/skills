// Collaborator for confirm-booking.js. Stands in for the real email notifier; the spec
// replaces it wholesale, so its body is never run by the fixture test.
async function notifyBookingConfirmed(booking) {
  throw new Error('not implemented in the fixture: ' + booking.id);
}

module.exports = { notifyBookingConfirmed };
