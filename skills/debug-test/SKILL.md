---
name: debug-test
description: Automatically diagnose a failing Playwright test — reads files directly, applies QA heuristics, routes to the Playwright healer or diagnosing-bugs.
argument-hint: "[test file path or test name]"
allowed-tools: [Read, Bash]
---

## Philosophy

When a Playwright test fails, don't describe the problem — let the skill read it. This skill runs the test, reads the file, applies fast QA heuristics, and routes to the right tool. No describing required. Scoped to Playwright; for non-Playwright failures invoke diagnosing-bugs directly.

## Steps

### 0. Locate the test
Get the test file path or test name from $ARGUMENTS.
- If a file path: read it directly
- If a test name: `grep -r "$ARGUMENTS" tests/ --include="*.spec.*" -l`

### 1. Flakiness check first
Before anything else — if the test is known to fail intermittently, run it 3×:
```bash
for i in 1 2 3; do npx playwright test "$TEST_NAME" --reporter=line 2>&1; done
```
If it fails on some runs but not others → skip to **Step 6 (Flakiness)**. Do not proceed with single-run analysis on a non-deterministic failure.

Otherwise run once and capture full output:
```bash
npx playwright test "$TEST_NAME" --reporter=line 2>&1
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
Invoke the Playwright healer agent with the failing test name.

> Requires `npx playwright init-agents` to have been run in the repo. If not initialized, note it and proceed directly to Step 5.

```
Healer input: [failing test name]
```

- **Healer passes** → done
- **Healer skips** (outputs "functionality broken") → Step 5

### 5. diagnosing-bugs
Invoke [Matt Pocock's diagnosing-bugs skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/diagnosing-bugs/SKILL.md).

**Phase 1 is already complete** — the failing Playwright test is the tight, deterministic feedback loop. Pass this context and begin at Phase 2:

- Test file: [path]
- Failing test: [name]
- Failure output: [captured in Step 1]
- QA-enriched hypothesis candidates for Phase 3 (pre-ranked):
  1. Mock/stub returns wrong shape or is never triggered
  2. Missing `await` on async step or assertion
  3. Test sets up state but never invokes the code under test (false positive)
  4. Code logic regression — behavior changed, test not updated

### 6. Flakiness
Run `/qa-review` on both the test file and the production code file under test. Focus on:
- `Date.now()`, `new Date()`, `Math.random()` — non-deterministic values
- Uncontrolled `setTimeout` or timers
- Network calls without interception (`page.route` / mock missing)
- Shared state across tests (missing `beforeEach` reset)
- Race conditions in async setup or teardown

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

## Notes
- Scoped to Playwright. For Jest/Vitest/pytest failures, invoke diagnosing-bugs directly.
- The Playwright healer requires `npx playwright init-agents` in the repo. If missing, skip to Step 5.
- `--explain` is not supported — this skill is procedural, not pedagogical.
- 80% of quick-heuristic catches are one of three things: missing `await`, mock set up but function never called, assertion that can never fail.
