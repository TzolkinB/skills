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
