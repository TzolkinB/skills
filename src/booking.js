export function createBooking(store, { room, start, end }) {
  if (!room) throw new Error('room required');
  if (end <= start) throw new Error('end must be after start');
  const clash = store.list().some((b) => b.room === room && start < b.end && end > b.start);
  if (clash) throw new Error('overlap');
  const booking = { id: store.list().length + 1, room, start, end };
  store.save(booking);
  return booking;
}
export function listFor(store, room) {
  return store.list().filter((b) => b.room === room);
}
