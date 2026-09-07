# Kim Bell's QA Skills

**Know which passing tests protect you.**

## Install

```
/plugin marketplace add TzolkinB/skills
/plugin install kimbell-skills@kimbell
```

## Update

Claude Code has no single command to update a marketplace plugin. Do these two steps:

1. Refresh the marketplace listing.
2. Install the plugin again.

This gets you the new version.

Then use these commands, in any Claude Code session:

```
/audit-test app.test.js app.js
/coverage-review UserService.test.ts UserService.ts
/gate test-results/results.json --audit-test-json=audit.json
```

## Why these skills exist

A passing test suite hides a gap: some passing tests catch a regression, others pass right through it. A coverage number never shows you which kind each test is — this is the **coverage illusion**.

**[`/audit-test`](./skills/audit-test/SKILL.md)** closes that gap for Playwright and Cypress tests. It breaks the code behind a test on purpose, runs the test, and reports whether the test noticed. A caught mutation confirms the test catches _that one_ break, not any break. An uncaught mutation is proof — from real execution — that the test checks nothing real. Every finding gets a **Confirmed** or **Likely** label, never an invented score.

**Start here:** `/audit-test` needs one test and one command, not the full plugin.

### Why not a mutation tool?

Mutation tools like StrykerJS and Tautest run the same "break it on purpose" check, but only for unit tests. They change your source code and rerun it under Vitest or Jest. A Playwright or Cypress test that drives a real browser is out of their reach.

Browser-test _repair_ agents take the opposite approach: they rewrite a test until it passes. If the repair agent decides the code is broken, it marks the test as skipped instead. It does not repair the test.

|                                                   | Layer                          | What a pass proves                                                            |
| ------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------- |
| Mutation tools (StrykerJS, Tautest)               | Unit                           | The test fails when the code is wrong                                         |
| Browser-test repair agents                        | E2E                            | The test runs — not that it checks anything real                              |
| **[`/audit-test`](./skills/audit-test/SKILL.md)** | Playwright/Cypress, dev-served | The test fails when the code is wrong, at the layer the other two can't reach |

A seven-stage map sits behind these skills. It names the best free tool for each point in the QA workflow; these skills fill the gaps those tools leave. A QA professional built these skills: many AI-written tests pass but do not catch real bugs, and that is why this project exists.

## The Skills: When You Use Each One

Not sure which skill fits? Run `/qa-compass`. Describe your situation. It routes you to the skill that fits. Sometimes it points you to an external tool instead, when that tool is the better choice.

Each entry below has the full detail: what evidence it produces, and its exact limits.

### The Coverage Illusion

This is the core idea of this plugin. A high **test coverage** number shows that a test ran. A passing suite shows the same thing. Neither number shows if the test detects a real bug.

- **[`/audit-test`](./skills/audit-test/SKILL.md)** _(user-invoked)_
  If a test passes and you do not trust it, run this skill. It runs one targeted mutation with a real effect on behavior, and reports the result. A caught mutation confirms that the test catches that one break; it does not confirm the test catches other breaks. An uncaught mutation is proof, from real execution, that the test checks nothing real. The skill labels each finding as **Confirmed** or **Likely**, and never gives an invented score. It runs on dev-served Playwright and Cypress tests, the layer unit-mutation tools like Stryker and Tautest can&apos;t reach. Point the skill at a whole file or at a directory; batch mode then triages every test in it. Proof of one flagged Cypress test needs a one-test spec, or the `@cypress/grep` plugin. Without one of these, `cypress run --spec` runs the whole file, and the deep-audited test falls back to a 🟡 rating.
- **[`/coverage-review`](./skills/coverage-review/SKILL.md)** _(user-invoked)_
  After AI writes tests, run this skill. It finds missing test cases. It finds assertions that pass even when the code is wrong.
- **[`/audit-orchestrator`](./skills/audit-orchestrator/SKILL.md)** _(user-invoked)_
  If a passing test looks suspicious, run this skill. It routes the test to the tool that proves it: Tautest or StrykerJS at the unit layer, or `/audit-test` for app-driven tests.
