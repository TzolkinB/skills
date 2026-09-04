# Why not *just* TEA?

**TL;DR** — Use [TEA](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise) for
what it does well: risk planning, static test review, requirement-to-test mapping, scaffolding, and a
governance gate with a compliance audit trail. Turn to `audit-test` and Gate for what TEA's own docs
and source show it **cannot** do.

The first gap: TEA does not **run a mutation to check whether a passing test does not fail when the
code breaks.** `audit-test` does this today, as a shipping skill. A survived mutation is an
execution-grounded counterexample: the test does not fail when the code breaks. A killed mutation
confirms the test works *against that specific break* — never a blanket guarantee.

The second gap: combining that evidence with live execution into a **risk-weighted, calibrated**
release confidence that **learns from your gate overrides.** Gate aims to close this gap. Treat this
as a **design, not a live feature**: Gate ships today as a categorical, advisory ship/canary/hold
gate. The calibrated, learning layer waits until a labeled history exists to calibrate against (see
the load-bearing caveat below).

The third gap follows from the first. `trace`'s gate runs on arithmetic over **coverage presence**,
with no credibility input. So a P0 requirement whose only test does not fail when the code breaks
still reads as covered, and the gate returns **PASS** (§3, verified at source).

TEA plans and governs. It does not run a mutation to check a test. These three gaps slot *into* TEA's
gate. They do not replace it.

This note answers "why ours, not just theirs?" It follows the same evidence bar as the rest of this
repository: **every claim here names a verified TEA absence.** This repo confirmed every "TEA cannot"
claim below against TEA's own published docs on 2026-07-17. Section 3 also confirms its claim against
the workflow **source** on 2026-07-29. Each claim is falsifiable: the "How to check" line tells you
where to look. If a future TEA release closes one of these gaps, this note is wrong. Update it then.

---

## Which tool for X?

| Your situation | Where to go |
| --- | --- |
| You need P0–P3 risk tiers and NFR planning before you write tests | **TEA** `test-design` |
| You want a static test-quality score with violations and fixes | **TEA** `test-review` |
| You need a requirement→test traceability matrix and a governance/compliance gate | **TEA** `trace` |
| You need to scaffold a test framework, CI pipeline, or expand ATDD suites | **TEA** `framework` / `ci` / `atdd` / `automate` |
| You need to know whether a passing test actually fails when the code breaks | **[`audit-test`](../audit-test.md)** — one targeted mutation, execution-grounded |
| You want to know if a P0 requirement's "covered" test is actually hollow | **Gate's `--trace-json` join** — reads TEA's `trace` matrix, resolves each requirement against `audit-test` evidence |
| You want one risk-weighted, calibrated ship/canary/hold call across both | **[`gate`](../gate.md)** — design today; the calibration layer waits on a labeled history |

## What TEA actually is (and why the question is fair)

TEA is the **BMAD Test Architect module**
([`bmad-method-test-architecture-enterprise`](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise),
free). It is not a single-purpose tool. It is a near-complete testing **orchestration method**: a
prompt-persona agent with nine workflows that span most of the same QA lifecycle this repo's map
covers. This is exactly why "why use yours, not just TEA?" is a real question, not a strawman. Its
nine workflows:

| TEA workflow | What it does | Map stage it covers |
|---|---|---|
| `test-design` | P0–P3 risk tiers + NFR planning | 1 · Plan |
| `test-review` | Static quality audit → 0–100 score + violations + fixes | 2–3 · Static review |
| `trace` | Requirement→test matrix + categorical gate (PASS/CONCERNS/FAIL/WAIVED) | 4 · Traceability / 7 · Gate |
| `nfr-assess` | NFR evidence audit | 7 · Gate (governance) |
| `framework` / `ci` / `atdd` / `automate` | Scaffold, pipelines, ATDD, expand suites | Setup / authoring |

TEA states its enemy plainly: *"AI tests that rot."* TEA is a **credibility-side ally**, not a tool
that pushes for green results. On its home ground — risk-ranked planning, static review, traceability,
and a governance gate with an NFR/compliance audit trail — use TEA. This note is not a takedown. It
draws a boundary line.

## The three things TEA's own docs and source show it cannot do

### 1. Run a mutation to check a passing test — the strongest, uncontested differentiator

A test sometimes scores **100/100** on TEA's static `test-review` and still does not fail when the
code breaks: a pinned assertion, an unreached branch, an expected value quietly edited to match a
regression (the trap a self-healer leaves behind). Static review, TEA's or anyone's, reads the test.
It cannot tell you whether the test fails when the code breaks, because it never breaks the code.

