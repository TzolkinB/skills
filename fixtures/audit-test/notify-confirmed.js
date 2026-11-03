// Code under test for the audit-test stale-stub fixture.
// The real behavior worth protecting: a failed confirmation email is logged and swallowed,
// never thrown at the caller.

async function notifyConfirmed(booking, db, mailer) {
  const rooms = await db.rooms(booking.roomIds);
  if (rooms.length === 0) return; // guard added after the test below was written

  try {
    await mailer.sendEmail(booking.contactEmail, rooms.map((r) => r.name).join(', '));
  } catch (err) {
    console.error('confirmation email failed', err); // <-- the guard a real test must pin
  }
}

module.exports = { notifyConfirmed };
