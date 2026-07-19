# Rename the internal `witness://` identifiers to `gate://` — schema v0.1/v0 → v0.2/v0.1

**Status: Accepted (2026-07-19).** Completes the deferred item in [ADR-0032](0032-flatten-to-single-kimbell-skills-plugin.md#considered-options) ("Rename the internal identifiers too, now" — deferred there, done here) and finishes resolving [#113](https://github.com/TzolkinB/skills/issues/113): ADR-0032 collapsed the "Witness" *brand* to "Gate" in user-facing prose; this ADR renames the *internal* identifiers the brand pass deliberately left alone because they're plumbing behind the honesty-guarded self-test and the [ADR-0031](0031-witness-evidence-bundle-v0.1-empty-result.md) contract.

## Context

ADR-0032 retired "Witness" everywhere a human reads it — the SKILL prose, the printed report header, the eval samples. It explicitly left four things unrenamed, flagged as a deliberate follow-up: the script filename (`witness.mjs`), the producer-id namespace (`witness://playwright@1.x`, etc.), the predicate-URI domain (`witness.local`), and the two schema identifiers (`witness-evidence-bundle/v0.1`, `witness-audit-test/v0`). Those are exact-match constants the self-test and the JSON-Schema contract both pin — changing them is a contract event, not a brand edit, so it needed its own deliberate pass rather than riding on the prose sweep.

Leaving them unrenamed indefinitely would mean the one artifact a hostile reviewer is most likely to open — the actual evidence bundle a `/gate` run produces — still says `witness-evidence-bundle` and `witness://audit-test@0.x` after the product had otherwise dropped the name. That's the exact "headline vs. fine print" mismatch the pre-launch critique existed to catch, just relocated to the JSON instead of the README.

## Decision

**1. Rename the script.** `skills/gate/witness.mjs` → `skills/gate/gate.mjs` (`git mv`). Every invocation — the SKILL.md command examples, the `.github/workflows/skill-evals.yml` CI step, the eval samples, `evals/cases/gate.json` — updated to match.

**2. Rename the producer/predicate namespace.** `witness://playwright@1.x` / `witness://cypress@1.x` / `witness://audit-test@0.x` / `witness://gate@0.x` → the same shape under `gate://`. `witness.local` → `gate.local` in both predicate-type URIs (`.../evidence/qa-stage/v0`, `.../gate/v0`) and both schema `$id`s. The real external type — `https://in-toto.io/Statement/v1` — is untouched; it was never a "Witness" identifier.

**3. Rename and bump both schema constants — MINOR, not MAJOR.**
   - Bundle: `witness-evidence-bundle/v0.1` → **`gate-evidence-bundle/v0.2`**.
   - Emission: `witness-audit-test/v0` → **`gate-audit-test/v0.1`**.

   Same logic as ADR-0031: an exact-match `const` is the contract, so changing its string is a version event even though nothing about the *data model* moved — a producer still emitting the old string must be rejected, not silently accepted. This stays firmly in the reserved-MAJOR-for-calibration lane ([ADR-0031](0031-witness-evidence-bundle-v0.1-empty-result.md), honesty guard #3): a rename with no numeric field and no data-model change is the textbook MINOR case, and v1.0 stays reserved for the confidence/calibration re-architecture.

**4. Rename the default output filename.** `witness-bundle.json` → `gate-bundle.json` (the `--out` default in `gate.mjs`).

**5. Schema *filenames* are unchanged** (`evidence-bundle.v0.schema.json`, `audit-test-emission.v0.schema.json`) — same precedent as ADR-0031: the file denotes the v0.x family; the version identity lives in `schemaVersion`/`$id`, not the path.

**6. Fixed two double-rename artifacts** the earlier blind `Witness`→`Gate` prose sweep left behind (`audit-test/SKILL.md`'s "for Gate / the Gate" and "(`/gate`, Gate)"; `evals/cases/gate.json`'s "the Gate (the Gate skill)"; `fixtures/gate/expected-findings.md`'s title) — caught while touching the same lines for the identifier rename, not a separate pass.

## Considered options

- **Leave the internal identifiers alone indefinitely.** Rejected — this is exactly the deferred item ADR-0032 flagged; leaving it stale means the one artifact most likely to draw a hostile reviewer's eye (the evidence bundle itself) contradicts the retired brand everywhere else.
- **Rename without a version bump** (treat it as a pure refactor with no contract consequence). Rejected — both constants are exact-match values a validator and a self-test pin; a producer built against the old string must fail loudly, not pass silently. Precedent (ADR-0031) already established that any `const` change is a version event.
- **Bump to v1.0 / v1** (treat the rename as the "real" release). Rejected — v1.0 is reserved specifically for the confidence/calibration re-architecture (ADR-0031, honesty guard #3); spending it on a rename would blur that signal for the one bump that's actually supposed to mean something structural.
- **Rename the schema files too** (`evidence-bundle.v0.2.schema.json`). Rejected — same reasoning as ADR-0031: churns every SKILL/ADR link for no semantic gain; the version lives in the content, not the path.

## Consequences

- **Breaking for any existing bundle/emission** — a `witness-evidence-bundle/v0.1` bundle or a `witness-audit-test/v0` emission no longer validates; this is intentional (see Decision §3) and acceptable pre-launch (no released consumers, same-repo atomic change).
- **Verified:** gate self-test 81/81 (all string literals — including the deliberately-bogus-version rejection test — updated to the new names, not just find-replaced blind), `evals/lint.mjs` and `evals/changed.mjs` self-tests, all touched JSON valid, all 3 gate eval samples resynced to the renamed script/schema strings.
- **Historical ADRs (0028–0031) are left untouched** — they're the accurate record of what was true when they were written, matching the ADR-0006 precedent of annotating rather than rewriting history. ADR-0032's two stale "deferred" mentions are annotated forward to this ADR.
- **Residual scope, unchanged from ADR-0032:** the ~35-file contextual "Sentinel" de-brand is still a separate follow-up; this ADR only completes the `witness://`→`gate://` half.
