---
name: debug-test
description: Automatically diagnose a failing Playwright test — reads files directly, applies QA heuristics, routes to the Playwright healer or diagnosing-bugs, and classifies what the healer changed before calling it fixed, flagging 🔁 when the same test keeps getting healed for the same reason (read from git history, nothing stored). Also has a flake mode (detects, quarantines, routes flaky tests — Playwright or Cypress) and a drift mode (classifies an already-red test as external drift vs local regression and surfaces the mismatch for a human to dispose).
argument-hint: "[test file path or test name] [--flake] [--drift]"
allowed-tools: [Read, Bash, Task, Skill]
disable-model-invocation: true
---

When a Playwright test fails, don't describe the problem — let the skill read it. This skill runs the test, reads the file, applies fast QA heuristics, and routes to the right tool. **Steps 0–5 below assume Playwright** — Flake Mode is the one exception, since measuring a flake rate doesn't need the rest of this skill's Playwright-specific diagnosis machinery, and also supports Cypress (via `@cypress/grep --burn`). For a plain, non-flaky Cypress failure, or any other non-Playwright failure (Jest/Vitest/pytest), this skill stops rather than running its Playwright-specific steps against the wrong target — Step 0 checks for this and names `diagnosing-bugs` as the tool to reach for instead of proceeding.

Two special cases branch off the normal flow, each with its own procedure file — load it only when its trigger fires:
- **Flake Mode** — a *non-deterministic* failure (mixed pass/fail). Most teams `.skip()` or delete it; this skill instead **detects, quarantines, and routes the cause**, consuming the framework's own burn rather than rebuilding a runner. Triggered by `--flake` (Step 0) or a mixed-result Step 1. → follow [reference/flake-mode.md](reference/flake-mode.md).
- **Drift Mode** — a *deterministic* red with **no relevant local change** (an external service moved a contract underneath a long-green test). This skill **classifies drift vs local-regression, quarantines, and surfaces the mismatch for a human** — never green-locks, never runs the suite. Triggered by `--drift` (Step 0) or a Step-1 N/N with an empty/irrelevant diff. → follow [reference/drift-mode.md](reference/drift-mode.md).

## Steps

### 0. Locate the test
Get the test file path or test name from $ARGUMENTS.
- If `--flake` is present → load and follow [reference/flake-mode.md](reference/flake-mode.md). Use this when the complaint is "it's flaky," not "it's failing." (Flake mode does its own Playwright/Cypress detection.)
- If `--drift` is present → load and follow [reference/drift-mode.md](reference/drift-mode.md). Use this when a long-green test went red and nothing in its own repo changed. (Framework-agnostic — drift mode never runs the suite.)
- **Otherwise (the main diagnosis flow, Steps 1–5): confirm the target is Playwright first** — a `playwright.config.*` in the project, or a `@playwright/test` import in the file. **If it isn't, stop here** — do not proceed to Step 1. Report that this skill's diagnosis is Playwright-scoped and name `diagnosing-bugs` as the tool to reach for instead (see Output Format). Don't self-invoke it — that's a decision for the user to make, not a silent handoff.
- If a file path: read it directly; pass it **positionally** to the run commands below (`playwright test path/to/file.spec.ts`).
- If a test name: `grep -r "$ARGUMENTS" tests/ --include="*.spec.*" -l`, then select it in every run command below with **`-g "$TEST_NAME"`** — Playwright's title filter. A bare positional arg is a *filename* regex, not a title: passing a test name positionally matches **zero** files, runs 0 tests, and reports 0 failures — which reads as a false "not flaky." Always `-g` for a name.

### 1. Flakiness check first
Before single-run analysis, rule out non-determinism using the framework's **own** burn mechanism — never a hand-rolled loop. With Playwright, `--repeat-each` runs the same test N times in one invocation:
```bash
npx playwright test -g "$TEST_NAME" --repeat-each=5 --reporter=line 2>&1
```
- **Mixed pass/fail across the repeats → confirmed flaky.** Follow [reference/flake-mode.md](reference/flake-mode.md) — do not run single-run diagnosis on a non-deterministic failure.
- **Fails every repeat (N/N) → a real, deterministic failure**, not flake. Before assuming a *local* cause, run the drift signal: if the working/PR diff **doesn't touch any source this test exercises** (empty or drift-irrelevant diff under a previously-green test) → follow [reference/drift-mode.md](reference/drift-mode.md). Otherwise continue below — the cause is local.

