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
| StrykerJS | npm `@stryker-mutator/core` dist-tags.latest | 9.6.1 (113 versions, modified 2026-05-13) | 2026-07-27 |
| Tautest | npm `tautest` dist-tags.latest | 1.10.1 (10 versions, modified 2026-06-04) | 2026-07-27 |
| Exspec | npm `@mnapoli/exspec` dist-tags.latest | 0.1.7 (11 versions) | 2026-07-27 |
| TEA (BMAD Test Architect) | raw `bmad-code-org/bmad-method-test-architecture-enterprise` `main/package.json` version | v1.19.1 | 2026-07-27 |
| Playwright test agents | raw `microsoft/playwright` `main/docs/src/release-notes-js.md`, top `## Version` block + grep it for `planner`/`generator`/`healer`/`agent`; npm `@playwright/test` dist-tags.latest for the version number | v1.62 (published 2026-07-24; agents feature landed 1.56; 1.62 block has no agent-keyword hit) | 2026-07-27 |
| Cypress AI (`cy.prompt`) | raw `cypress-io/cypress` `develop/cli/CHANGELOG.md`, top version + grep recent entries for `prompt`/`AI` | 15.19.1 at top of changelog | 2026-07-27 |
| Schema validators (sclavijosuero) — **recommended, not competitor** | npm `cypress-schema-validator`, `playwright-schema-validator`, `core-ajv-schema-validator` dist-tags.latest | cypress-schema-validator 2.0.0 (2026-06-07); playwright-schema-validator 1.0.0 (2025-08-03); core-ajv-schema-validator 1.0.0 (2025-04-06) | 2026-07-31 |
| Kane / LambdaTest (`kane-cli`, `evidence-cli`) | npm `@testmuai/kane-cli` + `@testmuai/evidence-cli` dist-tags.latest; raw `LambdaTest/evidence-cli` `HEAD/package.json` HTTP status (404 = repo still private/absent, 200 = went public); `evidence-cli.dev` DNS | kane-cli 0.6.7; evidence-cli 0.1.7 (6 versions); repo raw-status 404 (still private); DNS NXDOMAIN | 2026-07-27 |
| Matt Pocock's skills (`diagnosing-bugs` — a **dependency** watch) | raw `mattpocock/skills` `main/README.md`: (a) grep `diagnosing-bugs` — absent means the load-bearing route is gone; (b) diff the `` `/skill-name` `` inventory for a new QA/test-quality-shaped entry | `diagnosing-bugs` present; 9 skills listed — `code-review`, `diagnosing-bugs`, `grill-me`, `grill-with-docs`, `improve-codebase-architecture`, `setup-matt-pocock-skills`, `tdd`, `to-spec`, `triage` | 2026-07-31 |

Notes:
- The schema-validator row is the one entry that is **not** a competitor — `contract-guard` Tier 1b
  ([ADR-0049](adr/0049-contract-guard-test-boundary-validation-tier.md)) *recommends* these packages,
  so what matters is **liveness, not features**: `core-ajv-schema-validator` is a single-maintainer
  1.0.0 from 2025-04-06 and is the shared engine under both framework plugins. The trigger to care is
  a long silence plus an open-issue backlog, or a new major that changes the command surface — not a
  routine bump. Watch also for a *further* successor: `cypress-ajv-schema-validator` /
  `playwright-ajv-schema-validator` are already superseded predecessors, and the skill must always
  name the current package.
- Playwright and Cypress checks are proxies (whole-product version, not an "agents-only" or
  "AI-only" release channel) — the grep step is what catches an agent/AI-relevant entry inside a
  general release. A version bump alone is low-signal for these two; a keyword hit is the real
  trigger.
- Matt Pocock's skills is the one **dependency** row, not a competitive one. `debug-test` routes
  logic failures to `diagnosing-bugs` and calls it load-bearing (README "Dependencies",
  `ARCHITECTURE.md`), so a rename or removal upstream silently breaks that terminal route — leg (a)
  is the whole point of the row. Leg (b) is secondary and speculative: nothing in that repo contests
  this lane today (`/triage` is issue-state-machine triage, not test-failure triage), but it is the
  most plausible origin for a QA-verification skill, since it's the adjacent workflow system with the
  distribution. Same proxy caveat as Playwright/Cypress, and here it **undercounts**: the repo ships
  more skills than its README headlines (`codebase-design`, `domain-modeling`, `research` install but
  aren't listed), so a skill that never reaches the README won't trip leg (b). `raw` can't list a
  directory and `api.github.com` is out of scope, so this is the best available signal, not a
  complete one. **Not a licensing concern** — routing to a skill the user installs themselves copies
  nothing (mattpocock/skills is MIT); the row exists for breakage, not compliance.
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

- 2026-08-01: **Shiplight AI** — installs as an MCP server + Skills in Claude Code/Cursor/Codex/Copilot, generating natural-language E2E tests with self-healing locators. [https://www.shiplight.ai/]. Why relevant: natural-language test generation / self-healing test automation.
- 2026-08-01: **Revyl** — YC-backed agentic E2E testing platform running natural-language workflows on real iOS/Android devices with replayable reports. [https://revyl.com/]. Why relevant: natural-language test generation / AI exploratory-testing agents.
- 2026-08-01: **Panto AI** — AI-first mobile QA platform turning plain-English flows into deterministic tests with self-healing locator maintenance across 150+ real devices. [https://www.getpanto.ai/]. Why relevant: self-healing test automation.
- 2026-08-01: **Trail of Bits mewt / MuTON** — agentic-era mutation testing tools (language-agnostic core plus a TON-blockchain variant), extended to DAML on 2026-07-08. [https://blog.trailofbits.com/2026/04/01/mutation-testing-for-the-agentic-era/]. Why relevant: mutation/false-confidence auditing.
