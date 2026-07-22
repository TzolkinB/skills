# audit-test — Batch / directory mode

Loaded from Step 1 when the target is a directory, glob, `--changed`, or nothing. The same audit fanned out over a set of test files, with the triage funnel doing the cost control. It's how `/sentinel` consumes this skill.

1. **Resolve the file set** (Step 1). If discovery matches no test files, report **INCONCLUSIVE — no recognized test files** and stop. A caller like `/sentinel` must treat INCONCLUSIVE as "the audit did not run," never as a clean result.
2. **Triage every test** (Step 3), then **deep-audit only the flagged ones** (Step 4) — never more than one live mutation across the whole batch, reverting between each.
3. **Cost guard.** The funnel normally keeps deep audits to a handful. If more than ~15 tests flag, or even triage is heavy, report the counts and ask the user to narrow scope rather than grinding the whole suite — deep-audit the highest-smell tests first and say plainly which ones you did **not** reach.
4. **Report the tally plus flagged-only** (see Output Format). Each flagged entry names the test **and its file path**, so a caller — e.g. `/sentinel` mapping findings to sacred paths — can locate every finding without re-triaging.

Batch mode judges tests exactly as single-test mode does; it does **not** know or care about sacred paths or branch verdicts — that's the caller's synthesis.

## Batch output (provenance tally)

Show flagged findings plus a **provenance tally** — never a flat "hold up" count, which hides the difference between a test confirmed solid and one never examined ([ADR-0013](../../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). Only deep-audited tests can be 🟢; every test that never left triage is **Unexamined**, counted separately and never as green. Each line carries the test's **file path**:

```
Audited 47 · deep-audited 5 (2 🟢 confirmed-solid · 1 🔴 confirmed-hollow · 1 🟡 likely-hollow · 1 ⚠️ baseline-lock) · 42 unexamined

🔴 "rejects overlapping bookings" (booking.spec.ts) — overmocked (proof: removed guard, still green)
⚠️ "renders the initial deck" (seed.spec.ts) — baseline-lock: assertion 12→10 co-changed with the deck slice; robots.ts declares 12 (confirm intended count)
🟡 "sends confirmation email" (email.spec.ts) — likely incidental (env not runnable, reasoned only)
🟢 "charges the card" (payment.spec.ts) — killed the proposed mutation (nulled the amount → test failed)

42 unexamined — triaged clean but never mutated; not evidence of health. Use `--all` to list them.
```

In batch mode, `--all` additionally lists the **Unexamined** tests; without it they are summarized by count only — but they are **never** folded into the confirmed-solid greens.
