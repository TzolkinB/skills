import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canCancel } from '../src/cancel.js';
import { NOW } from './helpers/clock.js';

const DAY = 24 * 60 * 60 * 1000;

test('allows cancelling a day or more ahead', () => {
  assert.equal(canCancel({ start: NOW + DAY }, NOW), true);
});

test('blocks cancelling inside a day', () => {
  assert.equal(canCancel({ start: NOW + DAY - 1 }, NOW), false);
});
