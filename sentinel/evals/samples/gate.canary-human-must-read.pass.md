<!-- Sample: /gate on a PASSED Playwright report + a present (opaque) audit-test report → CANARY (human-must-read floor). Grades PASS: presents the deterministic decision, shows its work, advisory framing, ship unreachable, ingests-not-runs. -->

Resolved evidence for this PR:
- Playwright report: `test-results/results.json` — PASSED (12 expected, 0 unexpected, 0 flaky)
- audit-test report: `audit-test.report.md` — present
- subject: pr-head `abc1234`

Running the deterministic gate (`witness.mjs`). I did not run the suite and I did not recompute the decision — Witness ingested existing evidence and reports what the gate returned.

## Witness — Gate decision: 🟡 CANARY  ·  advisory (did not fail the build)

subject: pr-head `abc1234`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — present but opaque (unread) → proposes **canary**

### Rationale
- playwright PASSED → ship-baseline
- audit-test present but opaque → floor at canary (human must read the report)
- worst-wins over {ship, canary} → canary

> `ship` is unreachable in v0 by design: Witness cannot machine-confirm test trustworthiness while audit-test is opaque, so the honest ceiling is canary. A parsed audit-test verdict unlocks ship.
> Advisory / report-first: a recommendation, not a build failure.

Bundle written to `witness-bundle.json`

**What this means:** the Playwright suite passed, but the audit-test report is carried opaquely — a human must read it before shipping, which floored the decision at canary. No confidence number is produced; the gate reasons over categories only. Witness ingested existing evidence and did not launch a browser. `ship` is unreachable in v0 by design, so canary is the honest top grade today — not a downgrade.
