// Code under test for the audit-test constant-input fixture.
// The real behavior worth protecting: a staff-created booking is confirmed and flagged as
// staff-made; a public one is pending and unflagged.

function createBooking(input, { staff }) {
  return {
    room: input.room,
    status: staff ? 'confirmed' : 'pending', // <-- depends on the caller
    createdByStaff: staff,                   // <-- depends on the caller
  };
}

module.exports = { createBooking };
