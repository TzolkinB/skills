# `contract-guard` gains a test-boundary validation tier that routes to an external plugin, and reports per-spec which drifts that validation can actually catch

**Status: Proposed (2026-07-31).** Backed by
[EXPERIMENT-0049](../experiments/EXPERIMENT-0049-schema-permissiveness.md) (two arms, both Confirmed).
Tracked by [#217](https://github.com/TzolkinB/skills/issues/217). Amends — does not supersede —
[ADR-0021](0021-contract-guard-consumer-side-openapi-differ.md), whose tier order and verdict
semantics stand unchanged.

## Context

[ADR-0021](0021-contract-guard-consumer-side-openapi-differ.md)'s **Tier 1** proposes response-schema
validation **at the application's fetch boundary** — a Zod `safeParse` where the frontend calls
`fetch`. That is the right durable fix, and it has one structural problem: it is a change to
production application code. The audience `contract-guard` was built for is the QA/SDET on the
stranded frontend team (`docs/positioning.md`), and that person routinely **cannot merge into the
application repo**. Tier 1 asks the stranded team to depend on the participation of another team —
a quieter echo of the Pact failure the skill exists to route around.

An external MIT plugin family covers the missing insertion point. `cypress-schema-validator` (2.0.0)
and `playwright-schema-validator` (1.0.0) — both wrapping `core-ajv-schema-validator` — validate a
live response against a **published OpenAPI/Swagger document** from inside the test:

```js
cy.request('/api/rooms').validateSchema(openApiDoc, { endpoint: '/rooms', method: 'GET', status: 200 })
```

Zero production code, living in the suite the SDET already owns, pointed at the exact artifact
[ADR-0021](0021-contract-guard-consumer-side-openapi-differ.md) Tier 2 already locates and parses.
This is **orchestrate-not-absorb** (`docs/orchestration-map.md`): the plugins are better at this than
anything we would write, and they emit reportable artifacts we do not have to build.

But recommending them **unqualified** would be manufactured confidence — the failure mode this repo
exists to catch, committed by us. [EXPERIMENT-0049](../experiments/EXPERIMENT-0049-schema-permissiveness.md)
establishes why:

- Across **1,152 published response schemas**, schema validation catches **retypes 98.6%** of the time
  but **misses drop 76.2%** and **rename 74.8%** of the time. It reliably catches **one of the three
  drifts ADR-0021 names**, and the two it misses are the two named *first*.
- The cause is a single binary: **62.6% of published response schemas declare no `required`**, and in
  those, drop is caught **0.0%** of the time. The distribution is bimodal — 57.6% of schemas sit at
  exactly 33.3% (types only), 19.0% at 100%.
- `contract-guard`'s own worked example (`SKILL.md:56`) is `label → name`. A **rename**.

Arm B forecloses the tempting simplification of conditioning on the provider's stack. FastAPI/Pydantic
and NestJS emit `required` automatically; **springdoc does not** — swagger-core's `ModelResolver` has
no path from a plain field to `required`, and its type-aware overload is documented as ignoring the
type. So a flat recommendation misleads Spring shops and a flat caveat libels Python/TS shops. Neither
blanket answer is available.

## Considered options

- **Recommend the plugin flatly as a Tier-1 alternative.** Rejected — three-in-four odds of printing ✅
  on a rename, which is the drift the skill's own example uses. That is a green-pusher, and the map
  already labels green-pushers as hazards.
- **Do not recommend it; keep Tier 1 as the only light play.** Rejected — it does catch retypes almost
  perfectly, it is the only tier a stranded SDET can adopt unilaterally, and withholding it leaves the
  target user with nothing they can actually merge.
- **Condition the recommendation on the provider's backend stack** (springdoc → warn, FastAPI → don't).
  Rejected on two counts: `contract-guard` reads *across an org boundary* and usually cannot see the
  provider's build files at all; and it is unnecessary, because the published document states the
  answer directly. Arm B explains *why* coverage varies — the check never needs to know.
- **Build the "hollow schema" auditor as originally scoped.** Rejected on evidence: fully hollow
  schemas are **0.8%** of the corpus. The population does not exist.
- **Ship a runtime mutation check inside the skill** (perturb a payload, confirm the schema rejects).
  Rejected — it would put AJV and a dependency-install story into a static-judgment skill
  ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)) to recompute something a static
  read of `required` already answers. Mutation established the rule; it does not have to ship.

## Decision

**1. Add Tier 1b — test-boundary validation, routed to the external plugin.** When the consumer reads
untyped JSON (the Tier 1 condition) *and* a published spec is available, `contract-guard` additionally
proposes validating the response **inside the suite**, naming the stack-matching plugin
(`cypress-schema-validator` / `playwright-schema-validator` — the *current* packages; the far
more-downloaded `cypress-ajv-schema-validator` / `playwright-ajv-schema-validator` are their
superseded predecessors and must not be the ones named). Tier 1 keeps precedence: fetch-boundary
validation is still the better durable fix where the team can merge it. Tier 1b is what the SDET can
adopt alone. **Proposed, never applied** ([ADR-0003](0003-prune-tests-proposes-before-deleting.md)) —
and `contract-guard` never installs or runs it
([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)).

**2. Every such recommendation carries its drift-coverage, computed per operation.** For the resolved
operation's response schema, read `required` and report which of the three drifts the proposed
validation would actually catch, naming the uncovered fields:

> *This validation will catch **retypes**. It will **not** catch a drop or rename of `label`,
> `capacity`, `notes` — the schema declares no `required`.*

No global claim, no stack inference, no percentage — a categorical statement about *this* operation,
consistent with the labels-not-magnitudes rule
([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)).

**3. Promote the optional/nullable flag from a footnote to a first-class output.** `SKILL.md:39`
already flags fields the consumer treats as required that the spec marks optional. EXPERIMENT-0049
sizes that case at **62.6% of published response schemas** — the majority, not an edge. It is the same
`required` read as (2), and it is what makes the E-vs-S diff honest about latent intermittent breaks.

**4. No new dependency, and no auditor skill.** The check is set membership over `required` plus the
operation resolution Tier 2 already performs. `core-ajv-schema-validator` is named as the engine
*users* get transitively when they adopt the plugin — it is never a dependency of ours.

## Consequences

- Tier 1b gives the stranded SDET something adoptable without cross-team consent, which was Tier 1's
  gap for exactly the persona the skill targets.
- The skill now says something *falsifiable and useful* about a tool it recommends, rather than
  passing along a green check. This is the map's own bar applied to a routing recommendation.
- **A cost, stated plainly:** we now recommend a third-party package whose weakest link is a
  single-maintainer core (`core-ajv-schema-validator` 1.0.0, 2025-04-06). Mitigated by it being a
  *recommendation*, not a dependency — and the whole family is MIT with a documented successor path.
- The drift-coverage line is only as good as the resolution in Tier 2. Where the endpoint is
  unlocatable or the document malformed, it must degrade the same way Tier 2 does — to `no-spec`,
  never a fabricated coverage claim.
- `.NET` (Swashbuckle/NSwag) generator behavior is untested. This does not block the decision — the
  per-spec check is stack-agnostic — but it stays an open item on the map's ledger.
