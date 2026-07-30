---
name: coverage-review
description: Review test coverage and flag untested paths, edge cases, and assertion gaps — reads real coverage instrumentation when present, falls back to static analysis
argument-hint: "[test file path] [code file path] [--digest] [--explain]"
allowed-tools: [Read, Bash]
disable-model-invocation: true
---

**Owns:** what these tests *don't catch yet* — missing paths, edge cases, loose assertions. The additive gap-finder.
**Not this:** a test that passes but may guard nothing → `/audit-test` (it proves by mutation); redundant, over-mocked, or stale tests to remove → `/prune-tests`; source that's hard to test at all → `/qa-review`.

A test suite that makes green lights doesn't protect you. Coverage review asks: *what could break that these tests wouldn't catch?* It's the anti-AI-makes-it-pass tool.

**Which lines executed** is a fact a coverage tool measures better than any reasoning can — so when instrumentation is present, read it as ground truth. But a line that *executed* is not a line that was *verified*: the real value is the judgment on top — assertion quality and the edge cases nobody wrote a test for. So prefer real coverage data when it exists and fall back to static inference when it doesn't; the judgment layer runs the same either way. It never *requires* instrumentation — most AI-generated repos have none, and a hard setup barrier would defeat the point.

## Steps

1. Read the test file (first argument) and the code being tested (second argument).
2. **Determine the coverage source — prefer real, fall back to static.** Before reasoning about which lines run, look for coverage instrumentation the project already produces:
   - **JS/TS** (nyc / istanbul / c8 / jest / vitest): `coverage/lcov.info`, `coverage/coverage-final.json`, `coverage/clover.xml`, or a config that emits it (`.nycrc*`, `collectCoverage` in a jest/vitest config, `c8` in `package.json`).
   - **Java** (JaCoCo): `jacoco.xml`, `target/site/jacoco/`, `build/reports/jacoco/`.
   - Look with Bash, e.g. `ls coverage/ 2>/dev/null; find . -path '*/node_modules' -prune -o \( -name 'coverage-final.json' -o -name 'lcov.info' -o -name 'jacoco*.xml' \) -print 2>/dev/null`.
   - **Found → instrumentation mode.** Read the report and extract the *real* executed / not-executed lines and branches for the code file under review. Treat this as ground truth — don't re-derive or second-guess which lines ran. **But check freshness first:** compare the report's mtime directly against the mtime of the code file under review — `stat -f %m coverage/lcov.info <code file>` (or `stat -c %Y` on Linux). The code file is the second argument, so this needs no git and always works. **If the report is older than the source it claims to cover, it is stale ground truth** — worse than inference because it looks authoritative. Do **not** decide freshness from `git diff --name-only main...HEAD` alone: that sees only *committed* branch changes and misses the most common stale case — a dev who regenerated coverage and then kept editing (uncommitted working-tree edits, or an untracked new file), which leaves the report authoritative-looking but wrong. Mark a stale report `(possibly stale — older than the source under review)` and treat its numbers as a lower bound, not fact.
   - **Not found → static mode.** Infer coverage by reading the test and matching it against the source (the original behavior). **Never ask the user to set up coverage and never block on its absence** — most AI-generated repos have none, and degrading gracefully is the point.
3. **State the mode** at the top of the report (`Coverage source: instrumentation (lcov)` or `Coverage source: static inference`) so the reader knows how authoritative the line-level numbers are — measured fact vs. reasoned estimate.
4. Identify what the tests actually verify (not what they claim to).
5. List code paths, conditions, and edge cases in the source. In instrumentation mode, anchor "not covered" to the real uncovered lines/branches from the report; in static mode, reason them out.
6. Flag every path NOT covered by an assertion.
7. Flag assertions that are too loose (e.g., `expect(result).toBeDefined()`). **This runs identically in both modes** — instrumentation proves a line *executed*, never that anything *verified* it, so assertion-quality and edge-case judgment is exactly the value a coverage number can't give. A line at 100% coverage with a loose assertion is still a gap.
8. **Build "Escalate to audit-test" directly from step 7's findings** — one line per loose or incidental assertion: which one, a one-line reason it's worth a mutation, and the invocation (`/audit-test <test file> <code file>`). This is not new analysis; it's the prune-tests "Deferred to audit-test" hand-off applied to what step 7 already found. **Omit the section entirely when step 7 found nothing** — an escalation list with nothing to escalate is a manufactured finding, not a hand-off.
9. Flag untested error paths, boundary conditions, state transitions.
10. Summarize gaps in order of risk.
11. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.
12. If `--digest` is present in $ARGUMENTS, emit the [shared digest card](../shared/digest-format.md) **instead of** the report above — the same gaps, trimmed to the top three as risk / evidence / action / confidence. The confidence ceiling is split, and the split is the point: a line or branch read from a **fresh** instrumentation report is **Confirmed**; static-mode inference, every assertion-quality call (even in instrumentation mode), and anything from a report older than the source are **Likely**.

