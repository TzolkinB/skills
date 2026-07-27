# gate — one readable evidence bundle, one advisory ship decision

> **Agent instructions:** [`skills/gate/SKILL.md`](../skills/gate/SKILL.md) · **Run:** `/gate [Playwright results.json and/or Cypress result.json] [audit-test emission .json or report .md]`

## What it does

`gate` is the **Gate stage** (stage 7) — the release-verdict layer that [`sentinel`](./sentinel.md) deliberately doesn't speak ([#99](https://github.com/TzolkinB/skills/issues/99)). It ingests a PR's *existing* test evidence — a Playwright JSON report and/or a Cypress Module API result, plus (optionally) an [`audit-test`](./audit-test.md) verdict — and binds them into one readable, in-toto-shaped evidence bundle over content-addressed inputs. From that bundle it derives a categorical **ship / canary / hold** decision by **worst-wins**: if any input proposes `hold`, the decision is `hold`; else if any proposes `canary`, it's `canary`; else `ship`. The arithmetic is deterministic code (`gate.mjs`), not a judgment call — given the same bundle it always yields the same decision.

The bar for `ship` is deliberately hard to clear: every E2E suite passed in must be green **and** clear an **executed-floor** against what the report itself says it discovered (a suite that only ran a sliver of what it found is capped at `canary`, not read as green) — **and** a *parsed* `audit-test` verdict must show no hollow tests among what it deep-audited, with that deep-audited fraction clearing an **examined-floor**. An *opaque* audit-test report (human-readable but not machine-parsed) or no audit-test at all floors the decision at `canary` — a bare green E2E run can never launder into `ship` on its own. The whole bundle can optionally be DSSE-signed with a self-signed ed25519 key so a reader can verify nothing was altered after Gate produced it — self-signed, not Sigstore, and unsigned by default.

## When to use it

- At the end of a PR, to turn a Playwright/Cypress result and an `audit-test` verdict into one honest, human-readable release recommendation instead of eyeballing two separate reports.
- You want a tamper-evident record of the exact evidence a ship decision was based on.

## When *not* to use it

- **You want to run the suite or a browser** → out of scope by design; Gate ingests existing evidence only ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
- **You want to know if a passing test is hollow** → [`audit-test`](./audit-test.md); Gate *consumes* its report, it doesn't produce one.
- **You want which specs a diff hits, or to diagnose a red one** → [`e2e-impact`](./e2e-impact.md) / [`debug-test`](./debug-test.md).
- **You want a QA judgment read across a branch** → [`sentinel`](./sentinel.md), which feeds Gate but doesn't itself speak shippability.

## Prerequisites

Claude Code, plus Node to run the bundled `gate.mjs` script and at least one already-produced E2E result file (a Playwright JSON reporter output and/or a Cypress `CypressRunResult` — Cypress requires a small Module API wrapper to persist, since it doesn't write one to disk on its own). No network calls; it reads local files only.

## Worked example

Fixtures live under [`skills/gate/fixtures/`](../skills/gate/fixtures/) rather than the shared `fixtures/` directory, since Gate's decision arithmetic has its own golden-truth-table self-test (`node skills/gate/gate.mjs --self-test`) — the eval here grades the skill's honest *reporting* of that decision, not the numbers ([expected findings](../fixtures/gate/expected-findings.md)).

A green Playwright report paired with a **present-but-opaque** `audit-test.report.md` yields **🟡 CANARY**: Playwright proposes `ship`, but an unparsed Markdown report can only floor the credibility axis at `canary` — a human has to read it. Swap in a **parsed** confirmed-clean `audit-test` emission (`--audit-test-json`) and the same green Playwright report yields **🟢 SHIP** — the only path to it: both axes propose `ship`, worst-wins agrees. A third case shows the Cypress-specific guard: a Cypress result reading `totalPassed:12, totalFailed:0` but with one test that failed-then-passed in `attempts[]` is **derived** as WARNED (Cypress emits no aggregate flaky count) and floors the decision at `canary` even paired with a confirmed-clean audit — a survived flake never launders into a clean green.

## Where it fits

The last stage of the [orchestration map](./orchestration-map.md) — after [`sentinel`](./sentinel.md)'s QA read and after [`audit-test`](./audit-test.md)'s credibility audit, Gate is where their evidence becomes an advisory release decision. It owns the ship verdict; nothing upstream of it does.

## Anti-patterns

- **Treating `canary`/`hold` as a build-blocker.** The decision is advisory only — Gate doesn't abort a build or a deployment; that's on your CI or team to act on.
- **Reading a confidence number into the decision.** There is none, deliberately — the schema forbids a numeric field on the gate entry.
- **Recomputing or overriding the script's decision.** It's deterministic code; present it as returned.
- **Calling a self-signed bundle "Sigstore-verified" or "trusted publisher."** Signing proves integrity and continuity, never third-party identity.
