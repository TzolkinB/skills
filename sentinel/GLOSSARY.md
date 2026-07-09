# Glossary

Reference for concepts Sentinel's skills flag. Written for someone newer to QA/testing — this is what `--explain` mode points back to instead of re-explaining itself every time.

### Boundary Condition
A value at the edge of what's valid — `0`, `-1`, the max allowed length, an empty string, `null`. Bugs cluster at boundaries because code often gets the "normal" middle case right but mishandles the edges (off-by-one errors, unhandled empty states).

### Loose Assertion
A test check that can't meaningfully fail. `expect(result).toBeDefined()` passes as long as *anything* is returned — including the wrong thing. It looks like a real test and counts toward coverage metrics, but verifies almost nothing.

### False Positive Test
A test that passes, but for the wrong reason — usually because it never actually exercised the code it claims to test (e.g., mocks were set up but the function under test was never called).

### Non-determinism
Code whose output depends on something other than its inputs — `Date.now()`, `Math.random()`, network timing. Tests against non-deterministic code are inherently flaky: they can pass or fail without the code changing at all.

### Flaky Test
A test that sometimes passes and sometimes fails with no code change. Usually caused by non-determinism, timing assumptions, or shared state between tests. Flaky tests erode trust in the whole suite — people start ignoring red because "it's probably just flaky."

### Coupling (test context)
When code can't be tested in isolation because it depends directly on something hard to substitute — a live database connection, a hardcoded API URL, a global singleton. High coupling means you need the whole system running just to test one function.

### Mocking / Stubbing
Replacing a real dependency (a database call, an email service) with a fake one during a test, so you can control its behavior and avoid side effects. Code that's hard to mock is usually code with hidden or hardcoded dependencies.

### Severity vs. Priority
**Severity** is how bad the bug is (Critical/High/Medium/Low), independent of when it gets fixed. **Priority** is when it gets fixed, which also depends on business context. A Low-severity bug can still be high priority (a typo on the homepage); a Critical bug might be low priority if it's in a feature nobody uses yet.

### Acceptance Criteria
The specific, checkable conditions that define "this feature is done." Written before code, ideally — they're the contract the implementation has to satisfy, not a description of what got built after the fact.

### Coverage (line vs. behavioral)
Line coverage measures whether a line *executed* during tests. It says nothing about whether the test *verified* the line did the right thing. 100% line coverage with loose assertions everywhere is coverage theater, not confidence.

### Blast Radius
How much is affected if a change fails — one user, all users, one feature, or something downstream that depends on it silently. A bug with a small blast radius (breaks a debug-only script) matters less than one with a large blast radius (breaks a shared library everything imports), even at the same severity level.

### Threat Model
A structured list of what could go wrong with a change and its consequences — failure mode, blast radius, whether you'd notice, whether it's reversible. Different from a test plan: a test plan verifies specific behaviors work; a threat model reasons about consequences *if something doesn't* work, including failure modes nobody thought to write a test for.

### Silent Failure
A failure that produces no error, no crash, no alert — just wrong behavior nobody notices until something downstream breaks or a user complains. Generally worse than a loud failure (a crash), because loud failures get fixed fast; silent ones can run in production for a long time.

### False-Confidence Test
A passing test that wouldn't fail even if the code it covers broke — so it looks like protection but guards nothing. The umbrella term for what `audit-test` hunts. Proven false-confidence means a mutation was actually applied and the test stayed green; likely means it was only reasoned about.

### Overmocking
Replacing so many real collaborators with fakes that the test only verifies the fakes, not the code. Classic tell: the test asserts a method *was called* (`expect(save).toHaveBeenCalled()`) instead of asserting the real outcome happened (the record is actually rejected/saved). Break the real logic and the test still passes, because it never touched it.

### Pseudo-Tested
Code that has a test naming it, but the code can be changed arbitrarily — even deleted — without the test failing. The execution-proven, worst case of false confidence: the "test" is decoration.

### Implementation-Coupled Test
A test that asserts *how* the code works (internal call sequence, private data shape) rather than *what* it guarantees. It breaks on harmless refactors (false alarm) yet can pass while the real guarantee is broken (false confidence) — the worst of both.

### Characterization Test
A test written to pin down the *current* behavior of code — even quirky or undocumented behavior — so that a later refactor can't change it silently. Not false confidence: it's a deliberate safety net, and `audit-test` labels it as one rather than condemning it.

### Test Debt
The accumulated drag of tests that cost more than they protect — redundant, over-mocked, or stale ones that pile up (especially fast under AI-assisted development). Like technical debt, it doesn't show up as a single broken thing; it makes the whole suite slower to run, noisier to read, and less trustworthy without adding any real safety. `prune-tests` is the skill that looks across the suite and proposes paying it down.

### Low-Value / Redundant Test
A test that runs but adds no confidence something else doesn't already provide — a duplicate of another test's assertions, a timing/performance check sitting in a normal unit suite, or a test that really just checks the framework or ORM rather than your own behavior. It isn't *wrong*, it's just weight: deleting it loses no protection. Distinct from a false-confidence test, which looks like it protects something but doesn't.

### Out-of-Sync (Stale) Test
A test that has drifted from the code it names — its title or comments describe one behavior while its assertions check another, or it validates a response shape or status code the code no longer produces. Dangerous precisely because it still *passes*: it looks like protection while guarding something that no longer exists. Worse than having no test there at all, because the green checkmark tells you not to look.

### Mutation Campaign
An exhaustive mutation-testing run: a tool automatically inserts many small bugs (mutants) across *all* of the source, runs the suite against each, and reports which mutants the tests "killed." This is what dedicated frameworks like StrykerJS do. `audit-test` deliberately *avoids* the campaign — it mutates one flagged test's code, one mutation at a time, bounded by its triage funnel — because the campaign needs a per-runner plugin, config, and a green runnable suite, and takes minutes-to-hours rather than a handful of single-test runs.

### Mutation Score
The headline number a mutation campaign produces: the percentage of inserted mutants the test suite killed. It is a codebase-wide *evidence* artifact (the stronger cousin of line coverage — see Coverage — line vs behavioral), not a per-test judgment. `audit-test` produces no score by design — it answers "would *this one test* fail if its code broke, and what should it assert?", which is judgment about a specific test, not a suite-wide grade. A high mutation score still says nothing about *which* surviving mutant matters or how to fix the test that let it live; that translation is the judgment layer a score can't give.

### Sacred Path
A code or test path you designate — per run, via `/sentinel --sacred=<glob>` — as critical enough that "shippable with notes" is the wrong answer to proven-hollow protection. On a sacred path, Sentinel drops its usual gradient and applies binary rigor: a **proven** false-confidence test (from `audit-test`) or an unhandled boundary (from `coverage-review`) forces an un-overridable FAIL, no matter how solid the rest of the branch is. Everything off the sacred paths keeps the normal PASS/CAUTION/FAIL gradient. Sacred paths are opt-in — Sentinel never guesses what's critical — and the override fires on *proven* evidence only, never on a reasoned-only (🟡 likely) finding.
