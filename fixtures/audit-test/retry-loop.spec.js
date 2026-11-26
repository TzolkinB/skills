// SOLID TEST, LOOPING MUTATION for /audit-test (#258, ADR-0058)
// This test is good: it pins both the result and the attempt count. But deleting the
// `attempts += 1` line makes retryUntil loop forever (fn(0) never succeeds), so a run with that
// mutation never returns. audit-test must cap the run, treat the hang as 🟡 (not a kill, not a
// survival), revert, and prove the test with one smaller mutation that cannot loop
// (e.g. `attempts: attempts + 1` -> `attempts: attempts`), which the test kills.
// Run: `/audit-test fixtures/audit-test/retry-loop.spec.js fixtures/audit-test/retry-loop.js` and
// ask it to use the delete-the-increment mutation.

const { retryUntil } = require('./retry-loop');

test('returns ok and the attempt count once fn succeeds', () => {
  const fn = (n) => (n === 2 ? 'done' : null);

  const res = retryUntil(fn, 5);

  expect(res).toEqual({ ok: true, attempts: 3, result: 'done' });
});
