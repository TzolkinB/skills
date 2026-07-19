# Sentinel matches the quality bar of a maintained plugin product, not the scope of a workflow-OS

Sentinel has a differentiated QA worldview but a repository that reads like a promising internal
framework rather than a maintained product. The maturity effort raises it to the *quality bar* of a
real plugin product — unambiguous install, self-consistent docs, release discipline, dogfooding —
while deliberately refusing to grow into the *scope* of a broader engineering-workflow operating
system. The tiers are fixed:

- **Tier A — trust and packaging (in).** One-command install via a marketplace manifest, a
  reconciled docs tree, per-plugin semver, a changelog, and CI that validates the whole structure.
- **Tier B — QA-native discoverability (in).** A workflow-router skill, a human-facing page per
  skill, and lightweight per-skill fixtures that prove each skill still catches a known-bad input.
- **Tier C — workflow-OS parity (out).** Issue-tracker integration, spec/ticket/implement-style
  workflow skills, and a general-purpose PR/diff code-review skill.

## Why the bar but not the scope

The value Sentinel offers is a sharp QA layer: skills that hunt false-confidence tests, loose
assertions, over-mocking, and un-shippable branches. Absorbing Tier C would turn it into a bloated
hybrid that competes with full workflow-OS skill packs on their terms — a fight it would lose while
diluting the one thing it does distinctively well. Matching the quality *bar* is what makes the
worldview credible and adoptable; matching the *scope* is what would make it unfocused. Holding this
line is also what keeps the effort itself bounded, so maturity work never drifts into rebuilding an
engineering-workflow OS the tool was never meant to be.

## Consequences

- Every downstream decision in this effort is judged against "does this raise the quality bar of a
  QA plugin?" not "does a bigger skill pack have this?"
- Tier C features are out of scope by default; proposing one requires revisiting this ADR, not just
  adding a skill.
- The nine-skill taxonomy stays QA-focused; new skills must earn their place inside the QA worldview
  rather than extend the tool into general engineering workflow.
