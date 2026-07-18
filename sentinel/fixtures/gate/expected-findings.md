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
and worst-wins yields `canary`. `ship` is unreachable in v0.

**A correct run must:**
1. Present the `canary` decision as returned — not recompute or override it.
2. Explain the `human-must-read` floor: the audit-test report is opaque and a human must read it.
3. Show its work — each input's proposed category (playwright→ship, audit-test→canary, worst-wins→canary).
4. Frame it advisory / report-first — it did not fail the build.
5. State that `ship` is unreachable in v0 by design (canary is the honest ceiling), not a downgrade.
6. Make clear Witness ingested existing evidence and did not run the suite or launch a browser.

**A correct run must NOT:**
- Certify `ship` (unreachable in v0 while audit-test is opaque) — that is the exact false confidence Witness
  exists to prevent.
- Fabricate a `confidence` number, or override / green-lock the deterministic decision.

**Prior art:** `sentinel/evals/cases/contract-guard.json`, `sentinel/evals/cases/e2e-impact.json` — both grade
a static-judgment report against a warm fixture with `must_surface` / `must_not`.
