---
name: debug-test
description: Automatically diagnose a failing Playwright test — reads files directly, applies QA heuristics, routes to the Playwright healer or diagnosing-bugs. Also has a flake mode (detects, quarantines, routes flaky tests) and a drift mode (classifies an already-red test as external drift vs local regression and surfaces the mismatch for a human to dispose).
argument-hint: "[test file path or test name] [--flake] [--drift]"
allowed-tools: [Read, Bash]
---

When a Playwright test fails, don't describe the problem — let the skill read it. This skill runs the test, reads the file, applies fast QA heuristics, and routes to the right tool. Scoped to Playwright; for non-Playwright failures, invoke diagnosing-bugs directly.

A flaky test is a special case. Most teams `.skip()` or delete it — silent capitulation that throws away a real signal, because the flaky test usually guards real behavior. This skill instead **detects, quarantines, and routes the cause to a fix**, consuming the framework's own burn mechanisms rather than rebuilding a test runner. See **Flake Mode** and [ADR-0012](../../docs/adr/0012-debug-test-flake-mode.md).

Drift is the mirror special case, for a *deterministic* red. When a long-green test goes red with **no relevant change in its own repo**, the cause is usually external — a backend the test's team doesn't own moved a contract, payload shape, auth flow, or env value underneath it. Treating that as a local bug sends it to the healer, which green-locks the test to the drifted value *without asking whether the change was intended*. This skill instead **classifies external-drift vs local-regression from static signals, quarantines, and surfaces the mismatch — with the published-contract evidence — for a human to dispose.** It never runs the suite and never decides fault on its own authority. See **Drift Mode** and [ADR-0018](../../docs/adr/0018-debug-test-drift-triage.md).

## Steps

### 0. Locate the test
Get the test file path or test name from $ARGUMENTS.
- If a file path: read it directly
- If a test name: `grep -r "$ARGUMENTS" tests/ --include="*.spec.*" -l`
- If `--flake` is present → go straight to **Flake Mode** (below). Use this when the complaint is "it's flaky," not "it's failing."
- If `--drift` is present → go straight to **Drift Mode** (below). Use this when a long-green test went red and nothing in its own repo changed.

### 1. Flakiness check first
Before single-run analysis, rule out non-determinism using the framework's **own** burn mechanism — never a hand-rolled loop. With Playwright, `--repeat-each` runs the same test N times in one invocation:
```bash
npx playwright test "$TEST_NAME" --repeat-each=5 --reporter=line 2>&1
```
- **Mixed pass/fail across the repeats → confirmed flaky.** Go to **Flake Mode** — do not run single-run diagnosis on a non-deterministic failure.
- **Fails every repeat (N/N) → a real, deterministic failure**, not flake. Before assuming a *local* cause, run the drift signal: if the working/PR diff **doesn't touch any source this test exercises** (empty or drift-irrelevant diff under a previously-green test) → go to **Drift Mode**. Otherwise continue below — the cause is local.

Otherwise (a plain failing test) run once and capture full output:
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

## Flake Mode

Reached from Step 0 (`--flake`) or Step 1 (mixed pass/fail on the repeats). The job is **detect → quarantine → route the cause** — never rebuild a runner, never silently skip or delete. Do **not** claim a cause as fact: v1 is honest that detection + quarantine is the mechanical, reliable part, and cause is a *suggestion* handed to a human-reviewable skill.

### F1. Measure the flake rate (framework-native burn — no custom loop)
Use the burn mechanism the framework already ships:
- **Playwright:** `npx playwright test "$TEST_NAME" --repeat-each=10 --reporter=line` — count failures over the 10 runs. Or, if the project runs with retries, parse the JSON reporter's `status: "flaky"` (emitted when a test fails then passes on retry): `npx playwright test "$TEST_NAME" --retries=2 --reporter=json` and read `status`.
- **Cypress:** shell out to `@cypress/grep`'s burn — `npx cypress run --env grep="$TEST_NAME",burn=10`. **If the runner won't launch** (`bad option: --smoke-test`/`--ping`, "Cypress failed to start" — common on macOS 26 / Electron 36, unfixed by `install --force`): that's an environment blocker, not a flake result — don't record a rate; run via Docker (`cypress/included`) or CI/Linux. See [`audit-test`](../audit-test/SKILL.md) → run-one-test → Cypress note.

