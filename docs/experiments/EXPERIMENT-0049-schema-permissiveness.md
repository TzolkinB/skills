# EXPERIMENT-0049 — would validating a response against a published OpenAPI schema actually catch the three drifts `contract-guard` names?

**Status: Run (2026-07-31), two arms, both Confirmed for what they measured.** Arm A mutation-tested
**1,152 published response schemas** from 112 public APIs; Arm B generated ground-truth specs from the
OpenAPI generators enterprise backends actually use. Together they gate
[ADR-0049](../adr/0049-contract-guard-test-boundary-validation-tier.md) — and they rule out *both* of
the blanket answers the decision could have taken.

## What this experiment is really deciding

[ADR-0021](../adr/0021-contract-guard-consumer-side-openapi-differ.md) gave `contract-guard` a Tier 1
that proposes response-schema validation **at the application's fetch boundary**. A QA/SDET on the
stranded frontend team frequently cannot merge into the application repo — that is the frontend
devs' review queue — so the obvious complement is **test-boundary** validation: a one-line assertion
inside the suite the SDET already owns, validating the live response against the provider's published
OpenAPI document (`cypress-schema-validator` / `playwright-schema-validator`, MIT, both wrapping
`core-ajv-schema-validator`).

Before recommending that, one fact has to be established, because the recommendation is worthless —
worse, it is *manufactured confidence*, the exact thing this repo exists to catch — if the answer is no:

> **Does validating a response against a published OpenAPI schema actually catch the drifts ADR-0021
> names — "renames a field, drops one, or retypes it"?**

- If **schema validation catches all three** → recommend it flatly; it is a strict upgrade over nothing.
- If **it catches none** → do not recommend it; it is a green-printing ritual.
- If **it catches some** → the recommendation must be **conditioned**, and the skill has to say which
  drifts it does and does not cover.

The experiment is designed so its result picks the branch. The third branch is the one that landed.

## Hypotheses

- **H1 (the original, and it failed).** A meaningful fraction of published response schemas are
  *hollow* — permissive enough to catch nothing at all — so an auditor that finds hollow schemas has
  a real population to work on.
- **H2 (mechanism).** Where schemas are permissive, `required` is the cause: JSON Schema makes
  `required` opt-in, so a schema that omits it cannot reject a missing field.
- **H3 (external validity — Arm B).** The Arm A corpus is public-directory data; `contract-guard`'s
  population is *internal enterprise* specs, which are usually code-generated. If generators emit
  `required` automatically from non-nullable source types, Arm A does not transfer and no caveat is
  needed.

## Arm A — mutation-testing published schemas

### Method

`audit-test`'s own move ([ADR-0001](../adr/0001-audit-test-proves-by-execution.md)), applied to data
instead of code: synthesize a **valid** instance from the schema, mutate it, ask AJV whether it still
validates. **A surviving mutant is a drift the "contract validation" would not have caught.**

- **Corpus.** apis.guru, one spec per distinct provider (seeded shuffle, `SEED=20260731`), capped at
  15 response schemas per spec so large vendors cannot dominate. 150 specs fetched → 112 contributed
  → **1,152 2xx JSON response schemas** → **18,648 mutants**.
- **Validator.** AJV 8.20 (`strict:false`) — the same engine `core-ajv-schema-validator` wraps, so the
  measurement is of the tool we would actually be recommending.
- **Mutation operators** are ADR-0021's three named drifts, no more: **drop** a field, **rename** it
  (`label` → `label_v2`), **retype** it (string↔number, etc.).
- **Deliberately excluded: extra-field injection.** Tolerating additive fields is *correct*
  tolerant-reader behavior, not a miss. Counting it would have inflated the result.

### Results

**H1 is false.** Fully hollow schemas (catch nothing) are **9 of 1,111 = 0.8%**; schemas with no
declared properties at all are a further 41 (3.6%). Published schemas almost always declare `type`,
and AJV catches retypes 98.6% of the time. **An auditor built to find hollow schemas would find
almost nothing.**

What is true instead is **selective blindness** — the permissiveness is drift-specific:

| Drift | Caught | **Survives** |
|---|---|---|
| retype | 98.6% | 1.4% |
| **drop** | 23.8% | **76.2%** |
| **rename** | 25.2% | **74.8%** |

**H2 holds, and explains nearly all of it.** One binary — does the schema declare `required`?

| | drop | rename | retype |
|---|---|---|---|
| declares `required` (37.4%) | 59.4% | 59.4% | 98.5% |
| **no `required` (62.6%)** | **0.0%** | **2.3%** | 98.6% |

The distribution is **bimodal, not a spectrum**: 57.6% of schemas sit at *exactly* 33.3% (every
retype, zero drop/rename) and 19.0% at 100%; only ~20% land in between. At API level, 50.5% of APIs
are "types-only" and **48.6% have not one response schema declaring `required`**.

### Threats to validity

- **357 schemas (~22% of candidates) were skipped** because the synthesizer could not produce a valid
  instance. These skew toward *stricter* schemas (nested `required`, `pattern`, `oneOf` branches), so
  the reported permissiveness is plausibly a slight **over**-estimate.
- An earlier run of this harness kept only 682 schemas because nested `$ref`s could not resolve —
  AJV was handed each schema without its surrounding document, silently biasing the corpus toward
  flat, ref-free (simpler) schemas. Fixed by embedding `components`/`definitions` at the compiled
  root; compile failures fell 3,210 → 114 and the sample grew to 1,152. **The headline ratios barely
  moved**, which is the reason to trust them.
