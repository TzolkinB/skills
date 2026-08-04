---
name: gate
description: "The Gate stage (stage 7): binds a PR's existing E2E results (Playwright and/or Cypress) plus an audit-test verdict into one evidence bundle, and derives an advisory ship/canary/hold decision by worst-wins. Ship requires the E2E run to clear an executed-floor and the audit-test verdict to clear an examined-floor (see docs/gate.md for the exact thresholds and what each floor does and doesn't catch) — Gate never re-runs anything, carries no confidence number, and is optionally DSSE-signed with a self-signed key (not Sigstore). Optionally join an external trace-matrix (--trace-json) against the audit-test verdict for a business-risk-coverage read (mutation-proven / unverified / hollow / not-covered per requirement) — purely informational, never a decision input. Use at the end of a PR for one honest release recommendation instead of eyeballing separate reports."
argument-hint: "[path to Playwright results.json and/or a Cypress result.json] [optional: path to an audit-test emission .json or report .md] [optional: path to a gate-trace-matrix .json for business-risk coverage]"
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
[ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §2) — a **DSSE envelope over that in-toto-*shaped*
Statement when a signing key is supplied** ([#141](https://github.com/TzolkinB/skills/issues/141), ADR-0037 §1;
no standard in-toto tooling consumes this bundle as-is); **unsigned by default**, in which case a bundle stays
exactly what it always was — in-toto-*shaped*, not a signed attestation), and derives one **categorical,
advisory** release decision by taking the **most conservative**
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
    along inline for the human. A malformed or arithmetically-inconsistent emission is **rejected, not silently
    dropped** (hostile-review finding #2, 2026-07-25, [ADR-0042](../../docs/adr/0042-gate-rejected-credibility-state-and-freshness-floor.md)): it persists as its own distinct `rejected` entry —
    content-addressed into the bundle's subjects, visibly marked `rejected` (not `absent`) in the rendered report —
    floors at the same `canary` ceiling absence already got, but is never silently identical to "nothing was ever
    sent." A warning still prints; the difference is that the rejection now also survives into the one artifact
    you sign and keep.
- **Trace matrix** (optional, `--trace-json`) — a requirement→test traceability matrix in Gate's own
  [`gate-trace-matrix/v0`](./schema/trace-matrix.v0.schema.json) shape (not any external tool's internal
  format), joined against `--audit-test-json` to answer *"what business risks are actually covered?"*
  without building a risk register ([#199](https://github.com/TzolkinB/skills/issues/199),
  [ADR-0045](../../docs/adr/0045-business-risk-coverage-is-a-join-not-a-register.md)). Purely informational —
  it never affects the ship/canary/hold decision. See Step 4 below.
- **PR head commit**: `git rev-parse HEAD` — the bundle's subject.

### 2. Run the deterministic gate
Run the bundled script from **this skill's base directory** (shown to you when the skill was invoked):

```
node "<skill base dir>/gate.mjs" (--playwright=<results.json> | --cypress=<cypress-results.json>) \
     [--audit-test-json=<tally.json>] [--audit-test=<report.md>] [--trace-json=<trace-matrix.json>] \
     [--examined-floor=<pct>] [--executed-floor=<pct>] [--max-age=<minutes>] [--sign-key=<private-key.pem>] --commit=<sha> --out=gate-bundle.json
```
(Pass `--playwright`, `--cypress`, or both — at least one is required. `--examined-floor` defaults to
`50`; a requested value below the `25` minimum is clamped, with a warning, never silently accepted —
only pass it when you consciously want to accept a narrower deep-audited scope than the default.
`--executed-floor` works the same way, but on the **execution** axis instead of the credibility axis —
default `50`, clamped to a `25` minimum — and gates how much of what the suite *discovered* actually
ran ([#157](https://github.com/TzolkinB/skills/issues/157)); only pass it when you consciously accept
a narrower executed scope (e.g. a deliberately tag-filtered run) than the default.
`--max-age` is opt-in with **no default** — pass a number of minutes to cap a suite at `canary` when its
report claims to have started longer ago than that, relative to when this bundle is assembled (a stale
leftover `results.json` from an earlier run); omit it and no freshness check runs at all.
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
dependency) covering the **whole normalized bundle**: the `subject[]` (pr-head + the #139 input digests + a
per-entry digest for every parsed evidence entry, [#158](https://github.com/TzolkinB/skills/issues/158)),
`producedOn`, `schemaVersion`, and the gate decision itself
([ADR-0040](../../docs/adr/0040-widen-gate-signed-scope-to-entries.md)) — so editing any of them after signing
invalidates it. This is **self-signed**, proving **integrity** (unaltered since signing) and **continuity**
(same key across runs) — it is **not Sigstore** and proves nothing about third-party **identity**. Report it
accordingly: a signed bundle may be called "signed," "tamper-evident," or a "DSSE-signed attestation"; never
"Sigstore-verified," "trusted publisher," or "verified identity."

### 3. Present the decision — as-is
Show the script's report: the decision, the per-input proposals (it **shows its work**), and the rationale.
Tell the user where the bundle was written. **State plainly, every time, that the Gate ingested existing
evidence and did not run the suite or launch a browser** — this is the Gate's core boundary (see *Ingests,
never executes* below); it must be said in the presented report itself, not left implicit in the decision or
assumed from context. Then interpret it honestly:

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
    certification mode (`--certify`) for a representative-breadth verdict, or re-gate with a consciously lower
    `--examined-floor` (never below 25%) to accept this narrower certified scope.
  - **execution incomplete (below the executed-floor)**: an execution suite reported `PASSED` (or `WARNED`),
    but the tests it actually ran are a small fraction of what the framework discovered — skipped/pending
    dominate (e.g. `expected:1, skipped:999`). The rationale always states the executed-vs-discovered split for
    every execution suite, whether or not it trips the floor; a PASSED suite whose executed fraction falls
    short of the executed-floor (default 50%) is capped at `canary` instead of proposing `ship`
    ([#157](https://github.com/TzolkinB/skills/issues/157)) — a green result over a sliver of the suite is not
    evidence the rest of it ran. Fix the discovery/filter/config that's skipping most of the suite, or re-gate
    with a consciously lower `--executed-floor` (never below 25%) if the narrower scope was intentional.
- **`ship`** — *every* E2E suite you passed in (Playwright and/or Cypress) is green and **clears an
  executed-floor against what the report itself says it discovered** (`executed`/`discovered` ≥ 50% by default,
  [#157](https://github.com/TzolkinB/skills/issues/157) — the discovered count is self-reported, so a
  discovery/filter/config change that quietly narrows the suite before the report is written isn't caught),
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

### 4. Business-risk coverage (optional, only when `--trace-json` was passed)

If a trace matrix was supplied, present the report's `## Business-risk coverage` section too — it is
**separate** from the decision above, never folds into it, and reads its own four states per
requirement: **mutation-proven** (every mapped test execution-confirmed solid), **unverified** (mapped,
but no execution-confirmed evidence either way), **hollow** (a mapped test survived a mutation — the
requirement is *not* actually guarded, even though the matrix's own presence read calls it covered),
and **not-covered** (the matrix itself says so). State plainly that this is a *join*, not a risk
register the Gate maintains ([ADR-0045](../../docs/adr/0045-business-risk-coverage-is-a-join-not-a-register.md))
— it never appears at all when `--trace-json` wasn't given, and a malformed one renders as `rejected`,
the same distinct-state treatment a malformed `--audit-test-json` gets.

## Output Format

Present the script's report verbatim. A `canary` (opaque audit-test) and the earned `ship` (parsed
confirmed-clean audit-test) look like:

```
The Gate ingested existing evidence — it did not run the suite or launch a browser.

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
> Optional: pass --trace-json for a business-risk coverage read … never changes ship/canary/hold.

Bundle written to gate-bundle.json
```

```
The Gate ingested existing evidence — it did not run the suite or launch a browser.

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
> Optional: pass --trace-json for a business-risk coverage read … never changes ship/canary/hold.

Bundle written to gate-bundle.json
```

Adding `--trace-json=<trace-matrix.json>` appends a separate section after the decision — here paired
with a confirmed-hollow audit-test emission, so the decision itself stays `canary` while the join still
resolves each requirement on its own:

```
## Business-risk coverage — informational, does not affect the ship/canary/hold decision

trace matrix: 6 requirement(s) · producer: TEA trace (bmad-testarch-trace) v1.19.1 · matrix gate: PASS

| Requirement | Priority | State |
|---|---|---|
| REQ-BOOKING-OVERLAP | P0 | 🟢 covered and mutation-proven |
| REQ-BOOKING-CONFIRM | P0 | 🟢 covered and mutation-proven |
| REQ-BOOKING-FEE | P1 | 🟢 covered and mutation-proven |
| REQ-BOOKING-ERROR-LOG | P1 | 🔴 covered by a test we proved hollow — booking.spec.ts::logs a booking error |
| REQ-BOOKING-EXPORT | P2 | ⚪ covered but unverified |
| REQ-BOOKING-SLA | P3 | — not covered — no mapped test (the traceability matrix already flags this) |

3 mutation-proven · 1 unverified · 1 hollow · 1 not-covered

> A JOIN over an external traceability matrix + an audit-test verdict, never a risk register this repo
maintains (ADR-0045) …
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
- **`audit-test` rides in three grades.** *Parsed* (`--audit-test-json`): `/audit-test --emit-json` writes its
  batch tally as `gate-audit-test/v0.3` structured data — the per-class **counts**, not prose. the Gate derives
  the category (`result`+`label`) from those counts mechanically (same as it restates Playwright's `stats`) and
  the gate reads only the derived category, never the counts (honesty guard #1). *Opaque* (`--audit-test`): the
  Markdown is carried verbatim and **not** prose-scraped, so it can only floor at `canary`. *Rejected*: a `.json`
  emission was given but failed `parseAuditEmission`'s shape/consistency check — a distinct state from *opaque*
  (unparsed prose) and *absent* (nothing given), persisted as its own entry rather than silently rendering
  identically to absence (hostile-review finding #2, 2026-07-25, ADR-0042; see Step 1 above). The **theater guard is
  structural**: only a parsed `PASSED`+`confirmed` verdict reaches `ship`; opaque, rejected, absent, or
  examined-nothing all cap at `canary`, so there is no "run less, grade better" incentive.
- **`scope` disclosure** ([#171](https://github.com/TzolkinB/skills/issues/171),
  [ADR-0038](../../docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)). A parsed emission may
  carry an optional free-text `scope` string — e.g. a certification run naming how much of the whole suite a
  narrower scope like `--changed` covered. the Gate passes it through unread by the decision (honesty guard #1
  untouched — `scope` never drives `result`/`label`) and prints it verbatim next to the deep-audited fraction in
  its own rendered report, so a certified `--changed` `ship` discloses its narrowness to whoever reads the Gate
  report, not only a reader of the raw emission. When `scope` is absent, the report says so explicitly
  ("reported scope: none declared") rather than just omitting the clause. **Known limit:** there is no minimum
  on `audited` itself — the examined-floor is a pure ratio, so `audited: 2, deepAudited: 1` clears the default
  50% floor on a two-test triage exactly as it would on a two-thousand-test one; the mechanically-derived
  fraction the report prints is the only anchor a reader gets against the suite's real size.
- **Run-trace cross-check** ([#142](https://github.com/TzolkinB/skills/issues/142),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §3). A parsed emission may also carry an optional
  `runs[]` — one record per test a mutation was actually **executed** against, with its outcome (`killed` |
  `survived`) and exit code. When present, the Gate cross-checks it against the tally it rides alongside:
  `confirmedSolid` must equal the killed-record count, `confirmedHollow` the survived-record count, and
  `runs.length` must never exceed `deepAudited`. A tally that disagrees with its own trace is rejected the same
  way an arithmetically-impossible tally is (see the *rejected* grade above). At ingest this cross-checks the
  *evidence behind* a `confirmed` label against a granular, per-test, internally-consistent trace instead of
  trusting a bare number (the bundle then records the verified record **count**, `runsVerified`, not the per-test
  trace itself); it does **not** make the verdict independently verified — the trace is still `audit-test`'s own
  account of its run (Gate cannot re-execute it, [ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)),
  and it opens no new path to `ship`. An emission with no `runs[]` is unaffected — this is purely additive.
  `runsVerified` is now surfaced in the rendered report too (hostile-review finding #5, 2026-07-25): the
  `audit-test` line in "Inputs — worst-wins" states either `(N run records cross-checked)` or `(no run trace
  carried — tally unverified against per-test records)`, so two `ship` verdicts of different evidential weight no
  longer read identically apart from an input digest.
- **Business-risk coverage — the trace-matrix join** ([#199](https://github.com/TzolkinB/skills/issues/199),
  [ADR-0045](../../docs/adr/0045-business-risk-coverage-is-a-join-not-a-register.md)). Optional `--trace-json`
  reads a requirement→test traceability matrix in Gate's own [`gate-trace-matrix/v0`](./schema/trace-matrix.v0.schema.json)
  shape — not TEA's or any other tool's internal format, to avoid coupling tighter than the join needs
  (orchestrate-don't-absorb) — and joins it against `--audit-test-json`'s `runs[]` on test identity
  (`<file>::<title>`, the same key `runs[]` already uses). The entry this produces is deliberately kept
  OUT of `gate()`'s decision loop — it's appended to `bundle.entries` only *after* the ship/canary/hold
  decision is computed, so it can never become a decision input and a bundle with no `--trace-json` is
  byte-for-byte unaffected. The join exists because TEA's own `trace` gate is **presence**-based — Verified
  against the `bmad-testarch-trace` workflow source (v1.19.1, [`comparisons/tea.md`](../../docs/comparisons/tea.md) §3):
  a requirement is marked covered because a matching test *exists*, never because it would fail if the code
  broke — so a P0 requirement whose only test is hollow reads as covered and gates PASS. A malformed
  `--trace-json` is **rejected**, the same distinct-from-absent treatment `--audit-test-json` gets; a valid
  matrix with no `--audit-test-json` `runs[]` evidence resolves every mapped requirement to `unverified`
  rather than a stronger claim.
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
  suite proposes `ship-baseline`; short of it, it proposes `canary`. **Known limit:** `discovered` is read
  straight from the report's own counts (`executed`+`skipped` for Playwright, `totalTests` for Cypress) — the
  Gate has no independent count of how many tests *should* exist, so a discovery/filter/config change that
  narrows the suite *before* the report is written (a `testDir`/`testMatch` change, a title filter, a shard) can
  still produce a report that honestly says `skipped: 0` and clears the floor at 100%. This floor catches a
  suite that reports its own skips; it does not catch one that was quietly filtered before it got the chance.
  Same honesty-guard #3 treatment: the
  floor's numbers live only in rationale prose, never as a field on the gate predicate.
- **Content-addressed inputs** ([#139](https://github.com/TzolkinB/skills/issues/139),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §2). Every ingested file (the Playwright JSON,
  the Cypress JSON, the `audit-test` emission and/or report) is sha256-digested and recorded as a subject of
  the gate Statement, alongside the existing `pr-head` commit subject — a lowercase hex **string**, never a
  field on the gate **predicate** (honesty guard #3 untouched). Swap or edit an input file after the bundle is
  produced and its recorded digest no longer matches: the decision is bound to the exact bytes it ingested, not
  to a typed commit string. On its own this is **not** a signature — it detects a swapped input, it does not
  prove the bundle itself wasn't edited after the fact; pair it with `--sign-key` (below) for that.
- **Report freshness — `--max-age`** (hostile-review finding #3, 2026-07-25, [ADR-0042](../../docs/adr/0042-gate-rejected-credibility-state-and-freshness-floor.md)). **Opt-in, no default**: unlike the
  examined/executed floors there is no universally-safe staleness threshold (a slow-but-legitimate CI run and a
  genuinely stale leftover `results.json` are indistinguishable without a number only you can supply), so this is
  off unless requested. Pass `--max-age=<minutes>` and the gate compares each execution entry's own recorded
  `producer.startedOn` (Playwright's `stats.startTime` / Cypress's `startedTestsAt` — already captured, previously
  never read) against the bundle's own `producedOn`; a suite whose report claims to have started longer ago than
  the window caps at `canary` even if it would otherwise ship, with the staleness named in the rationale. An entry
  with no recorded start time can't be checked and is silently unaffected — no evidence either way, not flagged
  stale. **Known limit:** this only catches a report that's old *relative to when this bundle was assembled* — it
  does not bind a report to the specific `--commit` named on the bundle, so a fresh-looking report regenerated
  moments before a DIFFERENT commit's gate run still passes. A git-timestamp cross-check was considered for this
  and **rejected** ([ADR-0043](../../docs/adr/0043-report-to-commit-provenance-over-git-timestamp.md)): a report
  regenerated *now* for the wrong commit has `startedOn ≈ now` ≥ any commit timestamp, so timestamps don't even
  catch this case, and the "report predates the commit" signal they *could* give false-positives the ordinary
  test-then-commit local workflow. The mature closure — deferred to v2 — is **producer-recorded SHA provenance**:
  the test producer records the git SHA it ran against *into* the report and Gate cross-checks it against
  `--commit`. See `docs/roadmap.md` item 3 and ADR-0043 for why.
- **Optional DSSE signing** ([#141](https://github.com/TzolkinB/skills/issues/141),
  [ADR-0037](../../docs/adr/0037-gate-evidence-integrity.md) §1, widened by
  [#158](https://github.com/TzolkinB/skills/issues/158)/[ADR-0040](../../docs/adr/0040-widen-gate-signed-scope-to-entries.md))
  — **opt-in and unsigned by default**. Pass `--sign-key=<private-key.pem>` and `gate.mjs` wraps the **whole
  normalized bundle** in a [DSSE](https://github.com/secure-systems-lab/dsse) envelope: the bundle's `subject[]`
  (pr-head + the content-addressed input digests above **plus** one content-addressed digest per parsed
  evidence entry), `producedOn`, `schemaVersion`, and the gate decision itself — an ed25519 signature
  (`node:crypto`, no new dependency) over the DSSE pre-authentication encoding, with `keyid` = sha256 of the
  public key. `--verify --bundle=<path> --pubkey=<path>` then confirms a signed bundle wasn't altered after
  Gate produced it — a tampered payload or the wrong key both fail closed, and a structurally-malformed bundle
  is rejected before the signature is even trusted. Digest-binding an evidence entry is **integrity, not
  endorsement**: the gate predicate still asserts only Gate's own decision, never that a stage's producer
  vouched for its own result — Gate only attests "my decision was rendered over exactly these bytes." This is
  **self-signed**: it proves **integrity** (unaltered since signing) and **continuity** (same key across runs),
  never third-party **identity** — it is **not Sigstore**, and the skill must not say "Sigstore," "verified
  identity," or "trusted publisher." Only a bundle that *is* signed earns "signed" / "tamper-evident" /
  "attestation"; an unsigned bundle (the default) keeps saying "in-toto-shaped, not a signed attestation."
  **Known limit:** `--verify` rejects any `schemaVersion` mismatch as a shape error before it even checks the
  signature, with the same "cannot vouch for a malformed bundle" message tampering would produce — so a bundle
  signed under an older schema version fails `--verify` with a tamper-shaped error, not a version-shaped one,
  once `SCHEMA_VERSION` moves on. There is no version allow-list; a signed bundle must be re-generated (and
  re-signed) after a schema bump to keep verifying.
- **No manufactured number.** There is no `confidence`/score anywhere; the gate reasons over categories, not
  magnitudes. The schema forbids a numeric field in the gate entry — re-adding one requires a schema-version
  bump, which is the signal a real calibration loop has landed.
- **Advisory / report-first** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) —
  it recommends, it never blocks a merge in v0. A `hold` or `canary` is a recommendation for a human or a CI
  pipeline to act on; the Gate has no mechanism of its own to stop a build or a deployment. This now holds for a
  malformed *input* too (hostile-review finding #4, 2026-07-25): a truncated/unparseable Playwright or Cypress
  report used to crash with an uncaught `SyntaxError`, and a missing `--audit-test`/`--audit-test-json` path used
  to throw `ENOENT` — both exited 1 despite the "never fails the build" claim. Both now degrade instead: an
  unreadable execution report becomes an `EMPTY` entry (the same, already-understood "unrun report is not a pass"
  path, #111) capping the decision at `hold`; a missing credibility-evidence path warns and falls back to
  whatever else is available (or absent). Exit code stays 0 either way — `--verify` and internal
  bundle-shape-validation failures remain the only paths that exit non-zero.
- **Housing & extraction:** everything lives under this one directory with a `gate://` namespace, so
  lifting the Gate to a standalone plugin is a folder move ([#99](https://github.com/TzolkinB/skills/issues/99),
  [#102](https://github.com/TzolkinB/skills/issues/102)).
- **Naming:** this skill was called "Witness" before [ADR-0032](../../docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)
  renamed it to "Gate" ([#113](https://github.com/TzolkinB/skills/issues/113)). ADRs and other historical records
  written before that rename still say "Witness" by design — history isn't rewritten — but every current
  user-facing surface (this file, the README, the CLI output) says "Gate."
- `--explain` is not supported — procedural, not pedagogical.
