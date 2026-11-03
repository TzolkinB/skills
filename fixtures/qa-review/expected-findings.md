# Expected findings — qa-review / pricing.js

Run: `/qa-review fixtures/qa-review/pricing.js`

This fixture is a pure **testability** target (no test file — `qa-review` reads code
only). Every smell below is deliberately planted; a correct run should surface them
grouped by category.

## Testability Issues (should be flagged HIGH/MEDIUM)
- **Hard-coded prod URL** — `API_URL = 'https://api.prod.example.com/pricing'` cannot be
  pointed at a mock server; no dependency injection.
- **`new Date().getHours()` in logic** — the flash-sale branch is time-dependent, so tests
  pass or fail depending on the clock. (See GLOSSARY: Non-determinism.)
- **`Math.random()`** — unseeded promo eligibility; non-deterministic, needs a mock/seed.
- **`fetch(...)` created inline** — the network call is not injectable; can't stub without
  editing the code.
- **`setTimeout(..., 3000)`** — uncontrolled timer makes any test slow or flaky.

## Brittleness Risks
- **`body.includes('rate limit exceeded')`** — fragile string match on an external error
  message that can change without notice.
- **`JSON.parse(body).surcharge`** — assumes response shape with no null/parse guard; will
  throw on unexpected payloads.

## Coupling / Mock Challenges
- The function bundles clock, RNG, network, and a timer, so it can only be exercised with the
  whole world running — it cannot be unit-tested in isolation.

## Not in scope for this skill
- Consequence-of-failure (blast radius) is `threat-model`'s job, not `qa-review`'s — the run
  should NOT rank production impact here.

---

# Expected findings — qa-review / booking-notifier.ts

Run: `/qa-review fixtures/qa-review/booking-notifier.ts`

Added from a real review of a booking-notification PR. The code is mostly guarded, so the
useful run names the one thing a shallow "it has try/catch, looks fine" read misses.

## Should be surfaced
- **Silent drop of unresolved room ids** — `byId.get(id) ?? []` removes any id with no matching
  row without a trace. The confirmation can name fewer rooms than were booked, and a test of
  the happy path cannot see it. This is an unclear-contract / hidden-data-loss finding.
- **Failure is only observable through `console.error`** — both `catch` blocks swallow the
  error and the promise always resolves, so a test cannot tell "sent" from "failed" except by
  spying on the console. Report the seam needed (an observable result, or an injected logger).

## Not in scope for this skill
- Whether the existing *tests* are credible (e.g. mocks that only pass because promises flush
  before the assertion) — that is `/audit-test`'s job. qa-review reads code only.
- Pre-existing coupling in code the file merely imports — flag it as out of scope, do not
  score it against this file.

## Open question for the owner (not asserted by the eval)
The original review rated "inject the email sender" HIGH. The repo's convention was module
mocking, which made that rating over-severe. `SKILL.md` step 2 names a module-level singleton
as a real testability cause, so whether severity should drop when the repo has an established
mocking convention is a skill decision, not a grader rule. Recorded here, deliberately unasserted.
