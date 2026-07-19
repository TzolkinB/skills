# `contract-guard` is a standalone consumer-side contract check — a tiered recommend-then-differ, not a snapshot, and not folded into drift-mode

**Status: Accepted (2026-07-15).** Implemented as the `contract-guard` skill
([SKILL.md](../../skills/contract-guard/SKILL.md)) — a **user-invoked, static-judgment** skill that
gives the *stranded* enterprise frontend team the consumer-side contract check Pact structurally
cannot ([ADR-0018](0018-debug-test-drift-triage.md) scoped this out of drift-mode and pointed at it as
the follow-up). It is **tiered, cheapest-first**: detect existing response validation → recommend/
generate client-side validation → differ the consumer's expected shape against the provider's
**published OpenAPI/Swagger**. It is the *detector + deliberate-vs-accidental oracle* that
`debug-test --drift` consumes; the classifier stays in drift-mode, the contract comparison lives here.
Backed by the design in [EXPERIMENT-0018](../experiments/EXPERIMENT-0018-drift-triage.md) — whose
widening run found the differ's value **conditional** (it earns its keep only for frontends that both
lack response-schema validation *and* face an empty-diff drift), which is exactly why this is a *tiered*
skill rather than a differ-by-default. Sibling to spec issue #71 (the *what*); this ADR is the *why*.
Sliced from the parked epic #48, unblocked by #44 (E2E-TIA v0, closed).

## Context

An enterprise frontend team runs an E2E suite against a backend another team owns, on another release
cadence. The backend renames a field, drops one, or retypes it; the previously-green suite goes red on a
contract change the frontend team did not cause and cannot fix at the source. Pact — the tool meant to
prevent this — needs the **provider** to run verification against the consumer's contract, so when the
backend org will not participate, Pact's loop never closes and the stranded consumer gets **no
coverage**. This is lived, not hypothetical (SDET teams have hand-rolled consumer-side contract checks
inside Cypress/Playwright precisely because Pact was not adoptable across the org boundary).

[ADR-0018](0018-debug-test-drift-triage.md) gave `debug-test` a **drift mode** that *classifies* an
already-red test as external drift and *surfaces* it for human disposition, consuming a
**published-contract comparison** as its tertiary signal and deliberate-vs-accidental oracle. But
ADR-0018 deliberately scoped the *building* of a provider-independent contract check **out** of
drift-mode (Considered options: "Build a full consumer-side contract framework into `debug-test` —
Rejected here... It warrants its own ADR"). Drift-mode does a **lightweight inline** check when a
contract or in-repo schema is already at hand; the harder job — **locate and parse the provider's
published OpenAPI/Swagger, derive the consumer's expected shape from untyped field reads, resolve the
endpoint to the right operation, and carry the recommend-validation play** — is the follow-up this ADR
decides.

[EXPERIMENT-0018](../experiments/EXPERIMENT-0018-drift-triage.md)'s widening run (n=2 apps, blinded) is
the evidence that shapes the decision. It found the contract differ's value is **conditional, not
universal**: a frontend that already `safeParse`s its responses has a lightweight consumer-side contract
*in the code already* (drift is self-revealing → a separate differ is **redundant**); the differ earns
its keep only on the segment that both **(a)** reads untyped JSON with no response validation **and**
**(b)** faces an **empty-diff** drift a static pass cannot resolve without a published contract. That
finding rules out a differ-by-default and rules *in* a **tiered** skill whose cheapest tier is often the
right answer.

## Decision

Build `contract-guard` as a **standalone, user-invoked, static-judgment** skill with a **tiered,
cheapest-first** disposition. It never runs the suite, never drives a browser, and never snapshots live
responses; it *reads* the consumer's response-consumption code, any in-code response schema, and the
provider's **published** OpenAPI/Swagger (a file or a fetched document — reading a published contract is
consumption, not execution; [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)).

**Tier 0 — Detect existing response validation.** If the frontend already validates responses against a
schema (e.g. a Zod `safeParse` at the fetch boundary), that schema **is** the consumer-side contract:
drift is self-revealing and `debug-test --drift` reads it as its oracle. `contract-guard` says so and
**recommends nothing new** — it does not add a redundant guard. (Directly from EXPERIMENT-0018's mosaic
finding.)

**Tier 1 — Recommend/generate client-side response-schema validation.** If the frontend reads untyped
JSON, the lightest durable fix is response-schema validation at the fetch boundary. `contract-guard`
**proposes** it and can **scaffold** a starter schema from the shape the consumer actually reads —
*proposed, never auto-applied* ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md),
[ADR-0003](0003-prune-tests-proposes-before-deleting.md)). This makes *future* drift self-diagnosing,
promoting the frontend into the Tier-0 case, and is more on-domain than a bespoke snapshot guard —
EXPERIMENT-0018 named it the lighter play "to weigh first."

