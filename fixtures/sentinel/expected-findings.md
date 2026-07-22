# Expected findings — sentinel / feat/payments-refund

Run: `/sentinel feat/payments-refund --sacred=src/payments/**` (scenario in `branch-scenario.md`).

Sentinel is the orchestrator: it synthesizes the sub-skill findings into ONE verdict. This scenario
plants a 🔴 **confirmed** false-confidence finding on a **sacred** path, so the Sacred-Path FAIL Override
must fire. The load-bearing judgment is that this is an **un-overridable 🔴 FAIL** — an otherwise-tidy
branch cannot soften it.

## Verdict (should be)
- **🔴 FAIL** — un-overridable. The Sacred-Path Override fired: a 🔴 confirmed false-confidence test guards
  a sacred behaviour (`src/payments/**`) and guards nothing.

## Should surface
- **Override fired, and why** — the confirmed-hollow `"refunds the full charge"` test pairs to
  `src/payments/refund.js`, which the `--sacred=src/payments/**` glob matches → un-overridable FAIL.
- **Name the sacred path that tripped** and the paired source file, so a fire is visible, not silent
  ([ADR-0014](../../docs/adr/0014-sacred-path-integrity-discovery-fails-loud.md)).
- **Honest provenance** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md))
  — count the confirmed-hollow as confirmed; report the 5 Unexamined tests as unexamined (triaged-clean, not
  proof), never dressed up as confirmed-solid.

## Boundary notes (what Sentinel should NOT do)
- **Don't soften the override to CAUTION / PASS.** Un-overridable means un-overridable; an otherwise-solid
  branch does not reduce it — this is the whole point of the sacred-path rule
  ([ADR-0007](../../docs/adr/0007-sentinel-sacred-path-fail-override.md)).
- **Confirmed-only.** A 🟡 *likely* finding would NOT fire the override — but this one is 🔴 confirmed, so it does.
- **No numeric score.** The verdict is categorical (🟢/🟡/🔴), never a percentage
  ([ADR-0002](../../docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)).
- **Don't run threat-model** — it is intentionally not in the Sentinel chain.
