# Witness Evidence-Bundle Prior Art — Signed/Aggregated Attestation Formats

> Provenance: research pass for wayfinder ticket #101, 2026-07-17. Primary sources only
> (in-toto/attestation spec, slsa.dev, OASIS SARIF 2.1.0, secure-systems-lab/dsse, cyclonedx.org).
> SURVEY + RECOMMEND only — this feeds a separate Witness schema-design ticket; the skeleton at
> the end is illustrative, not a finished contract. Every claim is cited inline with the owning spec.
>
> NOTE: this is a different sense of "provenance" than
> `references/orchestration-tools-provenance-research.md` (that file = which QA *tools* are
> credibility-proven). This file = signed/aggregated evidence-bundle *formats*. Fresh file on purpose.

## What Witness needs, in one sentence

Aggregate per-stage QA evidence (mutation verdicts, coverage, audit-test proven/likely/unexamined
labels, Playwright execution results) into ONE bundle with a provenance model — who/what produced
each piece, when, over what subject, with what verdict — feeding a categorical ship/canary/hold gate.
That is almost exactly the problem the software-supply-chain attestation stack already solved. Borrow
it; don't reinvent it.

## TL;DR — the top things to borrow

1. **The 3-layer split: Envelope / Statement / Predicate.** in-toto separates *signing+serialization*
   (DSSE envelope), *what-this-is-about* (Statement: `subject` + `predicateType`), and *the payload
   schema* (predicate). Witness gets a clean seam: one stable envelope + one stable "what subject /
   which stage / which verdict" header, and each stage plugs in its own predicate body.
   ([in-toto v1 README](https://github.com/in-toto/attestation/blob/main/spec/v1/README.md))
2. **`subject` = array of content-addressed ResourceDescriptors matched by digest.** Bind every
   evidence entry to the exact artifact (commit/build/file) it was computed over, by digest, so a
   verdict can't be silently re-pointed at a different artifact.
   ([Statement](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md),
   [ResourceDescriptor](https://github.com/in-toto/attestation/blob/main/spec/v1/resource_descriptor.md))
3. **The Bundle format: newline-delimited JSON (JSON Lines), order-independent, heterogeneous,
   ignore-unrecognized.** One `.jsonl` file = many independently-signed attestations of different
   predicate types. This IS the aggregation model Witness wants.
   ([Bundle](https://github.com/in-toto/attestation/blob/main/spec/v1/bundle.md))
4. **The in-toto Test Result predicate already exists and nearly fits.** `result: PASSED|WARNED|FAILED`
   + `passedTests`/`warnedTests`/`failedTests` + `configuration` + `url` is a ready-made per-stage QA
   verdict shape — extend it (or mirror it) rather than invent a verdict envelope.
   ([test-result predicate](https://github.com/in-toto/attestation/blob/main/spec/predicates/test-result.md))

Borrow SLSA's `builder.id` + `metadata.startedOn/finishedOn` idea (who ran it, when) as per-entry
provenance. Treat SARIF as an *ingest/emit* format for the static-analysis stages, not as the bundle
envelope. Keep signing optional-but-designed-in via DSSE.

---

## 1. in-toto Attestation Framework (the backbone to copy)

### What it models
A four-layer stack ([in-toto v1 README](https://github.com/in-toto/attestation/blob/main/spec/v1/README.md)):

- **Envelope** — authentication + serialization; this is DSSE (see §5).
- **Statement** — "Binds the attestation to a particular subject and unambiguously identifies the
  type of the predicate."
- **Predicate** — the type-specific metadata schema about the subject.
- **Bundle** — "Defines a method of grouping multiple attestations together."

The framework mandates SemVer2 versioning and that consumers "ignore unrecognized fields unless
otherwise noted" — forward-compatibility baked in.

**Statement** has exactly four fields
([spec](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)):

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [ { "name": "<NAME>", "digest": { "<ALGORITHM>": "<HEX_VALUE>" } } ],
  "predicateType": "<URI>",
  "predicate": { }
}
```

- `_type` (required): always `https://in-toto.io/Statement/v1`.
- `subject` (required): array of ResourceDescriptors — "the set of software artifacts that the
  attestation applies to." Each element must carry a `digest`; artifacts are "assumed to be immutable"
  and matched "purely by digest, regardless of content type." `name`/`uri` SHOULD be unique within
  `subject`; `name` may be `"_"` if not meaningful.
- `predicateType` (required): a URI identifying the predicate schema.
- `predicate` (optional): the payload; unset == empty.

**ResourceDescriptor** — the reusable "pointer to a thing" object
([spec](https://github.com/in-toto/attestation/blob/main/spec/v1/resource_descriptor.md)):

```json
{
  "name": "<NAME>", "uri": "<RESOURCE URI>",
  "digest": { "<ALGORITHM>": "<HEX VALUE>" },
  "content": "<BASE64 VALUE>", "downloadLocation": "<RESOURCE URI>",
  "mediaType": "<MIME TYPE>", "annotations": { "<FIELD>": "value" }
}
```

All fields optional individually, **but at least one of `uri`, `digest`, or `content` MUST be set.**
`annotations` is a free-form map "for policy evaluation" — an escape hatch for tool-specific metadata
without touching the core schema.

**Bundle** — the aggregation format
([spec](https://github.com/in-toto/attestation/blob/main/spec/v1/bundle.md)):
- JSON Lines (newline-delimited JSON); **each line is one DSSE Envelope** wrapping one attestation.
- No bundle-level signature — "individual attestations carry signatures."
- "Processing of a Bundle MUST NOT depend on the order of the attestations."
- Attestations MAY differ in signing key, `_type`, `subject`, and `predicateType`; "Consumers MUST
  ignore unrecognized lines."
- File suffix `.intoto.jsonl`; media type `application/vnd.in-toto.bundle`.

### What Witness should BORROW
- The **Envelope/Statement/Predicate/Bundle layering** verbatim as the mental model.
- **`subject` = digest-addressed ResourceDescriptor array** — every evidence entry is bound to the
  artifact it was computed over. This is the anti-"silently re-pointed verdict" guarantee.
- The **JSON Lines Bundle**: append-only, order-independent, one line per stage, heterogeneous
  predicate types coexisting, unrecognized lines ignored. Perfect for "each stage drops in its
  evidence as it finishes."
- **`annotations` free-form map** as the tool-specific-metadata escape hatch.
- The **"ignore unrecognized fields / SemVer" forward-compat contract** so the gate doesn't break when
  a stage adds a field.

### What to SKIP as overkill
- The full **vetted-predicate ecosystem** (Release, VSA, SCAI, Runtime Traces, VULNS, SPDX) — Witness
  needs maybe 2–4 predicate types, not the whole catalog
  ([predicate catalog](https://github.com/in-toto/attestation/tree/main/spec/predicates)).
- **Strict content-addressed immutability of `subject`** for *every* entry is nice but Witness can
  start with a single shared subject (the PR head commit / build) for the whole bundle rather than
  per-entry digests, if that's simpler for v1.
- The **`.intoto.jsonl` / media-type registration** machinery — internal tool; no need to register.

---

## 2. SLSA Provenance v1.0 (borrow the "who/how/when produced it" fields)

### What it models
A concrete in-toto predicate describing *how an artifact was produced*
([slsa.dev/spec/v1.0/provenance](https://slsa.dev/spec/v1.0/provenance)). `predicateType`:
`https://slsa.dev/provenance/v1` (the URI "will always change whenever there is a backwards
incompatible change"). It rides inside the standard in-toto Statement — `subject` names the artifact
produced; the predicate describes how.

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [ ... ],
  "predicateType": "https://slsa.dev/provenance/v1",
  "predicate": {
    "buildDefinition": {
      "buildType": "string",
      "externalParameters": {},
      "internalParameters": {},
      "resolvedDependencies": [ /* ResourceDescriptors */ ]
    },
    "runDetails": {
      "builder": { "id": "string", "builderDependencies": [], "version": {} },
      "metadata": { "invocationId": "string", "startedOn": "timestamp", "finishedOn": "timestamp" },
      "byproducts": [ ]
    }
  }
}
```

Key semantics ([spec](https://slsa.dev/spec/v1.0/provenance)):
- `buildDefinition` — "The input to the build. The accuracy and completeness are implied by
  `runDetails.builder.id`."
  - `buildType` — template identifying how to interpret the parameters.
  - `externalParameters` — "parameters that are under external control, such as those set by a user."
  - `internalParameters` — "parameters that are under the control of the entity represented by
    `builder.id`."
  - `resolvedDependencies` — "Unordered collection of artifacts needed at build time."
- `runDetails.builder.id` — "URI indicating the transitive closure of the trusted build platform"
  (i.e. *who/what ran this*, the root of trust).
- `metadata` — `invocationId`, `startedOn`, `finishedOn` (i.e. *when*).
- `byproducts` — "Additional artifacts generated during the build that are not considered the output"
  (logs, intermediate reports).

### What Witness should BORROW
- **`builder.id` → "producing stage/tool identity"**: each evidence entry says which tool+version
  produced it and how much to trust it. This is exactly Witness's per-entry provenance need.
- **`metadata.startedOn` / `finishedOn` / `invocationId`** — the *when* + a run handle. Steal these
  field names directly.
- **`resolvedDependencies` as ResourceDescriptors** — a clean pattern for "the config/inputs this
  verdict was computed against" (e.g. the mutation config, the coverage thresholds).
- **`byproducts`** — a home for pointers to raw logs/HTML reports (Playwright trace, Stryker report)
  without inlining them.

### What to SKIP as overkill
- The whole **build-platform threat model** (`externalParameters` vs `internalParameters`,
  hermeticity, transitive builder closure) — Witness produces *test evidence*, not *build provenance*;
  it doesn't need to prove a hermetic build.
- **`buildType` templating** — a QA stage isn't a parameterized build recipe.
- SLSA **levels / VSA verification-summary machinery** — that's supply-chain assurance grading, a
  different gate than ship/canary/hold.

Net: SLSA is the *shape* to imitate for provenance fields, but its subject matter (builds) is the
wrong domain. Take `builder.id` + `metadata` + `resolvedDependencies` + `byproducts`; drop the rest.

---

## 3. in-toto Test Result predicate (the closest existing fit — mirror it)

### What it models
A **generic predicate for test outcomes** — "Define a generic schema to express the result of running
tests in software supply chains"
([spec](https://github.com/in-toto/attestation/blob/main/spec/predicates/test-result.md)).
`predicateType`: `https://in-toto.io/attestation/test-result/v0.1` (note: v0.x — still pre-stable).

```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [ { ... } ],
  "predicateType": "https://in-toto.io/attestation/test-result/v0.1",
  "predicate": {
    "result": "PASSED|WARNED|FAILED",
    "configuration": [ "<ResourceDescriptor>", ... ],
    "url": "<URL>",
    "passedTests": [ "<TEST_NAME>", ... ],
    "warnedTests": [ "<TEST_NAME>", ... ],
    "failedTests": [ "<TEST_NAME>", ... ]
  }
}
```

- `result` (required enum): `PASSED` / `WARNED` / `FAILED`.
- `configuration` (required, list of ResourceDescriptor): "Reference to the configuration used for the
  test run."
- `url` (optional): link to the test run / logs.
- `passedTests` / `warnedTests` / `failedTests` (optional): named test lists.

### What Witness should BORROW
- This is a **ready-made per-stage verdict envelope**. The three-way `PASSED/WARNED/FAILED` maps
  cleanly onto Witness's need for a categorical stage outcome, and `configuration` (as
  ResourceDescriptors) already gives "what settings produced this verdict."
- The **named-test lists** pattern generalizes to Witness's evidence granularity (e.g. surviving
  mutants, uncovered lines, unexamined tests) — though Witness likely wants richer per-stage detail.

### What to SKIP / where it falls short for Witness
- **Only a 3-way ternary** — Witness's audit-test emits `proven/likely/unexamined`, coverage emits a
  percentage, mutation emits a kill-ratio. The predicate's `result` alone can't carry those; Witness
  needs richer per-stage predicate bodies (this predicate is the *frame*, not the whole payload).
- It's **v0.1 (unstable)** — fine to mirror the shape, risky to hard-depend on the exact URI.
- No notion of a **combined gate verdict** — it's per-run, not an aggregate. Witness's ship/canary/hold
  is a *derived* verdict over the bundle, which no single predicate here models (see §6).

---

## 4. SARIF 2.1.0 (an ingest/emit format for the static stages — NOT the bundle envelope)

### What it models
An **OASIS Standard** (approved 2020-03-27) — "a standard format for the output of static analysis
tools" ([OASIS SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html)).
Core object model:

```json
{
  "$schema": "https://.../sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [ {
    "tool": { "driver": { "name": "string", "rules": [ { "id": "string",
              "shortDescription": { "text": "string" } } ] } },
    "results": [ {
      "ruleId": "string",
      "level": "error|warning|note|none",
      "message": { "text": "string" },
      "locations": [ { "physicalLocation": {
          "artifactLocation": { "uri": "string", "uriBaseId": "string" },
          "region": { "startLine": 1, "startColumn": 1, "endLine": 1, "endColumn": 1 } } } ]
    } ]
  } ]
}
```

- `sarifLog` → `runs[]`; each `run` has one `tool` (with a `driver` naming the tool + its `rules`)
  and a `results[]` array.
- `result.ruleId` — which rule fired; `result.level` — `error` (critical) / `warning` / `note`
  (informational) / `none`; `result.message.text` — human-readable; `result.locations[]` —
  file+region via `physicalLocation → artifactLocation.uri` + `region.startLine/endLine`.

### Where it fits vs. attestations
SARIF and in-toto attestations answer **different questions** and Witness should use both at different
altitudes:
- **SARIF = per-tool, per-finding detail** ("linter X flagged rule Y at file:line, severity warning").
  It is a *result payload*, unsigned, tool-centric, location-rich.
- **Attestation = signed, subject-bound, provenance-carrying wrapper** around a *verdict*.

Recommendation: Witness **ingests SARIF** from static-analysis stages (many linters/scanners already
emit it) and can **emit SARIF** for its own file-located findings, but the SARIF blob should ride
*inside* an evidence entry (referenced via a ResourceDescriptor `byproduct`, or summarized into the
predicate), not replace the bundle envelope. SARIF has no signing, no provenance/builder model, and no
cross-tool aggregation contract — that's what the in-toto layers add on top.

### What to BORROW from SARIF specifically
- **`tool.driver.name` + `rules[].id`** — the "which tool, which rule" identity model for findings.
- **`level` enum (`error/warning/note/none`)** — a clean severity vocabulary if Witness wants per-
  finding severity under a stage's verdict.
- **`locations → physicalLocation → artifactLocation.uri + region`** — the standard way to point a
  finding at file+line; reuse verbatim for audit-test / coverage gap locations so downstream tooling
  (GitHub code scanning, IDEs) can consume it.

### What to SKIP as overkill
- The **enormous surface** of SARIF (code flows, thread flows, taxonomies, fixes, graphs,
  suppressions, artifact/logical locations, `reportingDescriptor` relationships) — Witness needs
  ~`ruleId`/`level`/`message`/`location`, not the full model.
- Using SARIF as the **aggregation/transport** layer — it has no signing and no provenance; wrong tool
  for the bundle envelope.

---

## 5. DSSE — the signing envelope (adopt as-is, keep signing optional-but-designed-in)

### What it models
**Dead Simple Signing Envelope** — signs an arbitrary payload without canonicalization
([envelope spec](https://github.com/secure-systems-lab/dsse/blob/master/envelope.md)):

```json
{
  "payload": "<Base64(SERIALIZED_BODY)>",
  "payloadType": "<PAYLOAD_TYPE>",
  "signatures": [ { "keyid": "<KEYID>", "sig": "<Base64(SIGNATURE)>" } ]
}
```

- `payload` (required): Base64 of the serialized body (the in-toto Statement JSON).
- `payloadType` (required): a MIME-ish type identifying the payload format
  (e.g. `application/vnd.in-toto+json`).
- `signatures[]` (required, ≥1): each has `sig` (Base64 signature, required) and `keyid` (optional;
  "An unset field MUST be treated the same as set-but-empty"). "An envelope MAY have more than one
  signature."

The signature is computed over a **Pre-Authentication Encoding (PAE)**, not the raw JSON, which is why
DSSE needs no canonical JSON ([protocol spec](https://github.com/secure-systems-lab/dsse/blob/master/protocol.md)):

```
PAE(type, body) = "DSSEv1" + SP + LEN(type) + SP + type + SP + LEN(body) + SP + body
```

(SP = ASCII space; `LEN` = decimal byte length.) It sign/verifies over `Sign(PAE(UTF8(payloadType),
SERIALIZED_BODY))`, preventing signature/canonicalization confusion. Critical rule: "Implementations
MUST ensure that the same payload bytes that are verified are the ones sent to the application layer."

### What Witness should BORROW
- **Use DSSE as the envelope** for each bundle line. It's tiny (3 fields), it's what in-toto bundles
  already use, and it makes signing *possible* without forcing it — Witness v1 can ship unsigned (empty
  or self-describing `signatures`) and turn on real signing later without changing the format.
- The **`payload` = Base64(serialized Statement) + `payloadType`** convention — decouples the envelope
  from the payload schema.

### What to SKIP as overkill
- **Multi-signature / keyid key-management, PAE hand-rolling, rotation** — v1 Witness doesn't need
  cryptographic signing to prove local value; adopt the *shape* now, defer real keys. (If/when signing
  matters, use an existing DSSE library — don't hand-roll PAE.)

---

## 6. Lighter-weight conventions worth stealing

### CycloneDX Attestations (CDXA)
CycloneDX v1.6+ added a `declarations` object for attestations: it lets orgs "communicate standards,
claims, and evidence in support of requirements, along with attestations to the veracity and
completeness of those claims"
([capability](https://cyclonedx.org/capabilities/attestations/),
[use case](https://www.cyclonedx.org/use-cases/attestations/),
[v1.6 release](https://cyclonedx.org/news/cyclonedx-v1.6-released/)). Model:
`declarations` → { **assessors, attestations, claims, evidence, targets, affirmation, signature** }.

- **`claim`** — an assertion about adherence to a requirement, with `target`, `predicate`, `evidence`,
  and `counterEvidence` (CDXA explicitly supports **counter-evidence / non-conformance**, not just
  green).
- **`target`** — "a specific system, application, API, module, team, person, process, business unit,
  company, etc. that a claim is being applied to" — targets can be organizations, components, services.
- Claims carry a **`conformance` score 0–1** (1 = 100% conformant) and a **`confidence` score 0–1**
  (1 = 100% confident).

**Borrow:** (a) the **counter-evidence** idea — Witness should have a first-class slot for "evidence
*against* shipping" (surviving mutants, unexamined-but-critical paths), not only for-verdict evidence;
(b) the **conformance + confidence 0–1 scoring** as a way to express "how strong is this stage's
signal" distinct from the pass/fail — directly useful for a canary (medium confidence) vs ship (high)
gate; (c) the **claim → target → evidence** triple as an alternative framing to subject/predicate.
**Skip:** the full compliance/standards-mapping apparatus (BOM lifecycles, requirements catalogs) —
Witness isn't a compliance BOM.

### SPDX (as an in-toto predicate)
SPDX2/SPDX3 are catalogued as vetted in-toto predicates (SBOM-as-attestation)
([predicate catalog](https://github.com/in-toto/attestation/tree/main/spec/predicates)). Relevance to
Witness is low — SBOMs describe *components*, not *test verdicts*. The only steal is the confirmation
that **"wrap an existing domain document as a predicate inside a Statement"** is the blessed pattern —
which is exactly how Witness should treat a SARIF blob or a Stryker report (reference it, don't
reinvent it).

### JSON Schema / forward-compat patterns (cross-cutting)
- **Versioned type URIs that change only on breaking changes** (SLSA's `predicateType` rule; in-toto's
  SemVer2) — Witness should stamp each predicate with a versioned type URI and treat minor additions as
  non-breaking.
- **"Consumers MUST ignore unrecognized fields"** (in-toto framework README) — make the Witness gate
  tolerant of stages adding fields.
- **Free-form `annotations` map** (ResourceDescriptor) — one sanctioned escape hatch per entry beats
  ad-hoc top-level fields.
- **At-least-one-of constraints** (ResourceDescriptor: one of uri/digest/content) — a lightweight
  JSON-Schema idiom for "identify the artifact somehow."

---

## 7. Recommended skeleton (ILLUSTRATIVE — not a finished contract)

Design intent: a **DSSE-enveloped, in-toto-Statement-shaped bundle in JSON Lines**, one line per QA
stage, each line binding a **verdict + provenance** to a **digest-addressed subject**, with a final
derived **gate** line. This reuses in-toto's Statement/subject/predicate + SLSA's builder/metadata
provenance + the Test Result verdict frame + CDXA's confidence/counter-evidence ideas.

**One evidence entry** (the Statement inside one DSSE envelope; the whole thing then Base64'd into
`payload`):

```jsonc
// ---- envelope (DSSE) ---- one of these per line in the .jsonl bundle
{
  "payloadType": "application/vnd.witness-evidence+json",
  "payload": "<Base64(statement below)>",
  "signatures": [ { "keyid": "", "sig": "" } ]   // present-but-empty in unsigned v1; DSSE-ready
}

// ---- payload (in-toto Statement shape) ----
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [                                   // BORROW: in-toto — bind verdict to the artifact by digest
    { "name": "pr-head", "digest": { "gitCommit": "<sha>" } }
  ],
  "predicateType": "https://witness.local/evidence/qa-stage/v0",   // versioned type URI (SLSA/in-toto convention)
  "predicate": {
    "stage": "mutation",                         // which QA stage produced this (mutation|coverage|audit-test|playwright|...)
    "producer": {                                // BORROW: SLSA runDetails.builder — who/what ran it
      "id": "witness://stryker@8.x",             //   tool + version identity (root of trust)
      "invocationId": "run-2026-07-17-abc123",
      "startedOn": "2026-07-17T10:00:00Z",
      "finishedOn": "2026-07-17T10:04:12Z"
    },
    "configuration": [                           // BORROW: Test Result / SLSA resolvedDependencies — inputs this verdict was computed against
      { "name": "stryker.conf.json", "digest": { "sha256": "<...>" } }
    ],
    "verdict": {                                 // BORROW: Test Result.result, extended for QA richness
      "result": "PASSED|WARNED|FAILED",          //   categorical stage outcome
      "label": "proven|likely|unexamined",       //   audit-test's native vocabulary where applicable
      "metric": { "name": "mutationScore", "value": 0.86 },
      "confidence": 0.9                          // BORROW: CDXA 0–1 confidence — feeds canary-vs-ship
    },
    "findings": [                                // OPTIONAL: SARIF-shaped, for file-located detail
      { "ruleId": "survived-mutant", "level": "warning",
        "message": { "text": "boundary mutant survived" },
        "location": { "uri": "src/checkout.ts", "region": { "startLine": 42 } } }
    ],
    "counterEvidence": [ /* CDXA: evidence AGAINST shipping — surviving mutants, unexamined critical paths */ ],
    "byproducts": [                              // BORROW: SLSA byproducts — pointers to raw reports, not inlined
      { "name": "stryker-report", "uri": "artifacts://mutation/report.html",
        "mediaType": "text/html" }
    ],
    "annotations": { }                           // BORROW: ResourceDescriptor escape hatch for tool-specific extras
  }
}
```

**The derived gate** (a final line over the whole bundle — the thing no single upstream predicate
models; Witness's own contribution):

```jsonc
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [ { "name": "pr-head", "digest": { "gitCommit": "<sha>" } } ],
  "predicateType": "https://witness.local/gate/v0",
  "predicate": {
    "decision": "ship|canary|hold",              // the categorical gate
    "producer": { "id": "witness://gate@0.x", "finishedOn": "2026-07-17T10:05:00Z" },
    "inputs": [                                   // reference the evidence lines this decision aggregated, by digest
      { "stage": "mutation",   "digest": { "sha256": "<entry-hash>" } },
      { "stage": "coverage",   "digest": { "sha256": "<entry-hash>" } },
      { "stage": "audit-test", "digest": { "sha256": "<entry-hash>" } },
      { "stage": "playwright", "digest": { "sha256": "<entry-hash>" } }
    ],
    "rationale": "1 survived critical mutant + 1 unexamined checkout path → canary"
  }
}
```

**Bundle** = these lines concatenated as newline-delimited JSON (in-toto Bundle convention:
order-independent, heterogeneous, ignore-unrecognized;
[Bundle spec](https://github.com/in-toto/attestation/blob/main/spec/v1/bundle.md)).

### Minimum viable per-evidence provenance field set (the ask from #101)
For each entry, capture: **which owning tool/stage produced it** (`predicate.producer.id` +
`predicate.stage`), **when** (`producer.startedOn/finishedOn`), **over what subject**
(`subject[].digest`), **against what config** (`configuration[]`), and **the verdict/result**
(`predicate.verdict.result` + `.label` + `.metric` + `.confidence`). That five-tuple is the
non-negotiable core; everything else (`findings`, `counterEvidence`, `byproducts`, `annotations`,
signatures) is additive.

---

---

## Competitive landscape — a funded peer shipped a competing `.evidence` format (added 2026-07-17)

> Added after the Kane CLI competitive-intel pass (`references/kane-cli-competitive-research.md`).
> Relevant here because it is the **first real, shipping competitor to the evidence-bundle idea** — and
> what it did *not* do is the strongest external validation the #101 "borrow the attestation stack"
> recommendation has.

**Who.** **Kane CLI** = `@testmuai/kane-cli` (npm, v0.6.x, Apache-2.0), by **LambdaTest, Inc.** rebranded
"TestMu AI" (2026-01-12). Its evidence layer is a *separate* package **`@testmuai/evidence-cli`**
(v0.1.x, created 2026-07-03) branded "an open, framework-agnostic format for what a test run produced —
the `.evidence` pack, and the library + CLI that validate and seal it"
([npm](https://registry.npmjs.org/@testmuai/evidence-cli)).

**What it borrowed (same instincts as this survey):**
- A **structured evidence pack** with versioned JSON Schemas (draft 2020-12) as the single source of
  truth: `run.yaml` (identity/lifecycle/totals) + per-test `result.yaml`, **L0** (framework-neutral core)
  and **L1** (+ screenshots, per-step console/network logs, video, coverage dir) profiles
  ([run.schema.json](https://unpkg.com/@testmuai/evidence-cli@0.1.6/dist/schemas/0.1/L0/run.schema.json)).
- A lightweight **provenance block** (`environment`: producer, model, surfaces, ci) — a thinner version of
  the five-tuple this survey recommends.
- A `validate` + `finalize`(**seal**) lifecycle and a **local-only, "nothing is uploaded" viewer** — the
  "open it and check it yourself" property, shipped.

**What it pointedly did NOT do — the validation of §1–§5 of this survey:**
- **No in-toto, SLSA, SARIF, DSSE, sigstore, or OTel.** Across every shipped schema/README/doc, *no
  external standard is referenced* — it is a self-defined custom JSON format. The exact backbone this
  survey recommends borrowing is the thing the shipping competitor skipped.
- **No cryptographic signing / verifiable issuer.** Its "seal" is an atomically-written **hashed zip**
  (tamper-*evidence* at best), not a signed **DSSE envelope** with an issuer identity. The §5 signing
  layer is open ground.
- **"Open" is soft.** Schema `$id` host **`evidence-cli.dev` does not resolve** (DNS ENOTFOUND); source
  repo **`github.com/LambdaTest/evidence-cli` is 404/private**. Published-as-npm-artifact, not
  published-as-governed-open-spec. Single producer today.

**Read for Witness's contract choice.** A funded incumbent independently reached for a structured,
portable, locally-openable evidence pack — validating the *problem* — and reached it **without** the
attestation/signing stack. That both (a) confirms the schema's difficulty is **adoption, not design**
(they shipped a format in weeks; making it a real *standard* they have not), and (b) leaves the
in-toto/DSSE **attestation + verifiable-issuer** layer as Witness's differentiated seam. Recommendation
stands unchanged and is now externally corroborated: **borrow the attestation stack; that is exactly the
part a well-resourced competitor left on the table.** (Watch item: if LambdaTest opens `evidence-cli`,
stands up the spec host, and courts other frameworks, `.evidence` could become the de-facto open format
first — the window is that it's v0.1.x, private repo, dead spec host.)

---

## Sources (primary specs, all cited inline above)
- in-toto Attestation Framework v1 README — https://github.com/in-toto/attestation/blob/main/spec/v1/README.md
- in-toto Statement v1 — https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md
- in-toto ResourceDescriptor v1 — https://github.com/in-toto/attestation/blob/main/spec/v1/resource_descriptor.md
- in-toto Bundle v1 — https://github.com/in-toto/attestation/blob/main/spec/v1/bundle.md
- in-toto predicate catalog — https://github.com/in-toto/attestation/tree/main/spec/predicates
- in-toto Test Result predicate — https://github.com/in-toto/attestation/blob/main/spec/predicates/test-result.md
- SLSA Provenance v1.0 — https://slsa.dev/spec/v1.0/provenance
- OASIS SARIF 2.1.0 — https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
- DSSE envelope — https://github.com/secure-systems-lab/dsse/blob/master/envelope.md
- DSSE protocol / PAE — https://github.com/secure-systems-lab/dsse/blob/master/protocol.md
- CycloneDX Attestations (CDXA) — https://cyclonedx.org/capabilities/attestations/ ,
  https://www.cyclonedx.org/use-cases/attestations/ , https://cyclonedx.org/news/cyclonedx-v1.6-released/
- Kane CLI `@testmuai/evidence-cli` (competitor, §Competitive landscape) — https://registry.npmjs.org/@testmuai/evidence-cli ,
  https://unpkg.com/@testmuai/evidence-cli@0.1.6/dist/schemas/0.1/L0/run.schema.json (full CI: `references/kane-cli-competitive-research.md`)
