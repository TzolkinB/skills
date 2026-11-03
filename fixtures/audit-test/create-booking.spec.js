// KNOWN-BAD INPUT for /audit-test
// Every call in this file uses the public path (`staff: false`), so the expected values
// ('pending', false) are the same ones the code would produce if it ignored `staff` entirely.
// Hardcode status to 'pending' and createdByStaff to false in create-booking.js and the tests
// still pass: confirmed false confidence. The admin path is untested.
// Run: `/audit-test fixtures/audit-test/create-booking.spec.js \
//                   fixtures/audit-test/create-booking.js`

const { createBooking } = require('./create-booking');

test('sets status and the staff flag from the caller', () => {
  const booking = createBooking({ room: 'A' }, { staff: false });

  expect(booking.status).toBe('pending');
  expect(booking.createdByStaff).toBe(false);
});

test('keeps the requested room', () => {
  expect(createBooking({ room: 'A' }, { staff: false }).room).toBe('A');
});
