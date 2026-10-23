# Edge review — where this repo wins, where it is exposed (draft, 2026-10-22)

**Status: draft for the owner.** Tracks [#254](https://github.com/TzolkinB/skills/issues/254), epic [#256](https://github.com/TzolkinB/skills/issues/256). It does not change [positioning.md](positioning.md), which stays the single source of truth for outward claims. Evidence tiers: **T1** docs, **T2** source read, **T3** run. Almost everything below is T1/T2 from the 2026-10-22 research passes; **nothing about other tools was run**, and speed claims are marked where we have no measurement.

## Where the tool landscape is heading

| Trend | Evidence |
|---|---|
| First-party agents absorb authoring, planning and healing | Playwright planner/generator/healer unchanged since 1.56 but now with WebMCP (1.64); Cypress `cy.prompt` is metered, 100 free runs a month (T1). They push toward green and audit nothing. |
| Mutation tools add an AI repair loop | Tautest 2.x writes a fix prompt for a surviving mutant and verifies a candidate test kills it by rerunning Stryker (T2). Still unit-only (Vitest/Jest). |
| TEA moves from planning toward a CI gate and self-evaluation | v3.4.0 has a headless review gate with a verdict and `--github` check runs, plus an evaluation harness (T2). Its `trace` gate still counts coverage only (presence gap holds). |
| Verdict SaaS appears | AxonQA: ready / ready with accepted risks / not ready, with evidence (T1, vendor claims; rules not public). Kane: open `.evidence` pack, no signing, no hollow-test audit (T2). |

## Where we win today

- **Mutation proof on app-driven Playwright/Cypress tests.** Every mutation tool found has no browser-aware runner. The two generic ones (Stryker `commandRunner`, mewt) can wrap any command but run the whole suite per mutant, one at a time; mewt's own docs work out about 16 hours for 10 files × 100 mutants (T1/T2, not run). `audit-test` runs **one targeted mutation**. That is the scope and cost edge, and it is the only one with T3 evidence (Epic Stack 🟢, Cypress RWA 🔴).
- **Neutral routing with labeled evidence.** No tool in the landscape tells you which other tool to use, free or priced, with an evidence label per claim. This is the license/price table plus `qa-compass`.
- **Under-claiming.** The audience (QA/SDET professionals, per positioning.md) has watched tools over-claim. Our labels are a feature the vendors do not offer.

## Where we are exposed

| Exposure | Why |
|---|---|
| **Gate's verdict** | The repo's own position (ADR-0038/0010) is that Gate aggregates and does not execute. TEA's CI gate and AxonQA both ship a verdict with a polished surface (PR comments, check runs). If either adds a credibility input, the gap narrows. |
| **A vendor adds a credibility audit** | Neither Playwright nor Cypress audits today (T1). A first-party "would this test fail" check would sit on the best distribution. |
| **mewt or Stryker get practical for E2E** | Parallelism, per-mutant rebuild and targeting are the missing pieces. None is present in mewt 4.0.0 (T2). |
| **Claims that age** | The Tautest label was 3 months stale and two tools shared the name Exspec. The watch exists to catch this. |

## Orchestration: the fastest route to the correct answer, by stage

The goal is not a longer tool list; it is the cheapest route that still gives the right answer for that side of QA. Timing data exists only where noted.

| Stage | Best route today | Speed / cost evidence | Gap |
|---|---|---|---|
| Plan | Playwright Planner (free, own AI tool) or `test-plan` | none | none measured |
| Author | Playwright Generator / Explorbot / `cy.prompt` (not free past 100 runs a month), then **audit** | none | The hand-off to `audit-test` is **Unexamined** — [#264](https://github.com/TzolkinB/skills/issues/264) |
| Audit, unit | Stryker (full) or Tautest (PR-scoped) — route, do not rebuild | Tautest scopes to changed lines (T2) | Gate cannot ingest their report yet — [#259](https://github.com/TzolkinB/skills/issues/259) |
| Audit, E2E | `audit-test`, one targeted mutation | the only T3 evidence in the table | Add a cheap throw-first probe and a timeout — [#258](https://github.com/TzolkinB/skills/issues/258) |
| Coverage | V8/istanbul, `coverage-review` | none | none measured |
| Flake / triage | Playwright `flaky` flag, `debug-test` | none | none measured |
| Gate | `gate` (aggregator), TEA gate (presence only), AxonQA (closed) | none | Verdict surface and accepted risks — [#261](https://github.com/TzolkinB/skills/issues/261), [#262](https://github.com/TzolkinB/skills/issues/262), [#265](https://github.com/TzolkinB/skills/issues/265) |

**Honest read:** the orchestration claim ("fastest correct route") is *supported* at the Audit stage and *unmeasured* everywhere else. Until there are timings, `qa-compass` should keep calling those routes by their evidence label and not by speed.

## Moves, in order

1. **Prove the Author → Audit pairing** ([#264](https://github.com/TzolkinB/skills/issues/264)). It is the most direct statement of the edge: generators optimize toward green, we show which greens are real.
2. **Make the E2E audit cheaper** ([#258](https://github.com/TzolkinB/skills/issues/258)), because cost is where mewt and Stryker lose today, and an edge that stays cheap stays an edge.
3. **Route to, not around, the unit tools** ([#259](https://github.com/TzolkinB/skills/issues/259)).
4. **Harden what Gate promises** ([#262](https://github.com/TzolkinB/skills/issues/262) tamper guard, [#261](https://github.com/TzolkinB/skills/issues/261) accepted risks) before improving how it looks ([#265](https://github.com/TzolkinB/skills/issues/265)).

## Watch triggers this review suggests (not applied to the routine)

- TEA `trace` starts reading a test-credibility score, or `tea-evaluate` targets user test suites.
- Tautest's runner list gains anything but Vitest/Jest, or Stryker's `commandRunner` gains an E2E guide.
- mewt gains parallelism, targeting or a per-mutant rebuild hook.
- Playwright or Cypress release notes mention test-quality or mutation checks.
- AxonQA publishes its verdict rules or exports evidence.

## What would change this review

Each has an issue:

- A T3 run of mewt and Stryker `commandRunner` against a small Playwright suite (turns "impractical" into a number) — [#250](https://github.com/TzolkinB/skills/issues/250).
- The `trace` real run, now against TEA v3 — [#223](https://github.com/TzolkinB/skills/issues/223).
- The generate-then-audit experiment — [#264](https://github.com/TzolkinB/skills/issues/264).
