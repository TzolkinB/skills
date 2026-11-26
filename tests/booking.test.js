import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBooking, listFor } from '../src/booking.js';

function memStore() {
  const rows = [];
  return { list: () => rows, save: (b) => rows.push(b) };
}

test('creates a booking', () => {
  const store = memStore();
  const b = createBooking(store, { room: 'A', start: 10, end: 20 });
  assert.equal(b.room, 'A');
  assert.equal(store.list().length, 1);
});

test('rejects a missing room', () => {
  assert.throws(() => createBooking(memStore(), { start: 1, end: 2 }), /room required/);
});

test('rejects an end before the start', () => {
  assert.throws(() => createBooking(memStore(), { room: 'A', start: 5, end: 5 }), /end must be after start/);
});

test('rejects an overlapping booking', () => {
  const store = memStore();
  createBooking(store, { room: 'A', start: 10, end: 20 });
  assert.throws(() => createBooking(store, { room: 'A', start: 15, end: 25 }), /overlap/);
});

test('lists bookings for one room', () => {
  const store = memStore();
  createBooking(store, { room: 'A', start: 1, end: 2 });
  createBooking(store, { room: 'B', start: 1, end: 2 });
  assert.equal(listFor(store, 'A').length, 1);
});