`audit-test` does exactly that. It proposes the single change most likely to break the code. It runs
that one targeted mutation. It checks whether the test goes red — **execution-grounded, not
reasoning.** A survived mutation is a counterexample: it proves the test does not fail when the code
breaks. A killed mutation confirms the test works *against that one mutation* — not a blanket
guarantee the test is fine. TEA has no mutation step of any kind. This is the cleanest, least-contested
ground in the whole comparison: mutation-grounded evidence is a capability TEA's docs simply do not
contain.

> **How to check:** Search TEA's workflow docs for "mutation," "would this test fail," or "kill
> score." `test-review` scores *test quality* statically; nothing runs a mutation. (Verified
> 2026-07-17.)

### 2. A risk-weighted, calibrated release confidence that learns from overrides — Gate

TEA's `trace` gate is **categorical**: PASS, CONCERNS, FAIL, or WAIVED. Its P0–P3 risk tiers inform
planning, but the ranking never becomes a *weight* on the final gate. The gate algorithm is not
transparent. And here is the load-bearing gap: **TEA is stateless.** TEA logs a WAIVED decision as a
governance artifact. It does not track whether that override was later shown to be right. It does not
measure its own agreement with human calls. It does not learn. Nothing in TEA improves from the last
hundred gate decisions.

Gate is designed to be that missing layer. Gate combines execution and credibility evidence into a
**numeric, risk-weighted** release confidence, and **calibrates** it against your gate overrides over
time. TEA governs each release in isolation. Gate is meant to be the layer that reads across
releases — calibrating against an override history it *reads*, never one it stores itself
([ADR-0047](../adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)).

> **Honest caveat, load-bearing:** The *audit-test* half of this pitch is credible **today.** It is a
> shipping skill. Run it on your own tests in ten minutes. The *Gate* half is a **design, not a
> confirmed capability.** The calibrated number is only as good as the calibration loop, and that loop
> has not yet proven itself on a real corpus. It needs a labeled history first: tests that pass and
> fail with no code change, each paired with its verdict. **Do not read "calibrated release
> confidence" as a live feature.** Gate ships today as an advisory evidence-bundle → ship/canary/hold
> gate; the calibration that earns it the higher verdict is parked until data exists to calibrate
> against. This note over-claims nothing on the Gate side. If the reviewer pitch ever does, that is a
> bug in the pitch.

### 3. `trace` gates on coverage *presence*, so a test that never fails still reads as covered

