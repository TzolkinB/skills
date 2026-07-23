---
name: gate
description: "The Gate stage (stage 7). Ingest a PR's existing E2E results (Playwright JSON and/or a Cypress Module API result) + an audit-test verdict (parsed emission or opaque report) into one readable evidence bundle, then derive an advisory ship/canary/hold release decision by worst-wins. Recommends ship only when the PR's own E2E results are green AND a parsed audit-test verdict reports no hollow tests among the tests it deep-audited AND that deep-audited fraction clears the examined-floor (default 50%, overridable down to a 25% minimum) — a shape-checked self-report, not an independent re-verification; caps at canary while credibility is unread, unparsed, or under-examined; carries no confidence number; advisory only — does not abort the build, and a hold/canary does not by itself stop a deployment. Use at the end of a PR to turn scattered test signals into one honest, human-readable release recommendation."
argument-hint: "[path to Playwright results.json and/or a Cypress result.json] [optional: path to an audit-test emission .json or report .md]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
---

**Owns:** the release **Gate** — aggregating a PR's existing test Evidence into one bundle and emitting an
advisory `ship`/`canary`/`hold` decision. the Gate owns the ship verdict; `/sentinel`-the-orchestrator does not
speak shippability ([#99](https://github.com/TzolkinB/skills/issues/99)).
**Not this:** running a suite or a browser → out of scope, the Gate **ingests existing evidence only**
([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)); proving a green test isn't
hollow → `/audit-test` (the Gate *consumes* its report); which specs a diff hits → `/e2e-impact`; diagnosing a
red spec → `/debug-test`.

the Gate reads what a PR already produced — an E2E result (a Playwright JSON report and/or a Cypress
`CypressRunResult`), and (if you ran it) an `audit-test` report — binds them into **one readable evidence
bundle** (in-toto-*shaped* Statement entries — [ADR-0032](../../docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)
— one structured JSON record per stage, sharing the PR head commit as subject — **not a signed
attestation**), and derives one **categorical, advisory** release decision by taking the **most conservative**
category any input proposes — **worst-wins, spelled out**: if any input proposes `hold` → `hold`; else if any
input proposes `canary` → `canary`; else `ship`. The decision rule is **deterministic code** (`gate.mjs`), not a
judgment call: given the same bundle, it always yields the same decision. That determinism is scoped to this one
step — the gate *decision* over an already-produced bundle is reproducible; the upstream evidence-gathering that
fills the bundle (the Playwright/Cypress run, the `audit-test` mutation) is not itself claimed to be
deterministic, and the Gate makes no promise about it.

## Steps

### 1. Resolve the evidence inputs

**Execution evidence — at least one E2E result is required** (both may be given; the gate takes
worst-wins across them, so ship needs *every* suite green):

- **Playwright report** (`--playwright`): the JSON reporter's output — from `$ARGUMENTS`, or discover it
  (`Glob` for `test-results/results.json`, or the `outputFile` in `playwright.config.*`).
- **Cypress result** (`--cypress`): the aggregate object `cypress.run()` resolves to (a `CypressRunResult`).
  Cypress does not write this to a file on its own, so produce it with a tiny Node wrapper:
  ```js
  // save-cypress-result.mjs  →  node save-cypress-result.mjs
  import cypress from 'cypress';
  import { writeFileSync } from 'node:fs';
  const r = await cypress.run();                 // runs the suite, resolves to CypressRunResult
  writeFileSync('cypress-results.json', JSON.stringify(r, null, 2));
  ```
  **Why the Module API result and not `cypress run --reporter json`?** Only the Module API result preserves
  per-test `attempts[]` — the *only* place a **flaky** (failed-then-passed-on-retry) test is recorded, because
  Cypress emits no aggregate `flaky` count. the Gate derives the WARNED signal from those attempts; the plain
  mocha `json` reporter has no attempts and would silently drop the flake (a false green). Verified against the
  Cypress Module API + test-retries docs (2026-07-17).

If there is no E2E result at all, tell the user to run their suite first — the Gate ingests a report, it does
not run the suite. An **empty or zero-test report** (nothing executed to a pass/fail verdict — e.g. a suite
that never ran, or a wrong `--playwright` path) is treated as **no execution evidence → `hold`**, never as a
pass: a green-looking `{}` is exactly the false confidence the Gate exists to refuse ([#111](https://github.com/TzolkinB/skills/issues/111)).

- **audit-test verdict** (optional) — two grades of credibility evidence, best first:
  - **Parsed emission** (`--audit-test-json`): a `gate-audit-test/v0.2` tally written by `/audit-test --emit-json=<path>`.
    This is the **graduated** input — a *parsed* confirmed-clean verdict that also clears the **examined-floor**
    (`deepAudited`/`audited` ≥ 50% by default) is the only thing that can lift the ceiling to `ship`
    ([#127](https://github.com/TzolkinB/skills/issues/127), [ADR-0035](../../docs/adr/0035-gate-examined-floor.md)).
  - **Opaque report** (`--audit-test`): a Markdown report from a prior `/audit-test` run. Carried verbatim but not
    machine-read → caps the decision at `canary` (`human-must-read`).
  - **Neither**: fine — *absence* also floors at `canary` (`no-credibility-evidence`), so a bare green Playwright run
    can never launder into `ship`.
  - If **both** a `.json` emission and a `.md` report are given, the parsed emission decides and the Markdown rides
    along inline for the human. A malformed emission is **ignored with a warning** and degrades to the opaque report
    (or absent) — never a silent upgrade.
- **PR head commit**: `git rev-parse HEAD` — the bundle's subject.

### 2. Run the deterministic gate
Run the bundled script from **this skill's base directory** (shown to you when the skill was invoked):

```
node "<skill base dir>/gate.mjs" (--playwright=<results.json> | --cypress=<cypress-results.json>) \
     [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--examined-floor=<pct>] \
     --commit=<sha> --out=gate-bundle.json
```
(Pass `--playwright`, `--cypress`, or both — at least one is required. `--examined-floor` defaults to
`50`; a requested value below the `25` minimum is clamped, with a warning, never silently accepted —
only pass it when you consciously want to accept a narrower deep-audited scope than the default.)

The script ([`gate.mjs`](./gate.mjs)) ingests, assembles the bundle, runs the worst-wins gate, appends a
`gate.local/gate/v0` entry, validates against the honesty guard
([`schema/evidence-bundle.v0.schema.json`](./schema/evidence-bundle.v0.schema.json)), and prints the report.
**Do not recompute or override the decision** — it is the script's deterministic output.

### 3. Present the decision — as-is
Show the script's report: the decision, the per-input proposals (it **shows its work**), and the rationale.
Tell the user where the bundle was written. Then interpret it honestly:

- **`hold`** — an E2E failure (Playwright or Cypress), an **empty/zero-test report**, or no execution
  evidence at all dominates. Route the red to `/debug-test`; the gate is not the place to fix it. (A
  confirmed-hollow `audit-test` finding is a `canary`, not a `hold` — the code may be fine; it's the *test*
  that needs fixing.)
- **`canary`** — release cautiously with monitoring / a human gate. Read the rationale for *why* it floored:
  - `human-must-read`: an **opaque** `audit-test` report is present — a human must read it (the Gate carries it
    but does not machine-read it). Re-gate with a **parsed** emission (`--audit-test-json`) to let the Gate read it.
  - `no-credibility-evidence`: no `audit-test` at all — run `/audit-test --changed --emit-json=<path>` and re-gate.
  - confirmed-hollow / likely-hollow / baseline-lock: `audit-test` found a real credibility defect — fix the flagged
    test(s) (`/audit-test` names them), then re-gate.
  - examined-nothing / reasoning-only: the audit ran but proved nothing (deep-audited 0, or the env wasn't
    runnable) — nothing was execution-verified, so credibility is unconfirmed.
  - **below the examined-floor**: `PASSED` + `confirmed`, but the deep-audited fraction fell short of the
    floor (default 50%) — a real confirmed-clean result over too small a slice to call the whole suite honest
    ([#127](https://github.com/TzolkinB/skills/issues/127)). Deep-audit more of the suite and re-gate, or
    re-run with a consciously lower `--examined-floor` (never below 25%) if the narrower scope is acceptable.
- **`ship`** — *every* E2E suite you passed in (Playwright and/or Cypress) is green **and** a *parsed*
  `audit-test` verdict is `PASSED` + `confirmed` **and** the deep-audited fraction clears the examined-floor
  (`deepAudited`/`audited` ≥ 50% by default): the deep audits ran, killed their mutations, found no hollow
  tests **among the deep-audited subset**, and that subset was big enough to call the result honest. This
  proves that subset, not the whole suite — `unexamined` tests are *not* evidence of health, and the report
  states the examined/unexamined split so the scope is never oversold. This is the one path to `ship`, and it
  is deliberately hard to reach — a single red suite, an **empty/zero-test** report, an opaque, absent, or
  vacuous audit, or a confirmed-clean audit that examined too little of the suite, never gets here.

The decision is **advisory only** — the Gate does not abort the build, and a `hold` or `canary` does not by
itself stop a deployment; nothing here enforces anything, so treat the report as input to a human or CI decision,
not as the decision itself (blocking is a future opt-in,
[ADR-0026](../../docs/adr/0026-live-evals-opt-in-pr-and-scheduled-drift.md)).

## Output Format

Present the script's report verbatim. A `canary` (opaque audit-test) and the earned `ship` (parsed
confirmed-clean audit-test) look like:

```
## Gate decision: 🟡 CANARY  ·  advisory (did not fail the build)

subject: pr-head `<sha>`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — present but opaque (unread) → proposes **canary**

### Rationale
- playwright PASSED → ship-baseline
- audit-test present but opaque → floor at canary (human must read the report)
- worst-wins over {ship, canary} → canary

> `ship` needs a *parsed* confirmed-clean `audit-test` verdict to unlock … Advisory / report-first.

Bundle written to gate-bundle.json
```

```
## Gate decision: 🟢 SHIP  ·  advisory (did not fail the build)

subject: pr-head `<sha>`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — PASSED · confirmed → proposes **ship**

### Rationale
- playwright PASSED → ship-baseline
- audit-test PASSED + confirmed → ship-eligible — no hollow tests among the deep-audited subset (6 of 12 triaged tests mutation-audited; 6 unexamined — not evidence of health) (50% examined, clears the 50% examined-floor)
- worst-wins over {ship} → ship

> `ship` earned: playwright passed and `audit-test` found no hollow tests among the deep-audited subset (6 of 12 triaged tests mutation-audited; 6 unexamined — not evidence of health). Advisory / report-first.

Bundle written to gate-bundle.json
```

## Notes

- **Ingests, never executes** ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
  the Gate reads a Playwright report and a Markdown file — pure consumption. It never launches a browser or a
  suite. Snapshotting a *live* response is an execution-layer artifact, out of scope.
- **Two E2E frameworks on one execution axis.** Playwright (JSON report) and Cypress (Module API
  `CypressRunResult`) both ingest to the same result → proposal mapping; the gate takes worst-wins across
  every suite present, so a green Playwright can't paper over a red Cypress. **The one asymmetry is honest,
  not hidden:** Playwright reports `stats.flaky` directly; Cypress has no such count, so the Gate *derives*
  the flaky (WARNED) signal by scanning per-test `attempts[]` for a failed-then-passed retry — the metric is
  labelled `flakyDerived` in the bundle to say so. (Unit-tested / component ingest is still a later increment.)
- **`audit-test` rides in two grades.** *Parsed* (`--audit-test-json`): `/audit-test --emit-json` writes its
  batch tally as `gate-audit-test/v0.2` structured data — the per-class **counts**, not prose. the Gate derives
  the category (`result`+`label`) from those counts mechanically (same as it restates Playwright's `stats`) and
  the gate reads only the derived category, never the counts (honesty guard #1). *Opaque* (`--audit-test`): the
  Markdown is carried verbatim and **not** prose-scraped, so it can only floor at `canary`. The **theater guard
  is structural**: only a parsed `PASSED`+`confirmed` verdict reaches `ship`; an opaque, absent, or examined-nothing
  audit all cap at `canary`, so there is no "run less, grade better" incentive.
- **Coverage-aware ship gate — the examined-floor** ([#127](https://github.com/TzolkinB/skills/issues/127),
  [ADR-0035](../../docs/adr/0035-gate-examined-floor.md)). A confirmed-clean verdict alone used to be enough to
  ship, even if `deepAudited` was a small minority of `audited` (the shipped fixture used to be `4 of 12` — 33%).
  The gate now ALSO requires `deepAudited`/`audited` to clear a floor — default **50%**, overridable via
  `--examined-floor` but never below a **25%** minimum, clamped (with a warning) rather than silently honored.
  Like everything else in the gate, the floor's numbers live only in rationale *prose*, never as a field on the
  gate predicate (honesty guard #3 still holds).
- **No manufactured number.** There is no `confidence`/score anywhere; the gate reasons over categories, not
  magnitudes. The schema forbids a numeric field in the gate entry — re-adding one requires a schema-version
  bump, which is the signal a real calibration loop has landed.
- **Advisory / report-first** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) —
  it recommends, it never blocks a merge in v0. A `hold` or `canary` is a recommendation for a human or a CI
  pipeline to act on; the Gate has no mechanism of its own to stop a build or a deployment.
- **Housing & extraction:** everything lives under this one directory with a `gate://` namespace, so
  lifting the Gate to a standalone plugin is a folder move ([#99](https://github.com/TzolkinB/skills/issues/99),
  [#102](https://github.com/TzolkinB/skills/issues/102)).
- **Naming:** this skill was called "Witness" before [ADR-0032](../../docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)
  renamed it to "Gate" ([#113](https://github.com/TzolkinB/skills/issues/113)). ADRs and other historical records
  written before that rename still say "Witness" by design — history isn't rewritten — but every current
  user-facing surface (this file, the README, the CLI output) says "Gate."
- `--explain` is not supported — procedural, not pedagogical.
