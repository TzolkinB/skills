---
name: gate
description: "The Gate stage (stage 7). Ingest a PR's existing E2E results (Playwright JSON and/or a Cypress Module API result) + an audit-test verdict (parsed emission or opaque report) into one readable evidence bundle, then derive an advisory ship/canary/hold release decision by worst-wins. Recommends ship only when the PR's own E2E results are green AND ran to completion — the executed fraction of what the suite discovered clears the executed-floor (default 50%, overridable down to a 25% minimum; a near-all-skipped run caps at canary instead) — AND a parsed audit-test verdict reports no hollow tests among the tests it deep-audited AND that deep-audited fraction clears the examined-floor (default 50%, overridable down to a 25% minimum) — a content-addressed, shape-checked self-report, cross-checked against its own per-test run trace when one is carried, not an independent re-verification (Gate never re-runs the mutation); caps at canary while credibility is unread, unparsed, or under-examined; carries no confidence number; advisory only — does not abort the build, and a hold/canary does not by itself stop a deployment. Optionally DSSE-signs the gate decision + its content-addressed input digests with a self-signed ed25519 key so a reader can verify those weren't altered after Gate produced it (the ingested report bodies ride alongside, outside the signature) — self-signed, not Sigstore; unsigned by default. Use at the end of a PR to turn scattered test signals into one honest, human-readable release recommendation."
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
— one structured JSON record per stage, over **content-addressed subjects**: the PR head commit plus a sha256
digest of every ingested input file ([#139](https://github.com/TzolkinB/skills/issues/139),
[ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §2) — **DSSE-signed in-toto attestations when a
signing key is supplied** ([#141](https://github.com/TzolkinB/skills/issues/141), ADR-0037 §1); **unsigned by
default**, in which case a bundle stays exactly what it always was — in-toto-*shaped*, not a signed
attestation), and derives one **categorical, advisory** release decision by taking the **most conservative**
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
A report that DID execute something but only a sliver of what the framework discovered — a discovery/filter/
config mistake that runs 1 of 1000 tests and skips the rest — is a related but distinct false confidence: it
reads `PASSED` and is capped at `canary` by the **executed-floor**, not treated as green
([#157](https://github.com/TzolkinB/skills/issues/157); see Step 3).

- **audit-test verdict** (optional) — two grades of credibility evidence, best first:
  - **Parsed emission** (`--audit-test-json`): a `gate-audit-test/v0.3` tally written by `/audit-test --emit-json=<path>`.
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
     [--executed-floor=<pct>] [--sign-key=<private-key.pem>] --commit=<sha> --out=gate-bundle.json
```
(Pass `--playwright`, `--cypress`, or both — at least one is required. `--examined-floor` defaults to
`50`; a requested value below the `25` minimum is clamped, with a warning, never silently accepted —
only pass it when you consciously want to accept a narrower deep-audited scope than the default.
`--executed-floor` works the same way, but on the **execution** axis instead of the credibility axis —
default `50`, clamped to a `25` minimum — and gates how much of what the suite *discovered* actually
ran ([#157](https://github.com/TzolkinB/skills/issues/157)); only pass it when you consciously accept
a narrower executed scope (e.g. a deliberately tag-filtered run) than the default.
`--sign-key` is optional — omit it and the bundle is unsigned, exactly as before this option existed.)

The script ([`gate.mjs`](./gate.mjs)) ingests, assembles the bundle, runs the worst-wins gate, appends a
`gate.local/gate/v0` entry, validates against the honesty guard
([`schema/evidence-bundle.v0.schema.json`](./schema/evidence-bundle.v0.schema.json)), and prints the report.
**Do not recompute or override the decision** — it is the script's deterministic output.

**Optional: sign the bundle** ([#141](https://github.com/TzolkinB/skills/issues/141),
[ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §1). With no `--sign-key`, stop here — the bundle
is the same unsigned, in-toto-*shaped* JSON it has always been. To make it tamper-evident:

```
node "<skill base dir>/gate.mjs" --gen-key=<path-prefix>              # once: writes <prefix>.pem (private,
                                                                       # keep secret) + <prefix>.pub.pem (public)
node "<skill base dir>/gate.mjs" ... --sign-key=<prefix>.pem --out=gate-bundle.json   # signs at gate time
node "<skill base dir>/gate.mjs" --verify --bundle=gate-bundle.json --pubkey=<prefix>.pub.pem  # anyone with
                                                                       # the public key can check it later
```

A signed bundle carries a `dsseEnvelope` — a DSSE envelope over an ed25519 signature (`node:crypto`, zero new
dependency) covering the bundle's `subject[]` (pr-head + the #139 input digests) and the gate decision itself,
so editing either after signing invalidates it. This is **self-signed**, proving **integrity** (unaltered since
signing) and **continuity** (same key across runs) — it is **not Sigstore** and proves nothing about
third-party **identity**. Report it accordingly: a signed bundle may be called "signed," "tamper-evident," or
a "DSSE-signed attestation"; never "Sigstore-verified," "trusted publisher," or "verified identity."

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
    floor (default 50%) — this was a **diagnostic** run (it examined the suspects a triage flagged, and found no
    problems among them), not a **certification** of the whole suite
    ([#127](https://github.com/TzolkinB/skills/issues/127),
    [ADR-0038](../../docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)). Run audit-test's
    certification mode (forthcoming) for a representative-breadth verdict, or re-gate with a consciously lower
    `--examined-floor` (never below 25%) to accept this narrower certified scope.
  - **execution incomplete (below the executed-floor)**: an execution suite reported `PASSED` (or `WARNED`),
    but the tests it actually ran are a small fraction of what the framework discovered — skipped/pending
    dominate (e.g. `expected:1, skipped:999`). The rationale always states the executed-vs-discovered split for
    every execution suite, whether or not it trips the floor; a PASSED suite whose executed fraction falls
    short of the executed-floor (default 50%) is capped at `canary` instead of proposing `ship`
    ([#157](https://github.com/TzolkinB/skills/issues/157)) — a green result over a sliver of the suite is not
    evidence the rest of it ran. Fix the discovery/filter/config that's skipping most of the suite, or re-gate
    with a consciously lower `--executed-floor` (never below 25%) if the narrower scope was intentional.
- **`ship`** — *every* E2E suite you passed in (Playwright and/or Cypress) is green, **ran to completion**
  (its executed fraction clears the executed-floor — `executed`/`discovered` ≥ 50% by default, [#157](https://github.com/TzolkinB/skills/issues/157)),
  **and** a *parsed* `audit-test` verdict is `PASSED` + `confirmed` **and** the deep-audited fraction clears the
  examined-floor (`deepAudited`/`audited` ≥ 50% by default): the deep audits ran, killed their mutations, found
  no hollow tests **among the deep-audited subset**, and that subset was big enough to call the result honest.
  This proves that subset, not the whole suite — `unexamined` tests are *not* evidence of health, and the
  report states the examined/unexamined split so the scope is never oversold. This is the one path to `ship`,
  and it is deliberately hard to reach — a single red suite, an **empty/zero-test** report, a suite that mostly
  skipped, an opaque, absent, or vacuous audit, or a confirmed-clean audit that examined too little of the
  suite, never gets here.

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
signed: ✗ unsigned — in-toto-shaped, not a signed attestation (pass --sign-key to sign)

### Input digests (content-addressed — swap a file's bytes and this changes)
- `playwright-json` — sha256:084b1c75a70790a66e486e598eca417147c7d010dea112c840d0d3c8a4609349
- `audit-test-report` — sha256:8d0f0197a96b852e3c4e4157efeae154b493e2a92eb1335bd6159b4611a55eb6

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — present but opaque (unread) → proposes **canary**

### Rationale
- playwright PASSED (12 of 12 discovered tests executed — 100%; 0 skipped) → ship-baseline
- audit-test present but opaque → floor at canary (human must read the report)
- worst-wins over {ship, canary} → canary

> `ship` needs a *parsed* confirmed-clean `audit-test` verdict to unlock … Advisory / report-first.

Bundle written to gate-bundle.json
```

```
## Gate decision: 🟢 SHIP  ·  advisory (did not fail the build)

subject: pr-head `<sha>`  ·  3 entries
signed: ✓ DSSE (ed25519, self-signed) — keyid `2801ebd3ab3cb4fd6944202388352de3593831f4f1ce0b3276f999a9a0e944d4`

### Input digests (content-addressed — swap a file's bytes and this changes)
- `playwright-json` — sha256:084b1c75a70790a66e486e598eca417147c7d010dea112c840d0d3c8a4609349
- `audit-test-json` — sha256:f638d225f3ccd62753cf623c05fc0e58e5a652b7a3838f4293ff8b60fe1d60e2

### Inputs — worst-wins (each input proposed a category)
- `playwright` — result=PASSED → proposes **ship**
- `audit-test` — PASSED · confirmed → proposes **ship**

### Rationale
- playwright PASSED (12 of 12 discovered tests executed — 100%; 0 skipped) → ship-baseline
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
  batch tally as `gate-audit-test/v0.3` structured data — the per-class **counts**, not prose. the Gate derives
  the category (`result`+`label`) from those counts mechanically (same as it restates Playwright's `stats`) and
  the gate reads only the derived category, never the counts (honesty guard #1). *Opaque* (`--audit-test`): the
  Markdown is carried verbatim and **not** prose-scraped, so it can only floor at `canary`. The **theater guard
  is structural**: only a parsed `PASSED`+`confirmed` verdict reaches `ship`; an opaque, absent, or examined-nothing
  audit all cap at `canary`, so there is no "run less, grade better" incentive.
- **Run-trace cross-check** ([#142](https://github.com/TzolkinB/skills/issues/142),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §3). A parsed emission may also carry an optional
  `runs[]` — one record per test a mutation was actually **executed** against, with its outcome (`killed` |
  `survived`) and exit code. When present, the Gate cross-checks it against the tally it rides alongside:
  `confirmedSolid` must equal the killed-record count, `confirmedHollow` the survived-record count, and
  `runs.length` must never exceed `deepAudited`. A tally that disagrees with its own trace is rejected the same
  way an arithmetically-impossible tally is — it degrades to the opaque report or absence, never a silent
  upgrade. At ingest this cross-checks the *evidence behind* a `confirmed` label against a granular, per-test,
  internally-consistent trace instead of trusting a bare number (the bundle then records the verified
  record **count**, `runsVerified`, not the per-test trace itself); it does **not** make the verdict independently verified — the trace is still
  `audit-test`'s own account of its run (Gate cannot re-execute it, [ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)),
  and it opens no new path to `ship`. An emission with no `runs[]` is unaffected — this is purely additive.
- **Coverage-aware ship gate — the examined-floor** ([#127](https://github.com/TzolkinB/skills/issues/127),
  [ADR-0035](../../docs/adr/0035-gate-examined-floor.md)). A confirmed-clean verdict alone used to be enough to
  ship, even if `deepAudited` was a small minority of `audited` (the shipped fixture used to be `4 of 12` — 33%).
  The gate now ALSO requires `deepAudited`/`audited` to clear a floor — default **50%**, overridable via
  `--examined-floor` but never below a **25%** minimum, clamped (with a warning) rather than silently honored.
  Like everything else in the gate, the floor's numbers live only in rationale *prose*, never as a field on the
  gate predicate (honesty guard #3 still holds).
- **Execution-completeness gate — the executed-floor** ([#157](https://github.com/TzolkinB/skills/issues/157)).
  The same coverage-aware shape, applied to the **execution** axis instead of the credibility axis: `PASSED`
  used to be enough to propose `ship-baseline` regardless of how much of the discovered suite actually ran —
  `expected:1, skipped:999` reads `PASSED` exactly like a fully-run suite. The gate now surfaces the
  executed-vs-discovered split in the rationale for **every** execution suite (Playwright's `expected`+
  `unexpected`+`flaky` vs `skipped`; Cypress's `totalPassed`+`totalFailed` vs `totalPending`+`totalSkipped`),
  and requires `executed`/`discovered` to clear a floor — default **50%**, overridable via `--executed-floor`
  but never below a **25%** minimum, clamped (with a warning) rather than silently honored — before a `PASSED`
  suite proposes `ship-baseline`; short of it, it proposes `canary`. Same honesty-guard #3 treatment: the
  floor's numbers live only in rationale prose, never as a field on the gate predicate.
- **Content-addressed inputs** ([#139](https://github.com/TzolkinB/skills/issues/139),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §2). Every ingested file (the Playwright JSON,
  the Cypress JSON, the `audit-test` emission and/or report) is sha256-digested and recorded as a subject of
  the gate Statement, alongside the existing `pr-head` commit subject — a lowercase hex **string**, never a
  field on the gate **predicate** (honesty guard #3 untouched). Swap or edit an input file after the bundle is
  produced and its recorded digest no longer matches: the decision is bound to the exact bytes it ingested, not
  to a typed commit string. On its own this is **not** a signature — it detects a swapped input, it does not
  prove the bundle itself wasn't edited after the fact; pair it with `--sign-key` (below) for that.
- **Optional DSSE signing** ([#141](https://github.com/TzolkinB/skills/issues/141),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §1) — **opt-in and unsigned by default**. Pass
  `--sign-key=<private-key.pem>` and `gate.mjs` wraps the bundle's `subject[]` (pr-head + the content-addressed
  input digests above) and the gate decision in a [DSSE](https://github.com/secure-systems-lab/dsse) envelope:
  an ed25519 signature (`node:crypto`, no new dependency) over the DSSE pre-authentication encoding, with
  `keyid` = sha256 of the public key. `--verify --bundle=<path> --pubkey=<path>` then confirms a signed bundle
  wasn't altered after Gate produced it — a tampered payload or the wrong key both fail closed, and a
  structurally-malformed bundle is rejected before the signature is even trusted. The signature covers **only
  the gate Statement** (the decision + the content-addressed input digests) — `producedOn`, `schemaVersion`,
  and the ingested Playwright/Cypress/`audit-test` evidence entries ride *inside* the bundle but *outside* the
  signature, so `--verify` reports exactly the decision and subjects it vouches for rather than the whole file.
  This is
  **self-signed**: it proves **integrity** (unaltered since signing) and **continuity** (same key across runs),
  never third-party **identity** — it is **not Sigstore**, and the skill must not say "Sigstore," "verified
  identity," or "trusted publisher." Only a bundle that *is* signed earns "signed" / "tamper-evident" /
  "attestation"; an unsigned bundle (the default) keeps saying "in-toto-shaped, not a signed attestation."
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