## Output Format

```
## Coverage Review: [Code File]
**Coverage source:** instrumentation (lcov) — 84% lines / 71% branches
<!-- or: **Coverage source:** static inference (no coverage output found) -->
<!-- or, when the report is older than the source under review: **Coverage source:** instrumentation (lcov, possibly stale — older than the source under review) — treat as lower bound -->

### Covered Behaviors
- Happy path (POST /api/book returns 201)
- Valid input validation (rejects invalid dates)

### GAPS (Not Tested)
- [ ] **HIGH RISK** Error handling: what if database write fails? (Line 42 — uncovered per lcov, no catch-block test)
- [ ] **MEDIUM** Edge case: booking at exactly midnight boundary
- [ ] **LOW** Logging calls (not asserted)

### Loose Assertions
- Line 8: `expect(result).toBeDefined()` — too vague, should assert the structure
- Line 15: `expect(bookings.length).toBeGreaterThan(0)` — could pass with wrong data

### Untested Branches
- Line 34: if-branch for overlapping bookings (no test for collision case)
- Line 41: catch (error) — no test for what happens on DB failure

### Recommended Next Tests
1. Test database write failure (throw, timeout, constraint violation)
2. Test booking collision (two simultaneous requests for same room/time)
3. Test date/time boundary (midnight, month boundary, DST)
4. Assert exact structure of returned booking object, not just existence

### Escalate to audit-test
- **Line 8** — `expect(result).toBeDefined()` passes for any non-undefined return; only a mutation shows whether it actually protects the write path. → `/audit-test booking.spec.js src/booking.js`
- **Line 15** — `expect(bookings.length).toBeGreaterThan(0)` could pass with wrong data; worth confirming by mutation. → `/audit-test booking.spec.js src/booking.js`
<!-- omit this whole section when Loose Assertions is empty — no findings, no escalation -->

**Next:** `/audit-test booking.spec.js src/booking.js` on the assertions above — this pass names them, only a mutation proves whether they bite
```

**Escalate to audit-test** is the Loose Assertions list turned into candidates, one-for-one — same entries, each naming the assertion, the one-line reason it's worth a mutation, and the invocation. Omit the section entirely when Loose Assertions has nothing in it; don't manufacture an entry to fill the template (same rule prune-tests applies to its own Deferred list).

Close every review — full or `--digest` ([shared card](../shared/digest-format.md)) — with that one-line [`Next:` footer](../shared/next-footers.md). Pick the row for the result you actually produced: loose or incidental assertions route to `/audit-test`; a report with gaps but nothing loose routes on to `/sentinel` once the gaps are closed. Both the section and the footer **point** — this skill still never runs a mutation itself, it only names the candidate ([ADR-0009](../../docs/adr/0009-coverage-review-consumes-coverage-not-produces-it.md)).

## Explain Mode (`--explain`)

Usage: `/coverage-review test.js code.js --explain`

When present, append this section after the standard report:

```
### Why This Matters
[For each HIGH/MEDIUM gap or loose assertion, 1-2 plain-language sentences on the underlying
concept — why this class of gap matters generally, not just here. Link to GLOSSARY.md terms
where applicable, e.g. "See: Loose Assertion", "See: Boundary Condition".]
```

Keep it concept-level. The gap list already says *what's* missing; this says *why it generalizes*.

## Notes

- A covered line with a loose assertion is still a gap — the executed-vs-verified distinction is the whole point (see GLOSSARY: Coverage — line vs behavioral).
- Boundary conditions to probe: 0, 1, -1, max, null, undefined, empty string, [], {}. State transitions: before/after state, side effects.
- This reads coverage reports; it does **not** run your suite to generate them. No report → static mode, never a coverage run.
- Escalate to audit-test is a mirror of the Loose Assertions list, never independent analysis — if a suite has no loose or incidental assertions, the section doesn't appear, full stop.
