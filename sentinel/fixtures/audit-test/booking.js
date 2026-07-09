// Code under test for the audit-test fixture.
// The real behavior worth protecting: a booking that overlaps an existing one
// must be rejected with a 409.

class BookingService {
  constructor(repo) {
    this.repo = repo;
  }

  book(room, start, end) {
    const clashes = this.repo.findOverlapping(room, start, end);
    if (clashes.length > 0) {
      const err = new Error('overlapping booking');
      err.code = 409;
      throw err; // <-- the guard a real test must pin
    }
    return this.repo.save({ room, start, end });
  }
}

module.exports = { BookingService };
