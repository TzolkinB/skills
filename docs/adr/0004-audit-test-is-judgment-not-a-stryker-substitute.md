# audit-test is judgment bounded by a triage funnel; Stryker is the exhaustive route, reached by a seam

`audit-test` runs its own targeted mutation ([ADR-0001](0001-audit-test-proves-by-execution.md)), which invites an obvious question: why build a hand-rolled mutation step when [StrykerJS](https://stryker-mutator.io/) is a mature, widely-adopted mutation-testing framework? The answer is that they answer different questions on different axes, and `audit-test` deliberately keeps the cheaper one. Stryker mutates **all of `src/`** and emits a codebase-wide **mutation score** — an *evidence* artifact, the kind [ADR-0002-sentinel](0002-sentinel-is-judgment-not-release-evidence.md) explicitly assigns to the separate evidence pipeline, not to Sentinel. `audit-test` answers a *judgment* question about a **specific passing test** — "does this guard anything, and if not, what should it assert?" — interactively, during a PR review, bounded by its triage funnel. We keep `audit-test` as the judgment tool and treat Stryker as the exhaustive route reached across a clean seam, not as a replacement for `audit-test`'s engine.

## Considered options

- **Replace `audit-test`'s mutation with Stryker.** Rejected. Stryker selects along a different axis — it mutates *source*, then uses coverage to pick which tests run *per mutant*. There is no input where "these tests smell suspicious" narrows the mutant set, so `audit-test`'s **test-level triage funnel cannot pre-filter a Stryker run** — that composition is a category error. Stryker also needs a per-runner plugin, config, and a green runnable campaign taking minutes-to-hours; `audit-test` needs only git and a shell and runs one test. The funnel + interactivity is exactly what Stryker structurally cannot offer.
- **Compete with Stryker on exhaustiveness.** Rejected. On its own axis — exhaustive, scored proof of test rigor across a codebase — Stryker wins outright and always will. `audit-test`'s durable value is **not** the mutation-proof itself (one `audit-test` mutation is literally one Stryker mutant, done by hand); it is the funnel that decides *which test to look at*, the failure-taxonomy classification, the equivalent-mutant discernment ("challenger, not oracle"), and the concrete fix ("a real test would assert 409"). Stryker stops at "mutant survived at line 34" and never does that QA translation.

## Decision: route, not rivalry

| Situation | Tool |
|---|---|
| Reviewing a PR / one suspicious test / no Stryker setup / want a *fix*, not a number | `audit-test` |
| Periodic suite health, a defensible **mutation score**, gating a release | Stryker |
| Go/no-go: `audit-test` is cheap → run it first; if it flags lots of false-confidence, fix those before spending Stryker's hours; when the suite looks tight and you need the number, run the campaign | `audit-test` → Stryker |

## Consequences

- `audit-test`'s own mutation is demoted to the **fallback for when Stryker isn't available** or when the job is a single test, not a score. The taxonomy + funnel is the product; the engine is not the moat.
- A future **ingestion seam** (deferred, not built here) would let `audit-test` consume a Stryker `--reporter json` survivor report, map survivors to covering tests, and run the taxonomy over them — Stryker supplying the proof, `audit-test` supplying the judgment. That is the additive complement and deserves its own design pass before it ships.
- `GLOSSARY.md` gains **Mutation Score** and **Mutation Campaign** to name the exhaustive thing `audit-test` deliberately is *not*, so `--explain` and the other skills can point at the distinction.
