You’re right. The better analysis is **not** “Matt has 21 skills, Sentinel has 7.” That framing is wrong and strategically weak.

The right framing is:

> **Matt Pocock’s skills help agents build better software. Sentinel helps stop agents from convincing themselves the software is good just because tests are green.**

That is a complementary position, not a competitive one.

Matt’s repo is a mature engineering workflow system: setup, alignment, specs, tickets, implementation, TDD, debugging, code review, research, architecture, and handoff. His README explicitly frames the skills as “small, easy to adapt, and composable,” and his quickstart includes installer/setup flow, issue tracker choices, labels, and docs location configuration. ([GitHub][1]) Sentinel should plug into that system as the **QA verification layer**: after the agent builds, tests, debugs, or reviews, Sentinel asks whether the tests actually prove behavior. Sentinel’s own README already says the core problem is AI tests that pass but do not catch real bugs, and `coverage-review` is explicitly the “anti-AI-makes-it-pass” skill.

## Blunt revised judgment

Sentinel should **not** position itself as “Matt but QA.” That will lose.

It should position itself as:

> **A QA-focused companion plugin for AI-assisted development workflows, designed to catch false confidence in AI-generated tests before merge.**

That gives you a clean lane.

Matt’s skills already cover broad engineering discipline: alignment, domain language, red-green-refactor, debugging loops, issue workflows, code review, and architecture. His README describes `/grill-with-docs`, `/to-spec`, `/to-tickets`, `/implement`, `/tdd`, `/diagnosing-bugs`, and `/code-review` as part of a composable engineering workflow. ([GitHub][1]) Sentinel should sit **beside and after** those skills, not try to replace them.

Your strongest wedge is not “QA automation.” It is:

> **AI agents optimize for passing feedback loops. Sentinel checks whether the feedback loop is meaningful.**

That is a real QA/SDET insight.

## How Sentinel complements Matt’s workflow

| Matt workflow moment     | What Matt’s skill does well                                                                                                                                                                        | Where Sentinel fits                                                                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/grill-with-docs`       | Clarifies requirements, domain language, ADRs, and decisions before work begins. Matt calls this one of the most powerful techniques in the repo. ([GitHub][1])                                    | Run `/test-plan` after requirements are clarified to convert the decision tree into QA cases, edge cases, unhappy paths, and test-layer recommendations.                                                                 |
| `/to-spec`               | Turns a conversation into a durable implementation spec.                                                                                                                                           | Run `/test-plan` against the spec to ask, “What would prove this works?” not just “What should we build?”                                                                                                                |
| `/implement`             | Builds work from a spec/tickets and drives implementation forward.                                                                                                                                 | After implementation, run `/qa-review` to catch testability issues before the generated tests calcify around bad design.                                                                                                 |
| `/tdd`                   | Establishes red-green-refactor and says tests should verify behavior through public interfaces. ([GitHub][2])                                                                                      | Run `/coverage-review` after the TDD loop to verify the final tests cover real behavior, not implementation-matching or loose assertions.                                                                                |
| `/diagnosing-bugs`       | Provides the disciplined bug loop: reproduce, minimize, hypothesize, instrument, fix, regression-test. Matt’s README describes it as a debugging loop for hard bugs and regressions. ([GitHub][1]) | Run `/debug-test` first for Playwright failures to classify selector/timing/flakiness/assertion problems, then route into Matt’s diagnosing-bugs when it is a deeper logic issue. Sentinel already does this explicitly. |
| `/code-review`           | Reviews the diff against standards and spec fidelity. Matt’s README says it separates standards review from spec review using parallel sub-agents. ([GitHub][1])                                   | Run `/sentinel` after code review to produce the QA-specific pre-merge signal: test plan coverage, loose assertions, testability issues, layer distribution, and PASS/CAUTION/FAIL.                                      |
| Release / merge decision | Matt’s system can improve build quality, but it is not a release-confidence evidence pipeline.                                                                                                     | Sentinel handles human-readable QA judgment now; your separate evidence-pipeline plugin can become the artifact-backed release-confidence layer later.                                                                   |

## Recommended user flow

This is the positioning I would put in the README:

```text
Recommended with Matt Pocock’s skills:

1. Use /grill-with-docs to clarify the change.
2. Use /to-spec or /to-tickets to turn the change into implementation work.
3. Use /implement and /tdd to build with a feedback loop.
4. Use Sentinel:
   - /test-plan to map behavior and test layers
   - /coverage-review to catch tests that pass without proving behavior
   - /qa-review to catch testability and flakiness risks
   - /debug-test for failing Playwright tests
   - /threat-model for production consequence analysis
   - /sentinel before merge for a QA-focused ship/no-ship signal
