# debug-test gains a drift mode: it classifies an *already-red* test as external drift vs. code regression and routes — it does not run the suite

**Status: Accepted (2026-07-13).** Implemented as `debug-test`'s **Drift Mode**
([SKILL.md](../../skills/debug-test/SKILL.md)) — classify → quarantine → surface, entered via
`--drift` or a deterministic red whose diff doesn't touch the code the test exercises. Backed by
[EXPERIMENT-0018](../experiments/EXPERIMENT-0018-drift-triage.md), a **blinded** run in which Arm A
(external field-rename drift) classified as external drift and routed away from local patching, while
Arm C (a genuine local regression control) did **not** cry drift — sensitivity ✓ and specificity ✓.
That was an **existence proof (n=1 target, n=1 app)**; the **2026-07-14 widening run** (EXPERIMENT-0018
§Widening run, #45) then closed the three open arms on a purpose-built fixture — **empty-diff drift on
an un-reset external backend**, a frontend with **no response-schema validation**, and a **naive-healer**
— all blinded. Results: **H1 *as defined* (signals 1–2 alone) was not closed** — the empty-diff arm resolved only
because the classifier was handed a **contract oracle** (the live response), so it shows the oracle need
not be an *in-code* schema, **not** that signals alone suffice; specificity (H3) held; and **H2 was
positively demonstrated** — a "make-it-pass" healer green-locks the drift (adapts the consumer to an
*unconfirmed* change) where a *triage* framing surfaces-and-defers. This lifts the evidence to **n=2
apps** — still **not a large-N rate**. The live-contract-visibility caveat is load-bearing (a static pass
needs a published contract to make the deliberate-vs-accidental call), which **points the contract-guard
*toward* load-bearing** for the no-validation/empty-diff segment — sequencing **revised, not simply
confirmed** (EXPERIMENT-0018 §Verdict). Held to the
[ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md) provenance discipline — existence-proof
*widened*, not oversold as a rate. The gap is argued from field experience
(enterprise orgs split frontend/backend teams; a frontend suite goes red on a backend the frontend
team never touched and cannot instrument). This ADR is the sibling of
[ADR-0012](0012-debug-test-flake-mode.md): flake-mode gave `debug-test` a disposition for a
*non-deterministic* red; drift-mode gives it a disposition for a *deterministic red with no relevant
local cause* — the failure a long-idle microservice consumer eats when the world moved and its code
did not.

## Context

A test that was green for months goes red with **no relevant change in its own repository**. In a
monolith this is rare; in an enterprise frontend/backend split it is routine — the frontend E2E suite
exercises a backend owned by another team, on another release cadence, and a contract, payload shape,
auth flow, or env value moved underneath it. The frontend team owns the red but not the cause, and —
critically — **cannot reach the fix through the tools that are supposed to prevent this.** Pact and
consumer-driven contracts require the *provider* to run verification against the consumer's contract;
when the backend org will not participate, Pact's loop never closes, so the stranded consumer team
gets no coverage from it. (This is lived, not hypothetical: SDET teams have debated hand-rolling a
consumer-side contract check inside Cypress precisely because Pact was not adoptable across the org
boundary; Playwright is now the more common substrate for that instinct.)

`debug-test` today meets this red the same way it meets any red: it assumes a **local** cause and
routes to the Playwright healer (locator/timing) or `diagnosing-bugs` (value/logic). Both are the
*wrong* disposition for drift. The healer, blinded, will "fix" a test to match the drifted backend
*without asking whether the drift was intended* — and `diagnosing-bugs` will hunt a local defect that
is not there.

But the deeper error is a wrong **default about fault**. It is tempting to invert the healer and rule
"external red → the backend broke its contract, fix it there." Field experience says that is usually
wrong: **most cross-service changes are deliberate.** The provider's OpenAPI/Swagger already reflects
the new shape; there was no accident and no rollback coming; the frontend/test is simply **stale**, and
updating it is correct maintenance. So drift has *two* legitimate outcomes — accept the change (update
the consumer) or reject it (escalate a real break) — and **neither the healer nor a blame-the-backend
reflex can tell which**, because that turns on the provider's *intent*, which only the published
contract (and a human) can read. Blindly healing green-locks a possible break; blindly blaming the
provider freezes the frontend against legitimate evolution and floods it with false escalations.

The disposition that is *missing* is the one flake-mode supplied for its category, adapted for a
boundary the tool must not adjudicate: **do not assert a cause or a fault you cannot prove; classify,
quarantine without capitulating, and *surface the mismatch — with the published-contract evidence — for
a human to dispose*.** The value is speed-to-surface (shift-left), not remediation.

### The constraint that shapes the whole design

Drift is fundamentally a **temporal/runtime** signal, and [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)
ruled the **Execution Gap out of scope**: the suite is a static judgment layer; it does not drive
browsers, spin sessions, or *run* the suite to discover a red. That ruling is not an obstacle here —
it is the design. Drift-mode engages a test that is **already red** (a human or CI ran it; the red is
an input, not something the suite produces) and does pure **judgment** on it — exactly as `debug-test`
already diagnoses an already-failing test without owning the runner. Nothing in this ADR runs, retries,
or instruments anything. The moment it would need to *execute* to get its signal, it routes across a
seam instead (below).

## Decision

Fold a **drift mode** into `debug-test` (not a tenth skill — the mirror of ADR-0012's decision to
fold flake-mode in), with three parts in ADR-0012's order — signals ranked by reliability, then a
non-capitulating disposition, then a routing seam.

**1. Classify — from static + temporal signals the suite already owns or can consume; never from a run.**
The verdict sought is a *suspicion*: "this red looks like external drift, not a local regression."
Signals, most reliable first:

- **Diff relevance (primary, static, cheap).** Does the working/PR diff touch any source the failing
  test plausibly exercises? An **empty or drift-irrelevant diff under a previously-green test** is the
  drift signature. This reuses the *same* source→test relevance map built for E2E impact analysis
  (Problem 1) — the map that answers "which specs does this change hit" answers, inverted, "did any
  change hit this spec at all." One artifact, both features.
- **Temporal signal (secondary, consumes ADR-0010's seam).** Was this test **green in the recorded
  findings log and is now red with no relevant local change**? ADR-0010 already defined the
  append-only, repo-relative findings log and named `debug-test` a *writer* of it; drift-mode is a
  *reader* of the green→red transition. Where the log is not yet implemented, this signal is absent
  and the mode says so — it does not fabricate history.
- **Published-contract comparison (tertiary, and the *disposition* oracle — consumed, never produced).**
  Compare the drifted response against the provider's **published contract (OpenAPI/Swagger)**. This is
  the cross-service mirror of [ADR-0017](0017-audit-test-baseline-lock-suspected.md)'s in-code intent
  oracle, and it does double duty: it is *positive* drift evidence ("the depended-on field moved"), and
  — critically — it is the **deliberate-vs-accidental discriminator**. Most cross-service changes are
  *intended* API evolution, and the provider's spec already reflects the new shape; the frontend/test is
  then merely **stale**, not guarding a regression. So: response **matches the published spec → deliberate**
  (the frontend is the thing to update); **contradicts it, or no spec exists → suspected break** (escalate).
  Note this oracle is usually **readable across the org boundary even when Pact is not adoptable** — a
  frontend team that cannot get the provider to run contract verification can still *read* its OpenAPI.
  The suite **consumes** the spec; snapshotting live responses to produce this evidence is an
  execution-layer artifact, out of scope here by ADR-0010 (see the follow-up note below).

**2. Quarantine — non-blocking, never `.skip()`-and-forget, never delete.** Identical disposition to
flake-mode: recommend a quarantine lane / tag so CI stops blocking on a red the frontend team cannot
fix, while the test keeps running and reporting — because a drifted test still guards real behavior,
and silently skipping it lets the *next*, real, local regression ship invisibly.

**3. Surface the mismatch for human disposition — shift-left, do *not* auto-route to a "fix".** This is
the load-bearing correction, and it reverses a wrong default: drift-mode does **not** presume the
backend erred. Because most cross-service changes are *deliberate* (see the published-contract oracle
above), the two dispositions are both legitimate and only a human can choose between them:

- **Deliberate evolution (response matches the published spec)** → the frontend/test is *stale*;
  drift-mode offers the exact test/frontend update to accept it. This is correct maintenance, **not** a
  green-lock — green-lock is adapting to an *unconfirmed* change, and the spec check is precisely what
  tells them apart.
- **Suspected break (contradicts the spec, or no spec exists)** → drift-mode routes to a cross-team
  report (`bug-report` structures this), pointing at the field that moved — **not** to the Playwright
  healer, which would blindly green-lock.

The choice — accept-and-update, or stop-and-escalate — is **always the human's** ([ADR-0001](0001-audit-test-proves-by-execution.md),
[ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md), [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
drift-mode presents both paths with the contract evidence; it neither silently heals the test nor
unilaterally declares the backend at fault. **The win is the surfacing itself** — the earlier a
frontend/backend mismatch is detected and reported (at CI/PR time, or the moment an idle suite first
reddens), the cheaper it is for everyone; speed-to-surface beats auto-remediation. A red that
classifies as *local* falls straight back to today's healer / `diagnosing-bugs` routing, unchanged.

The verdict is a **challenger's flag, not an oracle**: "suspected external drift — local diff is
empty/irrelevant, history shows green, and the response [matches / contradicts] the published contract
for X." It never asserts the backend is wrong on its own authority, and it never green-locks the
consumer to an *unconfirmed* change.

## Considered options

- **Own drift *detection* by running the suite / instrumenting the app.** Rejected — that is the
  Execution Gap [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md) put out of scope,
  and it would collapse the static-judgment/execution seam that is the suite's moat. Drift-mode acts
  on an already-red test only.
- **Build a full consumer-side contract framework into `debug-test`.** Rejected *here*, but not
  rejected outright — it is an execution-layer artifact, so by ADR-0010 it belongs to the execution
  layer / Gate and is *reached across a seam*, exactly like the Playwright healer. **It warrants its
  own ADR**, because the frontend/backend insight elevates it from "don't build, Pact owns prevention"
  to a genuine white space: Pact needs provider participation, so it structurally does **not** serve the
  stranded enterprise frontend team. The likely shape is **not** a blind response-snapshot but a
  **differ against the provider's published OpenAPI/Swagger** — which the frontend team can usually read
  even without backend cooperation, and which carries the deliberate-vs-accidental oracle for free
  (EXPERIMENT-0018 found an existing client-side Zod schema already served this role). That is the
  larger, defensible build this ADR scopes *out* and points *at*.
- **Route drift to the Playwright healer like any other red (status quo).** Rejected — the healer,
  blinded, adapts the test to the new backend value *without checking whether that value is intended*.
  When it is intended, that is correct maintenance done for the wrong reason (luck); when it is a break,
  it is a green-lock. Either way the healer decides something only a human-with-the-contract should.
  Drift is the one red where blind self-healing is the wrong reflex, which is why it needs its own
  disposition.
- **Have drift-mode auto-decide "the backend is wrong, fix it there."** Rejected — this was the
  original default and it is empirically wrong: in practice most cross-service changes are *deliberate*
  (the provider's Swagger already shows the new shape), making the frontend/test merely stale. A tool
  that reflexively blames the provider generates false escalations and freezes the frontend against
  legitimate evolution. The disposition belongs to a human reading the published contract.
- **Fold drift into flake-mode.** Rejected — a flake is *non-deterministic* (fails N/M runs); drift is
  *deterministically red* from a stable external cause. Same three-part shape, different discriminator
  and different route; conflating them would send a real contract break into the quarantine-and-burn
  loop and never notify the provider.

## Consequences

- **A new `debug-test` disposition**, parallel to flake-mode: detect-by-judgment → quarantine → route,
  applied to an already-red test. No runner, browser, or instrumentation enters the suite; the
  static-judgment moat ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)) is preserved.
- **Shares one artifact with Problem 1.** The source→test relevance map is built once and read in both
  directions — "which specs does this diff hit" (impact selection) and "did any diff hit this red at
  all" (drift). Whichever ships first subsidizes the other.
- **First real reader of ADR-0010's temporal seam.** Drift-classification gives the deferred findings
  log a concrete consumer (the green→red transition), which should inform when that log graduates from
  deferred to built. Where the log is absent, the temporal signal is a stated gap, not a faked pass.
- **Points at, and scopes, a follow-up ADR** for a provider-independent contract check — likely an
  **OpenAPI/Swagger differ**, not a blind response-snapshot — the stranded-frontend white space Pact
  cannot fill. Drift-mode *consumes* its evidence, so the two compose: the contract check is the
  detector + deliberate-vs-accidental oracle, drift-mode is the classifier and human-surfacing router.
- **Shift-left is the product value, not remediation.** The payoff is surfacing a frontend/backend
  mismatch *early* and reporting it; drift-mode deliberately stops at "here is the mismatch and the
  contract evidence — human, decide," rather than fixing either side. EXPERIMENT-0018's blinded run
  showed a careful classifier can reach the right *call*; this ADR withholds the *decision* from it on
  purpose.
- **Extends the green-lock defense outward — but only against *unconfirmed* change.**
  [ADR-0017](0017-audit-test-baseline-lock-suspected.md) stops a self-healer green-locking to a *local*
  regression; drift-mode stops the healer green-locking to an *external, unconfirmed* one. The
  published-contract oracle is the hinge: adapting a test to a change the provider's spec confirms is
  legitimate maintenance, not a false 🟢. The suite refuses false 🟢 in both directions **without**
  freezing the frontend against deliberate API evolution.
