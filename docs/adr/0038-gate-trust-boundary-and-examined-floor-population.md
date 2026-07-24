# Gate's trust-boundary posture, and the examined-floor's population — aggregator not executor; certify with breadth, not funnel-inflation

**Status: Accepted (2026-07-24).** From [#159](https://github.com/TzolkinB/skills/issues/159), the design half
of the Tier 2.3 external critique (finding F6 + the trust-boundary question it raised). Both decisions were
Kim's calls, taken 2026-07-24: **Decision 2 → aggregator + integrity-trust** (decline verification-trust);
**Decision 1 → Option B** (reframe *and* build the opt-in certification sample mode). The downstream code
issues are filed off this ADR. Amends — does not overturn — [ADR-0035](0035-gate-examined-floor.md); reaffirms
and extends [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md).

## Context

A hostile external review ("Tier 2.3 critique") read Gate as a **trust boundary** and found it wanting on two
fronts. Both are real observations; both are mis-severity'd because they assume Gate is something ADR-0010
explicitly says it is not (an executor / an independent verifier). This ADR settles what Gate *is*, so future
"harden the self-report" work has a line it does not cross by accident.

**F6 — the examined-floor fights `audit-test`'s funnel.** `audit-test` is a **funnel** (`reference/batch-mode.md`):
triage every test statically, then deep-audit **only the suspicious ones**, with a cost guard that narrows scope
if more than ~15 flag. Gate's examined-floor ([#127](https://github.com/TzolkinB/skills/issues/127), ADR-0035)
requires `deepAudited / audited ≥ 50%` (default) before a confirmed-clean audit can propose `ship`. In a healthy
suite where 10 of 100 tests look suspicious, the funnel deep-audits those 10, all kill their mutations — the
*good* case — and Gate caps it at `canary` because 10% < 50%. To clear the floor through the intended workflow,
the agent would have to mutate tests Step 3 says should **not** advance: do worse-targeted work to score better.

Crucially, this is not a newly-discovered bug. **ADR-0035 already named this as an accepted consequence:** "A
team with thousands of tests and a triage that only flags a few dozen as worth mutating will see `canary` by
default unless they either deep-audit more or consciously lower the floor — the tradeoff is surfaced, not
assumed away." So the question here is not "was this an oversight" (it wasn't) but "do we still accept that
tradeoff, and if we soften it, how — without reopening the 1-of-500 hole #127 was filed over."

**The trust-boundary question.** The critique's "Blocker / manufactures SHIP" framing treats Gate as a security
boundary. It is not: Gate **ingests existing evidence and never re-runs** (ADR-0010), and it is **advisory —
it never fails a build** (ADR-0026). A model that wants to lie can already write `confirmedSolid: 100`
directly; the self-report invariants (#155) make the report *internally consistent*, they are not a boundary
against a dishonest producer. "Trust boundary" is really three different questions the critique ran together,
and they have very different answers.

## Decision

### Decision 2 first — Gate's trust-boundary posture across three axes *(decided: aggregator + integrity-trust)*

"Should Gate be a trust boundary?" has no single answer because "trust" splits three ways:

1. **Integrity — was the evidence altered after Gate produced it?** *Build toward this; it is the reachable
   end-goal.* ADR-0037 already gets most of the way (content-addressed input subjects + opt-in DSSE signing).
   The remaining gap is that the signature covers only the decision + subjects, not the ingested evidence
   bodies or `producedOn` ([#158](https://github.com/TzolkinB/skills/issues/158)). Closing #158 makes the
   whole-bundle "tamper-evident" claim *true*. Integrity is a property Gate **can** own without executing
   anything, so it is the axis where Gate legitimately becomes a trust boundary.

2. **Verification — did the mutation actually run and kill? is the self-report true?** *Deliberately decline
   this.* To be a trust boundary here, Gate would have to **re-run the mutation itself** — which crosses the
   ADR-0010 execution seam and turns Gate from an *aggregator that composes with whatever ran the tests* into
   an *executor that competes with them*. That is a different product, and the aggregator identity is the
   differentiator (it works over any Playwright/Cypress/`audit-test` output, no matter what produced it). The
   run-trace (ADR-0037 §3) is the chosen **half-step**: it hardens the self-report toward per-test
   auditability *without* re-execution, and the self-report invariants (#155) tighten it further. We accept
   that the credibility axis is a **shape-checked, cross-checked self-report, not an independent
   re-verification** — and every user-facing surface must keep saying exactly that.

3. **Calibration — how much should the signal be trusted over time?** *Orthogonal — not a trust boundary at
   all.* A calibration loop makes a confidence *estimate* defensible by scoring predictions against outcomes.
   It does not make evidence tamper-proof (that's axis 1) or independently verified (axis 2). It is filed
   under the roadmap's future work and must not be conflated with either integrity or verification. (And it
   remains subject to the no-manufactured-number honesty guard until a real loop exists.)

**Decided: keep Gate on the ingest/aggregator side of the ADR-0010 seam. Build the integrity boundary
(#158). Decline the verification boundary as a conscious product choice, not a bug backlog.** If we ever want
verification-trust (Gate re-executing), it is its own future ADR with its own justification — never something
reached one "tighten the self-report" PR at a time.

### Decision 1 — the examined-floor's population *(decided: Option B — reframe + build the certification mode)*

The denominator must **not** change to the flagged/suspect population. If `deepAudited` were measured against
"mutation-eligible = flagged" tests, the ratio would sit at ~100% for any funnel run (you deep-audit all the
suspects), the floor would be trivially met, and the exact 1-of-500 exploit #127 closed would reopen behind a
redefinition. So the denominator stays **`audited` (all triaged)** — the population the whole-suite `ship`
claim actually covers.

What the floor is really enforcing is **breadth**: a confirmed-clean verdict over a narrow, self-selected slice
has not earned a *whole-suite* ship recommendation. And the funnel and the floor are answering two genuinely
different questions:

- **Diagnostic** (the funnel's default job): "are there hollow tests among the ones most likely to be hollow?"
  Cheap, targeted, suspect-only. A clean diagnostic run has found no problems **where it looked** — it has not
  certified the suite.
- **Certification** (what `ship` asks for): "is the suite broadly trustworthy enough to stake a release on?"
  This needs breadth the funnel deliberately does not spend.

So capping a diagnostic run at `canary` is **correct, not punitive** — but today's caveat ("deep-audit more of
the suite") reads like a demand to mutate more *suspects*, which is exactly the distortion F6 named. The fix is
to stop framing `canary` as a shortfall and give certification an **honest, principled** path.

**Recommended resolution (two parts):**

- **(1a) Reframe now — cheap, ship immediately.** Change the below-floor rationale/caveat from "deep-audit more"
  to name the *scope distinction*: this was a **diagnostic** run (examined suspects only); a `ship` needs a
  **certification** run that examined a representative breadth of the suite. `canary` here means "no problems
  found where we looked, but we looked narrowly," not "you did too little." Honesty-guard-safe (prose only).

- **(1b) Add an opt-in certification mode — the real path, its own build.** `audit-test` gains a mode that draws
  a **representative (random) sample sized to the floor across all triaged tests, regardless of suspicion**, and
  deep-audits *sample ∪ flagged-suspects*. Now `deepAudited / audited` can clear the floor **legitimately**, and
  "no hollow tests across a random sample plus every suspect" is real breadth evidence a `ship` can stand on. A
  *random* sample is principled in a way "mutate more suspects" never is. The default run stays diagnostic and
  still, correctly, caps at `canary`. Cost scales with the floor (50% is genuinely expensive on a large suite) —
  so it is **opt-in**, and the existing `--examined-floor` override (down to the 25% minimum) is how a team
  consciously buys a cheaper, narrower certification, exactly per ADR-0035's "surface the cost, don't assume it
  away."

**Decided (Kim, 2026-07-24): commit to (1b).** Both the reframe and the certification sample mode land — the
funnel gets a principled, breadth-based path to `ship` rather than being permanently capped at `canary`. (1a)
ships first (cheap, claims-safe); (1b) follows as its own spec'd build. Option D (reaffirm the status quo with
only better words) was considered and declined — it leaves the funnel with no honest route to `ship`.

## Considered options

**Decision 1:**

- **(A) Reframe only, no new mechanism.** Ship (1a); do not build (1b). Honest and cheapest, but leaves the
  funnel with no honest route to `ship` on a healthy suite — you relabel `canary` without giving a path. Viable
  if we decide `ship` should simply be rare and deliberate.
- **(B) Certification sample mode — CHOSEN.** (1a) + (1b). Gives the funnel a principled path to `ship`
  via random sampling, keeps #127's guard intact, matches ADR-0035's cost-surfacing philosophy. Costs a new
  opt-in mode in `audit-test` and a fixture/self-test pass.
- **(C) Change the denominator to the flagged/eligible population. REJECTED** — makes the ratio ~100% for any
  funnel run and reopens the 1-of-500 exploit #127 closed. This is the option the issue floated ("measure a
  mutation-eligible population") and it does not survive contact with the guard it would break.
- **(D) Accept `canary`-by-design, caveat the ceiling.** Formalize ADR-0035's accepted consequence: broad
  funnel runs cap at `canary`, full stop, and `ship` is reserved for a deliberate breadth audit. Same as (A)
  but stated as intent rather than as a gap. The honest fallback if (B) is judged not worth the build.

**Decision 2:**

- **Become an executor (re-run mutations to independently verify). REJECTED for v0 and as a default direction**
  — crosses the ADR-0010 seam, forfeits the compose-with-anything aggregator identity, and duplicates what the
  test runners already did. Kept only as a possible *future, explicit* ADR, never an accidental drift.
- **Claim the verification boundary in wording without building it. REJECTED** — that is precisely the
  overclaim the Tier 2.3 cleanup (#154/#160) just retired; re-introducing it would undo that work.

## Consequences

- **`ship` stays deliberately hard, and its scope is stated honestly.** Under (A)/(D), a healthy funnel run
  reads `canary` with a *diagnostic-scope* rationale. Under (B), `ship` becomes reachable through a certification
  run whose breadth it can actually defend. Either way the denominator stays `audited`; #127's guard is intact.
- **ADR-0035 stands.** Its floor, default, 25% clamp, and honesty-guard treatment are unchanged. This ADR only
  refines the *caveat wording* and (if B) adds an orthogonal opt-in path; it does not redefine "confirmed" or
  the floor arithmetic.
- **Downstream issues (filed off this Accepted ADR):** (1a) rationale/caveat reword in `gate.mjs` +
  `gate/SKILL.md` (claims-safe, agent-ready); and (1b) a spec for `audit-test`'s certification/sample mode
  (scope, the `sample ∪ suspects` rule, cost-guard interaction, how it clears the floor, fixtures, self-test
  rows). (1a) ships first; (1b) is the larger build.
- **Gate's identity is documented and defended.** Future critiques that read Gate as an independent verifier
  now have a decision to point to: integrity is the boundary we build (#158), verification is declined by
  design (ADR-0010), calibration is separate. This is the reusable answer, not a per-PR rebuttal.
- **No schema-version bump from this ADR.** Decision 2 is posture; Decision 1(a) is prose; Decision 1(b), if
  built, is an `audit-test` run-mode, not a bundle/emission shape change (same precedent as ADR-0035).
- **Honesty guards untouched.** No numeric field enters the gate predicate; the credibility axis keeps saying
  "shape-checked, cross-checked self-report, not independent re-verification."
