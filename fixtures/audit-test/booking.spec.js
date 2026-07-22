// KNOWN-BAD INPUT for /audit-test
// This test is named "rejects overlapping bookings" and is green — but it sets up
// the repo to report NO overlap and only asserts that save() was called. It never
// exercises the rejection it claims to guard. Delete the overlap guard in
// booking.js and this test still passes: confirmed false confidence.
// Run: `/audit-test fixtures/audit-test/booking.spec.js \
//                   fixtures/audit-test/booking.js`

const { BookingService } = require('./booking');

test('rejects overlapping bookings', () => {
  const repo = {
    findOverlapping: jest.fn().mockReturnValue([]), // <-- no clashes: the overlap path never runs
    save: jest.fn().mockReturnValue({ id: 1 }),
  };
  const svc = new BookingService(repo);

  svc.book('Room A', 1, 2);

  // Asserts the collaborator was called, not that an overlap was rejected.
  expect(repo.save).toHaveBeenCalled();
});
