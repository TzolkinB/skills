# kimbell-skills

QA-first Claude Code skills that audit whether AI-generated code and tests actually verify
behavior, not whether the suite is merely green. Aimed first at **QA and SDET professionals** who
already own a running suite and already believe hollow tests are real — so the pitch leads with the
proof, not with an explanation of the problem ([`docs/positioning.md`](docs/positioning.md)).

_User-facing concept definitions shipped with the plugin live in `GLOSSARY.md`. This file is
the canonical design vocabulary for building this plugin: the words we commit to when we design.
Outward-facing claims and their labels are governed by [`docs/positioning.md`](docs/positioning.md),
which also maps our internal terms to the words this audience actually uses._

## Language

**False-confidence test**:
A test that passes but would keep passing even if the behavior it appears to protect were
broken: it runs the code without verifying it. The single failure mode this plugin exists to
expose. Its strongest form is a *pseudo-tested* path, where the production code could be
deleted and no test would fail.
_Avoid_: green theater, green-light theater, suspicious passing test (informal color only, not the canonical term)

**Mutation thought experiment**:
The reasoning step proposing the single code change most likely to expose a false-confidence
test. `audit-test` then *runs* that mutation and checks the test still passes (proof), or, when
the code can't be run, leaves it as a reasoned hypothesis (fallback). If such a change exists and
the test stays green, the test isn't protecting that behavior.
_Avoid_: mutation testing (the heavyweight, whole-suite, execution-based discipline; this is one
targeted mutation on one flagged test)

**audit-test**:
The skill answering "could this test fail for the right reason?" about a *passing* test,
using the mutation thought experiment. Distinct from `coverage-review` (finds *missing*
coverage) and `debug-test` (requires an existing *failure*).
_Avoid_: test-assert (the retired predecessor)

**Categorical confidence**:
This plugin reports confidence as named levels tied to concrete evidence, never invented numbers.
Every verdict input carries its **provenance**, how it is known
([ADR-0013](docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)):
**Confirmed** (a mutation was run and observed), **Likely** (reasoned only, the code couldn't
run), or **Unexamined** (read and triaged but never advanced past the funnel, so nothing executed
or committed vouches for it). This plugin *labels* provenance; it does not gate on execution.
Re-running mutations to independently verify is **declined by design**, not deferred to a future
pipeline ([ADR-0010](docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md),
[ADR-0038](docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)): `gate` builds the
integrity boundary instead (see Subject vs. predicate, below).
_Avoid_: numeric confidence scores (e.g. "87% confident"); framing `gate` as an independent verifier,
since it ingests self-reports and never re-runs a mutation; letting an Unexamined test sit in a
"holds up" tally as if it were Confirmed.

**Diagnostic run**:
`audit-test`'s default batch behaviour: triage every test, deep-audit **only the flagged suspects**. It
answers "are there hollow tests among the ones most likely to be hollow?", cheap and targeted. A clean
diagnostic run found no problems *where it looked*; it hasn't certified the suite, so it correctly
caps at `canary` under the examined-floor
([ADR-0038](docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md)).
_Avoid_: "normal run" / "default audit" (imprecise about the funnel), "suspect-only pass" (names the
mechanism, not the question it answers).

