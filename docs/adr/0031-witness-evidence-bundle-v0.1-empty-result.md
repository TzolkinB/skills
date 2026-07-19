# Evidence-bundle contract v0 → v0.1 — an additive `EMPTY` execution result

**Status: Accepted (2026-07-18).** Falls out of the pre-launch critique hardening
([#111](https://github.com/TzolkinB/skills/issues/111), `references/critique-synthesis.md`), on epic
[#49](https://github.com/TzolkinB/skills/issues/49). This is the **first** bump of the evidence-bundle
contract, which [#102](https://github.com/TzolkinB/skills/issues/102) locked at v0 — so it records *why* the
lock was moved, and why this bump is not the one [ADR-0030 §4](0030-witness-cypress-ingest.md) and honesty-guard
#3 reserved.

## Context

The #111 fix closes a real false-green hole: `deriveResult({})` returned `PASSED`, so an empty / zero-test /
unrun execution report (a `{}` file, a wrong `--playwright` path, a suite that never ran) proposed
`ship-baseline` — the exact manufactured confidence Witness exists to refuse. The fix introduces a fourth
execution result, **`EMPTY`** (0 tests executed to a verdict), which the gate maps to `hold`.

`EMPTY` is a **new value in the `verdict.result` enum** — and the same enum is repeated in the gate entry's
`inputs[].result`. The published schema (`schema/evidence-bundle.v0.schema.json`) pins both to
`["PASSED", "WARNED", "FAILED"]`. So the code now emits a value the schema forbids. Two ways to resolve that,
and they are not equal:

- **Leave the schema at v0.** The code emits `EMPTY`; the published contract says it can't. That is precisely
  the doc-vs-reality drift this whole repo — and the critique that surfaced #111 — exists to catch. A contract
  that lies about what its producer emits is a bug, not a convenience.
- **Bump the contract.** Widen the enum in the schema and increment the version so the change is *on the
  record*, not smuggled.

This is a genuinely different situation from **ADR-0030 (Cypress)**, which deliberately did **not** bump: adding
Cypress needed *no* schema change at all — `stage` is a free string (contract Q1) and Cypress's results already
fit the existing `PASSED/WARNED/FAILED` enum. Cypress fit the contract; `EMPTY` **widens** it. The discipline is
"bump iff the schema structure actually changes," and here it did.

## Decision

**1. Bump the evidence-bundle contract v0 → v0.1 (SemVer MINOR: additive, backward-compatible).**
`schemaVersion` const, the schema `$id`, and the schema `title`/`description` all move to `v0.1`; `EMPTY` is
added to both `result` enums (`verdict.result` and gate `inputs[].result`). The change is backward-compatible:
**no v0 bundle ever carried `EMPTY`, so every v0 bundle is a valid v0.1 bundle** (the reverse is not
guaranteed — a v0.1 bundle may use `EMPTY` — which is exactly why the minor version, not a silent edit).

**2. Keep the schema *file name* (`evidence-bundle.v0.schema.json`) and the v0 issue lineage (#102).** The file
is the "v0.x evidence-bundle schema"; renaming it would strand references in the SKILL, ADR-0028, and
`witness.mjs` for no semantic gain. The version identity lives in `schemaVersion`/`$id`, which is what a
consumer checks. The v0 base contract from #102 is unchanged in structure apart from this one additive value.

**3. This bump does NOT consume or muddy the reserved "calibration" signal.** Honesty-guard #3 (and
[ADR-0030 §4](0030-witness-cypress-ingest.md)) say that re-adding a numeric `confidence`/score field *forces* a
schemaVersion bump — the bump is the signal calibration has landed. That reservation is about **a numeric field
plus a re-architecture of the number-rejecting guard** — a MAJOR, structural event (it would be v1.0, and it
stays actively blocked by `validateGateEntry` until earned). `EMPTY` is a MINOR additive enum widening with **no
number anywhere**; the honesty guard still rejects a smuggled confidence exactly as before. SemVer keeps the two
distinguishable: an enum value is `v0.1`; a confidence field is a different, larger event. Bumping here does not
spend the calibration signal.

## Considered options

- **Leave the schema at v0, fix only the code.** Rejected — the published contract would forbid a value the
  producer emits. Silent drift between contract and code is the failure mode the repo is built to catch.
- **Represent "empty" without a new enum value** (e.g. keep `result: PASSED` but special-case the gate to
  propose `hold` from the metrics). Rejected — it leaves the evidence entry *saying* `PASSED` for a suite that
  never ran. The dishonesty just moves from the decision layer to the evidence layer; the enum value tells the
  truth at the source. (It would also need an extra `inputs[]` field, which the gate schema's
  `additionalProperties:false` forbids anyway.)
- **Jump to v1.0.** Rejected — this is additive and backward-compatible, the textbook MINOR bump. Reserving
  MAJOR for the confidence/calibration re-architecture keeps the version signal legible.
- **Rename the schema file to `.v0.1.`** Rejected — churns SKILL/ADR/`witness.mjs` references for a filename
  that already denotes the v0.x family; `schemaVersion`/`$id` carry the version.

## Consequences

- `witness.mjs` `SCHEMA_VERSION`, the schema `const`/`$id`/description, and the two `result` enums move to
  `v0.1`; `validateBundle` and the self-test both read the const, so they stay internally consistent (81/81 gate
  self-tests pass, incl. the new `EMPTY → hold` and empty-exploit rows). Emitted bundles now stamp
  `witness-evidence-bundle/v0.1`.
- The contract is now **honest about `EMPTY`**: an empty/zero-test report is no-evidence → `hold`, and the
  schema says so. The false-green a `{}` report used to launder is closed at both the code and the contract.
- **v0's structural lock (#102) is otherwise intact** — `stage` extensibility, the number-free gate predicate,
  the OPAQUE/PARSED `audit-test` rails are all unchanged. The next bump trigger is still the reserved one:
  `confidence`/calibration ([#96](https://github.com/TzolkinB/skills/issues/96), PARKED), which would be a MAJOR
  event, not another minor.
- Companion to the #112 change (ship rationale now states the examined/unexamined scope), shipped in the same
  PR; #112 touched output prose only, no schema.
