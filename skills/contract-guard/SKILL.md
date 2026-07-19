---
name: contract-guard
description: Consumer-side contract check for the stranded frontend team Pact can't serve — tiered, cheapest-first — detect existing response validation, else recommend/scaffold client-side validation, else differ the shape the frontend expects against the provider's published OpenAPI/Swagger. Carries the deliberate-vs-accidental oracle; surfaces for human disposition, never green-locks.
argument-hint: "[endpoint or red spec, and the published spec as a path/URL — e.g. GET /api/rooms ./openapi.json]"
allowed-tools: [Read, Bash, Glob]
disable-model-invocation: true
---

**Owns:** whether a backend response the frontend depends on still matches what the frontend expects — the **consumer-side** contract check, read across the org boundary without provider participation. Detection + the deliberate-vs-accidental oracle, **for human disposition**.
**Not this:** classifying an *already-red* spec as external drift → `/debug-test --drift` (it *consumes* this skill's verdict); which specs a diff hits → `/e2e-impact`; whether a *passing* spec guards anything → `/audit-test`; structuring the cross-team escalation → `/bug-report` (this skill routes to it). **Never runs the suite, drives a browser, or snapshots live responses** ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).

An enterprise frontend team runs an E2E suite against a backend another team owns, on another release cadence. That backend renames a field, drops one, or retypes it; the green suite goes red on a contract change the frontend team **did not cause and cannot fix at the source**. Pact — the tool meant to prevent this — needs the *provider* to run verification, so when the backend org won't participate the stranded consumer gets **no coverage**. `contract-guard` gives them the check Pact can't: it reads what the frontend already has (its response-consumption code, any in-code schema) and the provider's **published** OpenAPI/Swagger — almost always *readable* across the boundary even when the provider won't *run* verification — and surfaces where the two disagree, carrying the **deliberate-vs-accidental oracle** for free ([ADR-0021](../../docs/adr/0021-contract-guard-consumer-side-openapi-differ.md), sibling of the `/debug-test --drift` disposition [ADR-0018](../../docs/adr/0018-debug-test-drift-triage.md)).

It is **tiered, cheapest-first** — because the heavy differ only earns its keep for a specific segment (a frontend that *both* lacks response validation *and* faces an empty-diff drift; EXPERIMENT-0018). For everyone else a lighter tier is the right answer, and the skill says so rather than selling ceremony.

## Steps

### 0. Resolve inputs — the endpoint, the consumer code, the published spec
- **Endpoint under suspicion.** From `$ARGUMENTS` (an endpoint or a red spec) or the situation. If handed a red spec, find the endpoint it depends on: the `page.route`/`cy.intercept` it stubs, the URL it drives, or the fetch in the code path it exercises. `/e2e-impact`'s source→spec map already links a spec to the consumer code behind it — reuse it, don't rebuild it.
- **Consumer code.** The frontend module that fetches and *reads* that response (the `fetch`/axios call and the property accesses / destructuring on its result).
- **Published spec (optional but the Tier-2 oracle).** An OpenAPI/Swagger document as a **local path** (`Read`) or a **URL** (`Bash` `curl` — fetching a published static document is *consumption*, not execution, [ADR-0010]). Absent → Tier 2 degrades to `no-spec` (below), never a fabricated match.

### 1. Tier 0 — is drift already self-revealing? (detect existing validation)
Does the consumer **validate the response against a schema** at the fetch boundary — a Zod `safeParse`, `io-ts`, `yup`, a typed decoder, an explicit runtime shape check? If **yes**, that schema *is* a consumer-side contract: a drift breaks it loudly and `/debug-test --drift` reads it as its oracle. **Recommend nothing new** — adding a differ here is redundant. Report Tier 0 and stop, unless the user explicitly wants the published-spec cross-check anyway.

### 2. Tier 1 — no validation? recommend (and scaffold) it — the light play
If the consumer reads **untyped JSON** (raw `.json()` result, no runtime check), the cheapest durable fix is **response-schema validation at the fetch boundary**. **Propose** it, and **scaffold** a starter schema from the shape the consumer actually reads (the fields it destructures/accesses, inferred types). This makes *future* drift self-diagnosing — promoting the frontend into the Tier-0 case — and is more on-domain than a bespoke snapshot guard. **Proposed, never applied** — the human adopts it ([ADR-0002](../../docs/adr/0002-sentinel-is-judgment-not-release-evidence.md), [ADR-0003](../../docs/adr/0003-prune-tests-proposes-before-deleting.md)).

### 3. Tier 2 — differ the expected shape against the published spec
For the segment the light play can't resolve *in the moment* — an **empty-diff drift** (the consumer repo changed nothing, yet the suite is red) with **no** response validation — compare, statically:
- **Consumer-expected shape** = the fields/types the frontend reads (or its in-code schema if one exists — that's both the Tier-0 signal and a precise expectation source).
- **Published shape** = the response schema of the **operation** the endpoint maps to. Resolve `METHOD + path` to the OpenAPI path item + operation, then its success-response schema (`components/schemas` `$ref`s followed). If the endpoint can't be located, or the document is malformed → **honest degrade** to `no-spec` (do **not** guess a match).

The verdict turns on **whether the published spec still matches what the consumer reads** — the field-level diff between consumer-expected (E) and published spec (S). This is what makes the deliberate-vs-accidental call *statically*, without seeing the live response (which a static pass can't; [ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)). Emit one verdict + the E-vs-S field diff:
- **`stale-consumer`** (deliberate evolution) — **S has moved away from E**: the published spec documents a shape the consumer doesn't read (a field the provider renamed / dropped / retyped). The provider *published* the change, so it is deliberate and the consumer is **stale** → *offer* the update aligning the consumer to the spec (e.g. `label → name`). Correct maintenance, not a green-lock — the published spec is the evidence the change was intended; the human still confirms before accepting.
- **`suspected-break`** — **S still matches E, yet the test is red**: the live response is deviating from the provider's *own* published contract (an *undocumented* change) → route to `/bug-report` (via the `Skill` tool) pointing at the field. Do **not** green-lock the consumer to the drifted value.
- **`no-spec`** — no published spec, endpoint unlocatable, or malformed doc → cannot confirm intent → treat as **suspected break** (never green-lock); recommend Tier 1 and a cross-team ask. Never a fabricated verdict.

Also flag, independently of the verdict, any field the consumer treats as required that S marks **optional/nullable** — a latent intermittent break the current red may not have surfaced yet.

### 4. Surface — challenger's flag, never a decision
Present the verdict, the field-level diff, and **both** dispositions (accept-and-update / stop-and-escalate). The **decision is always the human's** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)): `contract-guard` never silently heals the test, never silently edits the consumer, and never unilaterally blames the backend. `/debug-test --drift` consumes this verdict to classify and route the red; the win is **shift-left** — surfacing the mismatch early, from the consumer side, with the evidence a human needs.

## Output Format

```
## contract-guard: [METHOD /endpoint] · [spec: path/URL | none]

### Tier → [0 already-validated | 1 recommend-validation | 2 differ]
[Tier 0] Consumer safeParses this response (`RoomSchema`) — drift is self-revealing, no new guard needed. `/debug-test --drift` reads it as the oracle.
[Tier 1] Consumer reads untyped JSON. Proposed (lighter than a standing differ — it makes future drift self-diagnosing at the fetch boundary): response-schema validation. Scaffold:
  <starter schema from the fields the consumer reads>  (proposed — you apply it)
[Tier 2] Verdict → stale-consumer | suspected-break | no-spec

### Field-level diff — consumer-expected (E) vs published spec (S)  (Tier 2)
- `label` → E reads `.label`; S `GET /api/rooms` 200 has `name` (S moved: renamed) — stale-consumer
- `capacity` → E reads `.capacity`; S marks it optional/nullable — latent intermittent break

### Disposition  (challenger's flag — human decides)
[stale-consumer] Deliberate evolution (spec documents the new shape) → consumer is stale. Proposed update: <diff>. Accept only if the change was intended.
[suspected-break | no-spec] Spec still matches the consumer (or no spec) → undocumented drift → routed to `/bug-report` pointing at `label`. Not green-locked; backend not unilaterally blamed.
```

## Notes

- **Tiered by evidence, not by default.** EXPERIMENT-0018 (n=2 apps, blinded, injected drift) found the differ's value **conditional** — redundant where the frontend already validates responses, load-bearing only for the untyped + empty-diff segment. The tiers *are* that finding; **no large-N / rate claim** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)).
- **Static-judgment only** ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)). Reads source, in-code schemas, and the **published** contract (file or URL). Snapshotting a **live** response is an execution-layer artifact (Gate), out of scope — and a snapshot carries no deliberate-vs-accidental signal anyway; the published spec does.
- **Composes, doesn't duplicate.** `/debug-test --drift` keeps its lightweight *inline* contract check for the schema-at-hand case and **recommends** `contract-guard` for the harder job (locate/parse the published spec, derive the expected shape, resolve the operation). Classifier stays in drift-mode; the contract comparison lives here.
- **REST + OpenAPI/Swagger in v0.** GraphQL and other contract formats are a later increment — stated as a gap, not faked.
- `--explain` is not supported — procedural, not pedagogical.
