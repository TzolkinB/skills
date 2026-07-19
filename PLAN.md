# Evidence-provenance architecture — phased plan

This plan addresses the structural finding from external design review: **`/sentinel` sells an
executed-evidence verdict, but execution is an optional sub-step gated behind static triage — so a
PASS is mostly static reasoning wearing an execution badge.**

The response is split by design. The *honesty* half lands in Sentinel now — label what is actually
known, stop letting Unexamined masquerade as Proven, and never let a check that didn't run count as
health. The *hard execution gate* half becomes the separate evidence pipeline's reason to exist
([ADR-0002](docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)). This keeps Sentinel's
static-judgment identity ([ADR-0010](docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md))
intact.

Decisions are recorded in ADR-0013, ADR-0014, ADR-0015. This file tracks phasing.

## Phase 0 — Credibility fixes · DONE (PR #32)

Invented `Lines Tested: 84%` made categorical; colliding ADRs renumbered (0011, 0012); private
`references/*.md` de-linked from the shipped plugin.

## Phase 1 — Honesty (Sentinel-only, mostly prose) · ADR-0013 + ADR-0014

Highest trust-per-effort; no new execution.

- **WS1 — Evidence provenance (ADR-0013).** Add the **Unexamined** label alongside Proven/Likely.
  `audit-test` stops counting Unexamined tests as green; 🟢 relabeled "killed the proposed mutation";
  `/sentinel` PASS carries a mandatory provenance line and never asserts execution. Test Plan
  Coverage marked *Likely — model-generated criteria*; stale `lcov` marked *possibly stale*.
- **WS2 — Sacred-path integrity (ADR-0014).** Multi-ecosystem test discovery; zero matches →
  **INCONCLUSIVE** that blocks a clean PASS; test↔code pairing heuristic specified and shown in each
  finding; "guarantee revert on crash" softened; per-framework single-test invocation specified.

Touch points: `skills/audit-test/SKILL.md`, `skills/sentinel/SKILL.md`, `skills/coverage-review/SKILL.md`,
`CONTEXT.md` (Categorical confidence → add Unexamined), `GLOSSARY.md`, and the `fixtures/` expected-findings.

## Phase 2 — Topology (shared read pass) · ADR-0015

- **WS3 — One canonical behavior-contract read.** coverage-review / audit-test / prune-tests consume
  a single read and route to gap / mutate / prune; one finding per issue. Merge-into-one skill is
  designed as a go-plan in ADR-0015 but not taken — it triggers on user feedback, not on schedule.

Touch points: the three skill files plus `/sentinel`'s orchestration section; fixtures for the
de-duplicated reporting.

## Phase 3 — Gate seam (execution gate) · future

- **WS4.** The hard "no PASS without Proven evidence on changed paths" gate lives in the evidence
  pipeline (Gate), consuming Sentinel's labeled output. **The PASS bar is set empirically here**,
  after a prototype measures mutation cost per changed test — deferred deliberately rather than
  guessed. Sacred/high-risk-only vs all-changed-paths is the open question this phase answers.

## Sequencing rationale

Bank the cheap credibility wins (Phase 0), then get the decisions reviewed (this branch) before any
skill logic changes. Phase 1 is the honesty core and is almost entirely prose — it moves the trust
needle most for the least risk. Phase 2 is a mechanical de-duplication once Phase 1 fixes what each
skill *reports*. Phase 3 is a separate product (Gate) and waits on real measurement.
