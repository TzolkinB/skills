---
name: bug-report
description: Convert a messy failure description into a structured, actionable bug report
argument-hint: "[description of the bug]"
allowed-tools: [Read, Bash]
disable-model-invocation: true
---

A good bug report is reproducible, scoped, and actionable. It gives the person fixing it enough context that they don't have to ask follow-up questions.

## Steps

1. Parse the bug description from $ARGUMENTS
2. Extract or derive:
   - **Title** (one line, not "it's broken")
   - **Severity** (Critical, High, Medium, Low)
   - **Steps to reproduce** (numbered, as minimal as possible)
   - **Expected behavior** (what should happen)
   - **Actual behavior** (what actually happened)
   - **Environment** (OS, browser, Node version, test setup if applicable)
   - **Frequency** (Always / Sometimes / Once)
   - **Affected scope** (Is this one feature or system-wide?)
   - **Screenshots/logs** (if available)

3. Add **root cause hypothesis** (if obvious; otherwise leave blank)
4. Add **suggested fix** (if obvious; otherwise leave blank)
5. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.

## Output Format

```
## Bug Report

**Title:** [One line, specific]

**Severity:** [Critical|High|Medium|Low]

**Description:**
[1-2 sentences, high-level impact]

**Steps to Reproduce:**
1. Log in as a normal user
2. Go to /books page
3. Click "Filter by date"
4. Enter a date in the past
5. Click "Apply"

**Expected Behavior:**
The filter is applied and results update showing only books from that date forward.

**Actual Behavior:**
Page reloads and all filters are cleared. Browser console shows: `TypeError: dateRange.start is undefined`

**Environment:**
- Browser: Chrome 130          <!-- only if stated/known; otherwise: Unknown — not provided -->
- OS: macOS 14.7               <!-- only if stated/known; otherwise: Unknown — not provided -->
- Test: Using seed data from `test-setup.js`
- Reproduce: [Yes|No|Sometimes] — always

**Affected Scope:**
- Feature: Date filtering
- Components: BookList, DateFilter, useBooks hook
- Does this block other features? Yes (reporting depends on filters)

**Root Cause Hypothesis:**
[Optional] The dateRange state is cleared before the filter effect runs.

**Suggested Fix:**
[Optional] Move state reset to after filter is applied.

**Logs / Screenshots:**
[Paste any error logs or attach screenshots]
```

## Explain Mode (`--explain`)

Usage: `/bug-report "description" --explain`

When present, append this section after the standard report:

```
### Why This Matters
[1-2 sentences on why the severity/scope classification matters, and why specificity in
repro steps matters generally — e.g. "Vague repro steps are the #1 reason bugs bounce back
unresolved." Link to GLOSSARY.md terms where applicable, e.g. "See: Severity vs Priority".]
```

## Notes

- Don't say "broken" or "doesn't work"—say exactly what's wrong and what should happen
- Steps to reproduce should be repeatable by a stranger
- Severity: Critical = blocks shipping / High = feature broken / Medium = workaround exists / Low = edge case / typo
- **Never fabricate a field to fill the template.** The anti-guess rule isn't just for root cause — it covers *every* derived field. Environment (OS/browser/version), the exact error text, affected components, and repro specifics that the input doesn't support get marked **Unknown — not provided** (or listed under a short "Needs info" line), never invented. A plausible-but-wrong detail is worse than a blank: it sends the fixer down a false path, which is the opposite of this report's job. The input here is a *messy* description by definition — sparse fields are the norm, not a failure.
- If you don't know the root cause, say so—don't guess
- Frequency matters: "happens 50% of the time" is different from "always"