This repo verified this claim against the workflow **source** (not the docs) on 2026-07-29 —
`bmad-testarch-trace`, v1.19.1. This repo **re-verified the claim unchanged at v1.21.4 on 2026-08-04**
while building the `trace`-to-Gate conversion ([#220](https://github.com/TzolkinB/skills/issues/220)).
That re-read turned up two corrections, noted below.

- **`steps-c/step-03-map-criteria.md`** marks each oracle item **FULL / PARTIAL / NONE** by mapping it
  to a *matching test*. Every validation rule in this step is a presence check: endpoint, auth,
  error-path, and UI-state coverage marked "present or missing," plus a not-happy-path-only rule. None
  of these rules checks whether a mapped test fails when the code breaks.
  **Correction (v1.21.4):** the vocabulary has *five* values, not three. Step-03 §1 marks
  "FULL / PARTIAL / NONE / **UNIT-ONLY** / **INTEGRATION-ONLY**," and step-05 §3b treats all four
  non-NONE values as coverage-eligible. This does not change the presence claim — all five values are
  presence calls — but it is the vocabulary any tool converting TEA's output has to handle.
- **`steps-c/step-05-gate-decision.md`** is deterministic JS code that runs over the resulting
  percentages: `if (p0Coverage < 100) → FAIL`; `P1 >= 90 && overall >= 80 && P0 === 100 → PASS`.
  `p0Coverage` is `covered/total`, taken straight from Step 3's mapping.
- **Zero occurrences** of `mutation` / `hollow` / `would fail` / `kill score` anywhere in the trace
  source: `SKILL.md`, `instructions.md`, the 671-line `checklist.md`, and all four step files
  (including the 628-line gap analysis and the 681-line gate decision).
- Test quality appears **once**, in step-04, as a printed recommendation:
  `action: 'Run /bmad:tea:test-review to assess test quality'`. That is advice in the gaps report. It
  is **not an input to the gate arithmetic**. (The published docs describe "optional test quality
  scores from test-review" feeding Phase 2. That description does not appear in the gate-decision
  source.)

**Consequence:** a P0 requirement whose only test does not fail when the code breaks still counts as
covered, so `trace` returns **PASS**. This repo's own
[`fixtures/audit-test/booking.spec.js`](../../fixtures/audit-test/booking.spec.js) is exactly this
shape. Its "rejects overlapping bookings" test asserts only that `save()` was called, with
`findOverlapping` stubbed to `[]`, so the guard it is named for never runs. Because it reads as a
*rejection* test, it also satisfies Step 3's error-path-present and not-happy-path-only heuristics.

**Two limits on this claim, stated plainly:**

- On a **synthetic** oracle (no formal requirements), Step 5 downgrades PASS to CONCERNS when oracle
  confidence is not high. The clean PASS needs formal requirements. So this bites hardest for teams
  with the *most* mature requirements practice, not the least.
- Running `test-review` alongside `trace` does **not** close this gap. Per §1, a test sometimes scores
  100/100 on static review and still does not fail when the code breaks.

> **How to check:** Read
> `src/workflows/testarch/bmad-testarch-trace/steps-c/step-03-map-criteria.md` and
> `step-05-gate-decision.md`, then grep the workflow tree for `mutation`. (Verified 2026-07-29 against
> `main`, v1.19.1. Re-verified 2026-08-04 against `main`, v1.21.4: unchanged.)
> **Falsifier:** a TEA release that adds a credibility input to Step 5's arithmetic.

#### What `trace` actually writes (the machine-readable side)

This matters because Gate *joins* against this output. What the output does and does not contain
decides what a conversion honestly produces. Read at v1.21.4 on 2026-08-04:

| Artifact | Where it is written | Per-requirement rows? | Per-test **title**? |
|---|---|---|---|
| `e2e-trace-summary.json` | step-05 §3b | no — `coverage.inventory`, `priority_breakdown`, `by_level`, test counts | no |
| `gate-decision.json` | step-05 §3b, gate-eligible runs only | no — `gate_status` + `p0`/`p1`/`overall` status | no |
| `traceability-matrix.md` | step-03/05 (`trace-template.md`) | **yes** | **no** — `Detailed Mapping` renders each test as `` `id` `` - `file`:`line` |
| Phase-1 coverage-matrix JSON | step-04 §5–6 → `/tmp/tea-trace-coverage-matrix-<ts>.json`, path recorded in the `.md` frontmatter as `tempCoverageMatrixPath` | **yes** | **yes** — `tests[]` carry `id`, `title`, `file`, `line`, `level`, skip flags |

**Correction to an earlier reading:** the durable Markdown report is *not* the only per-requirement
artifact — the Phase-1 JSON is real, machine-readable, and is what TEA's own step-05 §1 reads back. It
is also a **temp** file, which is the one real fragility in consuming it. That is what
[`tea-to-trace-matrix.mjs`](../../skills/gate/tea-to-trace-matrix.mjs) converts, and why it never
parses the Markdown ([ADR-0050](../adr/0050-tea-trace-converts-from-its-phase-1-json-never-its-markdown.md)).

**This is not a flaw specific to TEA, and this note does not pitch it as one.** Presence-based
coverage is the category default: Qase's requirements-traceability report links test cases to issues,
and the same shape appears in commercial tools whose internals this repo cannot inspect. TEA is simply
the one tool whose source is open, which makes it the one place this pattern is *verifiable* rather
than inferred. Label the generalization honestly — **Confirmed** for TEA (source), **Likely** for
Qase (docs only), **Unexamined** for closed tools. The transferable claim is about the category, and
it is TEA's openness that lets this repo make that claim at all.

## How they fit together — orchestrate, do not replace

The two gaps described above are **additive to TEA, not a replacement for it.** "Integration" here
means **orchestration, not code**: TEA is a prompt-persona agent, not an API, so the pattern is to
route to TEA and pass evidence between the tools (this repo's *orchestrate, not absorb* thesis), not
to absorb TEA's workflows. Two concrete seams feed TEA's gate rather than compete with it:

- **Business-risk coverage join (TEA to Gate) — SHIPPED.** `--trace-json` ([#199](https://github.com/TzolkinB/skills/issues/199),
  [ADR-0045](../adr/0045-business-risk-coverage-is-a-join-not-a-register.md)) reads a `trace`-style
  matrix and resolves each requirement to mutation-proven / unverified / hollow / not-covered by
  joining it against `audit-test`'s `runs[]` — the §3 gap, closed. This join is **not** the same thing
  as the risk-weighting seam below: this join is purely informational and never touches the
  ship/canary/hold arithmetic; it only reports alongside it.
- **Risk-weighting seam (TEA to Gate) — still a design sketch, #96.** TEA emits P0–P3 tiers. The
  design: Gate uses these tiers as the *weight* on combined, credibility-adjusted execution evidence —
  a P0 requirement whose tests `audit-test` flags as never failing when the code breaks contributes
  about zero confidence, not a false pass. Unlike the join above, this seam changes the gate's own
  decision arithmetic. It is unbuilt, and parked with the rest of the calibrated-confidence work.
- **Calibration feed (TEA to Gate).** TEA's **WAIVED** decisions are already an audit-trailed
  human-override record (evidence → decision → reason) — the closest thing to the labeled data a
  calibration loop needs. Under this design, Gate reads that record where it already lives. Per
  [ADR-0047](../adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md), nothing in this repo
  accumulates a store of its own, so "Gate becomes the memory" is not the design. Two caveats before
  anyone relies on this: where TEA stores that trail is **unverified** (the 2026-07-29 teardown
  verified `trace` at the source, not the WAIVED trail), and an override is a *proxy* label — it
  records the human's call at gate time, not whether that call was later shown to be right.

Net: **TEA plans and governs; `audit-test` checks by execution; Gate, eventually, weighs — reading a
history it does not own.**
Run TEA for its governance gate, and add `audit-test` as the mutation check its `test-review`
structurally lacks — today, without adopting anything else.

## It's Working If

- You run TEA for risk planning, static review, traceability, and its governance gate — never for
  mutation-grounded proof, which it does not have.
- `audit-test` only enters where TEA's own docs and source show no mutation step exists: proving a
  passing test actually fails when the code breaks.
- A Gate verdict fed by TEA evidence reads as advisory today, not as a confirmed calibrated number —
  the calibration layer stays parked until a labeled override history exists.
- The business-risk coverage join (`--trace-json`) reports alongside Gate's ship/canary/hold call. It
  never enters the arithmetic.
- Every "TEA cannot" claim in this note traces to TEA's own published docs or source, not to
  inference — each has a "How to check" line.

If this note ever claims Gate's calibration is live, or claims `audit-test` replaces TEA's planning
and governance instead of adding the one mutation check TEA structurally lacks, that is a bug — file
it. See [Contributing & Support](../../README.md#contributing--support).

## FAQ

**Q: Does `coverage-review` beat TEA's `test-review` plus `trace`?**
A: Mostly no — soft overlap, with one hard exception. TEA's `test-review` plus `trace` already cover much of what `coverage-review` does; `coverage-review`'s edge stays narrow: granularity and real instrumentation (it reads code-to-coverage data when present) against TEA's requirement-to-test matrix. Do not lead a "why not just TEA" pitch with additive coverage gap-finding. The exception is coverage traceability: §3 shows `trace` counts a requirement as covered on the strength of a test that does not fail when the code breaks — a source-verified gap, not a soft overlap. Safe to lead with, but it routes to `audit-test`, not to `coverage-review`.

**Q: Does `qa-review` beat TEA's `test-review` at static test quality?**
A: No tool wins cleanly — this ground is crowded. `qa-review`, TEA's `test-review`, and third-party tools like Exspec all audit static test quality. The uncontested ground is (1) mutation proof and (2) calibration — lead with those, not with static review.

**Q: Is Gate's calibrated release confidence live today?**
A: No — restated because it is the easiest thing to over-sell. Credible today: `audit-test`'s mutation proof, a shipping skill you can run in ten minutes. Not yet confirmed: Gate's calibrated number, which needs a labeled history first — tests that pass and fail with no code change, each paired with its verdict — before the calibration loop can prove itself.

**Q: Does this repo integrate with TEA by absorbing its code?**
A: No. TEA is a prompt-persona agent, not an API. "Integration" means orchestration: route to TEA, pass evidence between the tools. Nothing here absorbs TEA's workflows.

**Q: Does this repo vendor any of TEA's code, and what's the license?**
A: No vendoring. TEA is MIT-licensed (Copyright (c) 2025 BMad Code, LLC, verified against the repo's `LICENSE` file, 2026-07-31) — permissive. Gate's `--trace-json` join ([#199](https://github.com/TzolkinB/skills/issues/199)) reads its own, independently-defined `gate-trace-matrix/v0` shape, informed by TEA's publicly-documented output fields but not copied from its source.

---

*Evidence base and the two-seam design detail: issue #96. Map context:
[`../orchestration-map.md`](../orchestration-map.md) (TEA sits at stages 1 and 7; the evidence-ledger
row records the verified absences). This repo verified all TEA capability and absence claims against
[TEA's published docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/)
on 2026-07-17.*