**Tier 2 — OpenAPI/Swagger differ.** For the segment the light play cannot cover in the moment — an
**empty-diff** drift on a frontend with **no** response validation, where the consumer's own repo gives
no signal — diff the **consumer-expected shape** (the fields/types the frontend reads, or its in-code
schema if one exists) against the provider's **published spec** (S), resolved to the operation the failing
test's endpoint hits. The deliberate-vs-accidental call turns on **whether the published spec still
matches what the consumer reads** — the field-level diff between consumer-expected (E) and spec (S). This
is the *static* form of ADR-0018's oracle ("the response matches the published spec → deliberate"): a
static pass cannot see the drifted live response, so it reasons off the *consumer's* expectation against
S, which inverts the surface phrasing — the drifted response follows the *new* shape S documents, while
the stale consumer still reads the *old* one. Hence:

- **S has moved away from E** (the published spec documents a field the consumer doesn't read — a
  rename/drop/retype) → the provider *published* the change → **deliberate** evolution, the consumer is
  **stale** → *offer* the update aligning the consumer to S. Correct maintenance, **not** a green-lock —
  the published spec is the evidence the change was intended (the human still confirms).
- **S still matches E, yet the test is red** → the live response is deviating from the provider's *own*
  published contract (an *undocumented* change) → **suspected break** → route to `/bug-report` pointing at
  the field. Do **not** green-lock the consumer to the drifted value.
- **No published spec, unlocatable endpoint, or malformed document** → cannot confirm intent → **suspected
  break** (never green-lock); recommend Tier 1 + a cross-team ask.

The verdict is a **challenger's flag, not an oracle**, and the **decision is always the human's**
([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)): `contract-guard` presents the
mismatch, the field-level diff, and both dispositions; it never silently heals the test, never silently
edits the consumer, and never unilaterally declares the backend at fault. **Honest degradation is
load-bearing** — no published spec, an unlocatable endpoint, or a malformed document yields the
`no-spec` → "cannot confirm intent → suspected break" path, never a fabricated verdict.

**Composition (by routing, not function call — all leaves are user-invoked,
[ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)).** `e2e-impact` emits the source→spec
relevance map that locates the consumer code behind a red spec; `debug-test --drift` classifies the red
and, when its inline check is insufficient (no in-code schema, untyped frontend, empty diff),
**recommends** `contract-guard`; `contract-guard` produces the contract evidence and routes a suspected
break to `/bug-report`. The classifier stays in drift-mode; the contract comparison lives here — one new
seam, no duplicated logic.

## Considered options

- **Fold it into `debug-test --drift` (status quo of the tertiary signal).** Rejected — ADR-0018 already
  scoped the *full* check out of drift-mode to keep the classifier's static-judgment simplicity, and put
  the contract-comparison logic behind its own seam. Drift-mode keeps its *lightweight inline* check for
  the schema-at-hand case; the heavy locate/parse/derive/differ job is a distinct skill.
- **A differ-by-default (always snapshot/compare).** Rejected on EXPERIMENT-0018's evidence: for a
  schema-validated frontend the differ is redundant, and the light Tier-1 play covers the common untyped
  case more cheaply. A tiered order avoids selling ceremony where the code already self-reveals drift.
- **A blind response-snapshot as the oracle.** Rejected — snapshotting *live* responses is an
  execution-layer artifact ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)), belongs
  to Gate, and a snapshot carries no deliberate-vs-accidental signal. The **published** contract is
  readable across the org boundary *and* encodes provider intent, which the snapshot cannot.
- **Auto-generate/apply the client-side validation, or auto-update the stale test.** Rejected — Sentinel
  is judgment, not remediation ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md)); it
  *proposes* and scaffolds, the human applies ([ADR-0003](0003-prune-tests-proposes-before-deleting.md)).
- **Auto-decide "the backend is wrong."** Rejected for the same reason ADR-0018 rejected it: most
  cross-service changes are *deliberate*, so a reflexive blame-the-provider verdict floods the backend
  team with false escalations and freezes the frontend against legitimate evolution. The human reads the
  published contract and decides.
- **Own GraphQL / non-OpenAPI formats in v0.** Deferred — REST + OpenAPI/Swagger first; other contract
  formats are a later increment, stated as a gap rather than faked.

## Consequences

- **A new user-invoked skill**, sibling to the other Sentinel leaves, that fills the Pact white space for
  the stranded consumer — coverage a provider-driven tool structurally cannot give.
- **Drift-mode gains its scoped-out detector.** `debug-test --drift`'s D3 follow-up note now resolves to a
  concrete skill; the two compose without duplicated logic (classifier vs. contract comparison).
- **Static-judgment moat preserved** ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)):
  reading a published contract (file or URL) is consumption; snapshotting live responses stays out of
  scope with the execution layer / Gate.
- **Green-lock defense extended outward** ([ADR-0017](0017-audit-test-baseline-lock-suspected.md) stops
  green-locking to a *local* regression; this supplies the oracle that stops green-locking to an
  *external, unconfirmed* one). The published-spec check is the hinge between legitimate maintenance and a
  false 🟢.
- **Evidence discipline held** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)): the
  differ's value is asserted only for its demonstrated segment (EXPERIMENT-0018, n=2 apps, injected
  drift) — **no large-N rate claim**; the tiered shape *is* the honest encoding of that conditional value.
- **Validated by fixture + `claude plugin validate`, not a unit runner** — consistent with the other
  skills (prose `SKILL.md` + `fixtures/<skill>/expected-findings.md`); the EXPERIMENT-0018 field-rename
  arms are the canonical scenarios.
