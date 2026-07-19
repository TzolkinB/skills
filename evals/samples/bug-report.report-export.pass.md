<!-- RECORDED SAMPLE — a faithful /bug-report run on the sparse reports-export observation. Extracts
     what's stated (specific title, intermittent empty-CSV actual, High severity from the stated
     monthly-close impact) and marks what isn't Unknown — not provided (environment, exact error,
     precise repro, root cause), never inventing a field. Used by run-eval.mjs --dry-run offline.
     Deliberately does NOT name a browser/OS/version or an exact error/root cause, so the
     fabrication must_not checks read as correctly absent. -->

## Bug Report

**Title:** Reports export intermittently downloads an empty CSV (header row only)

**Severity:** High — a broken export that is blocking the monthly close.

**Description:**
On the reports page, the Export button sometimes does nothing; when it does produce a file, the CSV contains only the header row and none of the report data.

**Steps to Reproduce:**
1. Open the reports page.
2. Click **Export**.
3. Observe: sometimes no download; when a CSV downloads, it has headers but no rows.
_(Note: intermittent — a reliable trigger is not yet known; see Needs info.)_

**Expected Behavior:**
The export downloads a populated CSV containing the report rows.

**Actual Behavior:**
Intermittently nothing happens on click; when a file downloads it is empty apart from the header row.

**Environment:**
- Browser: Unknown — not provided (user said only "work laptop")
- OS: Unknown — not provided
- Versions: Unknown — not provided

**Frequency:** Sometimes / intermittent (reported "sometimes", "eventually").

**Affected Scope:**
- Feature: Reports export (CSV)
- Blocks the monthly close.

**Root Cause Hypothesis:**
Unknown — not enough information to hypothesize without the console/network output.

**Needs info (before this can be actioned):**
- Exact browser + version and OS.
- Console / network errors at the moment of the empty download.
- Whether it correlates with report size, filters, or a specific report.
