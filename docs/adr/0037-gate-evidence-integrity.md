# Gate evidence integrity: sign the bundle, content-address the inputs, bind audit-test to its run

**Status: Accepted (2026-07-22).** Implements [#128](https://github.com/TzolkinB/skills/issues/128)
(*Real evidence integrity — DSSE signing, bind emissions to execution artifacts*), the third Tier-2 item of
`docs/roadmap.md`. Builds on the Gate MVP1 build ([ADR-0028](0028-witness-gate-skill-mvp1.md)) and the parsed
`audit-test` graduation ([ADR-0029](0029-witness-parsed-audit-test-graduation.md)); narrowly scope-reverses one
clause of [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) §3 (see Decision 1). It is the maturity
pass for the v1 launch, replacing the "aggregator of self-reports" caveat that
`references/critique-synthesis.md` said "cannot be honestly fixed by
Monday" for the *scrapped* v0 launch with a smaller, honest set of integrity properties that **can**.

## Context

Today the Gate produces an evidence bundle whose integrity is entirely notional:

- **The subject is a typed string.** `assembleBundle` records `subject: [{ name: 'pr-head', digest: { gitCommit } }]`
  where `commit` is whatever the caller passed to `--commit` ([gate.mjs](../../skills/gate/gate.mjs) line ~236).
  Nothing hashes the ingested Playwright/Cypress JSON or the `audit-test` file. Every evidence Statement carries
  `subject: []` (empty). So the report files can be swapped out from under the verdict and the bundle never notices.
- **The bundle is unsigned.** [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) §3 softened the language
  to "in-toto-*shaped* Statements (**not signed attestations**)" precisely because nothing signs them. A bundle can
  be edited after the fact — including the gate decision itself — with no evidence of tampering.
- **The `audit-test` tally is a bare model number.** `parseAuditEmission` validates the emission's *shape* and
  *internal arithmetic* ([#111](https://github.com/TzolkinB/skills/issues/111)), but nothing binds those counts to
  a real mutation run. A model writes `confirmedSolid: 6`; nothing checks that six mutations were actually killed.
  This is the honest core of #128's ask: "*bind an `audit-test` emission to the real execution run that produced
  it — today a model writes the tally; nothing checks it against a real run.*"

**#128's stated dependency is wrong, and this ADR corrects it.** #128 says it is "blocked by
[ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)'s execution seam landing first." But ADR-0010
did **not** defer execution behind a seam — it ruled the **Execution Gap out of scope permanently**: "Absorbing a
browser-driving stack would … collapse the judgment/execution seam that is the suite's competitive moat." Only the
*Temporal* Gap in ADR-0010 was deferred-behind-a-seam. There is no execution seam coming, and Gate will never run a
suite, a browser, or a mutation. The real prerequisite for binding an emission to its run is not Gate gaining
execution — it is **`audit-test` emitting a verifiable record of the run it already performed**, which Gate then
*ingests and checks*. That keeps Gate inside the static-judgment moat ([ADR-0028](0028-witness-gate-skill-mvp1.md)
Decision 1): pure consumption, never execution.

The honest ceiling this ADR works under, stated up front: Gate cannot *independently verify* any stage's evidence,
because independent verification would mean re-running it, which ADR-0010 forbids. So the goal here is not to make
the bundle *trustless* — it is to make it **tamper-evident, content-addressed, and internally cross-checkable**, and
to make the `audit-test` self-report *granular and consistency-checked* instead of a single opaque number. That is a
real, demonstrable maturity gain; it is not "verified by a third party," and the skill must keep saying so.

## Decision

Three separable capabilities, each independently landable, unified by one idea: **an in-toto attestation is a
signed predicate over content-addressed subjects.** We make the gate Statement exactly that.

### 1. Sign the gate Statement with a self-signed DSSE envelope (ed25519, zero-dep) — capability **A**

Gate signs **its own** Statement — the `gate.local/gate/v0` entry carrying the decision — as a
[DSSE](https://github.com/secure-systems-lab/dsse) envelope over an **ed25519** signature produced by Node's
built-in `node:crypto` (`sign`/`verify`, `generateKeyPair`). **No new dependency** — the zero-dep moot
([ADR-0028](0028-witness-gate-skill-mvp1.md)) holds. The envelope is standard: `payload` (base64 of the serialized
Statement), `payloadType` (`application/vnd.in-toto+json`), and `signatures[]` with `sig` and a `keyid` = sha256 of
the public key; the signature is over the DSSE **PAE** (pre-authentication encoding), not the raw JSON.

- **Gate signs only what Gate produced.** The envelope wraps the *gate* Statement, not the ingested
  Playwright/Cypress/`audit-test` entries. Signing an ingested entry with Gate's key would falsely imply the
  *producer* signed it — re-introducing exactly the self-report laundering we guard against. Gate attests: "I
  produced this decision over these subjects, unaltered." It never attests "Playwright signed its own result."
- **Signing is opt-in and backward-compatible.** With no key, Gate emits the same unsigned bundle it does today;
  unsigned bundles stay valid. A key is supplied via `--sign-key=<path>` (or an env var); a matching `--verify` /
  `--pubkey` path checks an existing bundle. In CI the key can later come from a secret or GitHub OIDC — that ties
  into the deferred `--live` escalation ([ADR-0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)) and is not
  required for v1.
- **Honest scope: self-signed, not Sigstore.** An ed25519 key the user generates proves **integrity** (the bundle
  was not altered after signing) and **continuity** (the same key signed across runs). It does **not** prove
  third-party **identity** — there is no Fulcio/OIDC certificate binding the key to a person or workflow. The skill
  earns the words "**signed**," "**tamper-evident**," and "**attestation**" (a DSSE envelope *is* the in-toto
  attestation format); it does **not** earn "**Sigstore-verified**," "**trusted publisher**," or "**verified
  identity**," and must not use them.
- **This narrowly scope-reverses [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md) §3.** When a bundle is
  DSSE-signed, "in-toto-*shaped* Statements (not signed attestations)" becomes "**DSSE-signed in-toto
  attestations**." Nothing else in ADR-0032 changes: the **Witness → Gate rename stays**, and the
  [#113](https://github.com/TzolkinB/skills/issues/113) naming-collision resolution stays intact (the rename was
  about the *name* colliding with the in-toto Witness *tool*, not about signing). **Unsigned** bundles keep the
  "shaped, not signed" language verbatim — the softened wording was never wrong for the unsigned default, only for
  the new signed path.

### 2. Content-address the inputs into the gate Statement's `subject[]` — capability **B1**

At ingest, Gate computes the **sha256** of each input file (the Playwright JSON, the Cypress JSON, the `audit-test`
emission/report) and records those digests as the **subjects** of the gate Statement — the textbook in-toto shape:
a predicate (the decision) asserted *over named, content-addressed subjects* (the exact files it summarized). The
existing `pr-head` git-commit subject is retained alongside them.

- Swap any input file after the fact and its recorded digest no longer matches — the binding between "these inputs"
  and "this decision" is now cryptographic, not a typed commit string.
- Digests are lowercase hex **strings** and live in the Statement's **`subject`**, never in the gate **`predicate`**.
  Honesty guard #3 (`validateGateEntry` → `findNumbers` scans `predicate` only) is therefore untouched: a sha256
  digest is not a smuggled number, and the "no numeric field in the gate predicate" invariant that signals the
  calibration loop ([#129](https://github.com/TzolkinB/skills/issues/129)) has **not** landed remains exactly as-is.

### 3. Bind the `audit-test` tally to a verifiable run trace — capability **B2**

`audit-test`'s emission gains an **optional** `runs[]` array — one record per test that a mutation was actually
**executed** against — carrying the per-test provenance of the run: the test identifier, the mutation applied, the
command executed, and the outcome (`killed` | `survived`) with its exit signal. Gate then **cross-checks the tally
against the trace**: `confirmedSolid` must equal the count of `killed` runs, `confirmedHollow` the count of
`survived` runs, and the number of trace records must not exceed `deepAudited`. A tally that disagrees with its own
trace is rejected the same way an arithmetically-impossible tally is today — it **degrades to opaque**, never a
silent upgrade.

- **Honest degradation for the un-runnable subset.** `audit-test` cannot execute a mutation in every environment
  (the `likelyHollow` = "env not runnable" class exists for exactly this). Those tests have **no** trace record and
  keep their existing "**reasoned-only**" standing; B2 covers only the executed (`confirmedSolid` +
  `confirmedHollow`) subset and must not imply otherwise. An emission with no `runs[]` at all is still valid and
  behaves exactly as today (counts-only, `confirmed`/`likely`/`unexamined` derived as before) — B2 is purely
  additive.
- **What B2 does and does not earn.** It raises the `audit-test` input from "trust a summary number" to "trust a
  granular, per-test, internally-consistent run record with exit codes that Gate cross-checked against the tally."
  It does **not** make the verdict independently verified — the trace is still `audit-test`'s own account of its
  run, and Gate cannot re-execute it (ADR-0010). B2 makes the self-report *checkable and hard to fabricate by
  accident*; it does not make it *trustless*. The `ship`-eligibility rule is unchanged — B2 hardens the *evidence
  behind* a `confirmed` label, it does not create a new path to `ship`.
- **Cross-skill and additive-schema.** B2 touches `audit-test` (it must emit `runs[]`) as well as Gate (it must
  verify them), so it is the largest and last of the three, and the one most likely to land as a fast-follow rather
  than by Monday. The `audit-test` emission schema bumps `gate-audit-test/v0.2` → `v0.3` (additive `runs[]`); the
  bundle schema bumps `gate-evidence-bundle/v0.3` → `v0.4` (additive subject digests + optional DSSE envelope).
  Both are **minor** bumps. Crucially, **neither is the numeric-`confidence` signal** reserved for the calibration
  loop ([#129](https://github.com/TzolkinB/skills/issues/129)): digests are strings, and the run-trace numbers live
  in the `audit-test` **evidence** entry (which legitimately carries counts today), never in the gate predicate.

### 4. A claims/docs honesty pass ships alongside the build — as its own reviewable slice

Capabilities A–B2 change *what wording is honest*: a signed bundle may say "attestation," an unsigned one may
not; a content-addressed, cross-checked self-report warrants a softer caveat than a bare one. So the user-facing
claims must move **in lockstep** with the build — but committed **separately from the capability code**, so the
wording diff reviews on its own and the launch's claim surface never drifts ahead of (or behind) the
implementation. Driven by the still-live wording findings in `references/critique2-chatgpt.md` that the build does
not itself resolve, this pass has two parts:

- **Build-coupled wording (lands with its capability, as a separate commit from the code).** The
  signed-attestation language ships **only** with **A** and **only** to the self-signed level — `gate/SKILL.md` +
  README may then say "signed / tamper-evident / attestation," never "Sigstore / verified identity / trusted
  publisher" (critique2 finding 5). The softened self-report caveat ships with **B1/B2**: reworded to state the new
  content-addressing / cross-check properties, **not deleted** — Gate still cannot re-execute, so "advisory,
  self-reported status" stays true (critique2 finding 4). This wording must **not** land before its capability, or
  it becomes the exact overclaim the critique names.
- **Build-independent wording (may land now, before A/B1/B2, as a cheap pre-launch batch).** The findings the build
  never touches: advisory / "does not abort the build" framing (finding 3), the determinism nuance — the gate
  *decision* is deterministic, the upstream evidence-gathering is not (finding 7), the Witness→Gate doc + ADR-filename
  sweep (finding 8), explicit prototype/solo-project status labeling (finding 9), and a plain-English worst-wins rule
  statement (finding 10). None depend on the build; they de-risk the launch regardless of how far A/B1/B2 gets.

The proven→confirmed Blocker (critique2 finding 1) and the examined-subset finding (finding 6) are already resolved
([ADR-0034](0034-proven-confirmed-taxonomy-rename.md), [ADR-0035](0035-gate-examined-floor.md)) and are out of scope
here.

### Sequencing

**A** and **B1** are Gate-only, self-contained, and land first (either order; B1 pairs naturally with A since the
signature then covers the input digests). **B2** is cross-skill and lands last, gated behind the `audit-test`
emission change; it is the acceptable spill point if the runway runs short — A + B1 alone already move the product
from "typed commit string + swappable inputs + unsigned" to "signed decision cryptographically bound to the exact
input files," which is an honest v1 story on its own.

The **build-independent wording batch** (Decision 4) has no code dependency and can land first of all; the
**build-coupled wording** lands with A and B1/B2 respectively but as a **separate commit** from each capability's
code, so `/to-tickets` should slice the docs work as its own ticket(s), not bury it inside the code tickets.

## Considered options

- **Sigstore keyless signing (OIDC → Fulcio short-lived certs).** The SLSA-grade, third-party-identity answer.
  Rejected for v1: it adds a dependency and a network/OIDC requirement, breaking the zero-dep moat for a local,
  model-invoked skill, and it over-promises "verified identity" for what is fundamentally a local developer tool.
  Self-signed ed25519 is the honest, zero-dep floor; Sigstore is a legitimate later escalation *if* Gate ever runs
  as a hosted CI identity, and would get its own ADR.
- **Sign each ingested Statement individually.** Rejected — Gate did not produce the Playwright/Cypress/`audit-test`
  results, so signing them with Gate's key would falsely attest that their producers vouched for them. Gate signs
  only its own gate Statement; the ingested entries ride inside it as content-addressed subjects, which is the
  honest binding.
- **Digest-bind the inputs but stop there (B1 only), leave signing and execution-binding reserved.** Rejected as the
  *whole* answer — B1 alone hardens the inputs but leaves the decision itself unsigned and the `audit-test` tally an
  unchecked number, so it would not honestly retire the "aggregator of self-reports" caveat. It is, however, the
  correct *first* slice, which is why the sequencing lands it early rather than cutting it.
- **Independently re-verify `audit-test` by re-running the mutation in Gate.** Rejected — it is the one thing
  ADR-0010 forbids, and it would collapse the judgment/execution seam that is the suite's moat. B2's cross-check
  against a self-reported trace is the strongest honest binding available to a pure-ingest gate.
- **Ship a numeric integrity/confidence score now that things are signed.** Rejected — signing says nothing about
  the *confidence* of the verdict, only its *integrity*. A number still requires the calibration loop
  ([#129](https://github.com/TzolkinB/skills/issues/129)); its arrival stays the reserved MAJOR-bump signal, and
  this ADR deliberately keeps every new field a string (digests) or out of the gate predicate (run-trace counts) so
  that signal stays clean.

## Consequences

- **The "attestation" language is earned back, narrowly and honestly.** A signed bundle is a DSSE-signed in-toto
  attestation; the skill may say "signed," "tamper-evident," "attestation." It still may not say "Sigstore,"
  "verified identity," or "trusted publisher." The v1 launch copy is bounded by exactly this line.
- **The caveat is softened, not deleted.** [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)'s
  honest-limits discipline stands: Gate still cannot re-run any stage, so its verdict is still an aggregation of
  (now content-addressed, cross-checked, and signed) self-reports. `SKILL.md` keeps a caveat to that effect —
  reworded to state the new integrity properties precisely, not removed.
- **The claims/docs honesty pass (Decision 4) is part of this work, reviewed separately.** The build alone does not
  neutralize `references/critique2-chatgpt.md`: it resolves the attestation finding (finding 5, via A) and reduces
  the self-report finding (finding 4), but the wording findings (3, 7, 8, 9, 10) and the caveat rewording are what
  actually close the "bold claims vs. minimal implementation" thesis. Shipping the build *without* the wording pass
  would add claim surface while leaving those findings live — so the docs pass is scoped in, committed apart from
  the code, and its build-independent half can precede the build.
- **Determinism and the honesty guards are preserved.** The gate decision is still deterministic prose over
  categories; signing wraps the *output*, it does not enter the decision. Honesty guard #3 (no number in the gate
  predicate) is untouched — the new fields are string digests in `subject` and counts in the `audit-test` evidence
  entry. The self-test (`gate.mjs --self-test`) gains rows for sign/verify round-trips, digest binding, and
  tally↔trace cross-checking, including the tamper cases (a mutated payload must fail verification; a mismatched
  digest and a tally-disagreeing trace must both be rejected).
- **#128's ADR-0010 mis-citation is corrected for the record**, so future passes stop re-deriving a blocked
  dependency that does not exist: the prerequisite for execution-binding is `audit-test`'s run trace, not a Gate
  execution seam.
- **Growth path stays legible.** Sigstore keyless signing (real third-party identity) and Gate-run-as-CI-identity
  remain future escalations behind their own ADRs and the `--live` seam
  ([ADR-0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)); the numeric `confidence` field remains reserved
  for the calibration loop ([#129](https://github.com/TzolkinB/skills/issues/129)) and its MAJOR schema bump. None
  of those is built here.