Otherwise (a plain failing test) run once and capture full output:
```bash
npx playwright test -g "$TEST_NAME" --reporter=line 2>&1
```
This is Phase 1 of diagnosing-bugs — the feedback loop is already built.

### 2. Quick QA heuristics (automated — no asking)
Read the test file. Check three angles:

**Setup**
- Is the function/action under test actually called?
- Are mocks or fixtures set up but never triggered?
- Is there a missing `await` on an async action or assertion?
- Does `beforeEach` / setup run before the assertion fires?

**Assertion**
- Is the assertion reachable? (Not inside an early return or dead branch)
- Is it too loose? (`toBeDefined()`, `toBeTruthy()`, empty `expect()`)
- Does it check the right value — not an incidental side effect?

**Code logic**
- Does the failure message point to an unexpected return value (not a selector/timeout error)?
- Does the stack trace land in production code rather than the test itself?

→ **Found**: report root cause + fix. Done (see Output Format).
→ **Not found**: proceed to Step 3.

### 3. Route based on failure output
Read the failure output from Step 1:

| Failure pattern | Route |
|---|---|
| `locator` / `selector` / `No element found` / `strict mode violation` | → Step 4 (Healer) |
| `Timeout` / `waiting for` / `exceeded` | → Step 4 (Healer) |
| `Expected X, received Y` / `TypeError` / `ReferenceError` / value mismatch | → Step 5 (diagnosing-bugs) |
| Unknown / ambiguous | → Step 5 (diagnosing-bugs) |

### 4. Playwright Healer
Invoke the Playwright healer subagent (via the **`Task`** tool) with the failing test name. This reaches execution *across the seam* — the healer owns the browser run; debug-test only orchestrates the handoff ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).

> Requires `npx playwright init-agents` to have been run in the repo. If not initialized, note it and proceed directly to Step 5.

Before invoking it, record `git status --porcelain -- <test file>` — Step 4.5 needs to know whether the file was already dirty to attribute the healer's edit.

```
Healer input: [failing test name]
```

- **Healer passes** → **Step 4.5** — a pass is a *change*, not yet a result
- **Healer skips** (outputs "functionality broken") → Step 5

### 4.5 Classify the heal
A healer pass says the test is green; it doesn't say *what the healer changed to get there*. A locator touch-up and an expected value rewritten to match a regression both end in green, and only the second green-locks a bug — the assertion stays live, keeps killing mutations, and now enforces the broken behavior ([ADR-0017](../../docs/adr/0017-audit-test-baseline-lock-suspected.md)). So don't call it done on the pass alone: `git diff` the test file, bucket what changed, and take that bucket's disposition. → follow [reference/heal-classification.md](reference/heal-classification.md).

The three buckets and where they land: **selector / timeout / wait only** → done, no mutation spent on the low-risk common case; **expected-value literal changed** → `/audit-test`'s baseline-lock check via the `Skill` tool — the invocation must carry the assertion co-change itself, since the healer's edit is uncommitted and `audit-test` can't resolve it — verdict reported inline before "done"; **setup / fixture / flow changed** → not auto-cleared, diff shown, human review required. All three also **propose** a `Healed-by:` / `Heal-bucket:` commit-trailer block — the durable record of the classification, for a human or a commit template to apply. This skill never creates or amends a commit ([ADR-0047](../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2).

### 4.6 Check repeat-heal history
A single heal is a data point; a pattern across heals is the thing worth a human's attention. Immediately after Step 4.5 classifies this heal, read the test file's history for prior heals of the same kind: `git log --follow` filtered on the `Heal-bucket` trailer #190 writes, falling back to plain file churn when trailers are absent. Three or more heals of the same bucket within the window (this one included) → 🔁 **repeat-heal**, naming the count, bucket, and element/behavior each occurrence touched. → follow [reference/repeat-heal.md](reference/repeat-heal.md).

