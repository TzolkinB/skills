export function canCancel(booking, now) {
  return booking.start - now >= 24 * 60 * 60 * 1000;
}
