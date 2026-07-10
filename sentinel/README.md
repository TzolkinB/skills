# Sentinel

**QA-first testing skills for Claude Code.** Verify behavior, not green lights.

## What Is Sentinel?

Sentinel is a judgement layer for your tests. It exists for one problem: AI writes tests that make assertions pass without proving anything — tests that stay green even when you break the very behavior they claim to guard. A suite like that isn't protection; it's false confidence, and false confidence is worse than no tests at all.

Built by a QA professional who got tired of:
- AI tests that pass but don't catch real bugs
- Massive code review backlogs with no time to verify quality
- Bloated file structures with no clear testing strategy
- Job descriptions requiring "AI proficiency" but not thinking about quality

## What You Get

Nine QA-focused skills — eight atomic skills you run standalone, plus the `/sentinel` orchestrator that composes them into one verdict. **Find your situation in the "When to use it" column**, then open the skill's **doc page** (what it does, when to use / when not, a worked example against the fixtures, anti-patterns) or its agent-facing **`SKILL.md`** (the instructions Claude runs):

| Skill | When to use it | Docs | Agent instructions |
|-------|----------------|------|--------------------|
| `/test-plan` | Before you write code or tests — define what to test and at which layer (`unit`/`component`/`integration`/`e2e`) | [docs](./docs/test-plan.md) | [SKILL.md](./skills/test-plan/SKILL.md) |
| `/qa-review` | During code review — catch untestable code before it ships | [docs](./docs/qa-review.md) | [SKILL.md](./skills/qa-review/SKILL.md) |
| `/coverage-review` | After AI writes tests — find the missing cases and loose assertions | [docs](./docs/coverage-review.md) | [SKILL.md](./skills/coverage-review/SKILL.md) |
| `/audit-test` | A test passes but you don't trust it — prove it would fail if the code broke | [docs](./docs/audit-test.md) | [SKILL.md](./skills/audit-test/SKILL.md) |
| `/prune-tests` | The suite feels slow or noisy — cut tests that cost more than they protect | [docs](./docs/prune-tests.md) | [SKILL.md](./skills/prune-tests/SKILL.md) |
| `/threat-model` | Before shipping something risky — what breaks in production, and would you notice | [docs](./docs/threat-model.md) | [SKILL.md](./skills/threat-model/SKILL.md) |
| `/debug-test` | A Playwright test is failing — auto-diagnose and route the fix | [docs](./docs/debug-test.md) | [SKILL.md](./skills/debug-test/SKILL.md) |
| `/bug-report` | Something broke — structure it into a clean handoff for the team | [docs](./docs/bug-report.md) | [SKILL.md](./skills/bug-report/SKILL.md) |
| `/sentinel` | Before you ship — one full quality pass on your branch (🟢 PASS / 🟡 CAUTION / 🔴 FAIL) | [docs](./docs/sentinel.md) | [SKILL.md](./skills/sentinel/SKILL.md) |
| `/ask-sentinel` (router) | Not sure which to reach for — describe the situation, get routed | [docs](./docs/ask-sentinel.md) | [SKILL.md](./skills/ask-sentinel/SKILL.md) |

### `/test-plan`
Generates a real test plan from a feature description:
- Acceptance criteria
- Happy path + edge cases
- Error paths and preconditions
- Recommended layer per case (`unit` / `component` / `integration` / `e2e`)

Written to find bugs, not to make a green light.

### `/coverage-review`
Reads your test file and code. Flags:
- What SHOULD be tested but isn't
- Loose or missing assertions
- Untested error paths
- Boundary conditions you forgot

The opposite of "make it pass."

### `/audit-test`
Interrogates a *passing* test: would it actually fail if the code it covers broke?
- Proposes the single code change most likely to expose a false-confidence test
- Runs that targeted mutation and checks whether the test stays green (proof), or reasons it out when the code can't be run (fallback)
- Labels findings as **Proven** vs **Likely** false-confidence — never an invented score

Distinct from `coverage-review` (finds *missing* coverage) — this hunts tests that exist but protect nothing.

### `/prune-tests`
Looks across the whole suite for tests that cost more than they protect:
- Low-value / redundant tests that duplicate confidence something else already provides
- Over-mocked tests that verify fakes instead of behavior
- Out-of-sync (stale) tests whose name or intent no longer matches what they assert

Proposes before it deletes; `--apply` edits or removes flagged tests and reruns the affected ones to confirm. The subtractive counterpart to `coverage-review`.

### `/bug-report`
Converts a messy failure into a structured bug report:
- Steps to reproduce
- Expected vs actual
- Severity, environment, affected scope
- Ready to paste into Jira/Linear/GitHub Issues

### `/qa-review`
Code review from a QA angle:
- Is this even testable?
- Hard-coded dependencies?
- Non-deterministic behavior (Date.now, Math.random)?
- Will tests be flaky?

