# Glossary

Reference for concepts this plugin's skills flag. Written for someone newer to QA/testing — this is what `--explain` mode points back to instead of re-explaining itself every time.

### Boundary Condition
A value at the edge of what's valid: `0`, `-1`, the max allowed length, an empty string, `null`. Bugs cluster at boundaries: code handles the normal middle case but mishandles the edges (off-by-one errors, unhandled empty states).

### Loose Assertion
A test check that can't meaningfully fail. `expect(result).toBeDefined()` passes as long as *anything* is returned, even the wrong thing. It looks like a real test and counts toward coverage, but verifies almost nothing.

### False Positive Test
A test that passes for the wrong reason, usually because it never exercised the code it claims to test (e.g., mocks were set up but the function under test was never called).

### Non-determinism
Code whose output depends on something other than its inputs: `Date.now()`, `Math.random()`, network timing. Tests against it are inherently flaky, since they can pass or fail with no code change.

### Flaky Test
A test that sometimes passes and sometimes fails with no code change, usually from non-determinism, timing assumptions, or shared state between tests. Flaky tests erode trust in the suite; people start ignoring red because "it's probably just flaky."

### Coupling (test context)
Code that can't be tested in isolation because it depends directly on something hard to substitute: a live database connection, a hardcoded API URL, a global singleton. High coupling means running the whole system just to test one function.

### Mocking / Stubbing
Replacing a real dependency (a database call, an email service) with a fake one in a test, to control its behavior and avoid side effects. Code that's hard to mock usually has hidden or hardcoded dependencies.

### Severity vs. Priority
**Severity** is how bad a bug is (Critical/High/Medium/Low), independent of when it's fixed. **Priority** is when it gets fixed, which also depends on business context. A low-severity bug can be high priority (a homepage typo); a critical bug can be low priority if it's in a feature nobody uses yet.

### Acceptance Criteria
The specific, checkable conditions defining "this feature is done," ideally written before code: the contract the implementation must satisfy, not a description of what got built after the fact.

### Coverage (line vs. behavioral)
Line coverage measures whether a line *executed* during tests, not whether the test *verified* it did the right thing. 100% line coverage with loose assertions everywhere is coverage theater, not confidence.

### Blast Radius
How much is affected if a change fails: one user, all users, one feature, or something downstream depending on it silently. A small blast radius (a debug-only script breaks) matters less than a large one (a shared library everything imports breaks), even at the same severity.

### Threat Model
A structured list of what could go wrong with a change and its consequences: failure mode, blast radius, whether you'd notice, whether it's reversible. Unlike a test plan, which verifies specific behaviors work, a threat model reasons about consequences *if something doesn't*, including failure modes nobody wrote a test for.

### Silent Failure
A failure with no error, crash, or alert, just wrong behavior nobody notices until something downstream breaks or a user complains. Worse than a loud failure (a crash), since loud failures get fixed fast while silent ones can run in production for a long time.

### False-Confidence Test
A passing test that wouldn't fail even if the code it covers broke, so it looks like protection but guards nothing. The umbrella term for what `audit-test` hunts. Confirmed means a mutation was actually applied and the test stayed green; likely means it was only reasoned about.

### Provenance (Confirmed / Likely / Unexamined)
How a verdict input is *known*, carried on every finding so a reader can tell evidence from guesswork. **Confirmed**: a mutation was run and its effect observed. **Likely**: reasoned about statically, since the code couldn't be run. **Unexamined**: read and triaged but never advanced past the funnel, so nothing vouches for it. The distinction that matters most is *Likely-good vs Unexamined*: an Unexamined test is not evidence of health and is never folded into a "holds up" count.

### Overmocking
Replacing so many real collaborators with fakes that the test only verifies the fakes, not the code. Classic tell: it asserts a method *was called* (`expect(save).toHaveBeenCalled()`) instead of asserting the real outcome (the record is actually rejected/saved). Break the real logic and the test still passes, since it never touched it.

### Pseudo-Tested
Code with a test naming it, but that can be changed arbitrarily, even deleted, without the test failing. The execution-confirmed worst case of false confidence: the "test" is decoration.

### Implementation-Coupled Test
A test that asserts *how* the code works (internal call sequence, private data shape) rather than *what* it guarantees. It breaks on harmless refactors (false alarm) yet can pass while the real guarantee is broken (false confidence): the worst of both.

### Characterization Test
A test that pins down the *current* behavior of code, even quirky or undocumented behavior, so a later refactor can't change it silently. Not false confidence: it's a deliberate safety net, and `audit-test` labels it as one rather than condemning it.

### Test Debt
The accumulated drag of tests that cost more than they protect: redundant, over-mocked, or stale ones that pile up (especially fast under AI-assisted development). Like technical debt, it's not one broken thing; it makes the suite slower, noisier, and less trustworthy without adding real safety. `prune-tests` looks across the suite and proposes paying it down.

### Low-Value / Redundant Test
A test that runs but adds no confidence something else doesn't already provide: a duplicate of another test's assertions, a timing/performance check in a normal unit suite, or one that really checks the framework or ORM rather than your own behavior. Not *wrong*, just weight: deleting it loses no protection. Distinct from a false-confidence test, which looks protective but isn't.

### Out-of-Sync (Stale) Test
A test drifted from the code it names: its title or comments describe one behavior while its assertions check another, or it validates a response shape or status code the code no longer produces. Dangerous because it still *passes*: it looks like protection while guarding something that no longer exists, worse than no test at all, since the green checkmark tells you not to look.

### Mutation Campaign
An exhaustive mutation-testing run: a tool inserts many small bugs (mutants) across *all* the source, runs the suite against each, and reports which ones the tests "killed." Dedicated frameworks like StrykerJS do this. `audit-test` avoids it: it mutates one flagged test's code, one mutation at a time, bounded by its triage funnel, since a campaign needs a per-runner plugin, config, and a green runnable suite, and takes minutes-to-hours rather than a handful of single-test runs.

### Mutation Score
The headline number a mutation campaign produces: the percentage of inserted mutants the suite killed. A codebase-wide *evidence* artifact (the stronger cousin of line coverage, see Coverage — line vs behavioral), not a per-test judgment. `audit-test` produces no score by design: it answers "would *this one test* fail if its code broke, and what should it assert?", judgment about a specific test, not a suite-wide grade. A high score still says nothing about *which* surviving mutant matters or how to fix the test that let it live; that translation is judgment a score can't give.

### Sacred Path
A code or test path you designate, per run, via `/qa-pass --sacred=<glob>`, as critical enough that a soft CAUTION is the wrong answer to confirmed-hollow protection. There, `/qa-pass` drops its usual gradient for binary rigor: a **confirmed** false-confidence test (from `audit-test`) or an unhandled boundary (from `coverage-review`) forces an un-overridable FAIL, regardless of how solid the rest of the branch is. Everything else keeps the normal PASS/CAUTION/FAIL gradient. Sacred paths are opt-in: `/qa-pass` never guesses what's critical, and the override fires on *confirmed* evidence only, never a reasoned-only (🟡 likely) finding.
