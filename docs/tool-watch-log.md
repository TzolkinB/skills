# External tool watch — change log

Append-only history of baseline changes from the weekly tool-watch routine. One line per tool
per change, newest at the bottom. [`tool-watch.md`](tool-watch.md) holds the *current* baseline and
check methods; this file holds how it got there. Lines before 2026-10-26 were backfilled from the
git history of `tool-watch.md`.

Format: `YYYY-MM-DD  Tool  old → new` — `⚑` marks a trigger (see "Triggers" in `tool-watch.md`).
Kane's `kane-cli` weekly bumps are summarised, not listed one by one.

## StrykerJS
- 2026-07-23  baseline 9.6.1
- 2026-08-17  9.6.1 → 10.0.0 ⚑ major

## Tautest
- 2026-07-23  baseline 1.10.1
- 2026-09-28  1.10.1 → 2.0.2 ⚑ major
- 2026-10-05  2.0.2 → 2.0.5
- 2026-10-19  2.0.5 → 2.1.3 (16 → 20 versions)
- 2026-10-22  2.1.3 → 2.1.5 (20 → 22 versions)

## Exspec
- 2026-07-23  baseline 0.1.7 (no change since)

## TEA (BMAD Test Architect)
- 2026-07-23  baseline v1.19.1
- 2026-08-04  v1.19.1 → v1.21.4 (manual; `comparisons/tea.md` §3 re-read)
- 2026-08-10  v1.21.4 → v1.21.10
- 2026-08-17  v1.21.10 → v1.23.1
- 2026-08-24  v1.23.1 → v1.23.3
- 2026-08-31  v1.23.3 → v1.23.4
- 2026-09-04  v1.23.4 → v1.24.0 (manual; `comparisons/tea.md` §3 re-read)
- 2026-09-14  v1.24.0 → v1.26.0
- 2026-09-21  v1.26.0 → v1.27.2
- 2026-10-12  v1.27.2 → v2.0.1 ⚑ major — §3 re-read not yet done
- 2026-10-19  v2.0.1 → v3.2.0 ⚑ major (workflows renamed `bmad-testarch-*` → `bmad-tea-*`) — §3 re-read not yet done
- 2026-10-22  v3.2.0 → v3.4.0 — §3 re-read not yet done
- 2026-10-22  v2.0.1 → v3.4.0 ⚑ major (baseline manually reset to v2.0.1 by #244 to test the trigger path; routine confirmed the major-bump trigger and restored the real baseline)

## Playwright test agents
- 2026-07-23  baseline v1.61.1
- 2026-07-25  v1.61.1 → v1.62
- 2026-08-03  v1.62 → v1.62.1
- 2026-09-07  v1.62.1 → v1.63.0
- 2026-10-12  v1.63.0 → v1.64.0 ⚑ agent-keyword hit (WebMCP: `Page.webmcp`, `webmcp_<tool>`)
- 2026-10-19  v1.64.0 → v1.64.1 (same 1.64 block, patch only)

## Cypress AI (`cy.prompt`)
- 2026-07-23  baseline 15.19.1
- 2026-08-10  15.19.1 → 15.20.1
- 2026-08-17  15.20.1 → 15.21.0 (keyword hit: `cypress tap`)
- 2026-08-24  15.21.0 → 15.21.1
- 2026-08-31  15.21.1 → 16.0.0 (major release)
- 2026-09-07  16.0.0 → 16.0.1
- 2026-09-14  16.0.1 → 16.1.0
- 2026-10-05  16.1.0 → 16.1.2
- 2026-10-12  16.1.2 → 16.2.0 (`cy.getByRole()`; only `prompt` hit is a bugfix)
- 2026-10-19  16.2.0 → 16.2.1 (bugfixes)

## Kane / LambdaTest
- 2026-07-23  baseline kane-cli 0.6.2; evidence-cli 0.1.6
- 2026-07-23  evidence-cli 0.1.6 → 0.1.7 (6 versions)
- 2026-07 → 2026-10  kane-cli 0.6.2 → 0.9.0 (weekly bumps; 0.9.0 on 2026-10-19)
- Unchanged through 2026-10-19: `LambdaTest/evidence-cli` raw status 200; `evidence-cli.dev` NXDOMAIN
