---
name: debug-test
description: Automatically diagnose a failing Playwright test — reads files directly, applies QA heuristics, routes to the Playwright healer or diagnosing-bugs. Also has a flake mode (detects, quarantines, routes flaky tests) and a drift mode (classifies an already-red test as external drift vs local regression and surfaces the mismatch for a human to dispose).
argument-hint: "[test file path or test name] [--flake] [--drift]"
allowed-tools: [Read, Bash, Task, Skill]
---

When a Playwright test fails, don't describe the problem — let the skill read it. This skill runs the test, reads the file, applies fast QA heuristics, and routes to the right tool. Scoped to Playwright; for non-Playwright failures, invoke diagnosing-bugs directly.

Two special cases branch off the normal flow, each with its own procedure file — load it only when its trigger fires:
- **Flake Mode** — a *non-deterministic* failure (mixed pass/fail). Most teams `.skip()` or delete it; this skill instead **detects, quarantines, and routes the cause**, consuming the framework's own burn rather than rebuilding a runner. Triggered by `--flake` (Step 0) or a mixed-result Step 1. → follow [reference/flake-mode.md](reference/flake-mode.md).
- **Drift Mode** — a *deterministic* red with **no relevant local change** (an external service moved a contract underneath a long-green test). This skill **classifies drift vs local-regression, quarantines, and surfaces the mismatch for a human** — never green-locks, never runs the suite. Triggered by `--drift` (Step 0) or a Step-1 N/N with an empty/irrelevant diff. → follow [reference/drift-mode.md](reference/drift-mode.md).

## Steps

### 0. Locate the test
Get the test file path or test name from $ARGUMENTS.
- If a file path: read it directly; pass it **positionally** to the run commands below (`playwright test path/to/file.spec.ts`).
- If a test name: `grep -r "$ARGUMENTS" tests/ --include="*.spec.*" -l`, then select it in every run command below with **`-g "$TEST_NAME"`** — Playwright's title filter. A bare positional arg is a *filename* regex, not a title: passing a test name positionally matches **zero** files, runs 0 tests, and reports 0 failures — which reads as a false "not flaky." Always `-g` for a name.
- If `--flake` is present → load and follow [reference/flake-mode.md](reference/flake-mode.md). Use this when the complaint is "it's flaky," not "it's failing."
- If `--drift` is present → load and follow [reference/drift-mode.md](reference/drift-mode.md). Use this when a long-green test went red and nothing in its own repo changed.

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

```
Healer input: [failing test name]
```

- **Healer passes** → done
- **Healer skips** (outputs "functionality broken") → Step 5

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
- Scoped to Playwright (flake mode also supports Cypress `@cypress/grep --burn`). For Jest/Vitest/pytest failures, invoke diagnosing-bugs directly.
- `--explain` is not supported — this skill is procedural, not pedagogical.
