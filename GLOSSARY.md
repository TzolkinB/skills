# Glossary

This is a reference for terms used in this plugin's reports. It is written for a person new to QA and testing. The `--explain` flag on each skill links back to this file. This file explains each term once, so no skill needs to explain it again.

### Boundary Condition
A value at the edge of what is valid: `0`, `-1`, the maximum allowed length, an empty string, or `null`. Bugs cluster at boundaries. Code often handles the normal middle case correctly, but mishandles the edges — for example, an off-by-one error, or an empty state with no handling.

### Loose Assertion
A check inside a test that never fails in a meaningful way. `expect(result).toBeDefined()` passes when the function returns *anything*, even a wrong value. This check looks like a real test and counts toward coverage, but it verifies almost nothing.

### False Positive Test
A test that passes for the wrong reason. Usually, the test never exercised the code it claims to test. Example: the test sets up mocks, but never calls the function under test.

### Non-determinism
Code whose output depends on something other than its inputs, for example `Date.now()`, `Math.random()`, or network timing. A test against this kind of code often passes or fails with no change to the code it tests.

### Flaky Test
A test that sometimes passes and sometimes fails with no change to the code. The usual causes are non-determinism, a timing assumption, or state shared between tests. A flaky test erodes trust in the suite. People start to ignore a red result, because they assume it is "probably just flaky."

### Coupling (test context)
Code that is not testable in isolation, because it depends directly on something hard to substitute. Examples: a live database connection, a hardcoded API URL, or a global singleton. High coupling forces a test to run the whole system, just to test one function.

### Mocking / Stubbing
Replacing a real dependency, for example a database call or an email service, with a fake one in a test. This controls the dependency's behavior and avoids side effects. Code that is hard to mock usually has a hidden or hardcoded dependency.

### Severity vs. Priority
**Severity** is how bad a bug is: Critical, High, Medium, or Low. Severity does not depend on when a team fixes the bug. **Priority** is when a team fixes the bug. Priority also depends on business context. A low-severity bug is sometimes high priority — for example, a typo on the home page. If a bug sits in a feature nobody uses yet, a critical bug is sometimes low priority.

### Acceptance Criteria
The specific, checkable conditions that define when a feature is done. Write these conditions before the code, if possible. They are the contract the implementation must satisfy, not a description written after the work.

### Coverage (line vs. behavioral)
Line coverage measures whether a line *executed* during a test run. It does not measure whether the test *verified* correct behavior. A suite sometimes shows 100% line coverage while using loose assertions everywhere. This gives a high number, not real confidence.

### Blast Radius
If a change fails, some part of a system is affected: one user, all users, one feature, or something downstream. That downstream dependency sometimes has no visible connection to the change. A small blast radius matters less than a large one, even at the same severity. Example: a debug-only script that breaks matters less than a shared library that every part of the system imports.

### Threat Model
A structured list of possible problems with a change, and their consequences. It covers the failure mode, the blast radius, whether someone notices, and whether the change is reversible. A test plan verifies that specific behaviors work; a threat model is different. It reasons about the consequences if a behavior fails, including a failure mode that no test covers.

### Silent Failure
A failure with no error, no crash, and no alert — just wrong behavior that nobody notices, until something downstream breaks or a user complains. This is worse than a loud failure, for example a crash. A team fixes a loud failure fast, while a silent failure sometimes runs in production for a long time.

### False-Confidence Test
A test that stays green if the code it covers breaks. It looks like protection, but it guards nothing. This is the general term for what `audit-test` looks for. **Confirmed** means a mutation actually ran, and the test stayed green. **Likely** means someone reasoned about the test only, without running a mutation.

### Provenance (Confirmed / Likely / Unexamined)
How a verdict input became *known*. Every finding carries this label, so a reader distinguishes evidence from a guess. **Confirmed**: a mutation ran, and someone observed its effect. **Likely**: someone reasoned about the code without running it, because execution was not possible. **Unexamined**: someone read and triaged the code, but it never advanced past the funnel, so nothing vouches for it. The most important distinction is *Likely-good vs Unexamined*. An Unexamined test is not evidence of health. It never counts toward a "holds up" total.

