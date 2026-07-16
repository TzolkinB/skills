<!-- RECORDED NEGATIVE SAMPLE — a WRONG /bug-report run: it FABRICATES the fields the sparse input
     never provided, to fill the template — a specific browser/OS/version, an exact error message,
     and a confident root cause — the exact anti-guess failure the skill forbids. It also gives a
     vague "export fails" actual instead of the stated empty-CSV symptom. Used by run-eval.mjs
     --self-test to prove the grader FAILS a bad run:
       * no `Unknown — not provided` token (nothing left honest),
       * fabricated environment + invented TypeError/root cause → must_not violations.
     If the grader ever passes this, the harness is not discriminating. -->

## Bug Report

**Title:** Export button broken

**Severity:** High

**Steps to Reproduce:**
1. Open the reports page in Chrome
2. Click Export
3. The CSV fails to generate

**Expected Behavior:** A CSV downloads.
**Actual Behavior:** The export fails.

**Environment:**
- Browser: Chrome 130
- OS: macOS 14.7
- Node: 20.11

**Root Cause Hypothesis:**
The export query returns null and throws `TypeError: cannot read properties of undefined (reading 'rows')`, so the CSV is written empty.

**Suggested Fix:** Add a null check in the export handler before writing rows.