Orthogonal to "is the code clean?"

### `/threat-model`
Independent of testability or coverage — asks what actually breaks in production if this is wrong:
- What does this change touch (data, external systems, downstream dependents)?
- Failure mode, blast radius, detectability, reversibility
- Ranked by impact weighted by how long a failure would go unnoticed — not by how likely you think it is (a silent failure outranks a loud one)

Doesn't run anything, doesn't prescribe a rollback plan it can't verify — flags reversibility as an open question, not an answer. Deliberately separate from `qa-review`; call it whenever you want the "what could go wrong" view without waiting on a full testability pass.

### `/debug-test`
Automatically diagnose a failing Playwright test — no describing required:
- Reads the test file and runs it directly
- Applies fast QA heuristics (setup, assertion, code logic)
- Routes to the Playwright healer for locator/timing failures
- Escalates to a full diagnostic loop for logic failures

Scoped to Playwright. For non-Playwright failures, invoke diagnosing-bugs directly.

> **Requires external tools** — Playwright, and Matt Pocock's `diagnosing-bugs` skill for logic-bug diagnosis. See [Dependencies](#dependencies) below.

### `/sentinel`
The orchestrator — the only skill that does no original analysis of its own. It composes the shippability skills (`/test-plan`, `/coverage-review`, `/qa-review`, and `/debug-test` on any failing tests) across your branch and reduces their output to one decision:
- Test plan coverage
- Layer distribution snapshot (`unit/component/integration/e2e`)
- Assertion quality audit
- Testability issues
- Risk summary
- Verdict: 🟢 PASS / 🟡 CAUTION / 🔴 FAIL

`/threat-model` and `/bug-report` are deliberately *not* in the `/sentinel` chain — they answer questions (what breaks in production; how to hand off) that are orthogonal to shippability. `/sentinel` is a layer above the atomic skills, not a peer of them.

### `/ask-sentinel` (router)
Not one of the nine — the front door. Describe your situation (*"AI just wrote 500 lines of tests"*, *"a Playwright test is red"*, *"about to merge"*) and it points you at the one skill that answers your question and shows where it sits in the flow. It routes; it never analyzes, runs, or emits a verdict, and it never joins the `/sentinel` chain. Run `/ask-sentinel` with no argument for the full map.

## Dependencies

Most Sentinel skills are self-contained — they statically read your code and tests and need nothing beyond Claude Code. **`/debug-test` is the exception:** it orchestrates external tools, so install these before you rely on it.

| Needed by | Tool | Install | If missing |
|-----------|------|---------|------------|
| `/debug-test` (all of it) | **Playwright** | already in your project (`npx playwright test`) | Skill can't run — it is Playwright-scoped |
| `/debug-test` auto-heal (locator/timing failures) | **Playwright agents** | `npx playwright init-agents` (once per repo) | Falls through to `diagnosing-bugs` instead of self-healing |
| `/debug-test` logic diagnosis | **Matt Pocock's `diagnosing-bugs` skill** | `npx skills@latest add mattpocock/skills` | Deep bug diagnosis has no terminal route — `/debug-test` stalls after triage |

`diagnosing-bugs` is the load-bearing one: when Playwright agents aren't set up, locator failures also route to it, so `/debug-test` leans on it for anything past a clean auto-heal. Installing Matt Pocock's skills alongside Sentinel is recommended — the two are designed to compose: **build with Matt's skills, verify with Sentinel.**

Every other skill (`/test-plan`, `/coverage-review`, `/audit-test`, `/prune-tests`, `/bug-report`, `/qa-review`, `/threat-model`, `/sentinel`) needs only Claude Code.

## Privacy — what each skill reads, runs, and routes externally

Sentinel is local-first. No skill sends your code to any third-party service, and nothing here calls a network API on your behalf. The table below spells out exactly what each skill touches so you can run it on private code with confidence.

| Skill | Reads | Runs (executes) | Routes externally |
|-------|-------|-----------------|-------------------|
| `/test-plan` | A feature description you provide | Nothing | Nothing |
| `/coverage-review` | Your test file + code file | Nothing | Nothing |
| `/audit-test` | The passing test + the code it covers | A single targeted mutation + one test run, on a clean git tree (always revertible) | Nothing |
| `/prune-tests` | The test suite | Read-only by default; `--apply` edits/removes flagged tests and reruns the affected ones locally | Nothing |
| `/qa-review` | The code under review | Nothing | Nothing |
| `/threat-model` | The change / diff | Nothing | Nothing |
| `/bug-report` | A failure description you provide | Nothing | Nothing |
| `/debug-test` | The failing Playwright test + code | Runs the Playwright test locally | **Yes** — routes to the Playwright healer agent and to Matt Pocock's `diagnosing-bugs` skill (both run locally in your session; see [Dependencies](#dependencies)) |
| `/sentinel` | Files in the change | Composes the skills above; runs only what they run | Only whatever `/debug-test` routes to, and only when a failing test is present |