Nothing is stored — this reads git fresh every time ([#194](https://github.com/TzolkinB/skills/issues/194), [ADR-0047](../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2). It always reports what history was available; an empty or trailer-less read is never reported as "no repeats."

### 5. diagnosing-bugs
Invoke [Matt Pocock's diagnosing-bugs skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md) via the **`Skill`** tool.

**Phase 1 is already complete** — the failing Playwright test is the tight, deterministic feedback loop. Pass this context and begin at Phase 2:

- Test file: [path]
- Failing test: [name]
- Failure output: [captured in Step 1]
- QA-enriched hypothesis candidates for Phase 3 (pre-ranked):
  1. Mock/stub returns wrong shape or is never triggered
  2. Missing `await` on async step or assertion
  3. Test sets up state but never invokes the code under test (false positive)
  4. Code logic regression — behavior changed, test not updated

## Output Format

### Not a Playwright test (Step 0)
```
## debug-test: [Test Name / file]

### Not Playwright
[file] has no `playwright.config.*` / `@playwright/test` import — debug-test's diagnosis (Steps 1–5) is Playwright-scoped.

### Route
Invoke diagnosing-bugs directly for this one. (If the actual complaint is flakiness, `--flake` also covers Cypress.)
```

### Heuristics caught it (Step 2)
```
## debug-test: [Test Name]

### Failure
[One-line summary from test output]

### Root Cause
**[Setup | Assertion | Code Logic]** — [specific finding]

[code snippet: the problem]
↓
[code snippet: the fix]

### Confidence
🟢 High — [reason]
```

### Routing to healer (Step 4)
```
## debug-test: [Test Name]

### Failure
[One-line: locator/timeout error]

### Routing → Playwright Healer
Failure type: [locator | wait | data]
Invoking healer: [test name]
```

### Heal classification (Step 4.5) + repeat-heal check (Step 4.6)
Emitted after a healer pass that changed the test file — see [reference/heal-classification.md](reference/heal-classification.md) for the per-bucket dispositions, the trailer rules, and the cases that produce no classification at all (empty diff, pre-dirty tree, edits outside the test file); see [reference/repeat-heal.md](reference/repeat-heal.md) for the read-side rules (window, trailer-coverage tiers, churn fallback) behind the last section.
```
## debug-test (heal): [Test Name]

### Healer → passed
[what the healer reported, one line]

### Heal classification → [Selector / timeout / wait only | Expected-value literal | Setup / fixture / flow]
`git diff -- [test file]`: [what changed — old → new]
[bucket disposition: cleared · /audit-test baseline-lock verdict · ⛔ not auto-cleared, human review]

### Healing justification
[what changed] · [which check ran] · [verdict]

### Proposed commit trailers  (proposed, not applied — debug-test does not own the commit)
Healed-by: debug-test
Heal-bucket: [locator | assertion-value | flow-data]

### Repeat-heal check (Step 4.6)
History read: [window] · [bucket-accurate | churn-only (missing/no Heal-bucket trailers found) | no prior history]
[🔁 Repeat-heal — N heals of `[bucket]` in [window], this one included: [what each occurrence touched] | N heals of `[bucket]` in [window], below the 3-heal threshold | 🔁 N total edits to this file in [window] (churn fallback, no bucket data) | first heal on record for this file]
```

### Routing to diagnosing-bugs (Step 5)
```
## debug-test: [Test Name]

### Failure
[One-line summary]

### Heuristics: Nothing Found
Checked: setup (✓), assertion (✓), code logic (✓)

### Routing → diagnosing-bugs
Feedback loop: `npx playwright test [name]`
Phase 1: complete
Top hypotheses for Phase 3:
1. [highest ranked]
2. [second]
3. [third]

Proceeding with diagnosing-bugs Phase 2...
```

> Flake Mode and Drift Mode carry their own output formats — see [reference/flake-mode.md](reference/flake-mode.md) and [reference/drift-mode.md](reference/drift-mode.md).

## Notes
- **Self-invoking orchestrator.** debug-test drives its own handoffs across the ADR-0010 seam — the Playwright healer via `Task`, sibling skills via `Skill` — but never owns execution itself. A routed cause is a *lead to confirm*, not a verdict.
- **A green from a healer is a change, not a result.** Step 4.5 classifies every healer pass from the diff — never from the healer's account of what it did — because the two greens that matter (a re-synced selector, an expected value rewritten to bless a regression) are indistinguishable from the pass alone.
- **Never commits.** Step 4.5 *proposes* the `Healed-by:` / `Heal-bucket:` trailer block; this skill does not create or amend a commit, and writes no ledger of its own ([ADR-0047](../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)).
- **Repeat-heal is read, not stored.** Step 4.6 computes 🔁 repeat-heal from `git log --follow` + the `Heal-bucket` trailer at read time, every time — never a new store, and it says plainly when trailers are missing and the weaker churn fallback is doing the work instead ([#194](https://github.com/TzolkinB/skills/issues/194)).
- Scoped to Playwright (flake mode also supports Cypress `@cypress/grep --burn`). For Jest/Vitest/pytest failures, invoke diagnosing-bugs directly.
- `--explain` is not supported — this skill is procedural, not pedagogical.
