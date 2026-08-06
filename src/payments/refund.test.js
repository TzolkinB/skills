import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refundCharge } from './refund.js';

test('refunds the full charge', () => {
  const calls = [];
  const gateway = { refund: (...args) => calls.push(args) };
  const charge = { id: 'ch_1', amount: 50 };

  refundCharge(gateway, charge, 50);

  assert.equal(calls.length, 1);
});
