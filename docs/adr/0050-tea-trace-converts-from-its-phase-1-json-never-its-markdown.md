# A TEA `trace` run converts into `gate-trace-matrix/v0` from its Phase-1 coverage-matrix JSON, never from its Markdown report

**Status: Accepted (2026-08-04).** Built in the same change —
[#220](https://github.com/TzolkinB/skills/issues/220), `skills/gate/tea-to-trace-matrix.mjs`.
Amends nothing; it fills the conversion step
[ADR-0045](0045-business-risk-coverage-is-a-join-not-a-register.md) and
[#199](https://github.com/TzolkinB/skills/issues/199) deliberately left open.

## Context

[#199](https://github.com/TzolkinB/skills/issues/199) shipped Gate's business-risk join:
`--trace-json` reads a requirement→test matrix in Gate's own minimal
[`gate-trace-matrix/v0`](../../skills/gate/schema/trace-matrix.v0.schema.json) shape and resolves each
requirement to mutation-proven / unverified / hollow / not-covered against an `audit-test` emission.
It did **not** ship the conversion. Pointing the join at a real TEA `trace` run meant hand-authoring
that JSON — and a feature that asks for hand-authored input is a feature nobody runs.

[#220](https://github.com/TzolkinB/skills/issues/220) framed the choice as *parse
`traceability-matrix.md`'s Markdown, or ask TEA to emit our shape directly*, on the reading that the
Markdown report is TEA's only per-requirement artifact. **Re-reading the `bmad-testarch-trace`
source at v1.21.4 (2026-08-04, up from #199's v1.19.1) shows that premise is wrong**, and the
correction is the whole decision. TEA writes four artifacts:

| Artifact | Per-requirement rows? | Per-test **title**? |
|---|---|---|
| `e2e-trace-summary.json` (step-05 §3b) | no — aggregates only | no |
| `gate-decision.json` (step-05 §3b) | no — gate signal only | no |
| `traceability-matrix.md` (step-03/05) | **yes** | **no** — `Detailed Mapping` renders each test as `` `id` `` - `file`:`line` |
| **Phase-1 coverage matrix JSON** (step-04 §5–6) | **yes** | **yes** — `tests[]` carry `id`, `title`, `file`, `line`, `level`, skip flags |

That fourth file is real JSON, written to `/tmp/tea-trace-coverage-matrix-<timestamp>.json`, with its
resolved path recorded in `traceability-matrix.md`'s frontmatter as `tempCoverageMatrixPath`. TEA's
own step-05 §1 reads it back exactly that way; it is the file step-05's aggregates are computed
*from*.

The distinction is load-bearing because of what Gate's join key is: `<file>::<title>`, the same
identity `gate-audit-test/v0.3`'s `runs[].test` uses. The Markdown carries `file` and `line` but
**no title anywhere**, so a key built from it would have to be fabricated, or guessed by reading
whatever happens to sit at a line number that drifts on the next edit. A wrong key joins to nothing
and renders `unverified` — a confident, honest-looking claim about coverage that is not true. That
is the exact failure mode this repo exists to refuse.

## Decision

**1. Convert from the Phase-1 coverage-matrix JSON.** `tea-to-trace-matrix.mjs` takes
`--coverage-matrix=<that file>`, or `--trace-md=<traceability-matrix.md>` and follows its
`tempCoverageMatrixPath` frontmatter pointer. It never parses the Markdown body.

**2. Refuse rather than approximate.** Anything unconvertible — an unrecognized coverage value, a
missing priority, a test with no title, a `NONE` row carrying tests, a duplicate id — refuses the
whole conversion, names the offending row, and writes nothing. Empty beats wrong; this is the same
posture `gate.mjs` already takes when one impossible row rejects a whole matrix. The output is
validated by importing `gate.mjs`'s own `parseTraceMatrix`, not by a second copy of those rules that
could drift away from it.

**3. `UNIT-ONLY` and `INTEGRATION-ONLY` map to `PARTIAL`.** TEA's coverage vocabulary is *five*-valued
(step-03 §1), Gate's is three. A test exists, so `NONE` would understate (and violate the schema's
tests-non-empty-iff-covered invariant); TEA is saying the requirement is covered at one level only, so
`FULL` would widen TEA's own presence call, which a conversion is never allowed to do. TEA's verbatim
value rides along on each row as `teaCoverage` so the flattening is visible in the artifact.

**4. The adapter stays a separate script.** Teaching `gate.mjs` to read TEA's internal format would
couple the gate to one tool's private shape — precisely what defining our own `gate-trace-matrix/v0`
avoided (ADR-0045, orchestrate-don't-couple). Another producer writes its own adapter; Gate is
unchanged, and this change adds **zero** lines to `gate.mjs`.

**5. Disclose the join-key spelling instead of silently normalising it.** TEA records files as repo
paths (`tests/e2e/booking.spec.ts`); an `audit-test` emission may name the same test by basename.
Every key then misses and every covered requirement renders `unverified`. `--test-key=path|basename`
makes the spelling an explicit, disclosed choice (recorded in `producer`, which Gate prints), and
`--audit-test-json` cross-checks the real overlap before Gate ever runs. Basename mode **refuses**
when two directories share a spec basename — collapsing them could join a requirement to a *different
file's* run record, a false `mutation-proven`, which is worse than no join at all. The cross-check
never rewrites a key: forcing keys to match would manufacture the very join this is supposed to make
trustworthy.

## Considered options

- **Parse `traceability-matrix.md`'s `Detailed Mapping` section.** Rejected — it carries no test
  title, so every key would be fabricated or line-drift-guessed, and the failure renders as
  plausible `unverified` coverage rather than as an error. It is also LLM-generated prose against a
  drifting template (the template even ships worked `#### Example:` blocks a naive parser would
  ingest as real requirements).
- **Recover titles by reading the test file at TEA's recorded `file:line`.** Rejected — the failure
  mode is a *wrong* key, not an empty one: a line number goes stale the moment the spec is edited,
  and the resulting mis-join could read `mutation-proven` for a requirement guarded by a different
  test.
- **Ask TEA to emit `gate-trace-matrix/v0` directly** (a prompt/config addition to its workflow).
  Rejected for now — it makes our schema TEA's problem, needs an upstream change to land before
  anything works here, and would still leave every other producer without a path. Reconsider as an
  upstream contribution once the shape has held for a while.
- **Convert from the Phase-1 coverage-matrix JSON.** Chosen.

## Consequences

- **The input is a temp file.** TEA writes it under `/tmp` with a timestamped name, so the
  conversion belongs in the same session as the `trace` run (or the file gets copied somewhere
  durable first). The refusal message says so. If a future TEA release stops writing it, or renames
  the frontmatter pointer, the adapter refuses loudly rather than mis-parsing — the drift guards are
  the fallback, not a Markdown parser.
- **This tracks a shape TEA never published as a schema.** Field names come from TEA's own step
  files reading them back (`phase`, `requirements[].id/.priority/.coverage`, `tests[].title|name`,
  `.file`), not from documentation. The `phase: "PHASE_1_COMPLETE"` sentinel — TEA's own
  completeness check — is what the adapter verifies first.
- **A stale `--trace-json` is still stale.** The conversion is a snapshot of one `trace` run; nothing
  binds it to the commit Gate is gating. Gate content-addresses the bytes it was handed, which
  records *what* was joined, not *when* it was true.
- **`positioning.md`'s business-risk-coverage claim now has a runnable path end to end** — TEA run →
  convert → `--trace-json` — proven in the adapter's self-test as a real subprocess chain, not
  asserted.
- **Falsifier:** a TEA release that writes per-requirement rows *with test titles* into a durable,
  documented artifact (or that adopts a published schema for the Phase-1 file) would make most of
  this adapter's caution unnecessary and should shrink it.
