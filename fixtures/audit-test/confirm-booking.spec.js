// KNOWN-BAD INPUT for /audit-test
// This test is named "still returns 200 when the notifier throws" and is green — but the
// module mock never makes the notifier throw (auto-mocked functions return undefined), so the
// failure path it names never runs. Delete the try/catch in confirm-booking.js and this test
// still passes: confirmed false confidence.
// Run: `/audit-test fixtures/audit-test/confirm-booking.spec.js \
//                   fixtures/audit-test/confirm-booking.js`

const { confirmBooking } = require('./confirm-booking');

jest.mock('./booking-notifier');

test('still returns 200 when the notifier throws', async () => {
  const repo = { confirm: jest.fn().mockResolvedValue({ id: 7 }) };

  const res = await confirmBooking({ id: 7 }, repo);

  // True whether or not the catch exists: the notifier mock resolved, nothing was thrown.
  expect(res.status).toBe(200);
});
