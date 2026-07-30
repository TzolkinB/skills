# Judgement skills share one `--digest` evidence card and one inline `Next:` footer; compression may drop a finding, never upgrade its label

**Status: Accepted (2026-07-30).** Implements
[#193](https://github.com/TzolkinB/skills/issues/193).

## Context

Every judgment skill emits exactly one shape: its full report. That's the right default — the
evidence is the product — but it means the reader who already trusts the skill still has to read a
40-line report to find the one thing to do. Two things were missing for the *scan → act* path:

**1. There was no short form, except by accident.** `audit-test`'s single-test entry is already a
four-field card — Verdict / How it fails / Proof / A real test would — which is precisely
*risk / evidence / action / how it's known*. No other skill had an equivalent, and the obvious
failure mode of adding one per skill is five bespoke short forms, each re-deciding independently
what a finding's confidence label should be.

**2. The routing sat behind a second lookup.** `ask-sentinel` knows what follows a given finding,
but the user holding a `coverage-review` report has to stop, re-invoke the router, and re-describe
their situation to get told. `prune-tests` is the one skill that already routes inline — its
`Deferred to audit-test` hand-off delivers the next step at the point of use — and it works.

## Considered options

- **A bespoke short form per skill.** Rejected: it is the status quo's problem restated — a fifth
  format for the reader, and seven independent answers to the label question.
- **Make the digest the default and put the full report behind a flag.** Rejected: the evidence *is*
  the product ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md)), and a default digest
  makes the unexamined denominator the easiest thing to lose. Opt-in keeps the honest report the
  thing you get without asking.
- **Compute the footer by calling `ask-sentinel`.** Rejected: it makes every report a router
  invocation, and `ask-sentinel` routes a *situation* — it is not a subroutine of another skill's
  output. The cost of the copy is a real sync obligation, which we take deliberately and name in
  both files.
- **A shared "digest" skill the others delegate to.** Rejected: a formatting contract is not worth a
  skill boundary, and it would make six user-invoked leaves model-invoke a seventh
  ([ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)).

## Decision

**One shared card, one shared footer, both defined once outside any single skill.**

1. **`--digest`** is an opt-in flag on the seven judgment skills (`test-plan`, `qa-review`,
   `coverage-review`, `audit-test`, `prune-tests`, `threat-model`, `sentinel`). It **replaces** the
   full report with a header line carrying the scope and tally, then at most three cards:
   `Risk` / `Evidence` / `Action` / `Confidence`. The contract lives in
   [`skills/shared/digest-format.md`](../../skills/shared/digest-format.md); each skill's Output
   Format **links** the format rather than restating it, and its `--digest` step names only its own
   confidence ceiling — the one line a reader at that skill needs, with the shared table authoritative
   for all seven.
2. **A one-line `Next:` footer** closes every judgment report, full or digest, tabulated in
   [`skills/shared/next-footers.md`](../../skills/shared/next-footers.md). It is **derived from**
   `ask-sentinel` — its routing signals plus its intended-flow diagram — but not copied from it: the
   router is keyed by *situation* ("this test passes but I don't trust it") and a footer is keyed by
   *result* ("🟡 likely — the code wasn't runnable"), because the skill already knows what it found.
   `ask-sentinel` is declared authoritative on the destination: the footer table is a shortcut *into*
   the map, and where the two name different next skills for the same situation, the map is right and
   the footer is the bug.

### The constraint that makes the card safe: compression never upgrades a label

A digest is a summarizing step, and summarizing is exactly where a reasoned finding could quietly
acquire the authority of a measured one — the self-report laundering this repo refuses everywhere
else ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md),
[ADR-0039](0039-audit-test-green-requires-execution.md),
[ADR-0038](0038-gate-trust-boundary-and-examined-floor-population.md)). So the `Confidence` field is
not a new vocabulary; it is the existing Confirmed / Likely / Unexamined provenance, and the shared
doc fixes a **ceiling per skill**: `Likely` for `test-plan`, `qa-review`, `prune-tests`, and
`threat-model` (none of them execute anything); split for `coverage-review` (`Confirmed` only for
line/branch facts from a *fresh* instrumentation report, `Likely` for every assertion-quality
judgment even in instrumentation mode); verdict-mapped for `audit-test`; and **worst-wins** for
`sentinel`, which composes and originates no evidence. `Unexamined` may label a card only when the
finding *is* that nothing here examined it (a hand-off, like `prune-tests`' `Deferred` entry);
otherwise it belongs in the header's denominator, and it never labels something as clean.

Defining that table once is most of the value of sharing the format at all. Seven skills deciding
this independently is seven chances to launder reasoning as proof.

## Consequences

- **`skills/shared/` is a new surface** — the first directory under `skills/` that is not a skill.
  It ships with the plugin (unlike the repo-root `references/` research tree, which is gitignored;
  skill-local `reference/` dirs like `audit-test/reference/` *are* tracked), and carries no `SKILL.md`, so
  plugin validation and the eval lint both walk past it.
- **A sync obligation exists** between `next-footers.md` and `ask-sentinel`'s routing signals. It is
  stated in both files with `ask-sentinel` named as authoritative; nothing enforces it mechanically.
- **Change detection had a hole and is patched:** a `skills/shared/**` edit changes seven skills'
  output but matches no `skills/<name>/SKILL.md` path, so `evals/changed.mjs` would have run zero
  evals for it. It now fans that change out to every skill with a case, the same way a harness-core
  change does.
- **`--digest` is guarded by one eval case, not seven.** `audit-test` carries a case asserting the
  digest keeps the four fields, the footer, and the honest label; the other six rest on the shared
  contract. That's a deliberate cost cap, not a claim of coverage.
- **[#191](https://github.com/TzolkinB/skills/issues/191) is not superseded.** The `coverage-review`
  footer is the one-line hand-off; #191 grows the same findings into a full "Escalate to audit-test"
  section. The footer is the mechanism it builds on.
- **Six skills stay footerless** (`debug-test`, `e2e-impact`, `contract-guard`, `bug-report`,
  `audit-orchestrator`, `gate`) — procedural or terminal rather than judgment skills, several of
  which already route inline. Named as a follow-up in `next-footers.md`, not silently skipped.
