# Sentinel

QA-first Claude Code skills that audit whether AI-generated code and tests actually verify
behavior — not whether the suite is merely green. Aimed first at developers *without* a QA
background who are accumulating AI-written tests faster than anyone can review them.

_User-facing concept definitions shipped with the plugin live in `GLOSSARY.md`. This file is
the canonical design vocabulary for building Sentinel — the words we commit to when we design._

## Language

**False-confidence test**:
A test that passes but would keep passing even if the behavior it appears to protect were
broken — it runs the code without verifying it. The single failure mode Sentinel exists to
expose. Its strongest form is a *pseudo-tested* path: one where the production code could be
deleted and no test would fail.
_Avoid_: green theater, green-light theater, suspicious passing test (informal color only, not the canonical term)

**Mutation thought experiment**:
The reasoning step that proposes the single code change most likely to expose a false-confidence
test. `audit-test` then *runs* that mutation and checks the test still passes (proof), or — when
the code can't be run — leaves it as a reasoned hypothesis (fallback). If such a change exists and
the test stays green, the test is not protecting that behavior.
_Avoid_: mutation testing (the heavyweight, whole-suite, execution-based discipline; this is one
targeted mutation on one flagged test)

**audit-test**:
The skill that answers "could this test fail for the right reason?" about a *passing* test,
using the mutation thought experiment. Distinct from `coverage-review` (finds *missing*
coverage) and `debug-test` (requires an existing *failure*).
_Avoid_: test-assert (the retired predecessor)

**Categorical confidence**:
Sentinel reports confidence as named levels tied to concrete evidence, never as invented numbers.
Every verdict input carries its **provenance** — how it is known
([ADR-0013](docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)):
**Proven** (a mutation was run and observed), **Likely** (reasoned only — the code could not be
run), or **Unexamined** (read and triaged but never advanced past the funnel, so nothing executed
or committed vouches for it). Sentinel *labels* provenance; it does not gate on execution — the
hard execution gate is the future evidence pipeline's job.
_Avoid_: numeric confidence scores (e.g. "87% confident") — reserve those for that pipeline; and
never let an Unexamined test sit in a "holds up" tally as if it were Proven.

**Sacred path**:
A path (code or test) the user marks as critical for a `/sentinel` run, via `--sacred=<glob>`, so that
Sentinel abandons its gradient there and applies binary rigor: a *proven* false-confidence finding or an
unhandled boundary on that path forces an **un-overridable FAIL**. It's the one place Sentinel refuses
CAUTION — and only ever on proven evidence, never a reasoned-only (Likely) finding. Off sacred paths the
gradient stands.
_Avoid_: sacred regression (J-Rig's term for the release-blocking test case — related idea, different
mechanism; ours keys off `audit-test`/`coverage-review` findings, not a designated failing case),
critical path (ambiguous — that's a workflow/perf term).

**Test debt**:
The accumulated cost of low-value, redundant, over-mocked, and stale tests that make a suite
slower, noisier, and less trustworthy without adding confidence. It is a property of the suite's
*accumulated economy*, visible only across many tests at once — the standing condition `prune-tests`
exists to reduce. The subtractive counterpart to a coverage gap.
_Avoid_: technical debt (broader, about production code), test smell (informal, per-test).

**Low-value / redundant test**:
A test that adds little *unique* confidence: duplicate assertions, a perf/timing check dropped into
a normal suite, pseudo-concurrency without a real race boundary, or a test of library/ORM behavior
rather than domain behavior. `prune-tests`' "remove" category. It may still execute code — the
problem is that nothing else in the suite depends on it to catch a regression.
_Avoid_: useless test (imprecise — it can still run the code), dead test (implies it never runs).

**Out-of-sync (stale) test**:
A test whose name or intent no longer matches what it asserts, or that validates payload shapes /
status contracts the code no longer produces. Worse than no test, because it still *passes* and so
looks like protection. `prune-tests`' "rewrite (or remove if the behavior is gone)" category.
_Avoid_: broken test (a stale test passes — that's the danger), flaky test (a different failure mode).

**Over-mocking**:
Replacing *internal* collaborators (services, managers, permission classes, serializers, query
paths) with fakes where a real collaborator is cheap, so the test verifies the mocks instead of the
behavior. Distinct from legitimate mocking at *external* boundaries (network, third-party APIs,
clock/randomness, expensive side effects). `prune-tests`' "rewrite with real collaborator" category;
surfaces to users as **Overmocking** in `GLOSSARY.md`.
_Avoid_: mocking (the practice itself is fine — over-application at internal seams is the problem).
