# A `--live` eval fixture that needs real, runnable code materializes as a permanent, never-merged git ref — `fixture_ref` checks it out instead of `HEAD`

**Status: Accepted (2026-08-06).** Decides how `sentinel`'s test↔code pairing fixture ([#210](https://github.com/TzolkinB/skills/issues/210), narrowed from [#188](https://github.com/TzolkinB/skills/issues/188)) gets real content for the `--live` eval tier — the one architectural choice #210 left open ("Either add a `fixture_ref` case field, or land the fixture on the default branch under a fixture dir and point the case at it").

## Context

`--live` (wired by [ADR-0026](0026-live-evals-opt-in-pr-and-scheduled-drift.md)) spins an isolated `git worktree add --detach wt HEAD` and runs a real agent against whatever's checked out there. That hardcoded `HEAD` is fine for every existing case — they either need no fixture content (routing/prose cases) or read a fixture file directly off the current checkout via `$(cat …)` substitution. `sentinel`'s pairing fixture needs more: a **runnable JS project** (`step 7`'s test↔code pairing only exercises for real when `/audit-test` can actually mutate source and run a test), with **real commits and a merge-base** (so `/audit-test --changed`'s `git diff main...HEAD` has something to diff), sitting somewhere `--live` can reach.

`main` itself can't hold it as a plain committed fixture directory: `/audit-test --changed` needs a diff *against* `main`, so the content can't already be on `main` without inventing a second, artificial base ref anyway. And scattering a throwaway src/payments/**, src/reports/**, package.json across the repo root — even briefly, even reverted — pollutes the one thing this repo has kept clean since inception: it is a skills/docs repo with no application code at its root.

## Considered options

- **Land the fixture on `main` under a fixture directory** (the issue's second option — e.g. `fixtures/sentinel/live/`), and point the case at a synthetic base commit or a shallow diff trick. Rejected: still needs *some* second ref to diff against (a merge-base can't exist against a repo's own tip), so it doesn't actually avoid inventing a ref — it just hides it. It would also permanently plant a runnable Node project's `package.json` at a non-root path, which nothing else in the repo does, purely to serve one eval case.
- **A synthetic-input mode for `/sentinel`** (teach the skill to accept fabricated sub-skill output). Already rejected in #188 as a shipped-skill eval-only affordance and a copy-forward, not a derivation — not reconsidered here.
- **Chosen: a dedicated permanent branch (`fixture/sentinel-payments-refund`), never merged into `main`, checked out via a new case-level `fixture_ref` field.** `evals/run-eval.mjs`'s `runInIsolatedWorktree` now does `git worktree add --detach wt (c.fixture_ref ?? 'HEAD')` — every existing case is unaffected (no `fixture_ref` → unchanged `HEAD` behavior). The branch carries its own `package.json` (`node --test`, zero dependencies — no `npm install` step exists anywhere in the harness, so a dependency-bearing test runner would silently never be available in the isolated worktree) and the real `src/payments/refund.js`/`refund.test.js` + `src/reports/export.js`/`export.test.js` pair, branched off `main`'s tip so its merge-base is real and `git diff --name-only main...HEAD` shows exactly the intended files.

## Decision

A `--live` fixture that needs runnable, diffable, committed content lives on its own permanent branch, named `fixture/<skill>-<scenario>` — a prefix distinct from every in-flight work prefix (`feat/`, `fix/`, `chore/`, `docs/`) this repo already uses, specifically so a future branch audit (per the stale-branch confusion this repo has hit before) doesn't mistake it for abandoned work and delete it. It is:

- **Pushed to `origin`**, so it's a real, shared, fetchable ref — not something that only exists in one contributor's local clone.
- **Never merged.** It has no PR, no review cycle toward `main`; its content is reviewed the same way any other fixture is (this ADR + the fixture's own commit message + `fixtures/README.md`'s row for it).
- **Referenced from a case's `fixture_ref`**, which `--live` resolves at worktree-creation time. `fixture_files` is untouched by this and keeps its pre-existing, purely documentary role across all 14 cases (never read by any code path) — it still names the human-readable scenario doc (`branch-scenario.md`), which now documents the spec the branch's real files were built from, not a stand-in fed to the run.

## Consequences

- **`main` stays a docs/skills repo with no application code at its root**, even though `--live` now genuinely runs `node --test` mutations against a real project — the tree that carries that project never touches `main`'s history.
- **A second live fixture (for a different skill) reuses this exact mechanism** — add a branch, add `fixture_ref` to its case — with no further harness change.
- **The branch is a maintenance surface future contributors need to know not to delete.** Named and documented (this ADR, `fixtures/README.md`'s "Live branch fixture" kind) specifically to survive a branch-cleanup pass; if that proves insufficient in practice, tightening this to a `refs/fixtures/*` namespace outside normal branch listings is the natural next step, deferred until a real collision happens.
- **Reversible.** Deleting the branch and the `fixture_ref` field returns `--live` to `HEAD`-only exactly as it worked for every other case before this ADR.
