# A distinct `rejected` credibility state, and an opt-in freshness floor with no default

**Status: Accepted (2026-07-25).** Implements two of four fixes from a hostile-review pass of `gate.mjs`
(findings #2 and #3, 2026-07-25) — the other two (findings #4 and #5) are straightforward bug fixes
(a crash-on-malformed-input, and a computed-but-unrendered metric) with no design alternative to weigh, so
they don't warrant an ADR of their own; this one covers the two that do.

## Context

### Finding #2 — a rejected emission renders identically to absence

`parseAuditEmission` already validates a `--audit-test-json` emission's shape and internal arithmetic
(ADR-0037 §3, #155/F1/F3) and returns `null` when it's malformed or arithmetically impossible. That `null`
is the single strongest signal Gate can produce about a broken or dishonest producer — a model *tried* to
report and the report didn't add up. Before this ADR, the CLI wrapper's response to that signal was a
`console.error` warning and nothing else: no entry was pushed to `bundle.entries` for the rejected emission,
so `gate()`'s credibility axis found no `audit-test` entry at all and took the `absent` branch. The rendered
report and the persisted (and, if `--sign-key` was passed, *signed*) bundle then read exactly as if nothing
had ever been sent — the rejection survived only as an ephemeral stderr line, gone the moment a CI wrapper
drops stderr (which most do).

### Finding #3 — no freshness check at all

`playwrightEntry`/`cypressEntry` have captured each execution report's own start time
(`producer.startedOn` — Playwright's `stats.startTime`, Cypress's `startedTestsAt`) since before this ADR,
but nothing ever read it. A stale `results.json` left over from an earlier, unrelated run gates cleanly
today as long as its bytes are readable and its counts say `PASSED` — content-addressing (#139/ADR-0037 §2)
proves the decision is bound to *these exact bytes*, not that these bytes are *current*.

## Decision

### 1. `rejected` is a new, distinct credibility state — not folded into `opaque` or `absent`

Three states already existed on the credibility axis (parsed, opaque, absent), each with its own ceiling
and its own line in the rendered report. A rejected emission gets a fourth: `auditTestRejectedEntry(reason)`
produces an evidence entry with `verdict: { rejected: true, reason }` — no `result`/`label`/`metrics`,
because there is nothing trustworthy to derive them from. `gate()` gives it a dedicated branch (checked
after the parsed-success case and before the opaque case, since a rejected verdict has no `result` field
and would otherwise silently fall through to `opaque`) with its own rationale sentence, and marks the gate
predicate's matching input `{ rejected: true, proposed: 'canary' }`.

**Ceiling stays `canary` — identical to absent and opaque.** This is not a stricter or looser decision, only
a more honest one: honesty guard #1 (the gate predicate never lets producer-supplied prose or a malformed
tally drive anything beyond the category it already derives) is unaffected, because `rejected` still isn't
read for *anything* beyond disclosure. No new path to `ship` opens.

**The rejected bytes are still content-addressed.** Only a truly never-sent emission contributes no
subject; a rejected-but-received one is hashed into `bundle.subject[]` exactly like a valid one would be —
the CLI ingested these bytes and made a decision informed by their absence-of-trust, so they belong in the
same evidentiary record.

**A markdown report riding alongside a rejected JSON attaches to the rejected entry as a byproduct**, rather
than instead of it. The alternative — falling back to the separate `auditTestEntry(md)` opaque path when a
markdown report is available — was rejected: it would silently re-bury the rejection behind a *different*
"present but opaque, human must read it" framing, the same class of silent-downgrade this fix exists to
close. `gate()` only ever reads the first `audit-test`-stage entry it finds, so the two paths can't coexist
as separate entries without one shadowing the other; rejected wins because it carries the stronger signal.

### 2. Schema bump: v0.6 → v0.7, additive

`rejected: { type: 'boolean' }` is added to the gate predicate's `inputs[].properties`
(`schema/evidence-bundle.v0.schema.json`), which has `additionalProperties: false` — so this is a real
shape change to a locked object, not a free-form extension, and needs the version bump `validateBundle`
already enforces exact-match on (same "regenerate, don't migrate" precedent as every prior bump: ADR-0031,
ADR-0033, ADR-0034, ADR-0037, ADR-0040). The committed signed fixture (`fixtures/gate-bundle.signed.json`)
is regenerated under v0.7 with the demo key. The bump is additive only — a bundle that never uses
`rejected` validates identically to a v0.6 one — and introduces no numeric field, so it doesn't collide
with the reserved MAJOR-bump signal for calibration (#129).

### 3. `--max-age` is opt-in with **no default** — deliberately, unlike the examined/executed floors

The examined-floor (ADR-0035) and executed-floor (#157) both ship with a defensible default (50%, clamped to
a 25% minimum) because "half the population" is a coherent, context-independent floor regardless of what
the suite or the audit actually is. A staleness threshold has no equivalent universal default: a legitimate
CI run that takes two hours and a genuinely stale leftover report from a crashed job two hours ago are
indistinguishable without a number only the operator can supply. Guessing one (even a generous one) would
retroactively change the decision for every existing user who never asked for a freshness check, the first
time this shipped — the opposite of the "never silently trust it, but never silently surprise either"
discipline the rest of this file holds itself to. So `resolveMaxAgeMinutes` returns `null` (no check) unless
a valid positive number is explicitly passed, and an invalid value disables the check rather than guessing
one, the same "clamp or disable, never silently coerce" treatment `resolveExaminedFloor`/
`resolveExecutedFloor` already get for out-of-range input.

**The comparison is against the bundle's own `producedOn`, not the named `--commit`.** Both were named in
the finding ("compare startTime against a `--max-age` and against the commit timestamp"); this ADR only
takes the first half. `producedOn` is a field the bundle already carries (set once, at assembly time, in
the CLI wrapper) — comparing an execution entry's `startedOn` against it needs no new I/O and keeps `gate()`
a pure function of the bundle it's given, with no wall-clock read inside the decision function itself.
Binding a report to the specific commit would need Gate to independently resolve that commit's own
timestamp (a `git show -s --format=%cI <commit>` shell-out, done once in the CLI wrapper, the only place
that already talks to the filesystem/subprocesses) and is deliberately deferred as a distinct, not-yet-scoped
follow-up — see `docs/roadmap.md` item 3 and `gate/SKILL.md`'s "Report freshness" note, both of which say so
plainly rather than let the gap go unstated as it did before this ADR.

**No schema change.** Same treatment the executed-floor cap already gets: `result === 'PASSED'` with
`proposed === 'canary'` is a sufficient, schema-stable signal for the report to key off (the human-readable
"why" lives only in rationale prose), so staleness needed no new field on the gate predicate.

## Considered options

- **Give `rejected` a default ceiling below `canary` (i.e. treat it as worse than absent/opaque).** Rejected
  — a rejected emission is not evidence the tests are *worse*, only that Gate can't currently trust the
  self-report; punishing it below the existing "no evidence" floor would conflate a producer bug with actual
  credibility failure, which the theater guard (#127/ADR-0035) already handles on its own terms.
- **Fold `rejected` into the existing `opaque: true/false` boolean as a third value (e.g. a string enum).**
  Rejected — `opaque` is documented and consumed elsewhere as a strict boolean; overloading it would be a
  silent behavior change for anything already reading `opaque === true` as "a markdown report rode in,"
  which is not what a rejected JSON emission is.
- **Default `--max-age` to some value (e.g. 60 minutes) instead of `null`.** Rejected for the reasons in
  Decision 3 above — no universal default is honest across arbitrary CI setups, and a default would silently
  change existing users' decisions on the version bump that shipped it.
- **Have `--max-age` shell out to `git show` against `--commit` in this same change**, closing finding #3
  completely in one pass. Deferred, not rejected outright — it's a reasonable next step, but it adds a new
  subprocess dependency to the hot path (today's only shell-out, the `--certify` self-test, is test-only) and
  a new failure mode (missing/unreachable git) that deserves its own scoping rather than riding along here.
  **Superseded by [ADR-0043](0043-report-to-commit-provenance-over-git-timestamp.md) (2026-07-25):** on
  re-examination this timestamp cross-check is *rejected* as the mechanism — it doesn't even catch the target
  wrong-commit-fresh-report case, and its only usable signal false-positives the test-then-commit local
  workflow. The commit-binding closure is producer-recorded SHA provenance, deferred to v2. Do not build the
  git-timestamp check.

## Consequences

- **Two ship-adjacent verdicts of different evidential weight no longer collapse into the same disclosure.**
  A rejected emission and a genuinely absent one now read differently everywhere that matters: the rendered
  report, the persisted bundle, and (if signed) the signed artifact itself.
- **The credibility axis has four states, not three**, in every place that enumerates them (`gate/SKILL.md`,
  the JSON schema, `renderReport`). Anything reading `gateEntry.predicate.inputs` for the audit-test stage
  must now handle `rejected` alongside `opaque`/`absent`/parsed — call sites in this repo were updated;
  external consumers of a v0.6 bundle are unaffected (the field is additive and optional).
- **`--max-age` closes the most common instance of finding #3** (a stale leftover report) **but not the
  general case** (a fresh-looking report from the wrong commit). That gap is now stated plainly in three
  places instead of left implicit, which is itself the point of writing it down here.
- **No decision-logic regression for any bundle that doesn't use the new field or flag** — self-test proves
  `--max-age` unset behaves byte-for-byte as before, and `rejected` floors at exactly the ceiling `absent`
  always had.
