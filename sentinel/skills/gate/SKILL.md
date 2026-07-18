---
name: gate
description: "Witness — the Gate stage (stage 7). Ingest a PR's existing Playwright JSON + audit-test report into one readable evidence bundle, then derive an advisory ship/canary/hold release decision by worst-wins. Refuses to certify ship while test-credibility evidence is unread; carries no confidence number; never fails the build. Use at the end of a PR to turn scattered test signals into one honest, auditable release recommendation."
argument-hint: "[path to Playwright results.json] [optional: path to an audit-test report .md]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
---

**Owns:** the release **Gate** — aggregating a PR's existing test Evidence into one bundle and emitting an
advisory `ship`/`canary`/`hold` decision. Witness owns the ship verdict; `/sentinel`-the-orchestrator does not
speak shippability ([#99](https://github.com/TzolkinB/skills/issues/99)).
**Not this:** running a suite or a browser → out of scope, Witness **ingests existing evidence only**
([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)); proving a green test isn't
hollow → `/audit-test` (Witness *consumes* its report); which specs a diff hits → `/e2e-impact`; diagnosing a
red spec → `/debug-test`.

Witness reads what a PR already produced — a Playwright JSON report, and (if you ran it) an `audit-test`
report — binds them into **one readable evidence bundle** (in-toto Statements over a single subject, the PR
head commit), and derives one **categorical, advisory** release decision by taking the **most conservative**
category any input proposes (worst-wins). The decision rule is **deterministic code** (`witness.mjs`), not a
judgment call: the same bundle always yields the same decision, because a release gate must be reproducible.

## Steps

### 1. Resolve the evidence inputs
- **Playwright report** (required): the JSON reporter's output — from `$ARGUMENTS`, or discover it
  (`Glob` for `test-results/results.json`, or the `outputFile` in `playwright.config.*`). If there is no
  Playwright JSON report, tell the user to run their suite with the `json` reporter first — Witness ingests a
  report, it does not run the suite.
- **audit-test report** (optional): a Markdown report from a prior `/audit-test` run, saved to a file. If the
  user hasn't run `/audit-test`, that's fine — its *absence* still floors the decision at `canary` (below).
- **PR head commit**: `git rev-parse HEAD` — the bundle's subject.

### 2. Run the deterministic gate
Run the bundled script from **this skill's base directory** (shown to you when the skill was invoked):

```
node "<skill base dir>/witness.mjs" --playwright=<results.json> [--audit-test=<report.md>] \
     --commit=<sha> --out=witness-bundle.json
```

The script ([`witness.mjs`](./witness.mjs)) ingests, assembles the bundle, runs the worst-wins gate, appends a
`witness.local/gate/v0` entry, validates against the honesty guard
([`schema/evidence-bundle.v0.schema.json`](./schema/evidence-bundle.v0.schema.json)), and prints the report.
**Do not recompute or override the decision** — it is the script's deterministic output.

### 3. Present the decision — as-is
Show the script's report: the decision, the per-input proposals (it **shows its work**), and the rationale.
Tell the user where the bundle was written. Then interpret it honestly:

- **`hold`** — a Playwright failure (or no execution evidence) dominates. Route the red to `/debug-test`;
  the gate is not the place to fix it.
- **`canary`** — release cautiously with monitoring / a human gate. In v0 this is the honest ceiling.
  - If it floored on `human-must-read`: the inline `audit-test` report **must be read** by a human — Witness
    carries it but does not machine-read it.
  - If it floored on `no-credibility-evidence` (no `audit-test`): recommend running `/audit-test` on the
    changed tests and re-gating, to raise credibility.
- **`ship`** — **unreachable in v0 by design.** Witness cannot machine-confirm test trustworthiness while
  `audit-test` is opaque, so it legitimately cannot certify `ship`. A *parsed* `audit-test` verdict (the
  next Witness increment) unlocks it. Read `canary` as "the honest top grade today," not a downgrade.

The decision is **advisory** — it never fails the build (blocking is a future opt-in,
[ADR-0026](../../docs/adr/0026-live-evals-opt-in-pr-and-scheduled-drift.md)).

## Output Format

```
## Witness — Gate decision: 🟡 CANARY  ·  advisory (did not fail the build)

subject: pr-head `<sha>`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — present but opaque (unread) → proposes **canary**

### Rationale
- playwright PASSED → ship-baseline
- audit-test present but opaque → floor at canary (human must read the report)
- worst-wins over {ship, canary} → canary

> `ship` is unreachable in v0 by design … Advisory / report-first.

Bundle written to witness-bundle.json
```

## Notes

- **Ingests, never executes** ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
  Witness reads a Playwright report and a Markdown file — pure consumption. It never launches a browser or a
  suite. Snapshotting a *live* response is an execution-layer artifact, out of scope.
- **Playwright JSON only in v0.** Cypress ingest is a later increment — stated, not faked.
- **`audit-test` rides opaque and inline.** Its Markdown is carried verbatim in the bundle (no `.md` to hunt
  for), and it is **not** prose-scraped — its presence floors the decision at `canary`, so a green Playwright
  run alone can never launder into a clean `ship`. Absence floors at `canary` too, so there is no
  "run less, grade better" incentive.
- **No manufactured number.** There is no `confidence`/score anywhere; the gate reasons over categories, not
  magnitudes. The schema forbids a numeric field in the gate entry — re-adding one requires a schema-version
  bump, which is the signal a real calibration loop has landed.
- **Advisory / report-first** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) —
  it recommends, it never blocks a merge in v0.
- **Housing & extraction:** everything lives under this one directory with a `witness://` namespace, so
  lifting Witness to a standalone plugin is a folder move ([#99](https://github.com/TzolkinB/skills/issues/99),
  [#102](https://github.com/TzolkinB/skills/issues/102)).
- `--explain` is not supported — procedural, not pedagogical.
