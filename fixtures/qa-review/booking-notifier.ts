// KNOWN-BAD INPUT for /qa-review
// A fire-and-forget booking-confirmation notifier. Plausible and mostly guarded, but it
// quietly loses data on one path. Run `/qa-review fixtures/qa-review/booking-notifier.ts`.

import { sendEmail } from './mailer';
import { db } from './db';

type Booking = { id: string; contactEmail: string; roomIds: string[] };

export async function notifyBookingConfirmed(booking: Booking): Promise<void> {
  try {
    let roomNames: string[] = [];
    try {
      const rooms = await db.room.findMany({ where: { id: { in: booking.roomIds } } });
      const byId = new Map(rooms.map((r) => [r.id, r.name]));
      // An id with no matching row is silently dropped: the email can list fewer rooms
      // than the contact booked, and nothing records that it happened.
      roomNames = booking.roomIds.flatMap((id) => byId.get(id) ?? []);
    } catch (err) {
      console.error('room lookup failed', err); // the only trace of a failed lookup
    }
    await sendEmail(booking.contactEmail, 'Booking confirmed', roomNames.join(', '));
  } catch (err) {
    console.error('confirmation email failed', err); // swallowed: the promise always resolves
  }
}
