# Kim Bell's QA Skills

**Know which green tests you can trust.**

Some of your passing tests would catch a real regression. Some would stay green while the behaviour broke underneath them — and a coverage number can't tell you which is which. That gap is the **coverage illusion**.

There's a direct way to find out: break the code a test covers on purpose, then check whether the test fails. Mutation tools do exactly this — StrykerJS, Tautest — but only for unit tests. They change your source and re-run it under Vitest or Jest, so a Playwright or Cypress test driving a real browser is out of their reach. And the browser-test tooling pushes the other way: Playwright's and Cypress's own agents write and repair tests *toward* green, and the healer, if it decides the functionality itself is broken, marks the test skipped instead of repairing it.

**[`/audit-test`](./skills/audit-test/SKILL.md)** breaks the code behind a Playwright or Cypress test and checks whether the test notices — it picks the change most likely to expose the test, applies it to your dev-served app, runs that one test, and reports what happened. A kill confirms the test catches _that specific_ break — not any break; a survivor is execution-grounded proof it's hollow. Findings are labelled **Confirmed** or **Likely**, never an invented score.

Start there — one test, one command, no adoption required. Behind it sits a seven-stage map of which free tool to reach for at each point in the QA workflow, with these skills filling the gaps those tools leave.

Built by a QA professional tired of AI tests that pass but don't catch real bugs.

## Install

```
/plugin marketplace add TzolkinB/skills
/plugin install kimbell-skills@kimbell
```

## Update

Claude Code has no single update command for a marketplace-installed plugin — refresh the marketplace listing, then reinstall to pick up the new version:

```
/plugin marketplace update kimbell
/plugin install kimbell-skills@kimbell
```

Then, in any Claude Code session:

```
/audit-test app.test.js app.js
/coverage-review UserService.test.ts UserService.ts
/gate test-results/results.json --audit-test-json=audit.json
```

## The skills, by the moment you'd reach for one

Not sure? Run `/qa-compass` and describe your situation — it routes you to the one that fits, including to external tools when they're the better answer.

### The coverage illusion — your suite is green, but is it protecting anything?

The core of this plugin. A high **test coverage** number and a green suite say a test *ran*; none of them say it would have *failed*.

- **[`/audit-test`](./skills/audit-test/SKILL.md)** _(user-invoked)_ — A test passes but you don't trust it: run one targeted, behaviorally-meaningful mutation and report what happened — a killed mutation confirms the test catches _that specific_ break (not any break), a survivor is execution-grounded proof it's hollow. Labels findings **Confirmed** vs **Likely**, never an invented score. Runs on dev-served Playwright/Cypress, not just unit tests. _(You can still point it at a whole file or directory — batch mode triages all of it. The isolation need is narrower: proving any one flagged Cypress test requires a one-test spec or the `@cypress/grep` plugin, since `cypress run --spec` otherwise runs the whole file; without that, the test being deep-audited falls back to 🟡.)_
- **[`/coverage-review`](./skills/coverage-review/SKILL.md)** _(user-invoked)_ — After AI writes tests: find the missing cases and the assertions too loose to fail.
- **[`/audit-orchestrator`](./skills/audit-orchestrator/SKILL.md)** _(user-invoked)_ — A suspicious passing test: route it to the tool that can actually prove it (Tautest/StrykerJS at the unit layer, `/audit-test` for app-driven tests).
- **[`/prune-tests`](./skills/prune-tests/SKILL.md)** _(user-invoked)_ — The suite feels slow or noisy: cut tests that cost more than they protect (proposes before it deletes).

### Before the code exists

- **[`/test-plan`](./skills/test-plan/SKILL.md)** _(user-invoked)_ — Define what to test and at which layer (`unit`/`component`/`integration`/`e2e`).
- **[`/qa-review`](./skills/qa-review/SKILL.md)** _(user-invoked)_ — During code review: catch untestable code before it ships.
- **[`/threat-model`](./skills/threat-model/SKILL.md)** _(user-invoked)_ — Before shipping something risky: what breaks in production, and would you notice — ranked by how long a failure would go unseen.

