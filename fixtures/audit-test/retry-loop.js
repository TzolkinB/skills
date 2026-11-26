// Code under test for the audit-test slow-run-cap fixture (#258, ADR-0058).
// Calls fn up to maxAttempts times and returns the first truthy result.

function retryUntil(fn, maxAttempts) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const result = fn(attempts);
    if (result) return { ok: true, attempts: attempts + 1, result };
    attempts += 1;
  }
  return { ok: false, attempts };
}

module.exports = { retryUntil };