- **[`/prune-tests`](./skills/prune-tests/SKILL.md)** _(user-invoked)_
  If the suite is slow or full of false alarms, run this skill. It cuts tests that cost more than they protect. It proposes each cut before it deletes a test.

### Before the Code Exists

- **[`/test-plan`](./skills/test-plan/SKILL.md)** _(user-invoked)_
  Use this skill to define what to test, and at which layer: `unit`, `component`, `integration`, or `e2e`.
- **[`/qa-review`](./skills/qa-review/SKILL.md)** _(user-invoked)_
  During code review, run this skill. It finds code that is not testable, before you ship it.
- **[`/threat-model`](./skills/threat-model/SKILL.md)** _(user-invoked)_
  Before you ship something risky, run this skill. It shows what breaks in production. It ranks each risk by how long a failure stays unseen.

### A Failing, Unstable, or Mismatched Test

- **[`/debug-test`](./skills/debug-test/SKILL.md)** _(user-invoked)_
  If a Playwright test fails, run this skill. It finds the cause automatically and routes you to the fix. Only its flake mode covers Cyress; every other mode is Playwright-only. The flake mode detects an unstable test and sets it aside, instead of repair. A repaired locator sometimes lets a test pass, but the test no longer checks its original behavior. This change happens without a warning.
- **[`/contract-guard`](./skills/contract-guard/SKILL.md)** _(user-invoked)_
  If a frontend suite fails from a backend that no longer matches it, run this skill. It checks the consumer's expectations against the provider's published OpenAPI/Swagger document.
- **[`/bug-report`](./skills/bug-report/SKILL.md)** _(user-invoked)_
  If something breaks, run this skill. It turns the failure into a clean handoff for your team.

### Around a PR

- **[`/e2e-impact`](./skills/e2e-impact/SKILL.md)** _(user-invoked)_
  Run this skill to find which user journeys a PR affects. It maps the diff to the Playwright and Cypress specs it probably affects. When it is not sure, it says so and tells you to run every spec, instead of giving a guess with false confidence.
- **[`/qa-pass`](./skills/qa-pass/SKILL.md)** _(model-invoked)_
  Before you merge, this skill runs one QA judgment pass over your branch. It reports one of three colors: 🟢, 🟡, or 🔴. Use the color to decide your next step. It is not a release gate.
- **[`/qa-compass`](./skills/qa-compass/SKILL.md)** _(model-invoked)_
  This is the starting point for all the skills. Describe your situation. The skill routes you to the one skill that answers it, and shows where that skill sits in the QA flow.

## Gate

Gate is the release-decision layer. It never runs a test suite. It **reads the evidence that a PR already produced**.

### User-invoked