### Something is red, flaky, or drifting

- **[`/debug-test`](./skills/debug-test/SKILL.md)** _(user-invoked)_ — A Playwright test is failing: auto-diagnose and route the fix. Its flake mode — the one part of this skill that also covers Cypress — detects and **quarantines** rather than healing to green: a healed locator can leave a test passing while silently no longer checking what it was written to check.
- **[`/contract-guard`](./skills/contract-guard/SKILL.md)** _(user-invoked)_ — A frontend suite reddens on backend drift: check the consumer's expectations against the provider's published OpenAPI.
- **[`/bug-report`](./skills/bug-report/SKILL.md)** _(user-invoked)_ — Something broke: structure it into a clean handoff for the team.

### Around a PR

- **[`/e2e-impact`](./skills/e2e-impact/SKILL.md)** _(user-invoked)_ — Which user journeys does this PR touch? Maps a diff to the Playwright/Cypress specs it plausibly hits, with an explicit "can't tell, run everything" bucket rather than a confident guess.
- **[`/qa-pass`](./skills/qa-pass/SKILL.md)** _(model-invoked)_ — Before you merge: one QA judgment pass over your branch, reduced to 🟢 / 🟡 / 🔴 (a read to act on, not a release gate).
- **[`/qa-compass`](./skills/qa-compass/SKILL.md)** _(model-invoked)_ — The front door: describe your situation and get routed to the one skill that answers it, plus where it sits in the flow.

## Gate

The release-decision layer: it never runs a suite, it **ingests the evidence a PR already produced**.

### User-invoked

