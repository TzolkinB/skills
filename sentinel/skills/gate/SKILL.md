---
name: gate
description: "Witness — the Gate stage (stage 7). Ingest a PR's existing Playwright JSON + an audit-test verdict (parsed emission or opaque report) into one readable evidence bundle, then derive an advisory ship/canary/hold release decision by worst-wins. Certifies ship only when tests are execution-proven trustworthy; caps at canary while credibility is unread; carries no confidence number; never fails the build. Use at the end of a PR to turn scattered test signals into one honest, auditable release recommendation."
argument-hint: "[path to Playwright results.json] [optional: path to an audit-test emission .json or report .md]"
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
- **audit-test verdict** (optional) — two grades of credibility evidence, best first:
  - **Parsed emission** (`--audit-test-json`): a `witness-audit-test/v0` tally written by `/audit-test --emit-json=<path>`.
    This is the **graduated** input — a *parsed* proven-clean verdict is the only thing that can lift the ceiling to `ship`.
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
node "<skill base dir>/witness.mjs" --playwright=<results.json> \
     [--audit-test-json=<tally.json>] [--audit-test=<report.md>] \
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
  the gate is not the place to fix it. (A proven-hollow `audit-test` finding is a `canary`, not a `hold` —
  the code may be fine; it's the *test* that needs fixing.)
- **`canary`** — release cautiously with monitoring / a human gate. Read the rationale for *why* it floored:
  - `human-must-read`: an **opaque** `audit-test` report is present — a human must read it (Witness carries it
    but does not machine-read it). Re-gate with a **parsed** emission (`--audit-test-json`) to let Witness read it.
  - `no-credibility-evidence`: no `audit-test` at all — run `/audit-test --changed --emit-json=<path>` and re-gate.
  - proven-hollow / likely-hollow / baseline-lock: `audit-test` found a real credibility defect — fix the flagged
    test(s) (`/audit-test` names them), then re-gate.
  - examined-nothing / reasoning-only: the audit ran but proved nothing (deep-audited 0, or the env wasn't
    runnable) — nothing was execution-verified, so credibility is unproven.
- **`ship`** — the tests are **execution-proven trustworthy**: Playwright passed **and** a *parsed* `audit-test`
  verdict is `PASSED` + `proven` (deep audits ran, killed their mutations, found no hollow tests). This is the
  one path to `ship`, and it is deliberately hard to reach — an opaque, absent, or vacuous audit never gets here.

The decision is **advisory** — it never fails the build (blocking is a future opt-in,
[ADR-0026](../../docs/adr/0026-live-evals-opt-in-pr-and-scheduled-drift.md)).

## Output Format

Present the script's report verbatim. A `canary` (opaque audit-test) and the earned `ship` (parsed
proven-clean audit-test) look like:

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

> `ship` needs a *parsed* proven-clean `audit-test` verdict to unlock … Advisory / report-first.

Bundle written to witness-bundle.json
```

```
## Witness — Gate decision: 🟢 SHIP  ·  advisory (did not fail the build)

subject: pr-head `<sha>`  ·  3 entries

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — PASSED · proven → proposes **ship**

### Rationale
- playwright PASSED → ship-baseline
- audit-test PASSED + proven → ship-eligible (execution-proven clean: deep audits ran, no hollow tests)
- worst-wins over {ship} → ship

> `ship` earned: Playwright passed and `audit-test` is execution-proven clean. Advisory / report-first.

Bundle written to witness-bundle.json
```

## Notes

- **Ingests, never executes** ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
  Witness reads a Playwright report and a Markdown file — pure consumption. It never launches a browser or a
  suite. Snapshotting a *live* response is an execution-layer artifact, out of scope.
- **Playwright JSON only in v0.** Cypress ingest is a later increment — stated, not faked.
- **`audit-test` rides in two grades.** *Parsed* (`--audit-test-json`): `/audit-test --emit-json` writes its
  batch tally as `witness-audit-test/v0` structured data — the per-class **counts**, not prose. Witness derives
  the category (`result`+`label`) from those counts mechanically (same as it restates Playwright's `stats`) and
  the gate reads only the derived category, never the counts (honesty guard #1). *Opaque* (`--audit-test`): the
  Markdown is carried verbatim and **not** prose-scraped, so it can only floor at `canary`. The **theater guard
  is structural**: only a parsed `PASSED`+`proven` verdict reaches `ship`; an opaque, absent, or examined-nothing
  audit all cap at `canary`, so there is no "run less, grade better" incentive.
- **No manufactured number.** There is no `confidence`/score anywhere; the gate reasons over categories, not
  magnitudes. The schema forbids a numeric field in the gate entry — re-adding one requires a schema-version
  bump, which is the signal a real calibration loop has landed.
- **Advisory / report-first** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) —
  it recommends, it never blocks a merge in v0.
- **Housing & extraction:** everything lives under this one directory with a `witness://` namespace, so
  lifting Witness to a standalone plugin is a folder move ([#99](https://github.com/TzolkinB/skills/issues/99),
  [#102](https://github.com/TzolkinB/skills/issues/102)).
- `--explain` is not supported — procedural, not pedagogical.
