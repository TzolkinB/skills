# Why not *just* TEA?

**TL;DR** — Use [TEA](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise) for
what it's genuinely good at: risk planning, static test review, requirement→test mapping, scaffolding,
and a governance gate with a compliance audit trail. Reach for `audit-test`/Gate for what TEA's own docs
and source show it **cannot** do — **run a mutation to check whether a passing test is hollow** (`audit-test`, a
shipping skill today): a survived mutation is an execution-grounded counterexample that the test is
hollow; a killed one confirms the test solid *against that specific break*, never a blanket guarantee.
The second gap — aggregating that evidence plus live execution into a **risk-weighted, calibrated**
release confidence that **learns from your gate overrides** — is where Gate is *headed*, but read it as
a **design, not a live feature**: Gate ships today as a categorical advisory ship/canary/hold gate, and
the calibrated/learning layer is parked until there's a labelled history to calibrate against (see the
load-bearing caveat below). The third gap follows from the first: because `trace`'s gate is arithmetic
over **coverage presence** with no credibility input, a P0 requirement whose only test is hollow reads
as covered and gates **PASS** (§3, verified at source). TEA plans and governs; it doesn't run a
mutation to check. Those gaps slot *into* TEA's gate rather than replacing it.

This is a "why ours, not just theirs?" note, held to the same bar as the rest of the repo: **no claim
here that isn't a verified TEA absence.** Every "TEA can't" below was confirmed against TEA's own
published docs on 2026-07-17 — and §3 additionally against the workflow **source** on 2026-07-29 — and
each is falsifiable: the "How to check" line tells you where to look. If a future TEA release closes
one of these gaps, this note is wrong and should be updated.

---

## What TEA actually is (and why the question is fair)

TEA — the **BMAD Test Architect module** ([`bmad-method-test-architecture-enterprise`](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise),
free) — is not a point tool. It's a near-complete testing **orchestration method**: a prompt-persona
agent with nine workflows that span most of the same QA lifecycle this repo's map covers. That's exactly why
"why use yours, not just TEA?" is a real question and not a strawman. Its nine workflows:

| TEA workflow | What it does | Map stage it covers |
|---|---|---|
| `test-design` | P0–P3 risk tiers + NFR planning | 1 · Plan |
| `test-review` | Static quality audit → 0–100 score + violations + fixes | 2–3 · Static review |
| `trace` | Requirement→test matrix + categorical gate (PASS/CONCERNS/FAIL/WAIVED) | 4 · Traceability / 7 · Gate |
| `nfr-assess` | NFR evidence audit | 7 · Gate (governance) |
| `framework` / `ci` / `atdd` / `automate` | Scaffold, pipelines, ATDD, expand suites | Setup / authoring |

TEA's stated enemy is *"AI tests that rot"* — it is a **credibility-side ally**, not a green-pusher.
On its home turf — risk-ranked planning, static review, traceability, and a governance gate with an
NFR/compliance audit trail — reach for TEA. This note is not a takedown; it's a boundary line.

## The three things TEA's own docs and source show it can't do

### 1. Run a mutation to check a passing test — the strongest, uncontested differentiator

A test can score **100/100** on TEA's static `test-review` and still be **hollow**: a pinned
assertion, an unreached branch, an expected value quietly edited to match a regression (the trap a
self-healer leaves behind). Static review — TEA's or anyone's — reads the test; it can't tell you
whether the test would *fail if the code broke*, because it never breaks the code.

`audit-test` does exactly that: it proposes the single most-likely-breaking change, runs that one
targeted mutation, and checks whether the test goes red — **execution-grounded, not reasoning**. A
survived mutation is a counterexample that proves the test hollow; a killed one confirms it solid
*against that mutation*, not a blanket guarantee the test is fine. TEA has no mutation step of any
kind. This is the cleanest, least-contested ground in the whole comparison: mutation-grounded evidence
is a capability TEA's docs simply don't contain.

