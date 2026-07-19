# Kim Bell's QA Skills

**QA-first testing skills for Claude Code — verify behavior, not green lights.**

AI writes tests that make assertions pass without proving anything — tests that stay green even when you break the very behavior they claim to guard. That isn't protection; it's false confidence. These skills are a **judgement layer** over your tests: they reason about whether your tests actually protect you, and where execution is needed they compose with the tools that already do it (coverage instrumentation, Playwright, Cypress, mutation testing) instead of reimplementing them.

Built by a QA professional tired of AI tests that pass but don't catch real bugs.

## Install

```
/plugin marketplace add TzolkinB/skills
/plugin install kimbell-skills@kimbell
```

To install from a local checkout instead:

```
/plugin marketplace add ./
/plugin install kimbell-skills@kimbell
```

Then, in any Claude Code session:

```
/audit-test app.test.js app.js
/coverage-review UserService.test.ts UserService.ts
/gate test-results/results.json --audit-test-json=audit.json
```

Not sure which to reach for? Run `/ask-sentinel` and describe your situation.

## Judgement

Skills that reason about whether your tests protect you. The flagship is **[`/audit-test`](./skills/audit-test/SKILL.md)** — the one skill that runs a real mutation to *show* whether a passing test would catch the single most-likely break to the code it covers: execution-grounded evidence, not reasoning. Start there.

### User-invoked

- **[`/test-plan`](./skills/test-plan/SKILL.md)** — Before you write code or tests: define what to test and at which layer (`unit`/`component`/`integration`/`e2e`).
- **[`/qa-review`](./skills/qa-review/SKILL.md)** — During code review: catch untestable code before it ships.
- **[`/coverage-review`](./skills/coverage-review/SKILL.md)** — After AI writes tests: find the missing cases and loose assertions.
- **[`/audit-test`](./skills/audit-test/SKILL.md)** — A test passes but you don't trust it: run one targeted mutation to prove whether it would fail if the code broke. Labels findings **Proven** vs **Likely**, never an invented score.
- **[`/prune-tests`](./skills/prune-tests/SKILL.md)** — The suite feels slow or noisy: cut tests that cost more than they protect (proposes before it deletes).
- **[`/threat-model`](./skills/threat-model/SKILL.md)** — Before shipping something risky: what breaks in production, and would you notice — ranked by how long a failure would go unseen.
- **[`/debug-test`](./skills/debug-test/SKILL.md)** — A Playwright test is failing: auto-diagnose and route the fix (also a flake mode).
- **[`/bug-report`](./skills/bug-report/SKILL.md)** — Something broke: structure it into a clean handoff for the team.
- **[`/e2e-impact`](./skills/e2e-impact/SKILL.md)** — Before running E2E: map a diff to the Playwright/Cypress specs it plausibly hits.
- **[`/audit-orchestrator`](./skills/audit-orchestrator/SKILL.md)** — A suspicious passing test: route it to the tool that can actually prove it (Tautest/StrykerJS, or `/audit-test` for app-driven tests).
- **[`/contract-guard`](./skills/contract-guard/SKILL.md)** — A frontend suite reddens on backend drift: check the consumer's expectations against the provider's published OpenAPI.

### Model-invoked

- **[`/sentinel`](./skills/sentinel/SKILL.md)** — Before you merge: one QA judgment pass over your branch, composed from the skills above and reduced to 🟢 / 🟡 / 🔴 (a read to act on, not a release gate).
- **[`/ask-sentinel`](./skills/ask-sentinel/SKILL.md)** — The front door: describe your situation and get routed to the one skill that answers it, plus where it sits in the flow.

## Gate

The release-decision layer: it never runs a suite, it **ingests the evidence a PR already produced**.

### User-invoked

- **[`/gate`](./skills/gate/SKILL.md)** — At the end of a PR: bind your existing Playwright/Cypress results + an `audit-test` verdict into one readable evidence bundle, and derive an advisory `ship` / `canary` / `hold` decision by worst-wins. Deterministic code, carries no confidence number, never fails the build. Recommends `ship` only when every E2E suite is green **and** a parsed `audit-test` verdict reports no hollow tests among the tests it deep-audited (a shape-checked self-report, not an independent re-verification).

## Privacy

These skills add **no network calls of their own** — none sends your code to a third-party service or hits a network API on your behalf. They run *inside* Claude Code, so your code is processed by Anthropic's API exactly as in any Claude Code session (that transport is the platform, not a skill call); the only Anthropic call in this repo is maintainer tooling — the eval harness ([`evals/lib/judge-llm.mjs`](./evals/lib/judge-llm.mjs)), not a skill you run. The two skills that *execute* — `/audit-test` (one targeted mutation + one test run, on a clean git tree, always reverted) and `/prune-tests --apply` — stay surgical and gated on a clean tree.

## Dependencies

Most skills are self-contained (Claude Code only). Two reach for external tools: **`/debug-test`** requires Playwright (and Matt Pocock's [`diagnosing-bugs`](https://github.com/mattpocock/skills) skill for logic diagnosis), and **`/audit-orchestrator`** optionally routes to Tautest / StrykerJS, falling back to `/audit-test` when they're absent. See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and the per-skill docs under [`docs/`](./docs/) for details.

## Philosophy

Testing isn't about green lights — it's about confidence. An assertion should say "if this fails, something is genuinely broken," not "I made the test pass." Code that's hard to test is a signal, not an inconvenience. And you don't need 100% coverage — you need to ship fast and be able to verify it works.

## License

[MIT](./LICENSE) · Made by Kim, a QA professional. AI can write the tests; knowing whether they have value is still the job.
