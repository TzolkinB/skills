# External tool watch — baseline

Source of truth for the automated competitive/adjacent-tool watch. Two cloud routines read and
update this file: a weekly deterministic registry/release diff (Job 1) and a monthly WebSearch
discovery sweep (Job 2, advisory-only — does not write here). Manual edits are fine; routines
diff against whatever this file last said, not against their own memory.

Format per tool: check method, current baseline, last-checked date. `last-checked` moves forward
each time Job 1 runs, whether or not anything changed.

Every known-tool check reaches only `registry.npmjs.org` and `raw.githubusercontent.com` — never
`api.github.com` or `github.com`. The cloud session's outbound GitHub access is proxy-scoped to
`TzolkinB/skills` only, so any request to another repo's GitHub-API/HTML endpoint 403s; npm and
raw-content are not scoped and work for any public repo. See the Notes section.

## Known tools (Job 1 — weekly deterministic check)

| Tool | Check | Baseline | Last checked |
|---|---|---|---|
| StrykerJS | npm `@stryker-mutator/core` dist-tags.latest | 9.6.1 (113 versions, modified 2026-05-13) | 2026-07-25 |
| Tautest | npm `tautest` dist-tags.latest | 1.10.1 (10 versions, modified 2026-06-04) | 2026-07-25 |
| Exspec | npm `@mnapoli/exspec` dist-tags.latest | 0.1.7 (11 versions) | 2026-07-25 |
| TEA (BMAD Test Architect) | raw `bmad-code-org/bmad-method-test-architecture-enterprise` `main/package.json` version | v1.19.1 | 2026-07-25 |
| Playwright test agents | raw `microsoft/playwright` `main/docs/src/release-notes-js.md`, top `## Version` block + grep it for `planner`/`generator`/`healer`/`agent`; npm `@playwright/test` dist-tags.latest for the version number | v1.62 (published 2026-07-24; agents feature landed 1.56; 1.62 block has no agent-keyword hit) | 2026-07-25 |
| Cypress AI (`cy.prompt`) | raw `cypress-io/cypress` `develop/cli/CHANGELOG.md`, top version + grep recent entries for `prompt`/`AI` | 15.19.1 at top of changelog | 2026-07-25 |
| Kane / LambdaTest (`kane-cli`, `evidence-cli`) | npm `@testmuai/kane-cli` + `@testmuai/evidence-cli` dist-tags.latest; raw `LambdaTest/evidence-cli` `HEAD/package.json` HTTP status (404 = repo still private/absent, 200 = went public); `evidence-cli.dev` DNS | kane-cli 0.6.6; evidence-cli 0.1.7 (6 versions); repo raw-status 404 (still private); DNS NXDOMAIN | 2026-07-25 |

Notes:
- Playwright and Cypress checks are proxies (whole-product version, not an "agents-only" or
  "AI-only" release channel) — the grep step is what catches an agent/AI-relevant entry inside a
  general release. A version bump alone is low-signal for these two; a keyword hit is the real
  trigger.
- A WebSearch sanity pass during setup (2026-07-22) claimed Cypress was at v16.0.0. The raw
  changelog said 15.19.1. The raw source wins — this is why Job 1 is curl-only, no LLM-search
  step, for every known-tool check.
- GitHub-API scope: the cloud session's outbound GitHub access (`api.github.com` and `github.com`)
  is proxy-scoped to `TzolkinB/skills` only — any other repo's GitHub endpoints 403 regardless of
  `$GITHUB_TOKEN`. This is a standing session-level restriction, not a signal about the tools. All
  external-repo checks therefore route around it entirely: `registry.npmjs.org` and
  `raw.githubusercontent.com` are not scoped and serve any public repo. That is why Exspec/Kane use
  npm, and TEA/Playwright/Cypress read `raw.githubusercontent.com`. The two previously-blocked legs
  now covered this way: Playwright's release-body grep (2026-07-23 it hit the 403 via the releases
  API; now reads `release-notes-js.md` raw) and Kane's repo-public check (was `github.com` HTTP
  status; now `raw.githubusercontent.com` HTTP status on a repo file). The routine still writes to
  `docs/tool-watch.md` and issue #144 via the GitHub Contents/Issues API — those are in-scope
  (`TzolkinB/skills`) and unaffected.

## Discovery log (Job 2 — monthly, advisory only)

New-tool candidates surfaced by the WebSearch sweep land here as dated bullets for manual triage.
Nothing in this section is a commitment to track the tool — promote a candidate to the table above
only after a human adds a real check method.

- (empty — first sweep not yet run)
