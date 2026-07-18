<!-- Sample: /gate on a PASSED Playwright report + a PARSED proven-clean audit-test emission → SHIP (the B→A graduation). Grades PASS: presents the earned decision, shows its work, advisory framing, notes ship was reachable only via a parsed proven-clean verdict, ingests-not-runs, no fabricated number. -->

Resolved evidence for this PR:
- Playwright report: `test-results/results.json` — PASSED (12 expected, 0 unexpected, 0 flaky)
- audit-test emission: `audit-test.proven.json` — parsed (`witness-audit-test/v0`: deep-audited 4, all proven-solid, no hollow tests)
- subject: pr-head `abc1234`

Running the deterministic gate (`witness.mjs`). I did not run the suite and I did not recompute the decision — Witness ingested existing evidence and reports what the gate returned.

## Witness — Gate decision: 🟢 SHIP  ·  advisory (did not fail the build)

subject: pr-head `abc1234`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — PASSED · proven → proposes **ship**

### Rationale
- playwright PASSED → ship-baseline
- audit-test PASSED + proven → ship-eligible (execution-proven clean: deep audits ran, no hollow tests)
- worst-wins over {ship} → ship

> `ship` earned: Playwright passed and `audit-test` is execution-proven clean (deep audits ran, no hollow tests).
> Advisory / report-first: a recommendation, not a build failure.

Bundle written to `witness-bundle.json`

**What this means:** the Playwright suite passed and the audit-test verdict was supplied **parsed** and execution-proven clean (PASSED + proven), so the credibility axis also proposed `ship` and worst-wins landed on `ship`. This is the one path to `ship` — it was reachable only because a parsed proven-clean audit-test verdict was provided; an opaque report or no audit-test at all would have capped the decision at canary. No confidence number is produced; the gate reasons over categories only. Witness ingested existing evidence and did not launch a browser or run the suite.
