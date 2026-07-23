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
- **[`/audit-test`](./skills/audit-test/SKILL.md)** — A test passes but you don't trust it: run one targeted mutation to prove whether it would fail if the code broke. Labels findings **Confirmed** vs **Likely**, never an invented score. Runs on dev-served Playwright/Cypress, not just unit tests. *(Cypress needs single-test isolation for a clean proof — a one-test spec or the `@cypress/grep` plugin; without it `cypress run --spec` runs the whole file and the audit falls back to 🟡.)*
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

- **[`/gate`](./skills/gate/SKILL.md)** — At the end of a PR: bind your existing Playwright/Cypress results + an `audit-test` verdict into one readable evidence bundle, and derive an advisory `ship` / `canary` / `hold` decision by **worst-wins** (any input says `hold` → `hold`; else any says `canary` → `canary`; else `ship`). The decision step itself is deterministic code, carries no confidence number, and is advisory only — it does not abort the build, and a `hold`/`canary` doesn't by itself stop a deployment; that's on your CI or your team. Recommends `ship` only when every E2E suite is green **and** a parsed `audit-test` verdict reports no hollow tests among the tests it deep-audited (a shape-checked self-report, not an independent re-verification).

## Dependencies

Most of these skills are self-contained — they statically read your code and tests and need nothing beyond Claude Code. Two reach for external tools: **`/debug-test` requires them to run at all**, and **`/audit-orchestrator` optionally routes to them** (falling back to a self-contained skill when they're absent). Install these before you rely on them.

| Needed by | Tool | Install | If missing |
|-----------|------|---------|------------|
| `/debug-test` (all of it) | **Playwright** | already in your project (`npx playwright test`) | Skill can't run — it is Playwright-scoped |
| `/debug-test` auto-heal (locator/timing failures) | **Playwright agents** | `npx playwright init-agents` (once per repo) | Falls through to `diagnosing-bugs` instead of self-healing |
| `/debug-test` logic diagnosis | **Matt Pocock's `diagnosing-bugs` skill** | `npx skills@latest add mattpocock/skills` | Deep bug diagnosis has no terminal route — `/debug-test` stalls after triage |
| `/audit-orchestrator` unit-test route | **Tautest** (PR diff-mutation) / **StrykerJS** (full campaign) | per each tool's own Vitest/Jest setup | No hard dependency — routes the audit to `/audit-test` instead |

`diagnosing-bugs` is the load-bearing one: when Playwright agents aren't set up, locator failures also route to it, so `/debug-test` leans on it for anything past a clean auto-heal. Installing Matt Pocock's skills alongside these is recommended — the two are designed to compose: **build with Matt's skills, verify with these.**

Every other skill (`/test-plan`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/bug-report`, `/qa-review`, `/threat-model`, `/e2e-impact`, `/contract-guard`, `/sentinel`, `/gate`) needs only Claude Code — `/contract-guard` optionally reads a published OpenAPI spec from a URL you supply, and `/gate` reads result files you already produced, but neither requires an install.

## Privacy — what each skill reads, runs, and routes externally

These skills add no network calls of their own — none sends your code to a third-party service or hits a network API on your behalf. They run *inside* Claude Code, so your code is processed by Anthropic's API exactly as in any Claude Code session (that transport is the platform, not a skill call); the only Anthropic call in this repo is maintainer tooling — the eval harness ([`evals/lib/judge-llm.mjs`](./evals/lib/judge-llm.mjs)), not a skill you run. The table below spells out exactly what each skill touches so you can run it on private code with confidence.

| Skill | Reads | Runs (executes) | Routes externally |
|-------|-------|-----------------|-------------------|
| `/test-plan` | A feature description you provide | Nothing | Nothing |
| `/coverage-review` | Your test file + code file | Nothing | Nothing |
| `/audit-test` | The passing test + the code it covers | A single targeted mutation + one test run, on a clean git tree (always revertible) | Nothing |
| `/prune-tests` | The test suite | Read-only by default; `--apply` edits/removes flagged tests and reruns the affected ones locally | Nothing |
| `/qa-review` | The code under review | Nothing | Nothing |
| `/threat-model` | The change / diff | Nothing | Nothing |
| `/bug-report` | A failure description you provide | Nothing | Nothing |
| `/e2e-impact` | The diff + your E2E specs and source | `git` locally (read-only) to resolve the diff | Nothing |
| `/audit-orchestrator` | The test under audit + your test configs | Detection locally (Glob/Read/`git`); hands off to `/audit-test` or points you at Tautest/StrykerJS | **Yes** — routes to `/audit-test` or the external mutation tools, all run locally in your session (see [Dependencies](#dependencies)) |
| `/contract-guard` | The consumer code + the published contract (a local file, or a URL you point it at) | Reads the spec — a local file, or a read-only `GET` on the URL you supply | Routes to `/bug-report` locally; the only network touch is fetching the published-spec URL you provide — your code is never sent out |
| `/debug-test` | The failing Playwright test + code | Runs the Playwright test locally | **Yes** — routes to the Playwright healer agent and to Matt Pocock's `diagnosing-bugs` skill (both run locally in your session; see [Dependencies](#dependencies)) |
| `/sentinel` | Files in the change | Composes the skills above; runs only what they run | Only whatever `/debug-test` routes to, and only when a failing test is present |
| `/gate` | A Playwright/Cypress result file + (optional) an `audit-test` emission/report you pass in | Its bundled Node script locally + `git rev-parse HEAD` for the subject | Nothing |

`/debug-test` and `/audit-orchestrator` are the skills that hand work to external tooling; `/contract-guard` may fetch a published OpenAPI spec from a URL you supply, but never sends your code anywhere. Everything else statically reads and reasons, and the two skills that do execute (`/audit-test`, `/prune-tests --apply`) stay surgical and gated on a clean git tree.

## New to testing? Start here

Every skill except `/debug-test` supports a `--explain` flag (`/debug-test` is procedural, not pedagogical). Default output stays terse for daily use; add `--explain` and each report includes a "Why This Matters" section that teaches the underlying concept, not just the finding — e.g. `/qa-review UserService.ts --explain`.

Unfamiliar terms in any report (boundary condition, flaky test, loose assertion, etc.) are defined in [`GLOSSARY.md`](./GLOSSARY.md).

If you're a QA professional reviewing this and want to give feedback, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the specific questions worth asking.

## Existing Project Bootstrap (One-Time)

Use this when adding these skills to a repo that already has tests.

1. Pick critical-path tests first (auth, payments/PII, state transitions, core journey flows).
2. Use `/test-plan` for upcoming work and ensure every case gets a layer recommendation (`unit`/`component`/`integration`/`e2e`).
3. Classify a small set of existing high-value tests to create an initial layer baseline.
4. Record an initial distribution (for example: `3 unit / 5 component / 7 integration / 4 e2e`).
5. Keep only thin critical-path browser journeys in `e2e`; if a case still passes with a browser replaced by API/client calls, move it toward `integration`.
6. From that point forward, treat the `/sentinel` report layer distribution as your per-PR drift signal.

Bootstrap is intentionally lightweight. You do not need to classify the entire legacy suite on day one.

## Roadmap

`/gate` and `/audit-test` deliberately shipped narrower than they could be — see
[`docs/roadmap.md`](./docs/roadmap.md) for the full list of what's deferred, why, and the
order it's getting picked back up in (short version: a taxonomy-wording fix, then
coverage-aware ship semantics, then real evidence signing, then a calibration loop for a
real confidence number).

Separately, not built yet on the authoring side:
- [ ] Starter templates for common frameworks (Jest, pytest, Playwright)
- [ ] Progressive guide: unit → integration → E2E testing
- [ ] Decision tree: "which test type for this scenario?"

## Examples

### Example 1: New Feature

```
# You're building a booking system. First:
/test-plan "Users can book a room from 9am-5pm, no overlaps allowed"

# This gives you: happy path, edge cases (midnight boundary, double-booking), error paths,
# and recommended test layers per case
# You and Claude use this plan to write both code and tests

# Later, when tests are done:
/coverage-review booking.test.js booking.ts
/sentinel booking-feature-branch
```

### Example 2: AI Code Review

```
# AI just wrote 500 lines of test code. Before merging:
/coverage-review UserService.test.js UserService.ts

# Red flags:
# - Tests pass but don't assert structure
# - Database error path not tested
# - Date boundary not covered

# You tell Claude: "Fix these gaps"
# Run /sentinel again when it's done
```

### Example 3: Production Bug

```
# Production: "Date filter broke"
/bug-report "Date filter on /books page broken, returns empty results, browser console shows dateRange.start is undefined"

# Output: structured bug report with severity, steps to repro, scope

# Now debug:
/debug-test "date filter test"
# ← reads the test file, runs it, identifies root cause automatically
```

## Philosophy

Testing isn't about green lights — it's about confidence. A test suite that passes but doesn't catch real bugs is worse than no tests: it gives you false confidence while your code rots. Three premises:

1. **Tests verify behavior.** An assertion should say "if this fails, something is genuinely broken," not "I made the test pass."
2. **Quality is testable.** Code that's hard to test is a signal it has hidden dependencies, non-deterministic behavior, or brittle assumptions. Fix the code, not the test.
3. **Pragmatism over perfection.** You don't need 100% coverage or zero technical debt. You need to ship fast and be able to verify it works.

For the reasoning behind specific design choices — why many small skills instead of one, why a 3-state verdict, what the tradeoffs are — see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## FAQ

**Q: Will this replace my QA team?**
A: No. These skills help you think like a QA professional and catch obvious gaps. A real QA team catches things AI never will.

**Q: Can I use this if I don't write tests?**
A: Yes, but the value is lower. They're most useful when you're actively writing/reviewing tests.

**Q: What if I don't use Claude Code?**
A: These are just structured procedures and checklists. Adapt them to your workflow.

**Q: How do I "ship" the report from `/sentinel`?**
A: That's up to you — copy it into your pull request, post it to Slack, use it in code review. `/sentinel` is a tool for thinking; `/gate` is the one that emits an explicit ship/canary/hold recommendation.

## Contributing & Support

**Status: prototype.** A personal project, built and maintained by one QA engineer — not a commercially supported product, and there's no team or SLA behind it. If a skill's judgment seems off, or something doesn't work, please file an issue — real usage against real code is exactly what sharpens these skills. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) · Made by Kim, a QA professional. AI can write the tests; knowing whether they have value is still the job.
