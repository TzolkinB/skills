# Gate ingests Cypress — a second E2E framework on the execution axis, flake derived from attempts

**Status: Accepted (2026-07-18).** Continues epic [#49](https://github.com/TzolkinB/skills/issues/49) on top of
the parsed-audit-test graduation ([ADR-0029](0029-witness-parsed-audit-test-graduation.md), PR #107), which
named Cypress ingest as "a separate later increment." Extends the now-proven Playwright + `audit-test` spine
into Kim's second core E2E framework — squarely the app-driven domain the whole repo bets on.

## Context

MVP1 and the B→A graduation shipped **Playwright-only** on the execution axis: `witness.mjs` had one
`playwrightEntry` ingest and a gate that hard-coded `entries.find(stage === 'playwright')`, flooring to `hold`
when it was absent. The SKILL and the map both stated the limit honestly ("Playwright JSON only; Cypress is a
later increment — stated, not faked"). Cypress is the obvious next input: it is the other framework Sentinel's
own skills already target (`audit-test`, `e2e-impact`, `debug-test` all speak Playwright **and** Cypress), and
it produces the same *kind* of evidence — pass/fail/flaky execution results over a real app.

The one non-obvious problem is **flake representation**, and it drove the whole design. Playwright's JSON
reporter emits `stats.flaky` directly — a retry-then-pass count Gate reads verbatim (`deriveResult`). Cypress
has **no aggregate flaky count anywhere in its machine-readable output.** Verified against primary sources
(Cypress Module API + test-retries docs, docs.cypress.io, 2026-07-17): a flaky test — one that failed an
attempt then passed on retry — lands in `totalPassed`, and the earlier failure survives *only* in that test's
`attempts[]` array (`runs[].tests[].attempts[]`, each `{ state }`). Cypress's own docs show the derivation
pattern: `_.some(test.attempts, { state: 'failed' })`. So an honest WARNED signal has to be **derived by
scanning attempts**, not read from a stats field.

That asymmetry also decides the **input format**. There are three machine-readable Cypress outputs; only one
carries `attempts`:

- **Module API `CypressRunResult`** (what `cypress.run()` resolves to) — aggregate across all specs, and the
  **only** format with per-test `attempts[]`. Chosen.
- **`cypress run --reporter json`** (mocha's json reporter) — has `stats{passes,failures,pending}` but **no
  attempts and no flaky notion**; ingesting it would silently turn a flaky suite into a false green.
- **mochawesome** — third-party; retry fidelity unverified.

## Decision

**1. Ingest the Cypress Module API result (`CypressRunResult`).** A new `cypressEntry` maps it to the same
`witness.local/evidence/qa-stage/v0` shape Playwright uses, under `stage: 'cypress'`. The SKILL documents the
tiny Node wrapper that produces the file (`cypress.run().then(r => writeFileSync(...))`), because Cypress writes
no such file itself — and states *why* the Module API result, not `--reporter json` (the reporter drops the
flake signal).

**2. Flake is DERIVED, and labelled as derived.** `deriveCypressResult` mirrors `deriveResult`'s ordering —
`totalFailed>0 → FAILED; else derived-flaky>0 → WARNED; else PASSED` — where the flaky count comes from
`countCypressFlaky`, which counts tests that **did not end failed but have a failed `attempts[]` entry**
(retried→passed). The count rides in the evidence entry's `metrics[]` as **`flakyDerived`** (not `flaky`), so
the bundle never implies Cypress reported a number it didn't. A test that *ended* failed with failed attempts is
a failure, not a flake (guarded by a self-test).

**3. The gate generalises to an execution *axis*, worst-wins across all suites.** The Playwright-specific branch
becomes a loop over every execution-stage entry (`EXECUTION_STAGES = {playwright, cypress}`), each proposing on
the same scale (`FAILED→hold, WARNED→canary, PASSED→ship-baseline`). Absence of *all* execution evidence →
`hold` (unchanged meaning). Because the decision is still worst-wins, **`ship` now requires every execution
suite present to be green** — a green Playwright cannot paper over a red Cypress. The credibility axis
(`audit-test`) is untouched: `ship` still also requires a parsed `PASSED`+`proven` verdict.

**4. No schema-version bump.** Contract Q1 already makes `stage` a free string ("new stages need no schema
change"); `verdict.result` already enumerates PASSED/WARNED/FAILED. Adding Cypress is exactly the additive
extension the v0 contract was designed to absorb. The schema's prose description is corrected; its structure and
version are unchanged. The version-bump signal stays reserved for `confidence`/calibration.

## Considered options

- **Ingest `cypress run --reporter json` (mocha JSON).** Rejected — it has no `attempts` and no flaky concept, so
  a flaky suite would ingest as a clean PASSED. Silently downgrading the flake signal is exactly the manufactured
  confidence this repo exists to catch; a lower-friction input isn't worth a dishonest one.
- **Ingest mochawesome.** Rejected for v0 — third-party, and its retry fidelity is unverified against a primary
  source. Could be added later as another adapter if a user needs it, behind the same derive-don't-trust rule.
- **Treat Cypress as an *alternative* to Playwright (one or the other).** Rejected — a repo can run both suites,
  and worst-wins across all execution entries is both simpler and more honest than picking one.
- **Fabricate a `flaky` metric name to match Playwright's field.** Rejected — naming it `flaky` would imply
  Cypress emitted it. `flakyDerived` keeps the provenance visible (ADR-0013 in spirit: don't launder a derived
  signal as a reported one).
- **Add a real Cypress-run integration test.** Deferred — Cypress won't launch natively on this machine (macOS
  Electron incompat; Docker-only), so the adapter is proven against schema-faithful fixtures + the verified docs,
  matching how Playwright ingest was validated. A live Docker-run ground-truth of the fixtures is a fair follow-up.
  **Done (2026-07-18):** ran the Module API (`cypress.run()`) in `cypress/included:15.17.0` over a
  pass / hard-fail / fails-then-passes-on-retry spec and diffed the real `CypressRunResult` against the fixtures.
  Confirmed against live output: **no aggregate flaky count exists anywhere** at the top level (the flake survives
  only in `attempts[]`), the retried-then-passed test lands in `totalPassed` with `state:passed,
  attempts:[failed,passed]`, the ended-failed test is `attempts:[failed,failed,failed]`, and `witness.mjs` derives
  correctly against the live result (`countCypressFlaky → 1` — the ended-failed test is *not* counted;
  `deriveCypressResult → FAILED`). Every fixture field exists in the real output; the shape is identical on
  Cypress 15.17.0 (fixtures name 13.15.0), so the derivation is version-stable. This retires the last deferred
  item on Cypress ingest.

## Consequences

- **Gate ingests both core E2E frameworks.** The "Playwright JSON only" caveat is retired from the SKILL,
  schema description, and (map PR) the Gate section. The gate self-test grows Cypress rows: derivation truth
  table, the attempts-based flake derivation (incl. the ended-failed-is-not-flake guard), Cypress-only
  ship/canary/hold, and both-frameworks worst-wins (green PW + red CY → hold). CI gates on it
  (`witness.mjs --self-test`, 70 checks).
- **The honest asymmetry is documented, not hidden** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
  Playwright reports flake; Cypress's is derived from attempts and labelled `flakyDerived`; the SKILL says why the
  Module API result is required over the reporter.
- **The growth path is unchanged.** Remaining reserved ceilings stay the calibration loop / `confidence`
  ([#96](https://github.com/TzolkinB/skills/issues/96), PARKED) and non-Sentinel inputs — the triggers for plugin
  independence ([#99](https://github.com/TzolkinB/skills/issues/99)). Cypress is another execution input, not a new
  axis; it does not move those.