- **[`/gate`](./skills/gate/SKILL.md)** — Use this skill at the end of a PR, to show **release readiness** to another person. It combines your Playwright or Cypress results and an `audit-test` verdict into one evidence bundle. From this bundle, it makes an advisory decision: `ship`, `canary`, or `hold`.

  **The rule is worst-wins:**
  1. If any input says `hold`, the decision is `hold`.
  2. If not, and any input says `canary`, the decision is `canary`.
  3. If neither applies, the decision is `ship`.

  **Cypress needs a wrapper.** Playwright's JSON reporter writes its result to disk automatically. Cypress does not do this; it needs a small Module API wrapper first. See [`docs/gate.md`](./docs/gate.md) for this wrapper.

  **The decision comes from deterministic code, and it is advisory — it does not stop your build.** It carries no confidence number. A plain passing E2E run never becomes `ship` on its own — a `ship` decision needs a parsed `audit-test` verdict that has passed a minimum check. A suite that ran only a small part of what it found is limited to `canary`.

  **Signing is optional.** Use your own ed25519 key and DSSE to sign it. A reader then verifies that the bundle was not changed after signing. This method is self-signed, not Sigstore. It never claims that the producer was honest.

  **The minimum requirements are necessary, but not sufficient.** Read their exact limits before you rely on them: [what the floors do and do not catch](./docs/gate.md#what-the-floors-do-and-dont-catch).

## Where These Skills Fit in the Ecosystem

These skills do not replace mature test tools that already exist. They **combine** with those tools and fill the one gap that they leave. One document is the one authoritative reference for which tool to use, for which job, and in what order. This document is the orchestration map:

- **[The AI-Test Tooling Orchestration Map](./docs/orchestration-map.md)** — This map shows a seven-stage QA workflow: Plan, Author, Audit, Coverage, Flake, Triage, Gate. For each stage, it names the **best free tool**, **the point where that tool stops**, and **where one of these skills fills the gap**. Every recommendation carries a provenance label: Confirmed, Likely, or Unexamined. The map never presents an unproven claim as advice.

**Choose between a tool and a skill:** these direct-comparison notes state the boundary plainly. Where the other tool is the better choice, the notes say so:

- **[vs. mutation tools (Stryker / Tautest / Exspec / Pitest·Arcmutate)](./docs/comparisons/mutation-tools.md)** — At the **unit** layer, run the mutation tool; it is the better choice there on false confidence. Use `audit-test` at the **app-driven E2E** layer, where those tools cannot enter, by their structure. Gate combines the evidence; it does not verify it.
- **[vs. TEA (BMAD Test Architect)](./docs/comparisons/tea.md)** — Use TEA for risk planning and for its governance gate. Use these skills for the mutation check that TEA's own documents show it does not do. TEA's **requirements traceability** marks a requirement as covered when a matching test exists; it does not check if that test fails on a real bug. Presence is not proof. `audit-test` fills that gap.

## Dependencies

Most of these skills are self-contained. They read your code and tests statically and need nothing beyond Claude Code. Two skills reach for external tools. **`/debug-test` needs these tools to run at all.** **`/audit-orchestrator` optionally routes to these tools**; if the tools are absent, it falls back to a self-contained skill. Install these tools before you rely on them.

| Needed by                                              | Tool                                                            | Install                                           | If missing                                                             |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| `/debug-test` (the whole skill)                        | **Playwright**                                                  | Already in your project (`npx playwright test`)   | The skill does not run. It works only with Playwright.                 |
| `/debug-test` auto-repair (locator or timing failures) | **Playwright agents**                                           | `npx playwright init-agents` (once for each repo) | The skill falls through to `diagnosing-bugs` instead of self-repair    |
| `/debug-test` logic diagnosis                          | **Matt Pocock's `diagnosing-bugs` skill**                       | `npx skills@latest add mattpocock/skills`         | Deep bug diagnosis has no end route. `/debug-test` stops after triage. |
| `/audit-orchestrator` unit-test route                  | **Tautest** (PR diff mutation) or **StrykerJS** (full campaign) | Follow each tool's own Vitest or Jest setup       | No hard dependency exists. The audit routes to `/audit-test` instead.  |

`diagnosing-bugs` is essential in this system. When Playwright agents are not set up, locator failures also route to it. `/debug-test` depends on it for anything past a clean auto-repair. Install Matt Pocock's skills alongside these skills. The two sets combine by design: **build with Matt's skills; verify with these.**

Every other skill needs only Claude Code: `/test-plan`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/bug-report`, `/qa-review`, `/threat-model`, `/e2e-impact`, `/contract-guard`, `/qa-compass`, `/qa-pass`, `/gate`. `/contract-guard` optionally reads a published OpenAPI spec, from a URL that you supply. `/gate` reads result files that you already produced. Neither of these two needs an install.

## Privacy: What Each Skill Reads, Runs, and Sends Out

**These skills add no network calls of their own.** No skill sends your code to a third-party service. Only one outbound request exists in any skill: `/contract-guard` optionally fetches a published OpenAPI spec, from a URL that you supply. This is a static document, never your code. These skills run inside Claude Code. Your code goes through Anthropic's API in the same way as in any Claude Code session; this transport belongs to the platform, not to a skill call. The one Anthropic call in this repository is maintainer tooling: the eval harness ([`evals/lib/judge-llm.mjs`](./evals/lib/judge-llm.mjs)). This is not a skill that you run. The table below shows what each skill touches. Use the table to run a skill on private code with confidence.

| Skill                 | Reads                                                                                                                                                                       | Runs (executes)                                                                                                                                                                                                                                                                                                                                            | Routes externally                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/qa-compass`         | Your description of the situation, plus your stack files (`package.json`, a `playwright.config.*`/`cypress.config.*`, a published `openapi`/`swagger` document, if present) | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing. It points you to the right skill; it does not run that skill.                                                                                             |
| `/test-plan`          | A feature description that you provide                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/coverage-review`    | Your test file and code file                                                                                                                                                | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/audit-test`         | The passing test or tests, plus the code they cover                                                                                                                         | One mutation at a time, reverted before the next, on a clean git tree. Single-test mode runs one mutation; batch mode runs this across every flagged test, and `--certify` sometimes runs into the hundreds on a large suite. A crashed session sometimes leaves one mutation live; recovery (`git checkout -- <file>`) is a manual step, not a guarantee. | Nothing                                                                                                                                                            |
| `/prune-tests`        | The test suite                                                                                                                                                              | Read-only by default. `--apply` edits or removes flagged tests, then reruns the affected tests locally.                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/qa-review`          | The code under review                                                                                                                                                       | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/threat-model`       | The change, or diff                                                                                                                                                         | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/bug-report`         | A failure description that you provide                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                                                    | Nothing                                                                                                                                                            |
| `/e2e-impact`         | The diff, plus your E2E specs and source                                                                                                                                    | `git`, locally and read-only, to resolve the diff                                                                                                                                                                                                                                                                                                          | Nothing                                                                                                                                                            |
| `/audit-orchestrator` | The test under audit, plus your test configs                                                                                                                                | Detection, locally (Glob, Read, `git`). Hands off to `/audit-test`, or points you to Tautest or StrykerJS.                                                                                                                                                                                                                                                 | Yes. It routes to `/audit-test` or to the external mutation tools; all of these run locally, in your session. See [Dependencies](#dependencies).                   |
| `/contract-guard`     | The consumer code, plus the published contract (a local file, or a URL that you point it at)                                                                                | Reads the spec: a local file, or a read-only `GET` request on the URL that you supply                                                                                                                                                                                                                                                                      | Routes to `/bug-report`, locally. The only network touch is the published-spec URL that you supply; your code is never sent out.                                   |
| `/debug-test`         | The failing Playwright test, plus its code                                                                                                                                  | Runs the Playwright test, locally                                                                                                                                                                                                                                                                                                                          | Yes. It routes to the Playwright repair agent, and to Matt Pocock's `diagnosing-bugs` skill; both run locally, in your session. See [Dependencies](#dependencies). |
| `/qa-pass`            | Files in the change                                                                                                                                                         | Combines the skills above; runs only what they run                                                                                                                                                                                                                                                                                                         | Only what `/debug-test` routes to, and only when a failing test is present                                                                                         |
| `/gate`               | A Playwright/Cypress result file, plus an optional `audit-test` emission or report that you pass in                                                                         | Its bundled Node script, locally, plus `git rev-parse HEAD` for the subject                                                                                                                                                                                                                                                                                | Nothing                                                                                                                                                            |

`/debug-test` and `/audit-orchestrator` hand work to external tools. `/contract-guard` sometimes fetches a published OpenAPI spec, from a URL that you supply; it never sends your code anywhere. Every other skill reads and reasons statically. **The two skills that do execute code**, `/audit-test` and `/prune-tests --apply`, run only on a clean git tree. Both are prose skills, not executable programs. Their verdicts are the agent's own account of what it ran in your session, not an independently verified measurement. Watch the tool calls.

## New to Testing? Start Here

**Eight skills teach as they work:** `/qa-review`, `/threat-model`, `/qa-pass`, `/coverage-review`, `/test-plan`, `/audit-test`, `/bug-report`, `/prune-tests`. Each of these skills supports a `--explain` flag. The default output stays short, for daily use. Add `--explain`, and each report gets a "Why This Matters" section. This section teaches the idea behind the finding, not only the finding itself. Example: `/qa-review UserService.ts --explain`.

**Five skills run a fixed check instead:** `/debug-test`, `/audit-orchestrator`, `/contract-guard`, `/e2e-impact`, `/gate`. These skills do not support `--explain`. They run a fixed check. They do not reason toward a finding, so there is no reasoning to teach.

## In a Hurry? `--digest`

**Seven judgment skills take a `--digest` flag:** `/test-plan`, `/qa-review`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/threat-model`, `/qa-pass`. This flag is the opposite of `--explain`. It replaces the full report with at most three evidence cards. Each card has one line of risk, the specific evidence behind it, one concrete action, and a label: `Confirmed`, `Likely`, or `Unexamined`. The label states how well the finding is known. Example: `/audit-test tests/booking.spec.ts --digest`.

A digest is a _trim_, not a new summary. A digest states less than the full report, never more, and never raises a label to a stronger one: a finding that is `Likely` stays `Likely`, at any length. One document defines this format: [`skills/shared/digest-format.md`](./skills/shared/digest-format.md) ([ADR-0048](./docs/adr/0048-shared-digest-card-and-inline-next-footers.md)).

Every judgment report, full or digest, ends with a one-line **`Next:`** footer. This footer names the single next step for this result, so you do not need to run `/qa-compass` again to find your next step. The full routing map stays with `/qa-compass`; the footer is a shortcut into that map ([`skills/shared/next-footers.md`](./skills/shared/next-footers.md)).

(The `--digest` group of seven skills and the `--explain` group of eight skills are different sets, by design. `/bug-report` teaches, but it has no findings to compress, so it takes `--explain` and not `--digest`.)

Find unfamiliar terms from any report, for example boundary condition, unstable test, or loose assertion, in [`GLOSSARY.md`](./GLOSSARY.md).

If you are a QA professional and you review this repository, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for feedback questions.

## Existing Project Bootstrap (One-Time)

Use this section when you add these skills to a repository that already has tests.

1. Pick your critical-path tests first: authentication, payments or PII, state transitions, and core journey flows.
2. Use `/test-plan` for upcoming work. Make sure that every case gets a layer: `unit`, `component`, `integration`, or `e2e`.
3. Classify a small set of your existing high-value tests. This creates a first layer baseline.
4. Record a first distribution, for example: `3 unit / 5 component / 7 integration / 4 e2e`.
5. If a case still passes when you replace the browser with API or client calls, move that case toward `integration`. Keep only thin, critical-path browser journeys in `e2e`.
6. From that point on, use the `/qa-pass` report layer distribution as your drift signal for each PR.

This bootstrap process is deliberately light. You do not need to classify your whole legacy suite on day one.

## Roadmap

The team shipped `/gate` and `/audit-test` narrower than the full design, by choice. See [`docs/roadmap.md`](./docs/roadmap.md) for what is deferred, why, and the order for future work. **Four of the original items are closed:** a taxonomy-wording fix, ship rules that use coverage, real evidence signing, and report-to-commit provenance. **One build item remains:**

- **Calibration loop** — a real confidence number instead of a bare category.

**Report-to-commit provenance shipped** ([#177](https://github.com/TzolkinB/skills/issues/177)). The Playwright and Cypress ingest adapters, and the `audit-test` emission, now record the git commit that they ran against. If that recorded commit does not match `--commit`, Gate caps an otherwise-`ship` report at `canary`: a report about a _different_ commit than the one under review.

(The team considered a git-timestamp cross-check for this purpose, and **rejected** it. Timestamps are too unreliable, and a timestamp check does not even catch the wrong-commit case. The [roadmap](./docs/roadmap.md) explains why, and what shipped instead.)

**Not yet built, on the authoring side:**

- [ ] Starter templates for common frameworks (Jest, pytest, Playwright)
- [ ] Step-by-step guide: unit tests, then integration tests, then E2E tests
- [ ] Decision tree: "which test type for this scenario?"

## Examples

### Example 1: New Feature

```
# You build a booking system. First:
/test-plan "A user books a room from 9am to 5pm. No overlaps."

# This plan gives you: the happy path, edge cases (the midnight boundary, a double booking),
# error paths, and a recommended test layer for each case.
# You and Claude use this plan to write the code and the tests.

# Later, when you finish the tests:
/coverage-review booking.test.js booking.ts
/qa-pass booking-feature-branch
```

### Example 2: AI Code Review

```
# AI just wrote 500 lines of test code. Before you merge:
/coverage-review UserService.test.js UserService.ts

# Problems found:
# - The tests pass, but they do not assert the structure.
# - The database error path has no test.
# - The date boundary has no coverage.

# Tell Claude: "Fix these gaps."
# Run /qa-pass again when you finish.
```

### Example 3: Production Bug

```
# Production bug: "The date filter broke."
/bug-report "The date filter on the /books page is broken. It returns empty results. The browser console shows that dateRange.start is undefined."

# Output: a structured bug report, with severity, steps to reproduce, and scope.

# Now find the cause:
/debug-test "date filter test"
# This skill reads the test file, runs it, and finds the root cause automatically.
```

## Philosophy

Testing is not about a passing status. Testing is about confidence. A test suite that passes, but does not catch real bugs, is worse than no tests at all. Such a suite gives you false confidence, while your code degrades underneath it. Three ideas support this:

1. **Tests verify behavior.** An assertion states: "If this fails, something is truly broken." An assertion does not state: "I made the test pass."
2. **Quality is testable.** Code that is hard to test gives you a signal. This signal often means hidden dependencies, unpredictable behavior, or weak assumptions. Fix the code, not the test.
3. **Practical work over perfect work.** You do not need 100% coverage. You do not need zero technical debt. You need to ship fast, and verify that your code works.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the reasons behind specific design choices: why the repository uses many small skills instead of one, why it uses a 3-state verdict, and what the tradeoffs are.

## It's Working If

- `/audit-test` gives you a **Confirmed** or **Likely** label, never a bare score.
- A caught mutation only claims to cover _that one_ break — not "this test is good."
- `/gate` never marks `ship` from a plain passing E2E run alone; it needs a passed `audit-test` minimum too.
- `/qa-pass` gives you 🟢, 🟡, or 🔴, not a pass/fail — and you use the color to decide your next step, not to stop there.
- A `--digest` card never states a stronger label than the full report would.
- Every judgment report ends with a `Next:` footer, so you always have a next step without re-running `/qa-compass`.

If a report ever _does_ invent a score, silently upgrades a label, or asserts something it did not run, that is a bug in the skill — file it. See [Contributing & Support](#contributing--support).

## FAQ

**Q: Will this replace my QA team?**
A: No. These skills help you think like a QA professional. They help you catch obvious gaps. A real QA team catches things that AI never will.

**Q: Is this useful if I do not write tests?**
A: Yes, but the value is lower. The skills are most useful when you actively write or review tests.

**Q: What if I do not use Claude Code?**
A: These skills are structured procedures and checklists. Adapt them to your own workflow.

**Q: How do I "ship" the report from `/qa-pass`?**
A: The choice is yours. Copy the report into your pull request. Post it to Slack. Use it in code review. `/qa-pass` is a tool for thought. `/gate` is the skill that gives an explicit `ship`, `canary`, or `hold` recommendation.

## Contributing & Support

**One person maintains this repository, with the same rigor that it asks from your tests.** One QA engineer works on it. There is no team, and no SLA. A CI-gated evaluation covers every skill. An ADR records every non-trivial decision; 52 ADRs exist so far. Every claim carries an evidence label.

No user beyond the maintainer has confirmed this repository, yet. If you are the first user, or if a skill's judgment seems wrong, file an issue. Real use, against real code, improves these skills. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) · Made by Kim, a QA professional. AI writes the tests. A person still checks if the tests have value. That check is still the real job.
