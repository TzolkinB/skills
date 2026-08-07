# Drop the "prototype" self-label for v2 — solo-maintained rigor, not roughness

**Status: Accepted (2026-08-07).** Supersedes the wording (not the intent) of
[ADR-0037](0037-gate-evidence-integrity.md) finding 9 for the v2.0.0 framing.

## Context

[ADR-0037](0037-gate-evidence-integrity.md) (finding 9, a pre-v1.0.0-launch hostile-review response)
deliberately added an explicit **"Status: prototype"** line to `README.md`, to avoid a single-maintainer
project overclaiming reliability it hadn't earned. That was the right call for v1.0.0.

Preparing v2.0.0 ([ADR-0052](0052-rename-sentinel-skills-to-qa-compass-qa-pass.md)'s rename plus the
additive work already in `CHANGELOG.md`'s `Unreleased` section), the word "prototype" now undersells
what's actually true: 14 skills, each covered by a CI-gated eval; 52 ADRs recording every non-trivial
decision; and a strict evidence-provenance discipline ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md))
applied to every claim this repo makes, including this one. "Prototype" connotes structural
rawness — likely to change wildly, minimally tested, thrown together — which this repo isn't. But the
*original* honest caveat behind the label — solo-maintained, no team, no SLA, no confirmed users beyond
the maintainer — hasn't changed and must not be dropped or, worse, replaced with an overclaim.

## Considered options

- **Leave "Status: prototype" as-is.** Rejected — actively undersells the project's actual engineering
  rigor for a v2 release; "prototype" specifically implies a structural rawness this repo doesn't have.
- **Replace it with a claim of external validation or adoption** ("used in production," "trusted by
  teams"). Rejected — false. Per the maintainer's own account, there are no confirmed users beyond
  herself. Making this claim would violate the no-proof-no-claim discipline this repo demands of every
  other claim it makes ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)) — the
  project's own "Status" line doesn't get an exemption from its own rule.
- **Drop the caveat sentence entirely; say nothing about maintainer status.** Rejected — "no team, no
  SLA" is a load-bearing trust signal a reader deciding whether to depend on this still deserves,
  exactly the reasoning ADR-0037 gave it in the first place. Removing it silently is a worse trust
  regression than keeping "prototype" would have been.
- **Chosen: keep every honest caveat, replace only the connotation.** State the concrete engineering
  discipline in place (evidence labels, ADRs, CI-gated evals) *alongside*, not instead of, the unchanged
  caveats (solo-maintained, no team, no SLA, no confirmed outside users). Drop the single-word
  `**Status: X.**` label pattern in favor of a sentence that holds both truths — real engineering rigor
  and unproven-by-outside-adoption — without conflating them into either "rough" or "trusted."

## Decision

1. **`README.md`'s Contributing & Support section no longer uses the word "prototype."** Replaced with a
   sentence naming the concrete discipline (14 skills / 14 CI-gated evals, 52 ADRs, an evidence label on
   every claim) alongside the unchanged honest caveats: solo-maintained, no team, no SLA, no confirmed
   users beyond the maintainer. The call to action (file an issue; real usage is what sharpens these
   skills) is unchanged.
2. **No other surface changes.** `CONTRIBUTING.md`, `CONTEXT.md`, and
   `.claude-plugin/{plugin,marketplace}.json` were grepped and already carried no prototype-flavored
   language — `CONTRIBUTING.md`'s own "personal framework first" framing already reads as honest rigor,
   not roughness, and needs no change.
3. **`docs/positioning.md` gains one new line under "Claims we must not make":** no implied external
   adoption. This repo may state its own engineering rigor (eval coverage, ADR count, evidence
   discipline); it must never claim usage or trust by anyone beyond the maintainer until that becomes
   true.

## Consequences

- The v1.0.0-era "prototype" self-label is superseded in wording, not in honesty — nothing about actual
  adoption status changed; only the word describing engineering maturity did. A reader still learns,
  in the same breath, that this is solo-maintained with no SLA and no confirmed outside users.
- Future outward copy that reaches for an adoption claim now has an explicit rule in
  `docs/positioning.md` to fail against, not just precedent to infer from.
- **Reversible.** One paragraph of `README.md` plus one policy line in `docs/positioning.md`; no code,
  schema, or behavior is touched.
