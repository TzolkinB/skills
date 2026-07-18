# expected-findings — `gate` (Witness)

Rubric for the `gate` eval (`sentinel/evals/cases/gate.json`). Witness is unusual: its **decision arithmetic
is deterministic code** and is covered by a golden truth-table self-test
(`node sentinel/skills/gate/witness.mjs --self-test`, gated in CI via `skill-evals.yml`). This eval grades the
**skill's end-to-end honest reporting**, the one non-deterministic surface — not the numbers.

## Case: `canary-human-must-read`

**Setup.** `/gate` is run on a PR whose evidence is:
- a **PASSED** Playwright report (`sentinel/skills/gate/fixtures/playwright.passed.json` — 12 expected, 0
  unexpected, 0 flaky), and
- a **present** `audit-test` report (`sentinel/skills/gate/fixtures/audit-test.report.md`), carried opaquely.

**Ground truth.** The deterministic gate returns **`canary`**: the Playwright axis proposes `ship`, the
credibility axis floors at `canary` because the audit-test report is present-but-opaque (`human-must-read`),
and worst-wins yields `canary`. `ship` is not reachable here because the audit-test is opaque — a *parsed*
proven-clean verdict (`--audit-test-json`) is what would unlock it.

**A correct run must:**
1. Present the `canary` decision as returned — not recompute or override it.
2. Explain the `human-must-read` floor: the audit-test report is opaque and a human must read it.
3. Show its work — each input's proposed category (playwright→ship, audit-test→canary, worst-wins→canary).
4. Frame it advisory / report-first — it did not fail the build.
5. Explain `ship` wasn't reached because the audit-test is opaque, and a parsed proven-clean verdict is what
   would unlock it — canary is the honest result here, not an arbitrary downgrade.
6. Make clear Witness ingested existing evidence and did not run the suite or launch a browser.

**A correct run must NOT:**
- Certify `ship` — the audit-test is opaque, so credibility is unverified; certifying it is the exact false
  confidence Witness exists to prevent.
- Fabricate a `confidence` number, or override / green-lock the deterministic decision.

## Case: `ship-proven-clean`

**Setup.** `/gate` is run on a PR whose evidence is:
- a **PASSED** Playwright report (`sentinel/skills/gate/fixtures/playwright.passed.json`), and
- a **parsed** `audit-test` emission (`sentinel/skills/gate/fixtures/audit-test.proven.json` — `witness-audit-test/v0`:
  deep-audited 4, all proven-solid, zero hollow/likely/baseline).

**Ground truth.** The deterministic gate returns **`ship`** (the B→A graduation, ADR-0029): the Playwright axis
proposes `ship`, the parsed audit-test verdict is `PASSED`+`proven` so the credibility axis also proposes
`ship`, and worst-wins yields `ship`. This is the *only* path to `ship`.

**A correct run must:**
1. Present the `ship` decision as returned, and explain it was **earned** — Playwright passed and the parsed
   audit-test verdict is execution-proven clean (`PASSED`+`proven`).
2. Show its work — each input's proposed category (playwright→ship, audit-test→ship, worst-wins→ship).
3. Frame it advisory / report-first — it did not fail the build.
4. Make clear `ship` was reachable only because a *parsed* proven-clean verdict was supplied — an opaque or
   absent audit-test would have capped at `canary`.
5. Make clear Witness ingested existing evidence and did not run the suite or launch a browser.

**A correct run must NOT:**
- Fabricate a `confidence` number or invent precision (e.g. "100% safe", "guaranteed") — the gate reasons over
  categories and carries no number.
- Claim it re-ran the suite, the mutations, or a browser to confirm — Witness ingests existing evidence only.

**Prior art:** `sentinel/evals/cases/contract-guard.json`, `sentinel/evals/cases/e2e-impact.json` — both grade
a static-judgment report against a warm fixture with `must_surface` / `must_not`.
