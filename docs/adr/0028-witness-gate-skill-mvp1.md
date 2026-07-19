# Gate ships as a deterministic, advisory Gate skill (stage 7) — MVP1

**Status: Accepted (2026-07-17).** Implements the first honest Gate vertical specced by
[#105](https://github.com/TzolkinB/skills/issues/105), which assembled the four load-bearing decisions locked
on wayfinder map [#98](https://github.com/TzolkinB/skills/issues/98): architecture
([#99](https://github.com/TzolkinB/skills/issues/99)), ingestible evidence
([#100](https://github.com/TzolkinB/skills/issues/100)), evidence-bundle prior-art
([#101](https://github.com/TzolkinB/skills/issues/101)), the evidence-bundle contract v0
([#102](https://github.com/TzolkinB/skills/issues/102)), and the gate-function spec v0
([#103](https://github.com/TzolkinB/skills/issues/103)). This ADR records the two decisions `/to-spec` added
on top of those locked assets, and formalises the build, because the four asset files live in a gitignored
`references/` tree and are not otherwise in the repo.

## Context

Gate is the **Gate stage** (stage 7) of the Sentinel orchestration map: ingest every earlier stage's
output → one Evidence bundle → a release verdict. The map deliberately sliced a *first honest vertical* —
Playwright-JSON ingest + an opaque `audit-test` attachment → a categorical **ship / canary / hold** gate —
with the numeric release-confidence score and the calibration loop **deferred**. The load-bearing hazard the
map named: Gate without trustworthy stages 3–5 is *theater*; a bundle that merely reprints a green
Playwright exit code adds nothing and actively launders false confidence.

Two things the locked assets **implied but never stated**, both left to `/to-spec`:

1. **How the decision executes.** A release gate must give the same bundle the same decision every time, and
   the honesty guards presuppose a schema validator — but every other Sentinel skill is model-executed prose.
2. **Where the decision is posted.** The gate-function spec ([#103](https://github.com/TzolkinB/skills/issues/103))
   explicitly deferred the output surface to `/to-spec`.

## Decision

**1. The gate is deterministic code, not model judgment.** The Playwright `stats → result` derivation, the
worst-wins decision rule, and the honesty-guard validation live in a zero-dependency Node script
(`skills/gate/witness.mjs`) with a JSON-Schema contract
(`skills/gate/schema/evidence-bundle.v0.schema.json`). The Gate **skill** (`SKILL.md`) is a
user-invoked leaf ([ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)) that *orchestrates* by running
the script and presenting its output — it never recomputes or overrides the decision. A gate that sometimes
says `ship` and sometimes `canary` for the same evidence would be worse than useless; determinism is the
point. This keeps Gate inside the static-judgment moat ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)):
it **ingests** an existing Playwright report and a Markdown file — pure consumption — and never runs a suite
or a browser.

**2. The output surface is a terminal report + a bundle file.** Gate prints the decision and rationale to
the terminal (like every Sentinel skill) and writes the evidence bundle to a file. PR-comment / check-run
posting and any build-blocking are deferred to a future `--live` escalation
([ADR-0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)), consistent with the advisory / report-first
posture.

**Carried verbatim from the locked assets** (not re-decided here): one readable JSON bundle of in-toto
Statements over a shared digest subject (the PR head commit); a **generic stage-agnostic entry** (`stage` is
data); exactly two v0 entries — `playwright` (parsed) and `audit-test` (**opaque**, Markdown inline);
**worst-wins** ordinal min under `hold < canary < ship`; the credibility axis floors at `canary` whether
`audit-test` is present-opaque (`human-must-read`) **or** absent (`no-credibility-evidence`), so **`ship` is
unreachable in v0** and there is no "run less, grade better" incentive; a `witness.local/gate/v0` entry
appended to the bundle that **shows its work** (`inputs[]` records each proposal); the four honesty guards
(category-in/out, ordinal-not-cardinal, schema forbids numeric fields, categorical-prose rationale); `ship`,
`WAIVED`, `confidence`, DSSE, `findings`, `counterEvidence`, and TEA risk-weighting all **reserved-not-built**;
the whole thing housed in one directory under a `witness://` namespace so extraction to a standalone plugin
is a folder move ([#99](https://github.com/TzolkinB/skills/issues/99)).

## Considered options

- **Model-judged prose gate (like the other skills).** Rejected — a non-deterministic release verdict, and the
  schema-forbids-numbers honesty guard needs an actual validator. The gate is the one Sentinel surface where
  reproducibility outranks prose flexibility.
- **Pull in a JSON-Schema engine (ajv) for validation.** Rejected for v0 — the repo is deliberately
  zero-dependency (the eval harness is zero-dep). The published schema file is the canonical contract; a small
  in-script validator enforces its load-bearing constraint (no numeric field in the gate predicate). Adopting
  ajv is a non-breaking later change if richer validation earns its keep.
- **Post to a PR comment / check-run in v0.** Rejected — pulls CI/`--live` integration and a GitHub-API surface
  into the first vertical, contradicting the advisory deferral. Terminal + file is the honest v0 surface.
- **Emit a numeric confidence now.** Rejected — no calibration loop stands behind a number
  ([#96](https://github.com/TzolkinB/skills/issues/96) is PARKED); a manufactured score is exactly the false
  precision the map forbids. Its future arrival is signalled by a schema-version bump.

## Consequences

- **A new user-invoked Gate skill** at `skills/gate/`, branded Gate. It owns the ship verdict;
  `/sentinel`-the-orchestrator stops speaking shippability ([#99](https://github.com/TzolkinB/skills/issues/99)
  verdict-ownership corollary).
- **Determinism earns a golden test, not just an eval.** Unlike the prose skills, the gate has a
  truth-table self-test (`witness.mjs --self-test`) gated in CI (`skill-evals.yml`), covering every contract-v0
  row plus the honesty guard (a smuggled numeric field must fail validation). The ADR-0022 eval
  (`evals/cases/gate.json`) grades only the *skill's honest reporting* — the one non-deterministic surface.
- **The theater hazard is structurally enforced**, not promised: absent `audit-test` floors at `canary`, so a
  bare green Playwright run can never reach `ship`.
- **Honest limits carried, not hidden** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
  Playwright-only ingest, `audit-test` opaque, `ship` unreachable, no `confidence`, advisory-not-blocking — all
  stated in the skill's own output.
- **Growth path stays legible.** A *parsed* `audit-test` verdict (the B→A graduation — the next Gate effort)
  is precisely what unlocks a reachable `ship`; a real calibration loop is what unlocks `confidence` and a
  schema-version bump. Neither is built here.
