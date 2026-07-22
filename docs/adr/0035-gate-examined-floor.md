# Gate requires a minimum examined-fraction to reach `ship` — the coverage-aware ship gate

**Status: Accepted (2026-07-22).** Closes [#127](https://github.com/TzolkinB/skills/issues/127), Tier 1 item 2
of `docs/roadmap.md`. Same shape as [ADR-0029](0029-witness-parsed-audit-test-graduation.md)'s B→A change: a
real design decision on when the existing gate function returns `ship`, not new capability.

## Context

Finding A3 of a hostile external review (`references/critique-synthesis.md`) named the sharpest gap left after
the B→A graduation: `ship` was reachable with `deepAudited:4, unexamined:8` on the shipped fixture — a
confirmed-clean verdict over 33% of the triaged tests was enough to earn `ship`, with no floor on how small
that fraction could get. #112 fixed the *disclosure* (the rationale and report already state the
examined/unexamined split), but the decision itself was unaffected — "1-of-500 deep-audited" would still
propose `ship` with the gap merely narrated, not gated on. The review's own words: "narrated, not gated."

## Decision

**1. `ship` requires the deep-audited fraction to clear an examined-floor.** In addition to the existing
`PASSED`+`confirmed` requirement, `gate()` now also requires `deepAudited`/`audited` ≥ the floor before a
confirmed-clean audit-test input proposes `ship`; short of it, it proposes `canary` with a rationale line
naming the fraction, the floor, and issue #127. The proof-grade `label` (`confirmed`/`likely`/`unexamined`,
derived by `deriveAuditLabel`) is unchanged — a 33%-examined confirmed-clean run is still honestly labelled
`confirmed`; the floor is a *separate*, additive ship-eligibility check on top, not a redefinition of what
"confirmed" means.

**2. Default 50%, overridable, never below a 25% minimum.** `--examined-floor=<pct>` lets a human consciously
accept a narrower scope than the default; a request below 25% is clamped up to 25%, with a warning printed —
never silently honored. This mirrors the project's existing "never trust it blind" pattern for
`--audit-test-json` (a malformed emission degrades with a warning, never a silent upgrade): a floor override
is a human's deliberate call, not a hands-off default, so the tool discloses when it clamps one.

**3. No new categorical rung; extends the existing `canary` floor.** A confirmed-clean-but-below-floor result
proposes `canary` — the same rank every other under-proven credibility state already floors at (opaque,
absent, examined-nothing, likely, baseline-lock). No new value joins the `hold`/`canary`/`ship` enum. This
matters more than it might look: the gate is **advisory and never fails the build** (it always has been, since
MVP1 — [ADR-0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)), so "gating on the floor" changes what the
tool *recommends*, not whether a PR can merge. A user is never mechanically blocked by this change; they get a
`canary` recommendation with a named reason, exactly as they already do for an opaque audit-test report.

**4. The floor's numbers never enter the gate predicate as fields.** Honesty guard #3 (no numeric field
anywhere in the gate predicate — `validateGateEntry`'s `findNumbers` check) is preserved unchanged. The
examined percentage and the floor value are computed and compared, then only ever written into `rationale[]`
**strings** — the same treatment `auditScope()` already gives the `deepAudited`/`audited`/`unexamined` counts.
`inputs[]` entries gain no new fields; `proposed` stays `ship`/`canary`/`hold`.

**5. No schema-version bump.** `gate-evidence-bundle` stays at `v0.3` and `gate-audit-test` stays at `v0.2` —
neither the bundle shape nor the emission shape changed, only the decision function's internal rule (same
precedent as ADR-0029's B→A change, which also shipped without a version bump). `--examined-floor` is a
gate.mjs *runtime* parameter, not a bundle or emission field.

## Considered options

- **Absolute floor on `deepAudited` count** (e.g. ≥5 deep-audited tests), instead of a fraction. Rejected — an
  absolute count doesn't scale: 5-of-5 is thorough, 5-of-5000 is not, and 5-of-6 would be *rejected* by a floor
  tuned for large suites. A fraction is proportional to the suite triage already sized; an absolute count isn't.
- **Both a fraction AND a floor count.** Rejected for v0 — doubles the surface (two thresholds to explain, tune,
  and self-test) for a marginal guard the fraction alone already closes (the exploit named in #127 is a *ratio*
  problem — 1-of-500 — not a *count* problem). Revisit only if a real-world case shows a fraction-only floor
  passing something a count would have caught.
- **New categorical rung between `canary` and `ship`** (e.g. `ship-partial`). Rejected (Kim's call) — the gate
  is advisory-only already, so a new rung buys no additional protection a `canary` + a named rationale doesn't
  already give; it would cost a new enum value, a schema-adjacent doc pass, and a new self-test dimension for
  a distinction users can already read straight from the rationale line.
- **Hard-block override (no escape hatch).** Rejected (Kim's call) — the gate never fails the build regardless,
  so a hard, non-overridable floor doesn't add a *safety* property, only friction: large suites where a full
  50% deep-audit run is genuinely expensive would have no honest way to ship faster while still disclosing the
  narrower scope. A clamped-but-overridable floor keeps the disclosure (the whole point) without pretending the
  advisory tool can or should enforce a policy on someone else's release process.
- **0% minimum on the override (no clamp at all).** Rejected — would let `--examined-floor=0` silently reopen
  exactly the 1-of-500 exploit #127 was filed over, just behind a flag instead of by default.

## Consequences

- **The golden self-test's ship-reachability invariant tightens.** "Ship reachable iff Playwright PASSED and
  parsed confirmed-clean" becomes "...and the examined-floor is cleared." The truth table gains
  `confirmedBelowFloor` (issue #127's own 4-of-12 example, now `canary` by default) and `confirmedVeryLow`
  (exercises the 25% clamp), plus `resolveExaminedFloor` unit checks.
- **The shipped fixture (`fixtures/audit-test.confirmed.json`) changed** from 4-of-12 (33%, the exact case the
  issue flagged) to 6-of-12 (50%, clearing the new default floor) so the fixture e2e "ship" path still
  demonstrates a run that actually should ship under the new rule.
- **A large suite's realistic cost is now visible, not hidden.** A team with thousands of tests and a triage
  that only flags a few dozen as worth mutating will see `canary` by default unless they either deep-audit more
  or consciously lower the floor — the tradeoff is surfaced, not assumed away.
- **Honest limits still carried, not hidden** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
  the floor value, the override, and the clamp are all stated in the tool's own rationale and report output.
