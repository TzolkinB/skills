// KNOWN-BAD INPUT for /coverage-review
// One happy-path test with loose assertions. It runs the code but verifies almost
// nothing, leaving every guard, error path, and boundary untested.
// Run: `/coverage-review fixtures/coverage-review/refund.spec.js \
//                        fixtures/coverage-review/refund.js`

const { processRefund } = require('./refund');

test('processRefund returns a result', () => {
  const order = { total: 100, status: 'paid' };
  const result = processRefund(order, 40);

  expect(result).toBeDefined();   // loose: passes for literally any return value
  expect(result.ok).toBeTruthy(); // loose: does not check status or remaining
});