- **[`/gate`](./skills/gate/SKILL.md)** — At the end of a PR, when you want **release readiness** you can show someone: bind your existing Playwright/Cypress results and an `audit-test` verdict into one readable evidence bundle, and derive an advisory `ship` / `canary` / `hold` decision by **worst-wins** (any input says `hold` → `hold`; else any says `canary` → `canary`; else `ship`). Playwright's JSON reporter writes its result to disk on its own; Cypress doesn't, so it needs a small Module API wrapper first — [`docs/gate.md`](./docs/gate.md) has it.

  The decision is deterministic code and carries **no confidence number**. It's advisory — it doesn't abort your build. A bare green E2E run can never launder into `ship` on its own: that needs a parsed `audit-test` verdict clearing an examined-floor, and a suite that ran only a sliver of what it discovered is capped at `canary`. Optionally DSSE-signed with your own ed25519 key so a reader can verify the bundle wasn't altered — self-signed, **not** Sigstore, and never a claim that any producer was honest.

  The floors are necessary, not sufficient, and their exact limits are worth reading before you rely on them: [what the floors do and don't catch](./docs/gate.md#what-the-floors-do-and-dont-catch).

## Where this fits — the ecosystem, and when to use what

These skills don't replace mature test tooling that already exists — they **compose** with it and
fill the one gap it leaves. The single source of truth for _which tool, for which job, in what
order_ is the orchestration map:

- **[The AI-Test Tooling Orchestration Map](./docs/orchestration-map.md)** — a seven-stage QA workflow
  (Plan → Author → Audit → Coverage → Flake → Triage → Gate), each stage naming the **best free tool**,
  **the wall where it stops**, and **where one of these skills fills the gap** — every recommendation
  carrying a provenance label (Confirmed / Likely / Unexamined), no unproven claim presented as advice.

**Deciding between a specific tool and one of these skills?** The head-to-head notes state the boundary
plainly, in the other tool's favor where it wins:

- **[vs. mutation tools (Stryker / Tautest / Exspec / Pitest·Arcmutate)](./docs/comparisons/mutation-tools.md)**
  — at the **unit** layer, run the mutation tool (it wins on false confidence there); reach for
  `audit-test` at the **app-driven E2E** layer those tools structurally can't enter; Gate composes the
  evidence, it doesn't verify.
- **[vs. TEA (BMAD Test Architect)](./docs/comparisons/tea.md)** — use TEA for risk planning and its
  governance gate. Reach for these skills for the mutation check its docs show it can't do — and note
  that its **requirements traceability** marks a requirement covered because a matching test *exists*,
  never because that test would fail. Presence is not proof; that's the seam `audit-test` fills.

## Dependencies

Most of these skills are self-contained — they statically read your code and tests and need nothing beyond Claude Code. Two reach for external tools: **`/debug-test` requires them to run at all**, and **`/audit-orchestrator` optionally routes to them** (falling back to a self-contained skill when they're absent). Install these before you rely on them.

| Needed by                                         | Tool                                                           | Install                                         | If missing                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `/debug-test` (all of it)                         | **Playwright**                                                 | already in your project (`npx playwright test`) | Skill can't run — it is Playwright-scoped                                    |
| `/debug-test` auto-heal (locator/timing failures) | **Playwright agents**                                          | `npx playwright init-agents` (once per repo)    | Falls through to `diagnosing-bugs` instead of self-healing                   |
| `/debug-test` logic diagnosis                     | **Matt Pocock's `diagnosing-bugs` skill**                      | `npx skills@latest add mattpocock/skills`       | Deep bug diagnosis has no terminal route — `/debug-test` stalls after triage |
| `/audit-orchestrator` unit-test route             | **Tautest** (PR diff-mutation) / **StrykerJS** (full campaign) | per each tool's own Vitest/Jest setup           | No hard dependency — routes the audit to `/audit-test` instead               |

`diagnosing-bugs` is load-bearing: when Playwright agents aren't set up, locator failures route to it too, so `/debug-test` leans on it for anything past a clean auto-heal. Installing Matt Pocock's skills alongside these is recommended — the two compose by design: **build with Matt's skills, verify with these.**

Every other skill (`/test-plan`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/bug-report`, `/qa-review`, `/threat-model`, `/e2e-impact`, `/contract-guard`, `/qa-compass`, `/qa-pass`, `/gate`) needs only Claude Code — `/contract-guard` optionally reads a published OpenAPI spec from a URL you supply, and `/gate` reads result files you already produced, but neither requires an install.

## Privacy — what each skill reads, runs, and routes externally

These skills add no network calls of their own — none sends your code to a third-party service. The only outbound request any skill makes is `/contract-guard` optionally fetching a published OpenAPI spec from a URL _you_ explicitly supply (a static document, never your code). They run _inside_ Claude Code, so your code is processed by Anthropic's API exactly as in any Claude Code session (that transport is the platform, not a skill call); the only Anthropic call in this repo is maintainer tooling — the eval harness ([`evals/lib/judge-llm.mjs`](./evals/lib/judge-llm.mjs)), not a skill you run. The table below spells out what each skill touches so you can run it on private code with confidence.

| Skill                 | Reads                                                                                                                                                                  | Runs (executes)                                                                                                                                                                                                                                                                                                                                              | Routes externally                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/qa-compass`       | Your description of the situation + your stack manifests (`package.json`, a `playwright.config.*`/`cypress.config.*`, a published `openapi`/`swagger` doc, if present) | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing — points you at the right skill, doesn't invoke it                                                                                                         |
| `/test-plan`          | A feature description you provide                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing                                                                                                                                                            |
| `/coverage-review`    | Your test file + code file                                                                                                                                             | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing                                                                                                                                                            |
| `/audit-test`         | The passing test(s) + the code they cover                                                                                                                              | One mutation at a time, reverted before the next, on a clean git tree — single-test mode runs one; batch mode fans this out across every flagged test, and `--certify` can run into the hundreds on a large suite. A crashed session can leave one mutation live; recovering it (`git checkout -- <file>`) is a manual step, not a guarantee the skill makes | Nothing                                                                                                                                                            |
| `/prune-tests`        | The test suite                                                                                                                                                         | Read-only by default; `--apply` edits/removes flagged tests and reruns the affected ones locally                                                                                                                                                                                                                                                             | Nothing                                                                                                                                                            |
| `/qa-review`          | The code under review                                                                                                                                                  | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing                                                                                                                                                            |
| `/threat-model`       | The change / diff                                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing                                                                                                                                                            |
| `/bug-report`         | A failure description you provide                                                                                                                                      | Nothing                                                                                                                                                                                                                                                                                                                                                      | Nothing                                                                                                                                                            |
| `/e2e-impact`         | The diff + your E2E specs and source                                                                                                                                   | `git` locally (read-only) to resolve the diff                                                                                                                                                                                                                                                                                                                | Nothing                                                                                                                                                            |
| `/audit-orchestrator` | The test under audit + your test configs                                                                                                                               | Detection locally (Glob/Read/`git`); hands off to `/audit-test` or points you at Tautest/StrykerJS                                                                                                                                                                                                                                                           | **Yes** — routes to `/audit-test` or the external mutation tools, all run locally in your session (see [Dependencies](#dependencies))                              |
| `/contract-guard`     | The consumer code + the published contract (a local file, or a URL you point it at)                                                                                    | Reads the spec — a local file, or a read-only `GET` on the URL you supply                                                                                                                                                                                                                                                                                    | Routes to `/bug-report` locally; the only network touch is fetching the published-spec URL you provide — your code is never sent out                               |
| `/debug-test`         | The failing Playwright test + code                                                                                                                                     | Runs the Playwright test locally                                                                                                                                                                                                                                                                                                                             | **Yes** — routes to the Playwright healer agent and to Matt Pocock's `diagnosing-bugs` skill (both run locally in your session; see [Dependencies](#dependencies)) |
| `/qa-pass`           | Files in the change                                                                                                                                                    | Composes the skills above; runs only what they run                                                                                                                                                                                                                                                                                                           | Only whatever `/debug-test` routes to, and only when a failing test is present                                                                                     |
| `/gate`               | A Playwright/Cypress result file + (optional) an `audit-test` emission/report you pass in                                                                              | Its bundled Node script locally + `git rev-parse HEAD` for the subject                                                                                                                                                                                                                                                                                       | Nothing                                                                                                                                                            |

`/debug-test` and `/audit-orchestrator` hand work to external tooling; `/contract-guard` may fetch a published OpenAPI spec from a URL you supply, but never sends your code anywhere. Everything else statically reads and reasons, and the two skills that do execute (`/audit-test`, `/prune-tests --apply`) stay gated on a clean git tree. Both are prose skills, not executables — their verdicts are the agent's own account of what it ran in your session, not an independently verified measurement; watch the tool calls.

## New to testing? Start here

Pedagogical skills — `/qa-review`, `/threat-model`, `/qa-pass`, `/coverage-review`, `/test-plan`, `/audit-test`, `/bug-report`, `/prune-tests` — support a `--explain` flag. Default output stays terse for daily use; add `--explain` and each report includes a "Why This Matters" section that teaches the underlying concept, not just the finding — e.g. `/qa-review UserService.ts --explain`.

Procedural skills — `/debug-test`, `/audit-orchestrator`, `/contract-guard`, `/e2e-impact`, `/gate` — don't support `--explain`; they run a fixed check rather than reasoning toward a teachable finding.

## In a hurry? `--digest`

The judgment skills — `/test-plan`, `/qa-review`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/threat-model`, `/qa-pass` — also take a `--digest` flag, the opposite of `--explain`. It replaces the full report with at most three evidence cards, each one line of risk, the specific evidence behind it, one concrete action, and the `Confirmed` / `Likely` / `Unexamined` label that says how well it's known — e.g. `/audit-test tests/booking.spec.ts --digest`. It's a *trim*, not a summary: a digest can only say less than the report it replaces, and it never upgrades a label (a reasoned finding stays `Likely` however short the card gets). The one format is defined once in [`skills/shared/digest-format.md`](./skills/shared/digest-format.md) ([ADR-0048](./docs/adr/0048-shared-digest-card-and-inline-next-footers.md)).

Every judgment report — full or digest — ends with a one-line **`Next:`** footer naming the single step that follows *this* result, so you don't have to run `/qa-compass` again to find out what to do with what you're holding. The routing map stays `/qa-compass`'s; the footer is the shortcut into it ([`skills/shared/next-footers.md`](./skills/shared/next-footers.md)).

(The `--digest` seven and the `--explain` eight are deliberately different sets: `/bug-report` teaches but has no findings to compress, so it takes `--explain` and not `--digest`.)

Unfamiliar terms in any report (boundary condition, flaky test, loose assertion, etc.) are defined in [`GLOSSARY.md`](./GLOSSARY.md).

If you're a QA professional reviewing this and want to give feedback, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the specific questions worth asking.

## Existing Project Bootstrap (One-Time)

Use this when adding these skills to a repo that already has tests.

1. Pick critical-path tests first (auth, payments/PII, state transitions, core journey flows).
2. Use `/test-plan` for upcoming work and ensure every case gets a layer recommendation (`unit`/`component`/`integration`/`e2e`).
3. Classify a small set of existing high-value tests to create an initial layer baseline.
4. Record an initial distribution (for example: `3 unit / 5 component / 7 integration / 4 e2e`).
5. Keep only thin critical-path browser journeys in `e2e`; if a case still passes with a browser replaced by API/client calls, move it toward `integration`.
6. From that point forward, treat the `/qa-pass` report layer distribution as your per-PR drift signal.

Bootstrap is intentionally lightweight. You do not need to classify the entire legacy suite on day one.

## Roadmap

`/gate` and `/audit-test` deliberately shipped narrower than they could be — see
[`docs/roadmap.md`](./docs/roadmap.md) for what's deferred, why, and the order it's being
picked back up. Four of the original items are closed (a taxonomy-wording fix, coverage-aware
ship semantics, real evidence signing, and report-to-commit provenance); one build remains:

- **Calibration loop** — a real confidence number instead of a bare category.

Report-to-commit provenance shipped ([#177](https://github.com/TzolkinB/skills/issues/177)):
the Playwright/Cypress ingest adapters and the `audit-test` emission now record the git commit
they ran against, and Gate caps an otherwise-`ship` report at `canary` when that recorded commit
doesn't match `--commit` — a report about a _different_ commit than the one being gated. (A
git-timestamp cross-check was considered and **rejected** as the mechanism — timestamps are too
flaky and don't even catch the wrong-commit case; the [roadmap](./docs/roadmap.md) explains why,
and what shipped instead.)

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
/qa-pass booking-feature-branch
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
# Run /qa-pass again when it's done
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

**Q: How do I "ship" the report from `/qa-pass`?**
A: That's up to you — copy it into your pull request, post it to Slack, use it in code review. `/qa-pass` is a tool for thinking; `/gate` is the one that emits an explicit ship/canary/hold recommendation.

## Contributing & Support

**Solo-maintained, built with the same rigor it asks of your tests.** One QA engineer, no team, no SLA — every skill is covered by a CI-gated eval, every non-trivial decision is recorded as an ADR (52 and counting), and every claim carries an evidence label. No confirmed users beyond the maintainer yet — if you're the first, or a skill's judgment seems off, please file an issue. Real usage against real code is what sharpens these skills. See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

[MIT](./LICENSE) · Made by Kim, a QA professional. AI can write the tests; knowing whether they have value is still the job.
