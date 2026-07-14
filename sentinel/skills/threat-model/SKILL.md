---
name: threat-model
description: Threat model a change — what actually breaks in production if it's wrong, and how you'd find out — independent of whether it's tested
argument-hint: "[file path, diff, or change description]"
allowed-tools: [Read, Bash]
---

A threat model answers a different question than `qa-review` or `coverage-review`. Those ask "can I test this" and "did the tests verify it." This asks: **if this change is wrong, what actually happens, to whom, and how would anyone find out?** Code can be perfectly testable and thoroughly tested and still have a bad blast radius if it fails — this skill looks at consequence, not coverage.

This is reasoning, not verification. It doesn't execute the code under review and can't confirm a risk is real — it's a structured list of "here's what to think about," meant to be validated by the person shipping the change, not treated as a checked box.

## Steps

1. Read the file(s), diff, or change description from $ARGUMENTS
2. Identify what this change touches: data, external systems, other services/features, user-facing behavior
3. For each thing touched, ask the four axes below. Cover every data write, external system, and downstream dependent — not just the obvious one or two:
   - **Failure mode**: If this is wrong, what specifically happens? (wrong data written, request hangs, silent no-op, crash, partial state, or **fail-open** — a check that returns a safe-*looking* default like `false`/`null`/`[]` on error. Trace what that value gates upstream: if an error degrades a security, permission, or validation decision to *permit*, that's not an innocuous default — it's a silent, high-blast failure that looks harmless in the erroring function itself.)
   - **Blast radius**: How much is affected — one user, all users, one feature, something downstream? (See GLOSSARY.md: Blast Radius)
   - **Detectability**: If this fails in production, would anyone notice — an error, a metric, a support ticket — or is it a silent failure? (See GLOSSARY.md: Silent Failure)
   - **Reversibility**: Is this easy to undo (stateless, flag-gated) or hard (data migration, sent email, charged payment)?
4. Rank by impact × how long the failure would go unnoticed — a low-detectability (silent) failure outranks a loud one at the same impact, because loud failures get fixed fast and silent ones run in production
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
reversibility can matter more than probability. Point to GLOSSARY.md for the concept rather
than re-explaining it, e.g. "See: Silent Failure", "See: Blast Radius".]
```

## Notes

- Scope is consequence-of-failure only; testability (hard-coded values, non-determinism) belongs to `qa-review`. Don't re-flag it here.
- Flag reversibility as a question, not an answer — this skill identifies risk, it doesn't prescribe deployment mechanics it can't see. Don't invent a rollback plan.
- If nothing this change touches has real blast radius (e.g., an isolated internal script), say so plainly instead of manufacturing risk to fill the template.
