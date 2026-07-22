# Witness evidence-bundle contract — v0 (LOCKED)

> Provenance: resolution of wayfinder ticket #102 (map #98, effort `witness-map`), 2026-07-17.
> Decided in a `/grilling` session against the two research assets this ticket blocked on:
> `references/witness-ingestible-evidence-audit.md` (#100) and
> `references/witness-evidence-bundle-prior-art.md` (#101).
>
> This is a **locked contract on paper** — fields + provenance model — the deliverable #102 owes.
> It is NOT emission code. The formal ADR + the build happen later at the map's destination via
> `/to-spec`. Scope guardrail carried from the map: **Playwright JSON only**; `audit-test` is the
> credible-today Sentinel input; the numeric score and calibration loop are deferred/PARKED — the
> bundle **carries evidence, it does not presume a scoring algorithm.**

---

## The one-sentence contract

An evidence bundle is **one readable JSON document** binding a set of **per-stage evidence entries**
— each an in-toto **Statement** carrying provenance (who/when) + a **verdict of facts** — to a single
digest-addressed **subject** (the PR head commit), designed so that (a) only stages that emit real
structured evidence today are populated, (b) new stages arrive as *data, not schema changes*, and
(c) the whole thing lifts to a standalone Witness plugin by moving one directory.

---

## Locked decisions (the grilling trail)

| # | Fork | Decision |
|---|------|----------|
| Q1 | How much multi-stage schema to lock now | **Generic stage-agnostic entry.** `stage` is a *data field*, not a schema variant. v1 emits exactly the entries that are honestly ingestible (Playwright parsed + audit-test attachment). More stages appear with **zero schema change**. The richer per-stage-predicate world ("A") is slated growth, gated on real emission — never pre-built (no theater). |
| Q2 | DSSE envelope now, or readable JSON | **Readable in-toto Statements now; DSSE implemented later.** No base64-wrapping in v1 — the bundle's whole value is legibility. Migration to DSSE is mechanical (base64 the exact Statement bytes we already emit), so deferring costs nothing. |
| Q3 | Container format | **Single JSON document** with an `entries[]` array now; the in-toto JSON-Lines bundle (append-per-stage, order-independent) is the growth path once stages stream independently. Conversion is 1 entry → 1 line. |
| Q4 | Subject binding | **One shared subject** (the PR head commit) at the bundle's top level. Per-entry `subject` is reserved (schema allows it) for future cross-run aggregation. |
| Q5 | Per-entry field set | Locked skeleton below. `findings` (SARIF) and `counterEvidence` (CDXA) are **reserved-only** — documented, not emitted (no producer for them in v1). |
| Q6 | What lives in `verdict` | `result` (required, mechanical from facts) · `label` (optional, stage-native) · `metrics[]` (optional, **raw measured facts only**). **`confidence` is CUT** — a manufactured number with no calibration behind it is exactly the false precision the map forbids; reserved, and its arrival is the *signal* Witness has earned a number. |
| Q7 | `audit-test` representation | **Opaque — no prose scraping.** No parsed verdict; the Markdown report rides **inline** as a `byproducts[].text` string so there is no separate file to hunt for. It becomes first-class only when a structured emission mode is built (the first B→A graduation). |
| Q8 | The derived gate line | **Out of scope for #102.** The contract defines the bundle that *feeds* the gate; `ship/canary/hold` semantics + thresholds belong to the "Categorical gate function" ticket that graduates from the fog now. A reserved forward-pointer only. |
| Q9 | Housing / extractability | **One self-contained directory** `sentinel/skills/gate/` (+ `schema/`) — Sentinel has no shared `lib`, so extraction = *move one folder*. All identities/type URIs use the **`witness://` / `witness.local/` namespace**, never `sentinel`, so emitted bundles are already plugin-neutral. |
| Q10 | Extensibility (TEA / WAIVED room) | Room = the generic entry (Q1) + three borrowed idioms: **versioned `predicateType` URIs**, **ignore-unrecognized-fields**, per-entry **`annotations` map**. Nothing TEA/WAIVED-shaped is built in MVP1; each lands later as a non-breaking addition. |

---

## The schema

### Bundle (single readable JSON document)

```jsonc
{
  "schemaVersion": "witness-evidence-bundle/v0",
  "subject": [                                   // Q4 — shared subject, digest-addressed (in-toto)
    { "name": "pr-head", "digest": { "gitCommit": "<sha>" } }
  ],
  "producedOn": "2026-07-17T10:05:00Z",
  "entries": [ /* one in-toto Statement per stage — see below */ ]
  // NO gate line in v0 (Q8). The gate function may append a `witness.local/gate/v0` entry;
  // its shape + thresholds are the next ticket's to lock. Reserved forward-pointer only.
}
```

The top-level wrapper (`schemaVersion` + `subject` + `producedOn` + `entries[]`) is Witness's own —
the consequence of choosing a single doc over JSON Lines (Q3). Each element of `entries[]` is a proper
in-toto Statement, so the JSONL migration stays clean (each element → one line).

### Entry (an in-toto Statement, kept readable)

```jsonc
{
  "_type": "https://in-toto.io/Statement/v1",
  "predicateType": "https://witness.local/evidence/qa-stage/v0",   // versioned; witness:// namespace (Q9, Q10)
  "subject": [],                                 // Q4 — reserved; shared at bundle top level in v0
  "predicate": {
    "stage": "playwright",                       // Q1 — data field: playwright | audit-test | (future) mutation | coverage | ...
    "producer": {                                // Q5 — SLSA builder/metadata: who + when
      "id": "witness://playwright@1.x",          //   tool + version identity (root of trust)
      "invocationId": "run-2026-07-17-abc123",   //   optional
      "startedOn": "2026-07-17T10:00:00Z",
      "finishedOn": "2026-07-17T10:04:12Z"
    },
    "configuration": [                           // Q5 — optional: inputs the verdict was computed against
      { "name": "playwright.config.ts", "digest": { "sha256": "<...>" } }
    ],
    "verdict": {                                 // Q6
      "result": "PASSED|WARNED|FAILED",          //   required — mechanical from facts
      "label": "proven|likely|unexamined",       //   optional — stage-native vocabulary where it exists
      "metrics": [                               //   optional — RAW measured facts only, never a judgment number
        { "name": "unexpected", "value": 0 },
        { "name": "flaky", "value": 1 }
      ]
      // NO `confidence` in v0 (Q6) — reserved until the calibration loop exists (#96, PARKED).
    },
    "byproducts": [                              // Q7 — prose → inline `text`; binary/large → `uri` pointer
      { "name": "playwright-json", "uri": "test-results/results.json", "mediaType": "application/json" }
    ],
    "annotations": { }                           // Q10 — the one sanctioned per-entry escape hatch
    // RESERVED, documented, NOT emitted in v0 (Q5): `findings` (SARIF-shaped), `counterEvidence` (CDXA).
  }
}
```

### The `result` derivation (Playwright)

Mechanical, from `stats` in the Playwright JSON report — a restatement of fact, not a judgment:

```
stats.unexpected > 0   → FAILED
else stats.flaky > 0    → WARNED     // flaky NEVER appears in `unexpected`; must be read explicitly
else                    → PASSED
```

`metrics[]` carries the raw counts (`expected`, `unexpected`, `flaky`, `skipped`) verbatim — facts the
tool actually reports, not derived scores.

---

## The two entries v0 actually emits

### 1. `playwright` — parsed structured evidence (ingestible today)

Per #100, Playwright's JSON reporter is complete and machine-readable now; the gap is an ingestion
adapter, not new emission. The entry:

- `verdict.result` derived from `stats` (rule above); `verdict.metrics[]` = the raw `stats` counts.
- `byproducts`: the raw `results.json` as a `uri` pointer; traces/screenshots/videos as `uri` pointers
  (binary → never inlined — that would wreck the readability we protected in Q2).

### 2. `audit-test` — opaque, inline (credible-today Sentinel input)

Per #100, every Sentinel stage-3–5 skill emits **prose Markdown only** (ADR-0002 defers structured
emission to the pipeline = Witness). So v0 does **not** parse it:

- `verdict`: no `result`/`label`/`metrics` parsed from prose (opaque).
- `byproducts`: `{ "name": "audit-test-report", "mediaType": "text/markdown", "text": "<the markdown>" }`
  — the report is carried **inline as a raw string** so opening the one bundle file shows the audit
  prose in place, next to the Playwright results. **No `.md` to locate.** (Turning that inline Markdown
  into a *pretty rendered* view is a presentation concern for the Gate/reporting skill — not this
  contract.)

Its *presence* still earns its place: it makes the bundle genuinely two-stage (proving the generic
multi-stage shape works) and carries the human-facing proof-of-audit.

---

## Reserved (documented, built by nobody in v0)

Every one of these is a **non-breaking future addition** the schema already tolerates
(versioned type URI + ignore-unrecognized + annotations):

- **DSSE envelope** (Q2) — wrap each Statement's serialized bytes into a DSSE `payload` when signing matters.
- **Per-entry `subject` digests** (Q4) — for cross-run / heterogeneous-artifact aggregation.
- **`findings`** (SARIF-shaped file+line detail) (Q5) — arrives with the first static-analysis stage.
- **`counterEvidence`** (CDXA "evidence against shipping") (Q5) — the honest heart of a gate; first-class later.
- **`verdict.confidence`** (0–1) (Q6) — arrives *with* the calibration loop that earns it (#96, PARKED).
- **The `gate` entry** (`witness.local/gate/v0`: `decision`/`inputs`/`rationale`) (Q8) — owned by the gate-function ticket.
- **TEA risk-weights / WAIVED overrides** (Q10) — land as a new `stage`, a new annotation, or a new reserved field.

---

## Forward-compatibility machinery (the whole story)

1. **Versioned `predicateType` URIs** (`.../v0`) — bump only on a breaking change (SLSA/in-toto convention).
2. **Ignore unrecognized fields** — the gate tolerates any stage adding fields it does not know (in-toto forward-compat contract).
3. **Per-entry `annotations` map** — the single sanctioned escape hatch for tool-specific extras.

Combined with the generic stage-agnostic entry (Q1), that is *all* the extensibility needed — and it
costs zero speculative code today.

---

## Housing & extraction (the #99 corollary)

- **Extraction unit = one directory.** All Witness code (schema/JSON-Schema, Playwright ingest adapter,
  bundle emitter, Gate skill) lives under **`sentinel/skills/gate/`** with the schema in
  `sentinel/skills/gate/schema/`. Sentinel has **no shared `lib`**, so there is nothing to untangle —
  extraction to a standalone plugin is *move that one folder* + repoint the plugin root.
- **`witness://` namespace everywhere.** Every `producer.id` and `predicateType` URI uses
  `witness://…` / `witness.local/…`, **never** `sentinel`. Emitted bundles are already plugin-neutral,
  so extraction never requires rewriting the type strings in any bundle ever produced.
- Witness stays **squarely a Gate skill** for now (per #99). No top-level `sentinel/witness/` pull-up
  until it earns plugin independence (own calibration loop + non-Sentinel inputs).

---

## Growth path — "A that isn't theater"

The endgame is first-class per-stage predicates (rich mutation/coverage/audit-test verdicts). The rule
that keeps it honest: **a stage graduates from a generic entry → a first-class parsed predicate only
when it actually emits structured, ingestible evidence.** Never pre-built.

- **First in line: `audit-test` structured-emission mode.** Its parseable fields already exist *latent
  in the prose* (`test_id`, `file`, `verdict`, `provenance` ∈ {proven, likely, unexamined},
  `taxonomy_category`, `proof`); ADR-0002 pre-assigns building the emission to the pipeline. Until that
  exists, audit-test stays the opaque inline attachment above. **This sits beyond this map's
  destination** (which is Playwright-ingest-only) — it is the next Witness effort, not a #98 child.

---

## Prior-art lineage (what each decision borrowed)

- **in-toto**: Statement (`subject`/`predicateType`/`predicate`), digest-addressed `subject`,
  ResourceDescriptor (`uri`|`digest`|`content` inline), JSON-Lines Bundle (as the growth path),
  ignore-unrecognized + SemVer forward-compat.
- **SLSA**: `producer` ← `runDetails.builder.id` + `metadata.startedOn/finishedOn`; `configuration` ←
  `resolvedDependencies`; `byproducts` for raw-report pointers. (Build threat-model dropped.)
- **in-toto Test Result predicate**: `verdict.result` frame (PASSED/WARNED/FAILED), extended.
- **SARIF**: reserved `findings` shape (`ruleId`/`level`/`message`/`location`) — rides *inside* an entry.
- **DSSE**: the reserved signing envelope.
- **CycloneDX (CDXA)**: reserved `counterEvidence`; `confidence` (deferred, not adopted in v0).
```
