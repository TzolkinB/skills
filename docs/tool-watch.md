# External tool watch — baseline

Source of truth for the automated competitive/adjacent-tool watch. Two cloud routines read and
update this file: a weekly deterministic registry/release diff (Job 1) and a monthly WebSearch
discovery sweep (Job 2, advisory-only — does not write here). Manual edits are fine; routines
diff against whatever this file last said, not against their own memory.

Format per tool: check method, current baseline, last-checked date. `last-checked` moves forward
each time Job 1 runs, whether or not anything changed.

## Known tools (Job 1 — weekly deterministic check)

| Tool | Check | Baseline | Last checked |
|---|---|---|---|
| StrykerJS | npm `@stryker-mutator/core` dist-tags.latest | 9.6.1 (113 versions, modified 2026-05-13) | 2026-07-22 |
| Tautest | npm `tautest` dist-tags.latest | 1.10.1 (10 versions, modified 2026-06-04) | 2026-07-22 |
| Exspec | GitHub `mnapoli/exspec` releases API, latest tag | 0.1.7 (11 releases, published 2026-04-13) | 2026-07-22 |
| TEA (BMAD Test Architect) | GitHub `bmad-code-org/bmad-method-test-architecture-enterprise` releases API, latest tag | v1.19.1 (30 releases, published 2026-07-17) | 2026-07-22 |
| Playwright test agents | GitHub `microsoft/playwright` releases API, latest tag + grep release body for `planner`/`generator`/`healer`/`agent` | v1.61.1 (published 2026-06-23; agents feature landed 1.56; latest release body has no agent-keyword hits) | 2026-07-22 |
| Cypress AI (`cy.prompt`) | raw `cypress-io/cypress` `develop/cli/CHANGELOG.md`, top version + grep recent entries for `prompt`/`AI` | 15.19.1 at top of changelog | 2026-07-22 |
| Kane / LambdaTest (`kane-cli`, `evidence-cli`) | npm `@testmuai/kane-cli` + `@testmuai/evidence-cli` dist-tags.latest; GitHub `LambdaTest/evidence-cli` HTTP status; `evidence-cli.dev` DNS | kane-cli 0.6.2; evidence-cli 0.1.6 (5 versions); repo 404 (private/nonexistent); DNS NXDOMAIN | 2026-07-17 (existing routine; not re-checked this pass) |

Notes:
- Playwright and Cypress checks are proxies (whole-product version, not an "agents-only" or
  "AI-only" release channel) — the grep step is what catches an agent/AI-relevant entry inside a
  general release. A version bump alone is low-signal for these two; a keyword hit is the real
  trigger.
- A WebSearch sanity pass during setup (2026-07-22) claimed Cypress was at v16.0.0. The raw
  changelog said 15.19.1. The raw source wins — this is why Job 1 is curl-only, no LLM-search
  step, for every known-tool check.

## Discovery log (Job 2 — monthly, advisory only)

New-tool candidates surfaced by the WebSearch sweep land here as dated bullets for manual triage.
Nothing in this section is a commitment to track the tool — promote a candidate to the table above
only after a human adds a real check method.

- (empty — first sweep not yet run)
