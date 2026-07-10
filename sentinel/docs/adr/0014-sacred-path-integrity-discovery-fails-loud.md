# The sacred-path FAIL must fail loud, never silent: test discovery is multi-ecosystem, zero matches is INCONCLUSIVE, and the test↔code pairing is specified

The sacred-path override ([ADR-0007](0007-sentinel-sacred-path-fail-override.md)) is Sentinel's only
hard guarantee — a proven false-confidence finding on a `--sacred` path forces an un-overridable
FAIL. A guarantee that degrades to *nothing without an error* is worse than no guarantee, because the
user spent attention-budget opting into it and now trusts it. Two unspecified mechanisms let it do
exactly that:

1. **JS-only test discovery.** `audit-test` resolves tests with `**/*.{spec,test}.*`, which requires
   `.spec.` or `.test.` inside the filename. pytest's `test_foo.py`, Go's `foo_test.go`, and JUnit's
   `FooTest.java` all match zero files. On those repos the False-Confidence Audit contributes
   nothing, the audit reports "empty, stop", and per Sentinel's own rule a quiet audit keeps PASS
   reachable — so PASS gets *easier* on exactly the repos Sentinel examined least.
2. **Undefined test↔code pairing.** Mapping an `audit-test` finding to the `--sacred` source glob it
   should trip is the load-bearing step of the override, and it is specified nowhere. When it
   misfires, the FAIL simply doesn't fire.

## Decision

- **Discovery is multi-ecosystem.** Recognize at minimum: JS/TS `*.{spec,test}.*`; pytest
  `test_*.py` and `*_test.py`; Go `*_test.go`; JUnit/`*Test`/`*Tests` on the JVM. Discovery is
  extensible by convention, not hard-coded to one ecosystem.
- **Zero matches is a loud state, never a silent pass.** When discovery over a target (or a
  `--sacred` glob) finds no test files, the audit reports **INCONCLUSIVE — no recognized test files**
  and that result *blocks Sentinel from asserting a clean PASS*. Absence of findings from a check
  that never ran is never evidence of health.
- **The test↔code pairing heuristic is written down.** A finding pairs to source by (a) the code the
  test imports/exercises as identified during the behavior-contract read, falling back to (b)
  conventional path/name correspondence. The pairing used is stated in the finding, so a user can see
  why a `--sacred` glob did or did not trip — no invisible mapping.

## Consequences

- On a non-JS repo, `/sentinel` says the False-Confidence Audit did not run and why; it cannot then
  emit a clean PASS on the strength of a check that produced nothing.
- The `--sacred` override becomes auditable: every finding shows the path it paired to, so a
  no-fire is visibly a no-match, not a silent swallow.
- Overreach guard: the "guarantee revert even on crash or interrupt" wording in `audit-test` is
  softened to what the clean-git-tree precondition actually delivers — recovery is *possible*, not
  *guaranteed* — and single-test invocation is specified per framework rather than left as "run just
  that one test."
