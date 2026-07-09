---
name: coverage-review
description: Review test coverage and flag untested paths, edge cases, and assertion gaps
argument-hint: "[test file path] [code file path]"
allowed-tools: [Read, Bash]
---

## Philosophy

A test suite that makes green lights doesn't protect you. Coverage review asks: "What could break that these tests wouldn't catch?" It's the anti-AI-makes-it-pass tool.

## Steps

1. Read the test file (first argument)
2. Read the code being tested (second argument)
3. Identify what the tests actually verify (not what they claim to)
4. List code paths, conditions, and edge cases in the source
5. Flag every path NOT covered by an assertion
6. Flag assertions that are too loose (e.g., `expect(result).toBeDefined()`)
7. Flag untested error paths, boundary conditions, state transitions
8. Summarize gaps in order of risk
9. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.

## Output Format

```
## Coverage Review: [Code File]

### Covered Behaviors
- Happy path (POST /api/book returns 201)
- Valid input validation (rejects invalid dates)

### GAPS (Not Tested)
- [ ] **HIGH RISK** Error handling: what if database write fails? (Line 42, no catch block tests)
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
```

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

- Don't just count lines covered; look at logic branches
- A test that runs code but doesn't assert anything is worthless
- Flag any `catch` block that isn't tested
- Boundary conditions: 0, 1, -1, max, null, undefined, empty string, [], {}
- State transitions: before/after state, side effects
