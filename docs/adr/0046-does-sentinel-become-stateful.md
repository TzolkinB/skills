# Does Sentinel become a stateful tool?

**Status: Proposed (2026-07-29) — undecided, needs a maintainer call.** Tracked as [#200](https://github.com/TzolkinB/skills/issues/200). This ADR does not decide
anything. It names a fork that three separate issues have each been parked on without any of them
naming it, so the shared dependency stops being invisible. No code changes.

## Context

Every skill in this repo is **stateless across sessions**. A skill reads files, reasons, emits a
report, and forgets. That is a real design property, not an accident: it keeps skills independently
invokable, makes them trivially reviewable, and avoids a store that would itself become the kind of
debt `prune-tests` exists to remove.

Three parked items each need the opposite, and each was parked separately:

| Item | What it needs memory for |
|---|---|
| [#129](https://github.com/TzolkinB/skills/issues/129) — calibration loop | A history of gate decisions and human overrides to calibrate against. Explicitly parked because "it needs the categorical gate to have been in real use first to have anything to calibrate against." |
| [#194](https://github.com/TzolkinB/skills/issues/194) — heal-ledger | Prior heal events, to detect the *pattern* across heals. The issue names itself "the first stateful/longitudinal feature, the same class Gate's roadmap parked calibration and report-to-commit provenance for." |
| Repeat-offender / longitudinal reporting generally | Any "has this happened before?" question. |

**[#177](https://github.com/TzolkinB/skills/issues/177) is deliberately excluded.** Producer-recorded
SHA provenance rides *inside* the report; it needs no store. #194 groups it as the same longitudinal
class, but on the persistence axis it is not — it is provenance, and it should not be blocked on this
decision.

Also excluded: **business-risk coverage**, which looks longitudinal and isn't. Per
[ADR-0045](0045-business-risk-coverage-is-a-join-not-a-register.md) it is a stateless join over two
files at gate time.

So the real question, asked once instead of three times:

> **Does this repo ever own a persistent store — or is statelessness a permanent property?**

## The fork

**Option A — stay stateless (permanent property).**

- #129 and #194 don't get built in their current shape.
- Every claim about calibration retires from all copy, permanently rather than "parked."
  `positioning.md` already forbids describing it as live; this would make that final, and
  `comparisons/tea.md`'s "Gate becomes the memory, fed by TEA's own audit trail" seam would need
  rewriting or deleting.
- Longitudinal questions route to tools that already own them (CI history, TEA's WAIVED audit trail,
  a test-management system of record).
- **Cost:** gives up the one differentiator no competitor has. `comparisons/tea.md` currently names
  calibration as the second of two things TEA structurally can't do.

**Option B — adopt a persistence layer (one decision, two unlocks).**

- Settle *once*: location, format, normalization, retention. Both #129 and #194 then become ordinary
  builds rather than blocked design questions.
- **Cost:** a genuine category change. A store must be versioned, migrated, retained, and reviewed;
  it can leak information into a repo; and it breaks the "each skill is a self-contained prose
  reader" property that makes these skills easy to trust and audit.

## Open questions either way (from #194, which thought hardest about it)

1. **Location** — committed and team-visible (the thing that makes it valuable) vs. gitignored local
   cache (no PR-diff noise, but mostly defeats the point). #194 leans committed.
2. **Format** — append-only NDJSON so it stays diffable and merge-safe.
3. **Signature normalization** — raw error text will not fingerprint stably; line numbers, UUIDs and
   timestamps defeat matching. Normalize structurally or not at all.
4. **Retention** — a ledger only grows. Last-K-per-test or a TTL, decided up front.
5. **Provenance anchoring** — anchor on git SHA the way Gate already does, so this composes with #177
   rather than inventing a second scheme.

## Recommendation (not a decision)

Decide **Option A or B explicitly before either #129 or #194 is scheduled**, and record the outcome by
superseding this ADR. Leaving it implicit is the current state, and its cost is concrete: three issues
sit open against an unnamed dependency, and outward copy keeps a calibration promise the repo has not
committed to keeping.

If forced to a lean: **A is the honest default.** Statelessness is a shipped, defensible property, and
Option B's cost lands on the exact axis this repo sells — auditability. B should require a specific,
named use case that a user has actually asked for, not the general appeal of "we could learn over
time."

## Consequences

- Until decided, **#129 and #194 stay parked**, and neither should be presented as near-term.
- **No outward-facing surface may describe calibration as a live or imminent capability**
  ([`positioning.md`](../positioning.md), "claims we must not make").
- Whichever way it goes, `comparisons/tea.md`'s calibration seam needs revisiting — it currently
  promises Gate "becomes the memory."
