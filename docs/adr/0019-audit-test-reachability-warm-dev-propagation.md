# audit-test reachability covers warm dev-server propagation, not just a stale build

**Status: Accepted (2026-07-13).** A sibling refinement of
[ADR-0016](0016-audit-test-reachability-guard.md), prompted by a blind credibility check of
`audit-test` on an app it did not author. Same invariant, one more failure mode.

## Context

[ADR-0016](0016-audit-test-reachability-guard.md) gates a 🔴 behind a reachability check: apply a
*maximal control mutation*, run the one test, and if it **survives**, the harness is not source-live,
so report 🟡 rather than a false 🔴. That models reachability as **binary** — either the running
artifact reflects `src/` edits (a dev server) or it never does (a stale `build && preview`, a deployed
URL).

A blind credibility check on **2026-07-13** (Epic Stack — a Vite-dev-served Playwright app) surfaced a
**third state the binary model doesn't capture**: a warm dev server *is* source-live, but it propagates
an edit **asynchronously** (HMR / server-module reload), so within a *single* test run a mutation can
be live for some assertions and not for others.

Concretely: auditing a users-search test with the mutation `like = '%%'` (search returns *all* users),
the test's **negative** assertion ("nonexistent term → no users found") reliably caught the break, but
the **positive** `toHaveCount(1)` assertion — which runs *earlier* in the same test — passed even
though the SQL provably returned all 9 users. Across two runs (including a ~4s settle) the mutation
appeared active for the later assertion but not the earlier one. The exact reload mechanism was not
pinned; the **observable** is that propagation is neither instantaneous nor ordered relative to the
test's assertions.

Why this re-opens the door ADR-0016 closed, by a different route:

- A test whose meaningful assertions run *before* the mutation propagates would **survive** the
  mutation for the wrong reason (not-yet-live), and `audit-test` would record a **false 🔴** on a solid
  test — the exact outcome ADR-0016 exists to prevent.
- ADR-0016's own **control probe is not immune**: if the control mutation hasn't propagated when the
  probe runs, the probe **survives** → `audit-test` reports 🟡 (thinking stale harness) on a harness
  that is actually fine — a **false 🟡**. Reachability judged mid-propagation is unreliable in *both*
  directions.

The binary model assumed reachability is *stable for the duration of a run*. On a warm dev server it
is not.

## Decision

Generalize the reachability invariant from **"is the harness serving a stale build?"** to **"is the
mutation *confirmed live in the running target for the whole test run* before its survival is
trusted?"** — and add the warm-dev case:

For an **app-driven, dev-served** target (Vite/webpack dev server, HMR, watch-mode SSR), do **not**
trust in-place propagation. Before running the mutated test **or** the ADR-0016 control probe, force
the mutation live, by the cheapest available of:

1. **Run against a fresh-boot-per-run harness.** If the harness boots the app fresh from current
   source on each run (a built/CI server, or a container per run), the mutation is guaranteed live
   before the test starts and the propagation race cannot occur. This is the **demonstrated fix**: the
   same exercise on Cypress-RWA via `cypress/included` — app booted fresh *inside the container* each
   run — caught a hollow test cleanly (a true 🔴) with reachability confirmed, no propagation
   nondeterminism.
2. **Restart / hard-reload the dev server after mutating**, then wait for ready, before running. (The
   reasoned, cheaper alternative — *not* demonstrated the way option 1 was; prefer option 1 where a
   fresh-boot harness is available.)

Only after the mutation is confirmed live does ADR-0016's caught/survived logic apply. **A survival
that was not confirmed live is not a 🔴** — it is an inconclusive run; force the mutation live and
re-run (or fall back to 🟡), never record the confident verdict off a propagation race.

This preserves ADR-0016's ethos — prove reachability by execution, refuse rather than guess — while
closing the gap the binary model left open.

## Considered options

- **Add a settle/delay after mutating and hope HMR propagates.** Rejected — the 2026-07-13 run added a
  ~4s settle and the race persisted. A timing guess is precisely the flakiness this skill exists to
  kill; determinism (fresh boot) beats a `sleep`.
- **Always require a built / fresh-boot harness for every app-driven audit.** Rejected as the default —
  a dev server is the cheap, source-live happy path for most audits ([ADR-0016](0016-audit-test-reachability-guard.md)
  already blesses it). Only *escalate* to fresh-boot when a **survival must be promoted to 🔴** on a
  dev-served target.
- **Do nothing / document the caveat only.** Rejected for the same reason as ADR-0016: a silent false
  🔴 is the worst outcome for a tool whose entire value is that a 🔴 is trustworthy.

## Consequences

- **Reachability becomes cause-agnostic.** The guard no longer reasons about *why* a mutation didn't
  reach (stale build vs propagation lag) — it requires the mutation *confirmed live for the run* before
  a 🔴. One invariant now covers both ADR-0016's stale-build case and this warm-dev case.
- **Fresh-boot-per-run harnesses are the robust substrate for app-driven auditing.** The Cypress-Docker
  single-container pattern (app + runner sharing one fresh boot) is the reference; a built CI server
  serves the same role. Dev servers stay fine for the common case where a survival is not being
  promoted to 🔴.
- **Cost is escalation-only.** Unit tests and non-dev-served app targets are unaffected. Only a
  *candidate 🔴 on a dev-served target* pays the fresh-boot/restart cost — funnel-bounded, like the
  ADR-0016 probe it extends.
- **Evidence, honestly labelled.** Existence proof from the 2026-07-13 credibility check — Epic Stack
  (nondeterministic propagation observed; exact mechanism unresolved) + Cypress-RWA Docker (fresh-boot
  mitigation demonstrated). Tracked in issue #54; held to the
  [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md) provenance discipline.