**Certification run**:
An opt-in `audit-test` mode (`--certify`) that deep-audits a **representative random sample sized to the
examined-floor across all triaged tests ∪ the flagged suspects**, so `deepAudited / audited` can clear the
floor *legitimately* and a `ship` recommendation stands on breadth evidence. It answers "is the suite broadly
trustworthy enough to stake a release on?", the question `ship` actually asks, and the breadth the diagnostic
funnel deliberately doesn't spend
([ADR-0041](docs/adr/0041-audit-test-certification-mode-verdict-semantics.md)).
_Avoid_: "full audit" / "deep audit" (a certification run still samples, it isn't exhaustive), "sample run"
(names the mechanism, not the purpose; the union with suspects is not just a sample).

**Sacred path**:
A path (code or test) the user marks critical for a `/sentinel` run, via `--sacred=<glob>`, so
`/sentinel` abandons its gradient there for binary rigor: a *confirmed* false-confidence finding or an
unhandled boundary on that path forces an **un-overridable FAIL**. It's the one place `/sentinel` refuses
CAUTION, and only ever on confirmed evidence, never a reasoned-only (Likely) finding. Off sacred paths the
gradient stands.
_Avoid_: sacred regression (J-Rig's term for the release-blocking test case, a related idea but different
mechanism; ours keys off `audit-test`/`coverage-review` findings, not a designated failing case),
critical path (ambiguous, that's a workflow/perf term).

**Judgment skill**:
One of the seven skills that read an artifact and return a *finding* about it — `test-plan`,
`qa-review`, `coverage-review`, `audit-test`, `prune-tests`, `threat-model`, `sentinel`. They are
the set that shares the output contract in `skills/shared/`: the `--digest` evidence card and the
inline `Next:` footer ([ADR-0048](docs/adr/0048-shared-digest-card-and-inline-next-footers.md)). The
distinguishing property is having something to compress — a finding with evidence and a provenance
label behind it. The **procedural** skills (`debug-test`, `e2e-impact`, `contract-guard`,
`bug-report`, `audit-orchestrator`, `gate`) run a fixed check or route, so they take neither.
_Avoid_: conflating it with **pedagogical skill**, README's `--explain` set, which is a different
cut of the same list (it includes `bug-report`, which teaches but has no findings to trim);
"analysis skill" (every skill analyzes something).

**Evidence card**:
The four-field short form a judgment skill emits under `--digest`: **Risk** (one line) / **Evidence**
(a checkable observation, not a characterization) / **Action** (one concrete step) / **Confidence**
(the Confirmed / Likely / Unexamined label the run earned). Generalized from `audit-test`'s
single-test entry. It is a *trim* of the full report, bound by one rule: compression may drop a
finding but never upgrade its label.
_Avoid_: summary (implies it may add or generalize — it may only say less), TL;DR (informal, and
carries no obligation to keep the provenance label).

**Test debt**:
The accumulated cost of low-value, redundant, over-mocked, and stale tests that make a suite
slower, noisier, and less trustworthy without adding confidence. A property of the suite's
*accumulated economy*, visible only across many tests at once: the standing condition `prune-tests`
exists to reduce. The subtractive counterpart to a coverage gap.
_Avoid_: technical debt (broader, about production code), test smell (informal, per-test).

**Low-value / redundant test**:
A test that adds little *unique* confidence: duplicate assertions, a perf/timing check dropped into
a normal suite, pseudo-concurrency without a real race boundary, or a test of library/ORM behavior
rather than domain behavior. `prune-tests`' "remove" category. It may still execute code; the
problem is that nothing else in the suite depends on it to catch a regression.
_Avoid_: useless test (imprecise, it can still run the code), dead test (implies it never runs).

**Out-of-sync (stale) test**:
A test whose name or intent no longer matches what it asserts, or that validates payload shapes or
status contracts the code no longer produces. Worse than no test, since it still *passes* and so
looks like protection. `prune-tests`' "rewrite (or remove if the behavior is gone)" category.
_Avoid_: broken test (a stale test passes, that's the danger), flaky test (a different failure mode).

**Over-mocking**:
Replacing *internal* collaborators (services, managers, permission classes, serializers, query
paths) with fakes where a real collaborator is cheap, so the test verifies the mocks instead of the
behavior. Distinct from legitimate mocking at *external* boundaries (network, third-party APIs,
clock/randomness, expensive side effects). `prune-tests`' "rewrite with real collaborator" category;
surfaces to users as **Overmocking** in `GLOSSARY.md`.
_Avoid_: mocking (the practice itself is fine; over-application at internal seams is the problem).

**Subject vs. predicate (integrity vs. endorsement)**:
In an in-toto Statement, the **subject** names bytes the predicate is *about*; the **predicate** is the
claim being made. Gate's signed predicate asserts only its own decision; it never endorses a stage it
didn't produce. But Gate *may* bind other producers' bytes into `subject` by content-addressed digest:
that only says "my decision was rendered over exactly these bytes," which is integrity-binding, not
endorsement, so it never launders a self-report as vouched-for ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md)
§1, [ADR-0040](docs/adr/0040-widen-gate-signed-scope-to-entries.md)). This is the line letting Gate widen
what it binds (inputs, then parsed entries) without ever widening what it endorses.
_Avoid_: "signing an entry" (ambiguous, say whether it's bound as a subject or asserted as a predicate).
