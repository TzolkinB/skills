import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refundCharge } from '../src/refund.js';

function makeGateway() {
  const calls = [];
  return { calls, refund: (id, amount) => { calls.push([id, amount]); return { ok: true }; } };
}

test('refunds part of a charge', () => {
  const gw = makeGateway();
  refundCharge(gw, { id: 'ch_1', amount: 50 }, 20);
  assert.deepEqual(gw.calls, [['ch_1', 20]]);
});

test('rejects a zero refund', () => {
  assert.throws(() => refundCharge(makeGateway(), { id: 'ch_1', amount: 50 }, 0), /positive/);
});

test('rejects a refund above the charge', () => {
  assert.throws(() => refundCharge(makeGateway(), { id: 'ch_1', amount: 50 }, 60), /exceeds/);
});
