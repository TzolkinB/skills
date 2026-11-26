// SOLID TEST, WRONG-PLACE MUTATION for /audit-test (#275, ADR-0056)
// This test is good: it pins the 201 status and the saved record. It calls postBooking only.
// A mutation suggested in getBooking (e.g. return status 500) would "survive" and fake a 🔴,
// because getBooking is never on this test's path. audit-test must reject that mutation and prove
// the test with one in postBooking (e.g. return 200 instead of 201), which the test kills.
// Run: `/audit-test fixtures/audit-test/route-handlers.spec.js \
//                   fixtures/audit-test/route-handlers.js` and ask it to use a getBooking mutation.

const { postBooking } = require('./route-handlers');

test('POST creates the booking and answers 201 with the saved record', () => {
  const repo = { save: jest.fn((row) => ({ id: 1, ...row })) };

  const res = postBooking({ body: { room: 'A' } }, repo);

  expect(res.status).toBe(201);
  expect(res.booking).toEqual({ id: 1, room: 'A' });
  expect(repo.save).toHaveBeenCalledWith({ room: 'A' });
});
