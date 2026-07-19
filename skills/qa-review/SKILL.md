---
name: qa-review
description: Review code from a QA/testability angle — is this even testable?
argument-hint: "[file path to review]"
allowed-tools: [Read, Bash]
disable-model-invocation: true
---

**Owns:** whether the *source code* can be tested at all — hidden deps, non-determinism, coupling — judged before any test exists.
**Not this:** anything about tests that already exist — their gaps → `/coverage-review`, their credibility → `/audit-test`, their redundancy → `/prune-tests`.

A code review from QA asks different questions than a general code review. Can I test this? Will it be flaky? Are there hidden dependencies? Is it coupled to something I can't mock?

## Steps

1. Read the code file provided in $ARGUMENTS
2. Scan for **testability issues**:
   - Hard-coded dependencies (API keys, file paths, timestamps)
   - Side effects that are hard to observe (console.log, network calls, timers)
   - Non-deterministic behavior (Date.now(), Math.random(), setTimeout)
   - Deeply nested state or coupled modules
   - **Structural coupling the pattern list above won't name** — look past the literal keywords for what forces integration-only testing: a **module-level singleton** imported once and called directly throughout (a `db`/`prisma`/client/service you can't inject without module-mocking), or an **import-time side effect** (work done at load — building a registry, opening a connection — so merely importing the file for a test triggers it). These are usually the *real* reason a file can't be unit-tested in isolation, and they don't show up as a hard-coded value or a `Date.now()`.
   - Missing error handling that would leave tests hanging
3. Scan for **brittleness risks**:
   - Overly specific assertions (e.g., exact string matching that might change)
   - Timing-dependent behavior
   - Database schema assumptions
4. Scan for **maintainability** from a test perspective:
   - Function signatures that are hard to mock
   - Too much logic in one function (hard to unit test)
   - Unclear contracts (what goes in, what comes out?)
5. Report findings by category
6. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.

## Output Format

```
## QA Review: [File Name]

### Testability Issues (Will Slow You Down)
- [ ] **HIGH** Line 12: `const api = 'https://api.prod.example.com'` — hard-coded URL, can't test with mock server
- [ ] **HIGH** Line 28: `new Date()` used directly in logic — tests will be flaky/time-dependent
- [ ] **MEDIUM** Line 15: `Math.random()` — non-deterministic, mock needed
- [ ] **MEDIUM** Line 45: `setTimeout(..., 3000)` — test will be slow or flaky

### Brittleness Risks
- [ ] Line 8: String matching `if (error.message.includes('Connection'))` — fragile if error messages change
- [ ] Line 32: Expects exact array length without validating content
- [ ] Data structure assumptions: assumes `user.profile.settings` exists without null checks

### Coupling / Mock Challenges
- [ ] `BookingService` creates its own database connection (can't inject test DB)
- [ ] `sendEmail()` call on line 62 — no way to spy/mock without changing code

### Unclear Contracts
- [ ] Function `validateBooking()` returns undefined or an error object? Document the contract.
- [ ] What if `rooms.filter()` returns empty? Documented?

### Suggestions
1. Inject dependencies (API URL, database connection, timer)
2. Avoid Date.now() — pass time as parameter or use injectable clock
3. Wrap Math.random() or use seedable random library
4. Document expected inputs/outputs for each function
5. Add error handling for all async operations
```

## Explain Mode (`--explain`)

Usage: `/qa-review path/to/file.ts --explain`

When present, append this section after the standard report:

```
### Why This Matters
[For each HIGH/MEDIUM finding, 1-2 plain-language sentences on the underlying concept —
not just what's wrong, but why it's a testing problem in general, not just in this file.
Link concepts to GLOSSARY.md terms where applicable, e.g. "See: Non-determinism".]
```

Keep it concept-level, not a repeat of the finding. The finding already says *what*; this says *why it generalizes*.

## Notes

- Testability review ≠ code quality review — orthogonal concerns. Even beautiful code can be untestable; even ugly code can be testable.
- **Credit handling that is present; don't flag it.** Well-guarded I/O — a `fetch` with a timeout, a try/catch with a graceful fallback — is a *coupling* to note (still not injectable), not a "missing error handling" gap. Report the seam you'd need to mock, not an error path the code already covers.
