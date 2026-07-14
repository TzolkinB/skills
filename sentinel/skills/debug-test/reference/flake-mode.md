# debug-test — Flake Mode

Loaded from the main skill's Step 0 (`--flake`) or Step 1 (mixed pass/fail on the repeats). A flaky test is a special case: most teams `.skip()` or delete it — silent capitulation that throws away a real signal, because the flaky test usually **guards real behavior**. The job is **detect → quarantine → route the cause** — never rebuild a runner, never silently skip or delete ([ADR-0012](../../../docs/adr/0012-debug-test-flake-mode.md)). Do **not** claim a cause as fact: detection + quarantine is the mechanical, reliable part; cause is a *suggestion* handed to a human-reviewable skill.

## F1. Measure the flake rate (framework-native burn — no custom loop)
Use the burn mechanism the framework already ships:
- **Playwright:** `npx playwright test -g "$TEST_NAME" --repeat-each=10 --reporter=line` — count failures over the 10 runs. (`-g` is the title filter; a bare positional is a filename regex and silently runs 0 tests — see the main skill's Step 0.) Or, if the project runs with retries, parse the JSON reporter's `status: "flaky"` (emitted when a test fails then passes on retry): `npx playwright test -g "$TEST_NAME" --retries=2 --reporter=json` and read `status`.
- **Cypress:** shell out to `@cypress/grep`'s burn — `npx cypress run --env grep="$TEST_NAME",burn=10`. **If the runner won't launch** (`bad option: --smoke-test`/`--ping`, "Cypress failed to start" — common on macOS 26 / Electron 36, unfixed by `install --force`): that's an environment blocker, not a flake result — don't record a rate; run via Docker (`cypress/included`) or CI/Linux. See [`audit-test`](../../audit-test/SKILL.md) → run-one-test → Cypress note.

Flake rate = failures / runs. `0/N` → not actually flaky (stop, say so). `N/N` → deterministic failure, not flake → run the drift check (main skill Step 1): an empty/irrelevant diff under a previously-green test → **Drift Mode** ([drift-mode.md](drift-mode.md)); otherwise back to the main skill's Step 2. Anything in between → **confirmed flaky**; record the rate (e.g. "3/10").

## F2. Quarantine — non-blocking, never deleted
Recommend moving the test out of the blocking lane while keeping the signal:
- Tag it (`test.describe`/`test` annotation, e.g. `@flaky`, or a dedicated quarantine project in `playwright.config`) so CI stops blocking on it but still runs and reports it.
- Open/keep a tracking note referencing the flake rate.
- **Never propose `.skip()`-and-forget or deletion.** A flaky test usually guards real behavior; dropping it lets a real regression ship unnoticed with invisible coverage loss. (Deleting *with justification* is `prune-tests`' job, only after a cause is confirmed — not a disposition you reach for here.)

## F3. Get the runtime evidence (framework-native — evidence, not a verdict)
Before hypothesizing a cause, pull the per-run runtime evidence the framework already produces — it lets you *see* the flake's mechanism instead of guessing it. Route by stack:
- **Playwright → trace viewer / Test Replay** (`npx playwright show-trace`, or the HTML report's trace) — per-step timeline, network, and DOM snapshots to compare the failing vs passing attempt.
- **Cypress → [`cypress-flaky-test-audit`](https://github.com/sclavijosuero/cypress-flaky-test-audit)** — a diagnosis-only command-queue tracer: per-command enqueue-vs-execution order, timing, internal retries, *never-run* (dead) commands, and a side-by-side retry diff. **Reading it for a flake:** an enqueue-vs-execution-order mismatch or a late-resolving command points at a timing/wait race; a *never-run* command marks where a prior step died; the retry diff shows what differed between the flaky and the green attempt.

This is **evidence downstream of detection** — not a detection or credibility claim — feeding the cause hypothesis below. Orchestrate the tool; don't rebuild its instrumentation into the skill.

## F4. Route the suspected cause (a suggestion, not a verdict)
Read the test + the code under test, then hand off (via the `Skill` tool) — always phrased as "suspected → routed to X to confirm":
- **Source non-determinism** (`Date.now()`/`new Date()`/`Math.random()`, uncontrolled timers, races, network calls without interception, shared state / missing `beforeEach` reset) → **`/qa-review`** on the test *and* the production code. This is the default for a genuine timing/ordering flake — including one that "only passes on lucky timing" — **as long as the assertion still exercises real code.**
- **Over-mocked / assertion decoupled from the real code** (asserts on a mock's return, or greens only because a stub or a lucky wait stands in for the behavior under test — so it may test *nothing*) → **`/audit-test`** to prove whether it ever tested anything; if it comes back proven false-confidence → **`/prune-tests`** to remove it *with justification*.
- **Genuinely redundant** (duplicates another test's coverage) → **`/prune-tests`**.

**The discriminator between the first two is false confidence, not timing.** A timing flake whose assertion still hits real code → `/qa-review`; a flake that greens because the assertion is decoupled from the real code (mock/stub, or a wait that lets it pass without the behavior ever happening) → `/audit-test`. Don't route on "is it timing?" — route on "if the flake were fixed, would this test actually check the behavior?"

Cause classification is inherently hard to infer from repeat runs, so present it as a ranked hypothesis routed to the skill that can actually confirm it — never as this skill's verdict. Detection and quarantine are the reliable output; the route is a lead.

## Output Format
```
## debug-test (flake): [Test Name]

### Flake rate
3/10 runs failed  (npx playwright test -g "[name]" --repeat-each=10)

### Disposition → Quarantine (non-blocking)
Tag `@flaky` / move to the quarantine project — keeps running and reporting, stops blocking CI.
NOT skipped, NOT deleted — the signal is preserved.

### Evidence → runtime trace (framework-native)
Playwright: `npx playwright show-trace` · Cypress: `cypress-flaky-test-audit` (command-queue order/timing, never-run commands, retry diff) — read to see the flake, not to verdict it.

### Suspected cause → routed (to confirm, not a verdict)
Suspected: source non-determinism — `Date.now()` in pricing.js:12, no `page.route` mock on /rates
→ Routed to `/qa-review` (test + code) to confirm.
[or: → `/audit-test` if the assertion is decoupled from the real code (mock/stub/lucky wait); → `/prune-tests` if redundant]
```