Flake rate = failures / runs. `0/N` → not actually flaky (stop, say so). `N/N` → deterministic failure, not flake → run the drift check (Step 1): an empty/irrelevant diff under a previously-green test → **Drift Mode**; otherwise back to Step 2. Anything in between → **confirmed flaky**; record the rate (e.g. "3/10").

### F2. Quarantine — non-blocking, never deleted
Recommend moving the test out of the blocking lane while keeping the signal:
- Tag it (`test.describe`/`test` annotation, e.g. `@flaky`, or a dedicated quarantine project in `playwright.config`) so CI stops blocking on it but still runs and reports it.
- Open/keep a tracking note referencing the flake rate.
- **Never propose `.skip()`-and-forget or deletion.** A flaky test usually guards real behavior; dropping it lets a real regression ship unnoticed with invisible coverage loss. (Deleting *with justification* is `prune-tests`' job, only after a cause is confirmed — not a disposition you reach for here.)

### F3. Route the suspected cause (a suggestion, not a verdict)
Read the test + the code under test, then hand off — always phrased as "suspected → routed to X to confirm":
- **Source non-determinism** (`Date.now()`/`new Date()`/`Math.random()`, uncontrolled timers, races, network calls without interception, shared state / missing `beforeEach` reset) → **`/qa-review`** on the test *and* the production code.
- **Over-mocked / timing-coupled** (asserts on mocks, or only passes on lucky timing) → **`/audit-test`** to prove whether it ever tested anything; if it comes back proven false-confidence → **`/prune-tests`** to remove it *with justification*.
- **Genuinely redundant** (duplicates another test's coverage) → **`/prune-tests`**.

Cause classification is inherently hard to infer from repeat runs, so present it as a ranked hypothesis routed to the skill that can actually confirm it — never as this skill's verdict. Detection and quarantine are the reliable output; the route is a lead.

## Drift Mode

Reached from Step 0 (`--drift`) or Step 1 (a deterministic red whose diff doesn't touch the code the test exercises). This is the mirror of Flake Mode for a *deterministic* red with **no relevant local cause** — the failure a long-idle consumer eats when an external service (a backend another team owns, on its own release cadence) moves a contract, payload shape, auth flow, or env value underneath a test that never changed.

Same three-part shape as Flake Mode — **classify → quarantine → surface** — but the disposition is tuned for a boundary this skill must *not* adjudicate. Two rules hold throughout:
- **Judgment only, never a run.** Drift mode acts on an *already-red* test (a human or CI produced the red; it is an input, not something this skill runs to discover). It reads diffs, history, and published contracts — it does **not** drive the app, retry, or run the suite. The moment it would need to execute to get a signal, it routes across a seam instead. Entering via `--drift` runs nothing at all; the Step-1 auto-path first spends flake mode's own burn to rule out non-determinism — that is the flake gate, not a drift signal, and drift classification itself adds no execution. (Static-judgment moat — [ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md).)
- **The verdict is a challenger's flag, not an oracle.** Frame it as: *"suspected external drift — the local diff is empty/irrelevant, history shows this test was green, and the response [matches / contradicts] the published contract for X."* It never asserts the backend is wrong on its own authority, and never green-locks the consumer to an *unconfirmed* change.

### D1. Classify — from signals the suite already owns (never from a run)
Signals, most reliable first. A verdict can rest on the first alone; the lower two sharpen it.
- **Diff relevance (primary, static, cheap).** Does the working/PR diff (`git diff --name-only main...HEAD`, plus the working tree) touch any source this failing test plausibly exercises? An **empty or drift-irrelevant diff under a previously-green test is the drift signature.** (Same source→test relevance map that E2E impact-analysis builds — read here in the inverse direction: "did *any* change hit this red at all?")
- **Temporal (secondary).** Was this test **green in the recorded findings log and now red with no relevant local change**? Read the green→red transition where the log exists; where it does not, **state the signal is absent — do not fabricate history.**
- **Published-contract comparison (tertiary — and the deliberate-vs-accidental oracle).** Compare the drifted response against the provider's **published contract** (OpenAPI/Swagger — usually readable across the org boundary even when the provider won't run contract verification — or an in-repo response schema such as a Zod validator, if one exists). It does double duty: positive drift evidence ("the depended-on field moved"), and the deliberate-vs-accidental discriminator —
  - response **matches the published spec → deliberate** API evolution: the test/frontend is merely **stale**, and updating it is correct maintenance;
  - response **contradicts the spec, or no spec exists → suspected break**: escalate.
  The suite **consumes** the contract; it does not snapshot live responses to produce one (an execution-layer artifact, out of scope here by ADR-0010).

If the diff *does* touch code the test exercises, this is **not** drift — fall back to the normal flow (Step 2 heuristics → healer / diagnosing-bugs), unchanged.

### D2. Quarantine — non-blocking, never `.skip()`-and-forget, never deleted
Identical disposition to Flake Mode: recommend a quarantine lane / tag so CI stops blocking on a red the team can't fix locally, **while the test keeps running and reporting.** A drifted test still guards real behavior — silently skipping it lets the *next*, real, local regression ship invisibly.

### D3. Surface the mismatch for human disposition — shift-left, do not auto-"fix"
Drift mode does **not** presume the backend erred, and does **not** heal to green. Because most cross-service changes are *deliberate*, the two dispositions are both legitimate and only a human can choose — present both, with the contract evidence:
- **Deliberate evolution** (response matches the published spec) → the test/frontend is *stale*; offer the exact test/frontend update to accept it. This is correct maintenance, **not** a green-lock — green-lock is adapting to an *unconfirmed* change, and the spec check is precisely what tells them apart.
- **Suspected break** (contradicts the spec, or no spec exists) → route to **`/bug-report`** to structure a cross-team report pointing at the field that moved — **not** to the Playwright healer, which would blindly green-lock.

The choice — accept-and-update, or stop-and-escalate — is **always the human's.** The win is the *surfacing itself*: the earlier a frontend/backend mismatch is reported, the cheaper it is for everyone. Speed-to-surface beats auto-remediation.

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

### Flake Mode
```
## debug-test (flake): [Test Name]

### Flake rate
3/10 runs failed  (npx playwright test "[name]" --repeat-each=10)

### Disposition → Quarantine (non-blocking)
Tag `@flaky` / move to the quarantine project — keeps running and reporting, stops blocking CI.
NOT skipped, NOT deleted — the signal is preserved.

### Suspected cause → routed (to confirm, not a verdict)
Suspected: source non-determinism — `Date.now()` in pricing.js:12, no `page.route` mock on /rates
→ Routed to `/qa-review` (test + code) to confirm.
[or: → `/audit-test` if over-mocked/timing-coupled; → `/prune-tests` if redundant]
```

### Drift Mode
```
## debug-test (drift): [Test Name]

### Classification → Suspected external drift  (challenger's flag, not a verdict)
Signals: local diff empty/irrelevant (no change to code this test exercises) · findings log: green→red [or: not available] · response [matches | contradicts] published contract for `[endpoint/field]`

### Disposition → Quarantine (non-blocking)
Tag / quarantine lane — keeps running and reporting, stops blocking CI. NOT skipped, NOT deleted.

### Surfaced for human disposition (not auto-fixed)
[Deliberate evolution] response matches the spec → test is stale; proposed update: [diff]. Accept only if the change was intended.
[or: Suspected break] contradicts the spec / no spec → routed to `/bug-report` pointing at `[field]`. Not green-locked, backend not unilaterally blamed.
```

## Notes
- Scoped to Playwright (flake mode also supports Cypress `@cypress/grep --burn`). For Jest/Vitest/pytest failures, invoke diagnosing-bugs directly.
- Drift mode is **judgment on an already-red test** — it never runs the suite ([ADR-0010](../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)). Its primary signal (diff↔test relevance) is the same map E2E impact-analysis builds, read inverted. It **consumes** a published contract (OpenAPI/Swagger or an in-repo response schema); building a provider-independent contract check is a scoped-out follow-up ([ADR-0018](../../docs/adr/0018-debug-test-drift-triage.md)).
- `--explain` is not supported — this skill is procedural, not pedagogical.
