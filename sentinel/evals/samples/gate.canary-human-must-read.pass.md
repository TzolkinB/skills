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

> `ship` needs a *parsed* proven-clean `audit-test` verdict to unlock — an opaque or absent `audit-test` caps credibility at `canary`. Run `/audit-test --emit-json=<path>` and pass it via `--audit-test-json` to raise the ceiling.
> Advisory / report-first: a recommendation, not a build failure.

Bundle written to `witness-bundle.json`

**What this means:** the Playwright suite passed, but the audit-test report is carried opaquely — a human must read it before shipping, which floored the decision at canary. No confidence number is produced; the gate reasons over categories only. Witness ingested existing evidence and did not launch a browser. `ship` wasn't reached because the audit-test is opaque — a parsed proven-clean verdict (`--audit-test-json`) is what would unlock it, so canary is the honest result here, not a downgrade.