```

That is much stronger than “compare our skills.”

## Where Sentinel wins

Sentinel wins when the question is:

> “Did the tests actually protect us, or did the agent just make CI happy?”

Matt’s `/tdd` already says tests should verify behavior through public interfaces. ([GitHub][2]) Sentinel’s value is that it operationalizes the QA suspicion that comes **after** the test exists: loose assertions, untested branches, boundary conditions, missing error paths, and false confidence. Your `coverage-review` directly targets that by reading the test and code, identifying what tests actually verify, and flagging loose assertions such as `toBeDefined()`.

That is the line:

> **Matt helps create the feedback loop. Sentinel audits whether that feedback loop deserves trust.**

Keep that.

## Where Sentinel still looks barely baked

Bluntly: the positioning is now clear, but the product still needs polish before public release.

The biggest issue is not feature count. It is **trust polish**.

Your docs still say “Six QA-focused skills” while listing seven, including `/threat-model` and `/sentinel`. That kind of inconsistency makes the project feel unfinished. You also still have install text that says GitHub install is for once it is published, with local install as the current path. That is fine for a private project, but not for something positioned next to Matt’s highly installable workflow.

The more important product gap: Sentinel currently finds **coverage/review issues**, but your own `LEARNINGS.md` admits it lost the explicit “suspicious passing test” workflow when `test-assert` was replaced by `debug-test`. That is exactly the gap your product thesis depends on. A future `/audit-test` skill is already suggested in the file.

That should become priority one.

## Product positioning

Use this as the core public positioning:

> **Sentinel is a QA companion for AI-assisted development. It complements engineering workflow skills like Matt Pocock’s by checking whether AI-generated tests actually verify behavior, cover meaningful risk, and produce release confidence rather than green-light theater.**

More direct variant:

> **Use Matt’s skills to build with discipline. Use Sentinel to verify the tests aren’t lying.**

Do **not** say:

> “Sentinel is better than Matt’s skills for QA.”

Say:

> “Sentinel is designed to run after or alongside broader engineering skills when you need a QA/SDET perspective on whether the tests prove anything.”

## README section to add

Add a section called **“How Sentinel Complements Other Skill Packs”**:

```md
## How Sentinel Complements Matt Pocock’s Skills

Matt Pocock’s skills are excellent for engineering workflow: clarifying requirements, turning ideas into specs, implementing work, practicing TDD, debugging, and reviewing code.

Sentinel is intentionally narrower. It adds a QA/SDET verification layer for AI-generated code and tests.

Use Matt’s skills to build the thing.
Use Sentinel to ask whether the tests actually prove the thing works.

Suggested flow:

1. Run `/grill-with-docs` to clarify the change.
2. Run `/to-spec` or `/to-tickets` to structure the work.
3. Run `/implement` and `/tdd` to build with a feedback loop.
4. Run `/test-plan` to map the expected behavior into testable QA cases.
5. Run `/coverage-review` after tests are generated to catch loose assertions, untested branches, and false confidence.
6. Run `/qa-review` to identify testability and flakiness risks.
7. Run `/debug-test` for failing Playwright tests.
8. Run `/threat-model` when production blast radius matters.
9. Run `/sentinel` before merge for a QA-focused ship/no-ship signal.

