---
name: sentinel
description: Run a full QA pass on a feature branch — test plan gaps, coverage, assertion quality, regression risks
argument-hint: "[branch or file path]"
allowed-tools: [Read, Bash, Glob]
---

## Philosophy

Sentinel watches your code the way a QA professional does—not just "does it run?" but "will it actually work? Will it break later? Did we test what matters?"

Sentinel is your testing framework: fast iteration, verify behavior, catch the AI hallucinations before they ship.

## Steps

1. Parse the branch/path from $ARGUMENTS
2. Find all test files and code files in the change
3. If `--explain` is present in $ARGUMENTS, pass it through to every sub-skill call below, and append your own "Why This Matters" section at the end (see Explain Mode).
4. For each file pair (test + code):
   - Run `/test-plan` on the feature description (from commit message or ask)
   - Run `/coverage-review` (test vs code)
   - Run `/qa-review` (testability issues)
   - Run `/debug-test` on any failing tests found in the change
5. Aggregate layer recommendations from the `/test-plan` output and compute a one-line layer distribution summary (`unit/component/integration/e2e`)
6. Synthesize findings into a **pass/fail verdict**:
   - 🟢 **PASS**: Coverage is solid, no major gaps, no testability blockers
   - 🟡 **CAUTION**: Minor gaps or loose assertions, but shippable with notes
   - 🔴 **FAIL**: Major untested paths, brittleness risks, or assertions that make no sense
7. Output a **Sentinel Report** with risk summary

## Output Format

```
# Sentinel Report: [Branch Name]

## Overview
**Verdict:** 🟡 CAUTION  
**Risk Level:** Medium  
**Shippable:** Yes, with notes

---

## Test Plan Coverage
✓ Happy path mapped  
✓ Edge cases listed  
⚠ Error paths incomplete (database failure not tested)
Layers: 2 unit / 3 component / 4 integration / 1 e2e

---

## Coverage Review Summary
**Lines Tested:** 84%  
**High-Risk Gaps:**
- Line 42: Database write error handling — no test
- Line 15: Date boundary condition (midnight) — not tested

**Loose Assertions:**
- `expect(result).toBeDefined()` (line 8) — should assert structure

---

## Testability Audit
🔴 **HIGH** Hard-coded API URL (line 12) — can't test with mock  
⚠ **MEDIUM** Uses Date.now() directly (line 28) — flaky tests  
✓ All error paths have catch blocks with logging

---

## Assertion Quality
- Tests are verifying behavior (not just green lights) ✓
- Mocks are set up correctly ✓
- Async/await handled properly ✓
- One suspicious test (line 45): `expect(bookings.length).toBeGreaterThan(0)` — too loose

---

## Risk Summary
| Category | Count | Severity |
|----------|-------|----------|
| Untested paths | 2 | HIGH |
| Testability issues | 2 | MEDIUM |
| Loose assertions | 1 | MEDIUM |
| Brittleness risks | 1 | LOW |

---

## Recommendations
1. **BEFORE SHIPPING:** Mock the API URL (testability)
2. **BEFORE SHIPPING:** Add test for database write failure
3. **FOLLOW-UP:** Refactor Date.now() to injectable clock
4. **NICE TO HAVE:** Tighten assertion on line 45 to check structure

---

## Notes
- Sentinel report generated at 2026-07-07 15:42 UTC
- Branch: `feat/booking-calendar`
- Files reviewed: BookingService.test.js, BookingService.js
```

## Explain Mode (`--explain`)

Usage: `/sentinel feature-branch --explain`

When present:
- Every sub-skill call includes `--explain`, so each of their reports carries its own "Why This Matters" section
- Add one additional top-level section after the Risk Summary:

```
### Why This Matters (Overall)
[2-3 sentences tying the verdict to the core Sentinel philosophy: tests verify behavior,
not green lights. Point to the specific finding in this run that best illustrates it.]
```

This is the mode to use when reviewing a branch with someone newer to testing — the report becomes a walkthrough, not just a checklist.

## Notes

- Sentinel is the orchestrator—it calls the other skills and synthesizes the report
- Verdict: PASS = ship it; CAUTION = ship with known gaps; FAIL = fix before shipping
- Focus on HIGH and MEDIUM risks; flag LOW for follow-up
- Give the developer actionable next steps, not just complaints
- A report that says "too many issues" is useless; prioritize by shippability impact
- `/threat-model` exists as a separate skill and is intentionally NOT part of this chain — it answers a different question (what breaks in production) than shippability (are tests solid). Call it on its own when that's the question, don't assume `/sentinel` covers it.
