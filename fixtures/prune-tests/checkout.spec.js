// KNOWN-BAD INPUT for /prune-tests --audit-evidence (#192)
// Two hand-off candidates, both loose/incidental rather than redundant, over-mocked, or
// stale — so neither belongs in categories 1-5, and both defer to /audit-test. A paired
// evidence file (checkout.audit-evidence.json) names one of them confirmed-hollow by a
// mutation that already ran, and the other only likely-hollow (reasoned, never executed) —
// so only the first should ever promote to Confirmed Prune.
// Run: `/prune-tests fixtures/prune-tests/checkout.spec.js`
//      `/prune-tests fixtures/prune-tests/checkout.spec.js --audit-evidence=fixtures/prune-tests/checkout.audit-evidence.json`

const { processPayment, applyDiscount } = require('./checkout');

// --- hand-off candidate #1: the mock is a correct external boundary, but the assertion
//     only checks the gateway was called, never the amount charged or the result ---
test('processes payment', () => {
  const gateway = { charge: jest.fn().mockResolvedValue({ ok: true }) };
  processPayment(gateway, { amount: 100 });
  expect(gateway.charge).toHaveBeenCalled(); // passes even if the wrong amount (or none) was charged
});

// --- hand-off candidate #2: no mocking at all, but the assertion is too loose to catch
//     wrong discount math ---
test('applies discount code', () => {
  const total = applyDiscount(100, 'SAVE10');
  expect(typeof total).toBe('number'); // passes whether or not SAVE10 actually discounted anything
});
