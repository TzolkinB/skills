# Sentinel keeps CAUTION as its default, but a sacred path forces an un-overridable FAIL

`/sentinel` synthesizes a three-state verdict — PASS / CAUTION / FAIL — and CAUTION is the
deliberate middle: "shippable with known gaps" ([ARCHITECTURE.md → why a 3-state verdict](../../ARCHITECTURE.md)).
[ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md) further fixes Sentinel as *categorical
judgment*, never a numeric release score. The governance-gap critique (the J-Rig
comparison from a market analysis of judgment-layer tools) presses on the cost of that gradient: on a *core* path, "CAUTION — ship with notes" lets
human subjectivity wave through a test that has been *proven* to guard nothing. J-Rig's answer is to
delete gradients entirely and gate on "sacred regressions." Adopting that wholesale would contradict
why CAUTION exists at all.

This ADR takes the narrow slice of J-Rig's rigor that's worth having without throwing out the
gradient: **CAUTION stays the default everywhere, but the user may designate sacred paths where a
_proven_ false-confidence — or an unhandled boundary — forces an un-overridable FAIL.**

## Decision

- `/sentinel` accepts `--sacred=<glob>` (repeatable). Sacred paths are **opt-in per run**; Sentinel
  never guesses what is critical. With no `--sacred`, the verdict is a pure gradient as before.
- The **override fires** when, on a path matching a sacred glob, either `/audit-test` returns a
  🔴 **proven** false-confidence finding, **or** `/coverage-review` finds an **unhandled boundary
  condition**. When it fires, the verdict is a 🔴 FAIL that **cannot be softened to CAUTION** by an
  otherwise-solid branch.
- Off sacred paths, the false-confidence audit still *shifts* the verdict, but categorically and
  gradiently: any proven-hollow test blocks PASS; a 🟡 *likely* finding can pull PASS to CAUTION but
  never forces FAIL. "Proportional" means count-and-severity mapped onto the gradient — **not** a
  numeric score, per [ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md).

## Why this shape

- **Binary everywhere was rejected.** A blanket J-Rig gate would FAIL branches over non-critical
  gaps and push developers to suppress or work around the tool — the opposite of the honest risk
  conversation CAUTION exists to enable. Sentinel is aimed first at developers *without* a QA
  background (see `CONTEXT.md`); a hostile, all-or-nothing gate is the wrong tool for that audience.
  Sacredness scopes the binary rigor to exactly the paths that earn it.
- **Proven-only, never likely.** The override burns a hard, un-overridable FAIL, so it must rest on
  execution evidence, not reasoning. This inherits `audit-test`'s own proven-vs-likely discipline
  ([ADR-0001](0001-audit-test-proves-by-execution.md)): a 🟡 finding (code wasn't runnable) informs
  the report but can never fire the override.
- **The user owns the designation.** Criticality is a product judgment Sentinel can't infer from
  code. Making sacred paths an explicit per-run flag keeps the mechanism honest and auditable — the
  report names which sacred glob tripped and why.

## Consequences

- `/sentinel` gains a `--sacred` argument, a **False-Confidence Audit** section fed by `/audit-test`
  in batch mode over the changed tests, and a Sacred-Path Override in its verdict synthesis.
- This depends on `audit-test`'s batch/directory mode and on its findings carrying a **file path** so
  Sentinel can map each to the sacred globs. `audit-test` stays unaware of sacredness — it emits
  per-test verdicts with locations; the sacred *mapping* and *override* are Sentinel's synthesis.
- ADR-0002 still holds: the override changes *which categorical state* is reached, not *how* it's
  expressed. Sentinel emits no numeric score, sacred or otherwise.
- This is a considered exception to "CAUTION is always available." CAUTION remains the default for
  every non-sacred gap; the override is the only place Sentinel refuses the gradient, and only on
  paths the user marked and only on proven evidence.