Sentinel is not a replacement for engineering workflow skills. It is the QA guardrail that asks whether the feedback loop deserves trust.
```

## GitHub issues to create

### P0 — Reposition Sentinel as a QA companion, not a Matt competitor

**Problem:** Current comparison framing risks positioning Sentinel against a broader, more mature workflow system.

**Requirement:** Update README, landing page, and architecture docs to describe Sentinel as a QA/SDET companion layer for AI-assisted development workflows.

**Acceptance criteria:**

- README includes “Use Matt’s skills to build; use Sentinel to verify the tests aren’t lying.”
- No language implies Sentinel competes with broad engineering workflow packs.
- Add “How Sentinel complements Matt Pocock’s skills” section.
- Add at least one example flow using `/grill-with-docs` → `/tdd` → `/coverage-review` → `/sentinel`.

### P0 — Build `/audit-test` for suspicious passing tests

**Problem:** This is the missing core skill. The product thesis is about false confidence, but `debug-test` only handles failing Playwright tests.

**Requirement:** Add `/audit-test` for a passing test that may not actually prove behavior.

**Acceptance criteria:**

- Input: single test file, test name, or code/test pair.
- Output answers: “Could this test fail for the right reason?”
- Flags tests that do not invoke the unit under test, overmock behavior, assert incidental details, use loose assertions, or only match current implementation.
- Includes “mutation thought experiment”: what code change would break behavior but still let this test pass?
- Distinct from `/coverage-review`, which scans broader test/code coverage.

This should probably be your next real feature.

### P0 — Fix “six vs seven skills” everywhere

**Problem:** Current docs say “Six QA-focused skills” while listing seven. This signals sloppy product readiness.

**Requirement:** Normalize taxonomy.

**Acceptance criteria:**

- README, landing page, architecture, deployment guide, and summary all say seven skills.
- Clarify whether `/sentinel` is counted as a skill or orchestrator.
- Clarify whether `/threat-model` is part of core Sentinel or optional production-risk module.

### P1 — Add “Run after Matt” recipes

**Problem:** Users need obvious moments to invoke Sentinel inside an existing agent workflow.

**Requirement:** Add recipe docs.

**Suggested recipes:**

- After `/tdd`: run `/coverage-review`.
- After `/implement`: run `/qa-review`.
- After `/diagnosing-bugs`: run `/debug-test` or `/bug-report`.
- After `/code-review`: run `/sentinel`.
- Before merge: run `/sentinel` plus `/threat-model`.
- Before release: run your future evidence-pipeline plugin.

### P1 — Define the handoff between Sentinel and the evidence pipeline plugin

**Problem:** Sentinel and the evidence-pipeline plugin could overlap unless you draw a hard boundary.

**Recommended boundary:**

- **Sentinel:** “Does this branch/test suite deserve QA trust?”
- **Evidence pipeline:** “What objective artifacts support release confidence?”

**Acceptance criteria:**

- Sentinel README says it produces human QA judgment, not release evidence.
- Evidence pipeline README says it aggregates artifacts: CI status, Playwright report, coverage report, risk score, manual signoff, known gaps, release recommendation.
- `/sentinel` output can become one input into the evidence pipeline.

### P1 — Add “QA complement matrix” to docs

**Problem:** Users will not know when to use Sentinel versus Matt’s existing skills.

**Requirement:** Add a concise matrix.

Columns:

- Situation
- Matt skill
- Sentinel follow-up
- Why both are useful

Example:

```md
| Situation               | Use Matt         | Then use Sentinel         | Why                                                                       |
| ----------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------------- |
| Starting feature work   | /grill-with-docs | /test-plan                | Align requirements, then convert them into QA-verifiable behavior         |
| Tests written by AI     | /tdd             | /coverage-review          | TDD creates tests; Sentinel checks whether they prove meaningful behavior |
| Failing Playwright test | /diagnosing-bugs | /debug-test or vice versa | Matt gives deep bug loop; Sentinel adds Playwright-specific QA routing    |
| Pre-merge review        | /code-review     | /sentinel                 | Code review checks implementation; Sentinel checks QA confidence          |
```

### P2 — Add confidence language, but avoid fake math

**Problem:** You were right earlier to ask about “weighting confidence scores.” Sentinel should not pretend to compute scientific confidence unless it has evidence.

**Requirement:** Use categorical confidence, not numeric scoring, until the evidence pipeline exists.

Good:

- `Confidence: High — tests cover critical behavior, unhappy paths, and assertions are specific.`
- `Confidence: Medium — happy path covered, but boundary and failure behavior are weak.`
- `Confidence: Low — tests mostly assert existence or implementation details.`

Bad:

- `Release confidence: 87%`

Save numeric weighting for the evidence pipeline plugin, where you can define actual inputs.

## How the two products combine

The combined story is strong:

1. **Matt’s skills reduce agent chaos.**
   They clarify, specify, implement, test, debug, and review.

2. **Sentinel reduces QA false confidence.**
   It checks whether tests are meaningful, code is testable, risk is visible, and a branch is shippable with known gaps.

3. **Your evidence-pipeline plugin turns QA judgment into release evidence.**
   It aggregates objective signals and produces a release-confidence report.

That is a clean ecosystem:

```text
Matt Pocock skills
  → build with engineering discipline

Sentinel
  → verify test quality and QA risk

Evidence pipeline plugin
  → aggregate artifacts into release confidence
```

## Final recommendation

Do not try to make Sentinel look as broad as Matt’s repo. Make it look **professionally narrow**.

The best version of Sentinel is not “another AI dev workflow pack.” It is:

> **The QA guardrail for AI-generated code: run it after the agent writes tests, before you trust the green checkmark.**

That is the lane. Stick to it.

[1]: https://github.com/mattpocock/skills/blob/main/README.md "skills/README.md at main · mattpocock/skills · GitHub"
[2]: https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/tdd/SKILL.md "raw.githubusercontent.com"
