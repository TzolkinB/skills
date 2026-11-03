// KNOWN-BAD INPUT for /audit-test
// This test is named "resolves and logs when the email send rejects" and is green — but its
// db stub returns no rooms, so notifyConfirmed returns at the empty-rooms guard and never
// reaches the send. Delete the try/catch and this test still passes: confirmed false
// confidence. (It was a real test until the guard went in; the stub went stale.)
// Run: `/audit-test fixtures/audit-test/notify-confirmed.spec.js \
//                   fixtures/audit-test/notify-confirmed.js`

const { notifyConfirmed } = require('./notify-confirmed');

test('resolves and logs when the email send rejects', async () => {
  const db = { rooms: jest.fn().mockResolvedValue([]) }; // <-- no rooms: the send is never reached
  const mailer = { sendEmail: jest.fn().mockRejectedValue(new Error('smtp down')) };

  await expect(notifyConfirmed({ contactEmail: 'a@example.com', roomIds: [1] }, db, mailer))
    .resolves.toBeUndefined();
});
