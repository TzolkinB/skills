---
name: test-plan
description: Generate a structured QA test plan from a feature description or ticket
argument-hint: "[feature description] [--digest] [--explain]"
allowed-tools: [Read, Bash]
disable-model-invocation: true
---

A test plan is a contract between you and the code. It says "this behavior will work this way." The plan should be testable, specific, and find bugs—not describe how to make a green light.

## Steps

1. Parse the feature description from $ARGUMENTS, or ask for it if empty
2. Break it into **acceptance criteria** (what constitutes "done")
3. Build **happy path** (the typical flow)
4. Add **edge cases** (boundaries, limits, weird inputs)
5. Add **unhappy paths** (errors, rejection, edge state transitions)
6. List **preconditions** (what state must already exist)
7. Assign a recommended test layer to every case in Happy Path / Edge Cases / Unhappy Paths: `unit`, `component`, `integration`, or `e2e` (use Layer Heuristics below)
8. Format as a numbered outline or markdown table with the layer label shown on each case
9. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.
10. If `--digest` is present in $ARGUMENTS, emit the [shared digest card](../shared/digest-format.md) **instead of** the plan above — the same cases, trimmed to the riskiest ones as risk / evidence / action / confidence. A plan's confidence ceiling is **Likely**: it's reasoned from a description, not graded against a written spec.

## Output

```
## Test Plan: [Feature Name]

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Happy Path
- [ ] `e2e` — User submits booking request and sees confirmation
- [ ] `integration` — Booking write succeeds and persists expected fields

### Edge Cases
- [ ] `component` — Empty input shows inline validation message
- [ ] `component` — Max length exceeded shows validation error
- [ ] `integration` — Overlap constraint rejects double-booking at minute boundary
- [ ] `unit` — Time-range guard rejects end-before-start

### Unhappy Paths
- [ ] `integration` — Permission denied returns authz error contract
- [ ] `e2e` — Network failure surfaces user-facing retry guidance
- [ ] `integration` — Invalid state transition is rejected with no partial write

### Preconditions
- User must be logged in
- Database must have seed data

**Next:** `/qa-review src/booking/BookingService.ts` once the code exists — a plan only holds if the code can be tested
```

Close every plan — full or `--digest` ([shared card](../shared/digest-format.md)) — with that one-line [`Next:` footer](../shared/next-footers.md). Pick the row for the result you actually produced: the default is `/qa-review`, but a feature touching money, permissions, or stored data routes to `/threat-model` first.

## Explain Mode (`--explain`)

Usage: `/test-plan "feature description" --explain`

When present, append this section after the standard plan:

```
### Why This Matters
[1-2 sentences on why edge/unhappy paths matter as much as the happy path, and why a test
plan is written before the code, not after. Link to GLOSSARY.md terms where applicable,
e.g. "See: Acceptance Criteria", "See: Boundary Condition".]
```

## Notes

- Layer Heuristics:
	- `unit` — pure logic, no I/O. Formatting, guards, calculations.
	- `component` — client-side UI logic that never needed a real backend. Field validation, disabled buttons, conditional rendering.
	- `integration` — authz/RLS, DB triggers/constraints, API contracts, PII boundaries. No browser.
	- `e2e` — one thin real-browser journey per critical path. If it would still pass with a browser swapped for an API client, downgrade to `integration`.
- Include boundary conditions (0, 1, max-int, negative, null) and state dependencies (does this feature depend on another feature's state?).
- Tests should fail if the criteria aren't met, not pass because the criteria are loose.