> **How to check:** search TEA's workflow docs for mutation / "would this test fail" / kill-score.
> `test-review` scores *test quality* statically; nothing runs a mutation. (Verified 2026-07-17.)

### 2. A risk-weighted, calibrated release confidence that learns from overrides — Gate

TEA's `trace` gate is **categorical** — PASS / CONCERNS / FAIL / WAIVED. Its P0–P3 risk tiers inform
planning, but the ranking never becomes a *weight* on the final gate, the gate algorithm isn't
transparent, and — the load-bearing gap — **TEA is stateless.** It logs a WAIVED decision as a
governance artifact, but it does not track whether that override was later vindicated, doesn't measure
its own agreement with human calls, and doesn't learn. Nothing in TEA improves from the last hundred
gate decisions.

Gate is designed to be that missing layer: aggregate execution + credibility evidence into a
**numeric, risk-weighted** release confidence, and **calibrate** it against your gate overrides over
time. TEA governs each release in isolation; Gate is meant to be the layer that reads across them —
calibrating against an override history it *reads*, never one it accumulates itself
([ADR-0047](../adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)).

> **Honest caveat, load-bearing:** the *audit-test* half of this pitch is credible **today** — it's a
> shipping skill you can run on your own tests in ten minutes. The *Gate* half is a **design, not a
> confirmed capability.** The calibrated number is only as good as the calibration loop, and that loop
> has not yet been shown to work on a real corpus (it needs a labeled flake/verdict history first).
> **Do not read "calibrated release confidence" as a live feature.** Gate ships today as an
> advisory evidence-bundle → ship/canary/hold gate; the calibration that would earn it the verdict is
> parked until there's data to calibrate against. This note over-claims nothing on the Gate side —
> and if the reviewer pitch ever does, that's a bug in the pitch.

### 3. `trace` gates on coverage *presence*, so a hollow test reads as covered

