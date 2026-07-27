# contract-guard — did the backend drift out from under a frontend that can't see it?

> **Agent instructions:** [`skills/contract-guard/SKILL.md`](../skills/contract-guard/SKILL.md) · **Run:** `/contract-guard [endpoint or red spec] [published spec path/URL]`

## What it does

Pact is the standard tool for catching backend drift before it breaks a consumer — but it needs the *provider* to run verification. When an enterprise frontend team depends on a backend another team owns, on another release cadence, and that backend team won't participate in Pact, the frontend gets **no coverage at all**: the backend renames a field, drops one, or retypes it, and the frontend's green E2E suite goes red on a contract change it didn't cause and can't fix at the source. `contract-guard` is the consumer-side check Pact can't give that stranded team: it reads what the frontend already has (its response-consumption code, any in-code schema) against the provider's **published** OpenAPI/Swagger — almost always *readable* across the org boundary even when the provider won't *run* verification.

It's **tiered, cheapest-first**. Tier 0 checks whether the consumer already validates responses against a schema (Zod, io-ts, yup) — if so, drift is already self-revealing and it recommends nothing new. Tier 1, for an untyped consumer, proposes and scaffolds response-schema validation at the fetch boundary — the light play that makes future drift self-diagnosing. Tier 2, for the hard case (an untyped consumer facing an **empty-diff drift** — the repo changed nothing yet the suite reddened), differs what the consumer expects against the published spec and returns one of three verdicts: **`stale-consumer`** (the spec moved — deliberate, provider-documented; offer the aligning update), **`suspected-break`** (the spec still matches, yet it's red — undocumented drift; route to [`bug-report`](./bug-report.md)), or **`no-spec`** (can't confirm intent — never a fabricated match).

## When to use it

- A frontend E2E suite reddens with an empty diff and a backend team you don't control is the likely cause.
- You want to know whether a backend contract change was deliberate (documented in its published spec) or an undocumented break, without waiting on the provider to run anything.

## When *not* to use it

- **The spec is already red and you haven't classified why** → [`debug-test --drift`](./debug-test.md) is the first stop; it recommends this skill for the harder empty-diff case rather than duplicating the differ inline.
- **You want to know which specs a diff hits** → [`e2e-impact`](./e2e-impact.md).
- **You want to prove a passing spec would catch a real break** → [`audit-test`](./audit-test.md).
- **Structuring the cross-team escalation itself** → this skill routes a `suspected-break` to [`bug-report`](./bug-report.md) rather than writing the report itself.

## Prerequisites

Just Claude Code. It reads consumer source, any in-code schema, and a published OpenAPI/Swagger document as a local path or a URL you supply — fetching that published document is the one network call any skill in this repo makes on its own ([README](../README.md)). It never runs the suite, drives a browser, or snapshots a live response ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).

## Worked example

`contract-guard` needs a real frontend consuming a real backend over HTTP, so it uses **warm sibling fixtures** in `~/projects/` rather than a vendored one ([why](../fixtures/README.md)): [expected findings](../fixtures/contract-guard/expected-findings.md).

Against `mosaic-room-booking`, the consumer runs `z.array(RoomSchema).safeParse(data)` on `GET /api/rooms` — Tier 0, recommend nothing new, since a `label`→`name` drift would already fail loudly. Against `epic-stack/.drift-fixture`, the consumer reads `room.label` straight off `r.json()` with no validation and the "backend team" renames the field out-of-band, leaving an **empty diff** in the consumer repo while the spec goes red. With the published OpenAPI supplied and now documenting `name` instead of `label`, the verdict is **`stale-consumer`**: the spec sanctions the rename, so it offers `room.label → room.name` as a deliberate-evolution fix rather than green-locking silently. If the published spec still said `label`, the same red would verdict **`suspected-break`** and route to `bug-report` instead.

## Where it fits

Sits alongside [`debug-test --drift`](./debug-test.md) as the escalation path for the case drift-mode's lightweight inline check can't resolve on its own — the untyped-consumer, empty-diff segment ([EXPERIMENT-0018](./experiments/EXPERIMENT-0018-drift-triage.md)). It shares the deliberate-vs-accidental oracle with drift-mode's disposition ([ADR-0018](./adr/0018-debug-test-drift-triage.md), [ADR-0021](./adr/0021-contract-guard-consumer-side-openapi-differ.md)) and hands a `suspected-break` off to [`bug-report`](./bug-report.md) for the cross-team escalation.

## Anti-patterns

- **Green-locking a `suspected-break`.** If the published spec still matches what the consumer reads, the live response deviating from the provider's own contract is a real break, not something to paper over.
- **Reaching for the differ when Tier 0 already covers it.** A consumer with existing response validation gets no new guard — that would be ceremony over a case that's already self-diagnosing.
- **Guessing a verdict with no published spec.** No spec, an unlocatable endpoint, or a malformed document degrades honestly to `no-spec` — never a fabricated match.
- **Applying the fix yourself.** The Tier-1 schema and the Tier-2 aligning update are proposed diffs; the human adopts them.
