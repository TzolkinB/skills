<!-- Sample: /gate on a FLAKY Cypress result (Module API CypressRunResult) + a PARSED proven-clean audit-test emission → CANARY. The Cypress suite reads 12/12 in totalPassed but one test failed an attempt then passed on retry; the Gate DERIVES that flake from per-test attempts[] (Cypress emits no aggregate flaky count) → WARNED → canary, even though the audit-test axis proposed ship. Grades PASS: presents the deterministic decision as-returned, shows its work, explains the derived flake + the false green it prevents, advisory framing, ingests-not-runs. -->

Resolved evidence for this PR:
- Cypress result: `cypress-results.json` (a Module API `CypressRunResult`) — reads 12/12 in `totalPassed`, `totalFailed` 0
- audit-test emission: `audit-test.proven.json` — parsed (`gate-audit-test/v0.1`: deep-audited 4, all proven-solid, no hollow tests)
- subject: pr-head `abc1234`

Running the deterministic gate (`gate.mjs --cypress=… --audit-test-json=…`). I did not run the suite and I did not recompute the decision — the Gate ingested existing evidence and reports what the gate returned.

## Gate decision: 🟡 CANARY  ·  advisory (did not fail the build)

subject: pr-head `abc1234`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `cypress` — result=WARNED → proposes **canary**
- `audit-test` — PASSED · proven → proposes **ship**

### Rationale
- cypress WARNED (flaky) → canary (a trust defect, not buried under a note)
- audit-test PASSED + proven → ship-eligible — no hollow tests among the deep-audited subset (4 of 12 triaged tests mutation-audited; 8 unexamined — not evidence of health)
- worst-wins over {canary, ship} → canary

> Advisory / report-first: a recommendation, not a build failure (blocking is a future opt-in, ADR-0026).

Bundle written to `gate-bundle.json`

**What this means:** the Cypress run reads fully green in `totalPassed` (12/12, `totalFailed` 0), but one test failed an attempt and passed on retry — a survived flake. Cypress emits no aggregate flaky count, so the Gate **derived** that WARNED signal by scanning the per-test `attempts[]` (the bundle records it as `flakyDerived`: 1) rather than reading it from a Cypress field. That derived flake is a trust defect, so the execution axis proposed **canary** — and even though the parsed audit-test verdict was execution-proven clean and proposed **ship**, worst-wins floored the decision at **canary**. The survived flake is surfaced here, not buried under the greens — which is the exact false green a plain `--reporter json` run would have shipped. No confidence number is produced; the gate reasons over categories only. the Gate ingested existing evidence and did not launch a browser or run the suite — the flake was read out of the report Cypress already produced.
