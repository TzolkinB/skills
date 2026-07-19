# coverage-review consumes line-coverage as evidence; it does not produce it — the analyzer is a route, not a rival

`coverage-review` reads a test and its code statically and asks a judgment question — "what could break that these tests wouldn't catch?" This invites the same question ADR-0004 raised about Stryker: why not just run a coverage tool? Ecosystem skills like `test-coverage-analyzer` (and the frameworks under them, NYC / JaCoCo / `c8`) execute the suite, parse coverage data, and pinpoint the exact untested lines. The answer is the same shape as [ADR-0004](0004-audit-test-is-judgment-not-a-stryker-substitute.md): they answer different questions on different axes, and `coverage-review` deliberately keeps the judgment one. A coverage tool emits **which lines executed** — an *evidence* artifact, the kind [ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md) explicitly assigns to the separate evidence pipeline, not to Sentinel. `coverage-review` answers **which behaviors are guarded**: it flags loose assertions, untested branches, and boundary conditions — including on lines a coverage tool already counts as green. We keep `coverage-review` as the judgment tool and treat the coverage analyzer as evidence reached across a clean seam, not as a replacement.

## The blind spot that makes this a complement, not a substitution

Line coverage tells you a line *ran*. It cannot tell you the line was *meaningfully asserted*. A line can sit at 100% coverage under a `expect(result).toBeDefined()` and the analyzer still reports green — which is exactly the false confidence `coverage-review` exists to catch ("a test that runs code but doesn't assert anything is worthless"). So the analyzer's green is `coverage-review`'s starting point, not its verdict. This is the identical evidence-vs-judgment split as `audit-test` vs. Stryker's mutation score.

## Considered options

- **Replace `coverage-review` with a coverage tool.** Rejected. Line coverage is structurally blind to assertion quality; the analyzer's output ("line 34 uncovered") and `coverage-review`'s output ("line 34 is covered but the assertion can't fail") are on different axes. A tool that maximizes the first can leave the second wide open — the category error ADR-0004 names for Stryker, reprised for coverage.
- **Have `coverage-review` run the analyzer itself.** Rejected. That makes the skill (and, transitively, Sentinel) execute and collect coverage data it deliberately does not run, and invites a coverage *percentage* into a verdict Sentinel keeps categorical ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md)). Coverage % is evidence; it belongs where the inputs are defined — the pipeline, not the judgment skill. `coverage-review` needs only `Read`, and stays that way.

## Decision: route, not rivalry

| Situation | Tool |
|---|---|
| Which lines executed / a coverage number / a CI gate | `test-coverage-analyzer` / NYC / JaCoCo |
| Which behaviors are guarded / loose-assertion & boundary judgment / a *fix*, not a number | `coverage-review` |
| Reviewing a change: run the analyzer first if it's set up → feed its uncovered-line list into `coverage-review` as the "start here" input → `coverage-review` adds the assertion-quality layer on top of both covered and uncovered lines | analyzer → `coverage-review` |

## Consequences

- `coverage-review` stays **static-by-default** — `Read`-only, no runner, no coverage collection. It reasons about the code and test it is given; a coverage report, when present, is an optional prioritization input, never a prerequisite.
- Coverage percentages never enter Sentinel's verdict. Sentinel stays categorical everywhere ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md)); "which lines ran" is evidence for the pipeline, "which behaviors are guarded" is the judgment Sentinel aggregates.
- A future **ingestion seam** (deferred, not built here) would let `coverage-review` consume an `lcov` / JSON uncovered-line report, treat the definitely-unexecuted lines as the highest-priority gaps, and run its assertion-quality judgment over the executed-but-hollow ones — the analyzer supplying the proof of what ran, `coverage-review` supplying the judgment of what that execution guarantees. This is the direct analogue of ADR-0004's deferred Stryker ingestion seam, and the two share one mental model: **evidence feeds judgment, never replaces it.** It deserves its own design pass before it ships.
