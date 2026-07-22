<!-- Sample: /gate on a PASSED Playwright report + a PARSED confirmed-clean audit-test emission → SHIP (the B→A graduation). Grades PASS: presents the earned decision, shows its work, advisory framing, notes ship was reachable only via a parsed confirmed-clean verdict, ingests-not-runs, no fabricated number. -->

Resolved evidence for this PR:
- Playwright report: `test-results/results.json` — PASSED (12 expected, 0 unexpected, 0 flaky)
- audit-test emission: `audit-test.confirmed.json` — parsed (`gate-audit-test/v0.2`: deep-audited 4, all confirmed-solid, no hollow tests)
- subject: pr-head `abc1234`

Running the deterministic gate (`gate.mjs`). I did not run the suite and I did not recompute the decision — the Gate ingested existing evidence and reports what the gate returned.

## Gate decision: 🟢 SHIP  ·  advisory (did not fail the build)

subject: pr-head `abc1234`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — PASSED · confirmed → proposes **ship**

### Rationale
- playwright PASSED → ship-baseline
- audit-test PASSED + confirmed → ship-eligible — no hollow tests among the deep-audited subset (4 of 12 triaged tests mutation-audited; 8 unexamined — not evidence of health)
- worst-wins over {ship} → ship

> `ship` earned: playwright passed and `audit-test` found no hollow tests among the deep-audited subset (4 of 12 triaged tests mutation-audited; 8 unexamined — not evidence of health).
> Advisory / report-first: a recommendation, not a build failure.

Bundle written to `gate-bundle.json`

**What this means:** the Playwright suite passed and the audit-test verdict was supplied **parsed** and execution-confirmed clean (PASSED + confirmed), so the credibility axis also proposed `ship` and worst-wins landed on `ship`. This is the one path to `ship` — it was reachable only because a parsed confirmed-clean audit-test verdict was provided; an opaque report or no audit-test at all would have capped the decision at canary. No confidence number is produced; the gate reasons over categories only. the Gate ingested existing evidence and did not launch a browser or run the suite.