### Overmocking
Replacing so many real collaborators with fakes that the test verifies only the fakes, not the real code. A classic sign: the test asserts that a method *was called* (`expect(save).toHaveBeenCalled()`), instead of asserting the real outcome. For example, the real outcome is that the record was actually rejected or saved. If someone breaks the real logic, the test still passes, because the test never touched that logic.

### Pseudo-Tested
Code that has a test naming it, but a person changes the code in any way, even deletes it, and the test does not fail. This is the worst case of false confidence, confirmed by execution: the "test" is only decoration.

### Implementation-Coupled Test
A test that asserts *how* the code works, for example an internal call sequence or a private data shape, rather than *what* the code guarantees. This test breaks on a harmless refactor, which is a false alarm. It also passes while the real guarantee is broken, which is false confidence. It combines the worst of both problems.

### Characterization Test
A test that pins down the *current* behavior of code, including quirky or undocumented behavior. This stops a later refactor from silently changing that behavior. This is not false confidence: it is a deliberate safety net. `audit-test` labels it as a safety net, instead of flagging it as a problem.

### Test Debt
The accumulated drag from tests that cost more than they protect: redundant tests, over-mocked tests, or stale tests that pile up. This piles up especially fast under AI-assisted development. Like technical debt, test debt is not one broken thing. It makes the suite slower, noisier, and less trustworthy, without adding real safety. `prune-tests` looks across the whole suite and proposes cuts to pay down this debt.

### Low-Value / Redundant Test
A test that runs, but adds no confidence beyond what another test already provides. One example is a duplicate of another test's assertions. Another is a timing or performance check inside a normal unit suite. A third checks the framework or the ORM itself, not your own code's behavior. This is not *wrong*, just extra weight — deleting it loses no protection. It differs from a false-confidence test, which looks protective but is not.

### Out-of-Sync (Stale) Test
A test that no longer matches the code it names. Its title or its comments describe one behavior, while its assertions check another. Or, it validates a response shape or a status code that the code no longer produces. This is dangerous because the test still *passes*. It looks like protection, but it guards something that no longer exists. This is worse than no test at all, because the green checkmark tells a reader not to look further.

### Mutation Campaign
An exhaustive mutation-testing run. A tool inserts many small bugs, called mutants, across *all* the source. It runs the suite against each mutant, and reports which ones the tests "killed." Dedicated frameworks like StrykerJS do this kind of run. `audit-test` avoids it. Instead, `audit-test` mutates the code behind one flagged test, one mutation at a time, bounded by its triage funnel. A full campaign needs a per-runner plugin, a config, and a suite that runs clean. A campaign also takes minutes to hours, instead of a handful of single-test runs.

### Mutation Score
The headline number that a mutation campaign produces: the percentage of inserted mutants that the suite killed. This is a codebase-wide *evidence* artifact, a stronger cousin of line coverage (see Coverage — line vs behavioral), not a judgment about one test. `audit-test` produces no score, by design. It answers a different question: "if the code behind this one test breaks, does the test fail, and what must the test assert?" This is judgment about one specific test, not a suite-wide grade. A high score still says nothing about *which* surviving mutant matters, or how to fix the test that let it live. That translation step needs judgment; a score does not provide it.

### Sacred Path
A code path or a test path that you designate as sacred, per run, with `/qa-pass --sacred=<glob>`. On a sacred path, a soft CAUTION is the wrong answer to protection confirmed to check nothing real. So there, `/qa-pass` drops its usual gradient for binary rigor. A **confirmed** false-confidence test, from `audit-test`, or an unhandled boundary, from `coverage-review`, forces an un-overridable FAIL. This holds no matter how solid the rest of the branch is. Everything else keeps the normal PASS/CAUTION/FAIL gradient. Sacred paths are opt-in: `/qa-pass` never guesses what is critical. The override fires only on *confirmed* evidence, never on a reasoned-only (🟡 likely) finding.
