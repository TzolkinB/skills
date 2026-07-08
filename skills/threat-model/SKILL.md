---
name: threat-model
description: Identify what could actually break in production if this change is wrong, independent of whether it's tested
argument-hint: "[file path, diff, or change description]"
allowed-tools: [Read, Bash]
---

## Philosophy

A threat model answers a different question than `qa-review` or `coverage-review`. Those ask "can I test this" and "did the tests verify it." This asks: **if this change is wrong, what actually happens, to whom, and how would anyone find out?** Code can be perfectly testable and thoroughly tested and still have a bad blast radius if it fails — this skill looks at consequence, not coverage.

This is reasoning, not verification. It doesn't run anything and can't confirm a risk is real — it's a structured list of "here's what to think about," meant to be validated by the person shipping the change, not treated as a checked box.

## Steps

1. Read the file(s), diff, or change description from $ARGUMENTS
2. Identify what this change touches: data, external systems, other services/features, user-facing behavior
3. For each thing touched, ask:
   - **Failure mode**: If this is wrong, what specifically happens? (wrong data written, request hangs, silent no-op, crash, partial state)
   - **Blast radius**: Does this affect one user, all users, one feature, or something downstream that depends on it?
   - **Detectability**: If this fails in production, would anyone notice — an error, a metric, a support ticket — or would it fail silently?
   - **Reversibility**: Is this easy to undo (stateless, flag-gated) or hard (data migration, sent email, charged payment)?
4. Rank by (impact × likelihood you'd actually notice it went wrong)
5. If `--explain` is present in $ARGUMENTS, append a "Why This Matters" section (see Explain Mode below). Otherwise omit it — default output stays lean.

## Output Format

```
## Threat Model: [File/Change]

### What This Touches
- Data: [e.g., writes to bookings table]
- External systems: [e.g., calls payment API]
- Downstream dependents: [e.g., reporting reads this table]

### Risks (ranked)

**HIGH — [short label]**
- Failure mode: [what actually happens if wrong]
- Blast radius: [who/what is affected]
- Detectability: [how you'd find out — or wouldn't]
- Reversibility: [easy/hard, and why]

**MEDIUM — [short label]**
[same structure]

**LOW — [short label]**
[same structure]

### Open Questions (for the developer, not answered here)
- Is there a feature flag for this? [if unknown, ask]
- What's the actual rollback mechanism for this system? [Sentinel doesn't know your deploy pipeline]
```

## Explain Mode (`--explain`)

Usage: `/threat-model booking.ts --explain`

When present, append this section after the standard report:

```
### Why This Matters
[1-2 sentences per HIGH risk on why this category of failure matters generally — e.g. why
silent failures are worse than loud ones, why reversibility matters more than probability.
Link to GLOSSARY.md terms where applicable, e.g. "See: Blast Radius".]
```

## Notes

- This is deliberately independent of `qa-review` — don't re-flag testability issues (hard-coded values, non-determinism) here. Those have their own skill.
- Don't invent a rollback plan — this skill identifies risk, it doesn't prescribe deployment mechanics it can't see. Flag reversibility as a question, not an answer.
- "Silent failure" (wrong but no error, no alert) is a worse finding than "loud failure" (crashes obviously) — rank accordingly.
- If nothing this change touches has real blast radius (e.g., an isolated internal script), say so plainly instead of manufacturing risk to fill the template.
