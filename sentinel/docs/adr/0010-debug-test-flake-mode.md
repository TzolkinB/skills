# debug-test gains a flake mode that detects, quarantines, and routes — it does not rebuild the runner

Flaky tests are the one failure category `debug-test` handled only rudimentarily: run it a few
times, and if it's non-deterministic, hand off to `qa-review`. The
[market analysis](../../../references/judgement_layer_skills.md) and everyday practice both show the
real gap is *disposition*: teams meet a flaky test with `.skip()` or deletion — silent capitulation.
That throws away a real signal, because a flaky test usually guards real behavior, so skipping it
lets a genuine regression ship with invisible coverage loss. Teams do it anyway because they have no
workflow for what *else* to do.

Two things could go wrong building this: (1) reinventing a bespoke re-run engine when frameworks
already ship burn mechanisms, and (2) letting the skill assert a *cause* it can't actually prove from
repeat runs — the exact false-confidence failure the suite exists to kill, one level up.

## Decision

Fold a **flake mode** into `debug-test` (not a tenth skill) with three parts, in order of how
reliable each is:

- **Detect — consume the framework's own burn, never a custom loop.** Playwright `--repeat-each=N`,
  or the JSON reporter's `status: "flaky"` when retries are configured; Cypress `@cypress/grep
  --burn=N`. Compute a flake rate (failures / runs). `0/N` isn't flaky; `N/N` is a deterministic
  failure routed back to normal diagnosis; in-between is confirmed flake.
- **Quarantine — non-blocking, never deleted.** Recommend tagging / a quarantine lane so CI stops
  blocking but the test keeps running and reporting. Never `.skip()`-and-forget, never delete.
- **Route the cause — a suggestion, not a verdict.** Source non-determinism → `qa-review`;
  over-mocked / timing-coupled → `audit-test` (which can *prove* it never tested anything) →
  `prune-tests` to remove it with justification; genuinely redundant → `prune-tests`.

## Why this shape

- **Don't rebuild what exists.** The frameworks already re-run tests; the durable value is the
  judgment layer — rate, disposition, and routing — not another runner. Building one would be
  the heavyweight overhead the suite deliberately avoids everywhere else.
- **Scope honesty (v1 = detect + quarantine).** Those two are mechanical and reliable. *Cause*
  classification is hard to infer from repeat runs, so it is presented as a ranked hypothesis routed
  to the skill that can actually confirm it — never dressed up as this skill's verdict. This keeps
  `debug-test` from making the false-confidence claim the suite exists to expose.
- **Quarantine over deletion, by division of labor.** Preserving the signal is the whole point;
  removing a test is a *subtractive* decision that belongs to `prune-tests`, and only *after* a cause
  is confirmed (e.g. `audit-test` proves the test guards nothing). Flake mode never deletes.

## Consequences

- `debug-test` gains a `--flake` trigger (and Step 1 auto-routes to flake mode on mixed pass/fail);
  its old "run 3× / hand to qa-review" flakiness handling is replaced by this workflow.
- New routing edges into `qa-review`, `audit-test`, and `prune-tests` — reusing existing skills
  rather than duplicating their logic.
- Cypress enters as a secondary burn source; Playwright remains primary and the skill stays
  Playwright-scoped for its non-flake paths.
- No bespoke re-run engine, and no new `allowed-tools` — it uses the `Bash`/`Read` access it already
  has to invoke the framework's burn and read the result.