Verified against the workflow **source** (not the docs) on 2026-07-29 — `bmad-testarch-trace`, v1.19.1
— and **re-verified unchanged at v1.21.4 on 2026-08-04** while building the `trace`→Gate conversion
([#220](https://github.com/TzolkinB/skills/issues/220)); the two corrections that re-read turned up are
noted below.

- **`steps-c/step-03-map-criteria.md`** marks each oracle item **FULL / PARTIAL / NONE** by mapping a
  *matching test*. Every validation rule it applies is a presence check — endpoint, auth, error-path
  and UI-state coverage "present or missing", plus a not-happy-path-only rule. None inspects whether
  a mapped test would fail if the code broke.
  **Correction (v1.21.4):** the vocabulary is *five*-valued, not three — step-03 §1 marks
  "FULL / PARTIAL / NONE / **UNIT-ONLY** / **INTEGRATION-ONLY**", and step-05 §3b treats all four
  non-NONE values as coverage-eligible. This doesn't touch the presence claim (all five are presence
  calls), but it is the vocabulary anything converting TEA's output has to handle.
- **`steps-c/step-05-gate-decision.md`** is deterministic JS over the resulting percentages:
  `if (p0Coverage < 100) → FAIL`; `P1 >= 90 && overall >= 80 && P0 === 100 → PASS`. `p0Coverage` is
  `covered/total` straight out of Step 3's mapping.
- **Zero occurrences** of `mutation` / `hollow` / `would fail` / `kill score` anywhere in the trace
  source: `SKILL.md`, `instructions.md`, the 671-line `checklist.md`, and all four step files
  (including the 628-line gap analysis and the 681-line gate decision).
- Test quality appears **once**, in step-04, as a printed recommendation —
  `action: 'Run /bmad:tea:test-review to assess test quality'`. That is advice in the gaps report,
  **not an input to the gate arithmetic**. (The published docs describe "optional test quality scores
  from test-review" feeding Phase 2; that does not appear in the gate-decision source.)

**Consequence:** a P0 requirement whose only test is hollow is counted as covered, so `trace` returns
**PASS**. This repo's own [`fixtures/audit-test/booking.spec.js`](../../fixtures/audit-test/booking.spec.js)
is exactly that shape — "rejects overlapping bookings" asserts only that `save()` was called, with
`findOverlapping` stubbed to `[]` so the guard it is named for is never entered. Because it reads as a
*rejection* test, it also satisfies Step 3's error-path-present and not-happy-path-only heuristics.

**Two limits on this claim, stated plainly:**

- On a **synthetic** oracle (no formal requirements) Step 5 downgrades PASS→CONCERNS when oracle
  confidence isn't high. The clean PASS needs formal requirements — so this bites hardest for teams
  with the *most* mature requirements practice, not the least.
- Composing `test-review` does **not** close it: per §1, a test can score 100/100 on static review and
  still be hollow.

> **How to check:** read `src/workflows/testarch/bmad-testarch-trace/steps-c/step-03-map-criteria.md`
> and `step-05-gate-decision.md`, then grep the workflow tree for `mutation`. (Verified 2026-07-29
> against `main`, v1.19.1; re-verified 2026-08-04 against `main`, v1.21.4 — unchanged.)
> **Falsifier:** a TEA release that adds a credibility input to Step 5's arithmetic.

#### What `trace` actually writes (the machine-readable side)

Relevant because Gate *joins* against this output, so what it does and doesn't contain decides what a
conversion can honestly produce. Read at v1.21.4 on 2026-08-04:

| Artifact | Where it's written | Per-requirement rows? | Per-test **title**? |
|---|---|---|---|
| `e2e-trace-summary.json` | step-05 §3b | no — `coverage.inventory`, `priority_breakdown`, `by_level`, test counts | no |
| `gate-decision.json` | step-05 §3b, gate-eligible runs only | no — `gate_status` + `p0`/`p1`/`overall` status | no |
| `traceability-matrix.md` | step-03/05 (`trace-template.md`) | **yes** | **no** — `Detailed Mapping` renders each test as `` `id` `` - `file`:`line` |
| Phase-1 coverage-matrix JSON | step-04 §5–6 → `/tmp/tea-trace-coverage-matrix-<ts>.json`, path recorded in the `.md` frontmatter as `tempCoverageMatrixPath` | **yes** | **yes** — `tests[]` carry `id`, `title`, `file`, `line`, `level`, skip flags |

**Correction to an earlier reading:** the durable Markdown report is *not* the only per-requirement
artifact — the Phase-1 JSON is real, machine-readable, and is what TEA's own step-05 §1 reads back. It
is also a **temp** file, which is the one real fragility in consuming it. That is what
[`tea-to-trace-matrix.mjs`](../../skills/gate/tea-to-trace-matrix.mjs) converts, and why it never parses
the Markdown ([ADR-0050](../adr/0050-tea-trace-converts-from-its-phase-1-json-never-its-markdown.md)).

**This is not a TEA-specific flaw — and shouldn't be pitched as one.** Presence-based coverage is the
category default: Qase's requirements-traceability report links test cases to issues, and the same
shape appears in commercial tools whose internals we can't inspect. TEA is simply the one whose source
is open, which makes it the one place the pattern is *verifiable* rather than inferred. Label the
generalisation honestly — **Confirmed** for TEA (source), **Likely** for Qase (docs only),
**Unexamined** for closed tools. The transferable claim is about the category, and it is TEA's
openness that lets us make it at all.

## Where the overlap is real (so you don't over-trust this note)

An honest positioning note has to name the ground it *doesn't* win:

- **`coverage-review` vs TEA — SOFT overlap, with one hard exception.** TEA's `test-review` + `trace`
  still cover much of what coverage-review does, and coverage-review's edge there stays narrow:
  granularity and *real instrumentation* (it reads code→coverage data when present) vs TEA's
  requirement→test matrix. **Don't lead a "why not just TEA" pitch with additive coverage
  gap-finding.** The exception is coverage ***traceability***: §3 shows `trace` counts a requirement
  covered on the strength of a hollow test, which is a source-verified gap rather than a soft overlap.
  That one is safe to lead with — but it routes to `audit-test`, not to coverage-review.
- **Static test quality — crowded.** `qa-review`, TEA's `test-review`, and third-party tools like
  Exspec all audit static test quality. Overlapping territory; no clean win for anyone. The uncontested
  ground is (1) mutation proof and (2) calibration — lead with those, not with static review.

## How they fit together — orchestrate, don't replace

The two gaps are **additive to TEA, not a replacement for it.** "Integration" here means
**orchestration, not code**: TEA is a prompt-persona agent, not an API, so the pattern is to route to
it and pass evidence between the tools (the repo's *orchestrate-not-absorb* thesis), not to absorb its
workflows. Two concrete seams, both feeding TEA's gate rather than competing with it:

- **Business-risk coverage join (TEA → Gate) — SHIPPED.** `--trace-json` ([#199](https://github.com/TzolkinB/skills/issues/199),
  [ADR-0045](../adr/0045-business-risk-coverage-is-a-join-not-a-register.md)) reads a `trace`-style
  matrix and resolves each requirement to mutation-proven / unverified / hollow / not-covered by
  joining it against `audit-test`'s `runs[]` — the §3 gap, closed. **Not** the same thing as the
  risk-weighting seam below: this join is purely informational and never touches the
  ship/canary/hold arithmetic, only reports alongside it.
- **Risk-weighting seam (TEA → Gate) — still a design sketch, #96.** TEA emits P0–P3 tiers; Gate
  could use them as the *weight* on aggregated, credibility-adjusted execution evidence — a P0
  requirement whose tests `audit-test` flags as hollow contributes ~0 confidence, not a false pass.
  Unlike the join above, this would change the gate's own decision arithmetic — unbuilt, parked
  with the rest of the calibrated-confidence work.
- **Calibration feed (TEA → Gate).** TEA's **WAIVED** decisions are already an audit-trailed
  human-override record (evidence → decision → reason) — the closest thing to the labeled data a
  calibration loop needs. Gate would **read** that record where it already lives; per
  [ADR-0047](../adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) nothing in this repo
  accumulates a store of its own, so "Gate becomes the memory" is not the design. Two caveats before
  anyone leans on this: where TEA persists that trail is **unverified** (the 2026-07-29 teardown
  source-verified `trace`, not the WAIVED trail), and an override is a *proxy* label — it records the
  human's call at gate time, not whether that call was later vindicated.

Net: **TEA plans and governs; `audit-test` checks by execution; Gate (eventually) weighs — reading a
history it doesn't own.**
You can run TEA for its governance gate and slot `audit-test` in as the mutation check its
`test-review` structurally lacks — today, without adopting anything else.

## Caveats worth stating plainly

- **The Gate half is a design, not confirmed** — restated because it's the easiest thing to over-sell.
  Credible today: `audit-test`'s mutation proof. Not yet confirmed: Gate's calibrated number.
- **Integration = orchestration, not code.** TEA is an agent persona, not an API; route to it, pass
  evidence, don't absorb.
- **Licensing — confirmed.** MIT (Copyright (c) 2025 BMad Code, LLC, verified against the repo's
  `LICENSE` file, 2026-07-31) — permissive, and this repo vendors none of TEA's code: Gate's
  `--trace-json` join ([#199](https://github.com/TzolkinB/skills/issues/199)) reads its own
  independently-defined `gate-trace-matrix/v0` shape, informed by TEA's publicly-documented output
  fields but not copied from its source.

---

*Evidence base and the two-seam design detail: issue #96. Map context: [`../orchestration-map.md`](../orchestration-map.md)
(TEA sits at stages 1 and 7; the evidence-ledger row records the verified absences). All TEA capability
and absence claims verified against [TEA's published docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/),
2026-07-17.*