`/debug-test` is the one skill that hands work to external tooling. Everything else statically reads and reasons, and the two skills that do execute (`/audit-test`, `/prune-tests --apply`) stay surgical and gated on a clean git tree.

## Installation

Add the marketplace, then install Sentinel by name:

```
/plugin marketplace add TzolkinB/skills
/plugin install sentinel@skills
```

To install from a local checkout instead:

```
/plugin marketplace add ./
/plugin install sentinel@skills
```

Then in any Claude Code session:

```
/test-plan "booking room app"
/coverage-review app.test.js app.js
/audit-test app.test.js app.js
/prune-tests
/bug-report "date filter doesn't work"
/qa-review BookingService.js
/debug-test tests/my.spec.ts
/sentinel
```

## Philosophy

Testing isn't about green lights. It's about confidence. A test suite that passes but doesn't catch real bugs is worse than no tests—it gives you false confidence while your code rots.

Sentinel is built on three premises:

1. **Tests verify behavior.** An assertion should say "if this fails, something is genuinely broken," not "I made the test pass."

2. **Quality is testable.** Code that's hard to test is a signal it has hidden dependencies, non-deterministic behavior, or brittle assumptions. Fix the code, not the test.

3. **Pragmatism over perfection.** You don't need 100% coverage or zero technical debt. You need to ship fast and be able to verify it works. Sentinel helps you do that.

For the reasoning behind specific design choices — why nine skills instead of one, why a 3-state verdict, what the tradeoffs are — see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## New to testing? Start here

Every skill except `/debug-test` supports a `--explain` flag (`/debug-test` is procedural, not pedagogical). Default output stays terse for daily use; add `--explain` and each report includes a "Why This Matters" section that teaches the underlying concept, not just the finding — e.g. `/qa-review UserService.ts --explain`.

Unfamiliar terms in any report (boundary condition, flaky test, loose assertion, etc.) are defined in [`GLOSSARY.md`](./GLOSSARY.md).

If you're a QA professional reviewing this and want to give feedback, see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the specific questions worth asking.

## Existing Project Bootstrap (One-Time)

Use this when adding Sentinel to a repo that already has tests.

1. Pick critical-path tests first (auth, payments/PII, state transitions, core journey flows).
2. Use `/test-plan` for upcoming work and ensure every case gets a layer recommendation (`unit`/`component`/`integration`/`e2e`).
3. Classify a small set of existing high-value tests to create an initial layer baseline.
4. Record an initial distribution (for example: `3 unit / 5 component / 7 integration / 4 e2e`).
5. Keep only thin critical-path browser journeys in `e2e`; if a case still passes with a browser replaced by API/client calls, move it toward `integration`.
6. From that point forward, treat the `/sentinel` report layer distribution as your per-PR drift signal.

Bootstrap is intentionally lightweight. You do not need to classify the entire legacy suite on day one.

## Roadmap

Not built yet, but planned as this gets used for real:
- [ ] Starter templates for common frameworks (Jest, pytest, Playwright)
- [ ] Progressive guide: unit → integration → E2E testing
- [ ] Decision tree: "which test type for this scenario?"
- [ ] Real test-runner integration (read actual coverage output, not just static analysis — see ARCHITECTURE.md tradeoffs)

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

### Example 4: Before / After

**Before:**
- Claude generates code + tests (tests all pass, but don't verify anything)
- You review manually, frustrated, can't keep up
- Something breaks in production

**After:**
- Claude generates code + tests
- You run `/sentinel` before merging
- It flags: "tests pass but don't verify booking collisions"
- You tell Claude: "fix this gap"
- `/sentinel` again — all good, ship it

## Contributing

This is a personal framework. If you find it useful, fork it. If you have ideas:

1. Try the skills on your own code
2. See what works and what doesn't
3. Document what you learned
4. Build on it

Testing is collaborative. There's no "one right way"—just ways that work for your team.

## FAQ

**Q: Will this replace my QA team?**
A: No. Sentinel helps you think like a QA professional and catch obvious gaps. A real QA team catches things AI never will.

**Q: Can I use this if I don't write tests?**
A: Yes, but the value is lower. Sentinel is most useful when you're actively writing/reviewing tests.

**Q: What if I don't use Claude Code?**
A: These are just frameworks and checklists. Adapt them to your workflow.

**Q: How do I "ship" the report from `/sentinel`?**
A: That's up to you. Copy it into your pull request, post it to Slack, use it in code review. It's a tool for thinking, not a gate.

## Support

This is a personal project, built and maintained by one QA engineer. If something doesn't work, or a skill's judgment seems off, please file an issue — real usage against real code is exactly what sharpens these skills.

---

**Made by Kim, a QA professional learning AI.**
AI can write the tests. Knowing whether they'd actually catch a bug is still the job — that's what Sentinel is for.
