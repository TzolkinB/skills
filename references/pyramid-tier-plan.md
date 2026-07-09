# Pyramid Tier Awareness Plan (Sentinel 2)

This file captures the tiering strategy that was migrated from the older `sentinel/` folder and implemented in Sentinel 2.

## Intent

Shift test-layer decisions left into `/test-plan` so tier placement happens before tests are written.

## Implemented in Sentinel 2

### `skills/test-plan/SKILL.md`
- Every case in Happy Path / Edge Cases / Unhappy Paths receives a layer recommendation:
  - `unit`
  - `component`
  - `integration`
  - `e2e`
- Layer heuristics were added.
- Output template now shows layer labels per case.

### `skills/sentinel/SKILL.md`
- Sentinel now aggregates layer recommendations and reports a one-line distribution in Test Plan Coverage:
  - `Layers: X unit / Y component / Z integration / N e2e`

## Existing-project adoption

Sentinel 2 handles this with the bootstrap section in `README.md`:
- classify a small critical-path subset first,
- record baseline layer distribution,
- use `/sentinel` distribution line as drift signal per PR.

This avoids creating a separate recurring audit skill inside Sentinel while still supporting mature repos.

> **Scope note.** "No separate recurring audit skill" here means *tier drift* — watching the unit/component/integration/e2e mix per PR, which the `/sentinel` distribution line already covers. It does **not** rule out recurring *test-debt* pruning, which is a different job (suite-level economy, not layer placement). `prune-tests` is the deliberate exception; see [ADR-0002](../docs/adr/0002-prune-tests-proposes-before-deleting.md).