- One spec per provider, `preferred` version only, 15 schemas per spec.

## Arm B — do code generators emit `required`? (external validity)

Arm A measures *public-directory* specs. `contract-guard` targets *internal* backends, whose specs are
usually generated from code. If generators emit `required` from non-nullable types, H3 holds and Arm A
does not transfer.

### Ground truth — generated locally

**FastAPI 0.141.1 / Pydantic 2.13.4** and **`@nestjs/swagger` 8.1.1** were each given the same model
(a `Room` with `id`, `label`, `capacity`, an `Optional`/`@ApiPropertyOptional` `notes`, and a nested
`owner`). Both emitted:

```json
"required": ["id", "label", "capacity", "owner"]
```

`notes` correctly excluded in both. **Automatic, from the source type — no annotation needed.**

### Source-verified — Java

No JVM available, so springdoc was verified at source instead. springdoc delegates schema generation
to swagger-core's `ModelResolver`; every `addRequiredItem` call site traces to exactly three triggers:

1. `@Schema(requiredMode=REQUIRED)` / `@Schema(required=true)`
2. `@JsonProperty(required=true)` (Jackson's `propDef.isRequired()`)
3. `@NotNull` / `@NonNull` / `@NotBlank` / `@NotEmpty` — `NOT_NULL_ANNOTATIONS`, `ModelResolver.java:122`

**There is no path from a plain field to `required`,** and the type-aware overload is documented as
inert:

> *"The default implementation **ignores the JavaType parameter** and delegates to
> `resolveRequiredMode(Schema)`"* — `ModelResolver.java:2440`

Zero Kotlin references in the file. An un-annotated Spring DTO therefore emits typed properties and no
`required` — landing **exactly** on Arm A's 33.3% signature.

### Result — H3 is half-true, which is the finding

| Provider stack | `required` by default | Arm A transfers? |
|---|---|---|
| FastAPI / Pydantic | yes, automatic | **no** |
| NestJS (`@ApiProperty`) | yes, automatic | **no** |
| Spring / springdoc | **only if annotated** | **yes** |
| .NET (Swashbuckle / NSwag) | not tested | unknown |

**Neither blanket answer is correct.** A flat recommendation would mislead Spring shops; a flat caveat
would libel FastAPI and NestJS shops.

### Threats to validity

- The NestJS result covers the **decorated** path only. The CLI-plugin path (infers from TS types) and
  the bare-DTO path are **untested** — an earlier apparent bare-DTO failure was traced to esbuild not
  implementing `emitDecoratorMetadata`, not to NestJS, and is not a finding.
- .NET was not tested in either form. C# 8+ nullable reference types plus Swashbuckle's opt-in
  `SupportNonNullableReferenceTypes()` make it genuinely open, not assumed-weak.
- Arm B is a *generator-default* measurement. It says nothing about how often real teams add the
  annotations — a Spring shop with disciplined `@NotNull` usage lands in the strict column.

## What it decides

The per-spec check, not the stack check. `contract-guard` cannot read the provider's build files
across an org boundary — but it does not need to. It already fetches the published document, so it can
read `required` **directly**, which is stack-agnostic and needs no generator inference. Arm B explains
*why* coverage varies; the check never has to know.

It also **resizes an existing line in the skill from footnote to main event**.
[`contract-guard/SKILL.md:39`](../../skills/contract-guard/SKILL.md) already says to flag "any field
the consumer treats as required that S marks optional/nullable — a latent intermittent break."
Arm A sizes it: **62.6% of published response schemas**. Not an edge case.

And it kills the auditor as originally conceived. "Find hollow schemas" has a 0.8% population. The
check worth building is the cheap static one — *for each field the consumer reads, is it in S's
`required`?* — which needs set membership and operation resolution, **not a validator in the
execution path**. Mutation is what proved the check matters (0.0% vs 59.4%); it does not have to ship.

## Reproducing

Harness is not committed — it is ~150 lines against a live third-party corpus, and pinning it would
imply a stability the apis.guru snapshot does not have. To re-run:

- **Arm A** — fetch `https://api.apis.guru/v2/list.json`, shuffle providers with `SEED=20260731`, take
  one spec each, extract 2xx JSON response schemas (OpenAPI `content['application/json'].schema`,
  Swagger `response.schema`), resolve `$ref`s, synthesize a valid instance, apply drop/rename/retype
  to each field of the payload object, validate with AJV 8.x `strict:false`. **Compile each schema
  with the document's `components`/`definitions` embedded at the root** or nested `$ref`s will not
  resolve and the corpus silently biases toward flat schemas.
- **Arm B** — `pip install fastapi pydantic`, `npm i @nestjs/swagger @nestjs/common @nestjs/core
  @nestjs/platform-express reflect-metadata`; the NestJS arm needs **real `tsc`** with
  `emitDecoratorMetadata` (esbuild/tsx does not implement it). Java arm: read
  `swagger-core/modules/swagger-core/src/main/java/io/swagger/v3/core/jackson/ModelResolver.java`.

## Evidence label

**Confirmed** for both arms, for what each measured — a corpus run we executed and a generator output
we generated ([ADR-0013](../adr/0013-evidence-provenance-sentinel-labels-not-gates.md)). **Likely** as
a generalization to internal enterprise specs: Arm B establishes the generator defaults that drive it,
but no internal corpus was measured. The honest upgrade is a second corpus of real internal specs —
which, by construction, we cannot obtain from public sources.
