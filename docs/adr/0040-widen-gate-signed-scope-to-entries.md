# Widen the gate signed scope to entries: digest-bind, don't sign-all

**Status: Accepted (2026-07-24).** Implements [#158](https://github.com/TzolkinB/skills/issues/158)
(*Gate integrity trust-boundary: widen the DSSE signed payload to the whole normalized bundle*, Tier 2.3
critique F5). Narrowly scope-reverses one clause of [ADR-0037](0037-gate-evidence-integrity.md) §1 (see
Decision 1).

## Context

[ADR-0037](0037-gate-evidence-integrity.md) §1 shipped self-signed DSSE signing over `gateStatementPayload`
= `{_type, predicateType, subject, predicate}`, where `subject` is `bundle.subject` (the `pr-head` commit
plus one sha256 per **ingested input file**, §2/#139) and `predicate` is the gate entry's own decision.
Outside that signed payload: `bundle.producedOn`, `bundle.schemaVersion`, and the **parsed evidence
entries** (`bundle.entries[*]` other than the gate entry) — Gate's normalized rendering of the Playwright/
Cypress/`audit-test` results, which is what a human actually reads in the report.

The gap is exploitable and was verified: take a signed fixture, flip its Playwright evidence entry's
`result` from `PASSED` to `FAILED` (and bump `unexpected` to a nonzero count), edit `producedOn`, leave the
`dsseEnvelope` untouched — `--verify` still exits 0 and prints "signature valid." B1 (§2) digests the
**raw input bytes**; this exploit edits the **parsed entry**, a different set of bytes than the ones B1
hashes. Nothing in ADR-0037 as shipped notices. The *decision* is protected; the *displayed evidence* is
not — so the README's "the bundle becomes tamper-evident" framing was not yet true; only "the decision and
the input digests" was.

## Decision

### 1. Digest-bind the entries into `subject[]` — not normalize-and-sign-all

Two shapes were on the table for widening the signed scope:

- **normalize-and-sign-all**: make the DSSE `payload` the entire bundle (minus the envelope itself).
- **digest-bind-entries**: keep the payload a clean in-toto Statement; extend `subject[]` with one
  content-addressed digest per parsed evidence entry, the same mechanism B1 already uses for raw inputs.

We take **digest-bind-entries**. Signing the whole bundle would make the `payload` — which
`payloadType: application/vnd.in-toto+json` promises is an in-toto Statement — actually contain the
ingested Playwright/Cypress/`audit-test` **entries** themselves, directly inside Gate's own signed
envelope. That is exactly the self-report-laundering move ADR-0037 §1 was written to prevent ("signing an
ingested entry with Gate's key would falsely imply the producer vouched for it"). Digest-bind avoids the
collision because an in-toto **subject** means "the bytes my predicate is *about*," not "the bytes my
predicate *endorses*." Binding an entry's digest into `subject[]` is integrity, not endorsement — Gate's
`predicate` still asserts only Gate's own decision. It also keeps the signed payload a valid Statement and
stays continuous with §2's existing subject mechanism rather than introducing a second one.

### 2. Granularity: one subject per entry, `producedOn`/`schemaVersion` in a signed header

- **Per-entry subjects, not one rollup digest over `entries[]`.** `entrySubjects(bundle.entries)` adds
  `{ name: 'entry:<stage>', digest: { sha256: <canonical digest of the entry> } }` for every non-gate
  entry. This costs more subjects than a single array-level digest but lets a verifier's failure reason
  name *which* entry was tampered, and it mirrors §2's existing input-subject shape exactly — one coherent
  scheme, not a bolt-on. The gate entry itself is excluded from `entrySubjects` — its `predicate` is
  already in the signed payload verbatim, so digesting it again is redundant.
- **`producedOn` and `schemaVersion` are folded into the signed Statement directly, not digested.** They
  are short scalars Gate itself produced, not opaque blobs, so hashing them is pointless ceremony. They do
  **not** go into `predicate` — honesty guard #3 (`findNumbers` scans `predicate` only, [gate.mjs](../../skills/gate/gate.mjs))
  must stay untouched, and widening what it scans is out of scope here. Instead the signed Statement gains
  a small header: `{ ...statement fields, producedOn, schemaVersion }`.
- **B1's input digests are retained unchanged**, alongside the new entry digests. Inputs (raw ingested
  bytes) and entries (Gate's parsed rendering of them) are different bytes — the exploit above edits one
  without touching the other — so both must be bound for the bundle to be honestly called tamper-evident.

The signed payload (`gateStatementPayload`) widens from
`{_type, predicateType, subject, predicate}` to
`{_type, predicateType, subject: [...bundle.subject, ...entrySubjects(bundle.entries)], predicate, producedOn, schemaVersion}`.

### 3. Canonicalization: a small hand-rolled sorted-key form, not JCS

Verification must recompute entry digests and re-serialize the Statement for comparison; without a pinned
canonical form, harmless reformatting (key order, whitespace) could produce spurious failures, or worse,
mask a real tamper if the comparison were too loose. We pin: **recursively sort every object's keys, then
`JSON.stringify` with no added whitespace; arrays keep their given order.** This is applied (a) to each
entry before it is sha256'd into an `entrySubjects` digest, and (b) to the full signed payload, both at
sign time (the bytes actually signed) and at verify time (both the decoded signed payload and the freshly
reconstructed `expected` are canonicalized before comparison, so neither side's incidental key order can
produce a false result in either direction).

This is **not** RFC 8785 (JCS) and is not claimed to be interoperable with it. JCS's genuinely hard
problems — ECMAScript-exact number formatting, full Unicode escaping — don't bite our payload: every field
signed here is a hex digest, an enum string, an ISO-8601 timestamp, or a small integer count, shapes Gate
fully controls. A ~10-line recursive key-sort is sufficient, auditable, and keeps the zero-dependency moat
([ADR-0028](0028-witness-gate-skill-mvp1.md)) that a JCS library would break. If Gate ever needs to
interoperate with external in-toto tooling that expects JCS, that is a future escalation behind its own
ADR, not a default assumed here.

### 4. Schema bump: v0.5 → v0.6, minor, regenerate-not-migrate

`validateBundle` already hard-rejects any bundle whose `schemaVersion` does not equal the current constant
— every prior bump (through v0.5) was already "regenerate or fail validation," with no multi-version
tolerance anywhere in the code. So there is no migration path to design: a pre-existing v0.5 bundle (signed
or not) simply fails validation under v0.6 code, exactly as a v0.4 bundle already fails under v0.5 code.
The only committed v0.5 signed artifact is the fixture (`fixtures/gate-bundle.signed.json`) plus its demo
keypair, neither of which is distributed to consumers — regenerating it is build work, not a compatibility
obligation.

The bump is **minor** (v0.5 → v0.6): the shape change is additive (new subjects, two new signed-header
fields) and introduces no numeric field on the gate predicate, so it does not collide with the reserved
MAJOR-bump signal for the numeric `confidence`/calibration loop
([#129](https://github.com/TzolkinB/skills/issues/129)).

**The honest nuance recorded here:** the schema *shape* is additive, but the *meaning of a valid signature
strengthens* — a v0.6 signature covers entries and `producedOn`/`schemaVersion`; a v0.5 signature did not.
A v0.6 verification is a stronger claim than a v0.5 one was, even though both bundles "validate."

**Downgrade-resistance falls out for free.** Because `schemaVersion` is now inside the signed payload, an
attacker cannot relabel a v0.6 bundle as `v0.5` to trick a future lenient verifier into applying the
narrower old scope — relabeling breaks the signature like any other tamper.

## Considered options

- **Normalize-and-sign-all.** Rejected (Decision 1): breaks the in-toto Statement shape of the DSSE
  payload and re-introduces the self-report-laundering risk ADR-0037 §1 exists to prevent, by putting
  ingested entries' own content directly inside Gate's signed envelope rather than binding them by digest.
- **A single rollup digest over `entries[]` instead of per-entry subjects.** Rejected: cheaper (one
  subject instead of N) but a tamper only reports "something in entries changed," not which entry —
  weaker diagnostics for the same binding guarantee, and it breaks the one-mechanism-for-everything
  continuity with §2's per-input subjects.
- **JCS (RFC 8785) canonicalization.** Rejected for v1 (Decision 3): correct and interoperable, but adds a
  dependency for correctness properties (exact number/Unicode canonicalization) our payload's controlled
  shapes never exercise — over-engineering relative to what this bundle actually contains.
- **A migration/compat shim for v0.5 signed bundles.** Rejected (Decision 4): no such tolerance exists
  anywhere else in the schema's history: `validateBundle` already hard-rejects any off-version bundle, so
  adding one here would be new, unrequested leniency rather than preserving an existing guarantee.

## Consequences

- **The "bundle is tamper-evident" claim is now honestly earned**, not just "the decision and the input
  digests are." README/SKILL.md wording lands in a separate commit from this build (ADR-0037 Decision 4's
  pattern: build-coupled wording ships with its capability, but as its own reviewable diff).
- **ADR-0037 §1 is narrowly scope-reversed.** Its literal "never the ingested entries" clause no longer
  holds; its *intent* — no self-report laundering, Gate's predicate endorses only Gate's own decision —
  is fully preserved, because entry digests are bound as *subjects* (integrity), never folded into
  Gate's *predicate* (endorsement). §1 carries an "Amended by #158" forward pointer to this ADR.
- **Honesty guard #3 is untouched.** `producedOn`/`schemaVersion` live in the signed Statement's header,
  never in `gateEntry.predicate`; entry/input digests remain hex strings in `subject`. `findNumbers`'s
  scan of `predicate` only is unaffected.
- **`dsseSign` always canonicalizes its payload before signing** (not just for gate Statements) — a small
  behavioral widening of a previously-generic function, invisible to existing callers since canonicalizing
  a single-key test object is a no-op.
- **The self-test gains tamper rows** for each newly-covered field: an evidence entry edited post-signing,
  `producedOn` edited post-signing, `schemaVersion` edited post-signing (the downgrade case) — each must
  invalidate; the untouched bundle must still verify. The committed signed fixture is regenerated under
  v0.6 with the existing demo key (never a secret worth protecting).
- **Growth path stays legible.** JCS-compatibility and Sigstore keyless signing remain future escalations
  behind their own ADRs, exactly as ADR-0037 already recorded; nothing here forecloses either.
