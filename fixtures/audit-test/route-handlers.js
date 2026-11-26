// Code under test for the audit-test mutation-path fixture.
// Two handlers in one module. The spec only ever calls postBooking, so a change inside getBooking can
// never make it fail.

function getBooking(req, repo) {
  const booking = repo.find(req.id);
  if (!booking) return { status: 404 };
  return { status: 200, booking };
}

function postBooking(req, repo) {
  if (!req.body.room) return { status: 400 };
  const booking = repo.save({ room: req.body.room });
  return { status: 201, booking };
}

module.exports = { getBooking, postBooking };
