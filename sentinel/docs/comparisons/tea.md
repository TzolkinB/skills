# Why not *just* TEA?

**TL;DR** — Use [TEA](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise) for
what it's genuinely good at: risk planning, static test review, traceability, scaffolding, and a
governance gate with a compliance audit trail. Reach for Sentinel/Witness for the two things TEA's
own docs show it **cannot** do — **prove a passing test isn't hollow** (`audit-test`, by mutation),
and turn that proof plus live execution into a **risk-weighted, calibrated** release confidence that
**learns from your gate overrides** (Witness). TEA plans and governs; it doesn't prove, and it doesn't
learn. Those two gaps slot *into* TEA's gate rather than replacing it.

This is a "why ours, not just theirs?" note, held to the same bar as the rest of the repo: **no claim
here that isn't a verified TEA absence.** Every "TEA can't" below was confirmed against TEA's own
published docs on 2026-07-17, and each is falsifiable — the "How to check" line tells you where to
look. If a future TEA release closes one of these gaps, this note is wrong and should be updated.

---

## What TEA actually is (and why the question is fair)

TEA — the **BMAD Test Architect module** ([`bmad-method-test-architecture-enterprise`](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise),
free) — is not a point tool. It's a near-complete testing **orchestration method**: a prompt-persona
agent with nine workflows that span most of the same QA lifecycle Sentinel maps. That's exactly why
"why use yours, not just TEA?" is a real question and not a strawman. Its nine workflows:

| TEA workflow | What it does | Sentinel-map stage it covers |
|---|---|---|
| `test-design` | P0–P3 risk tiers + NFR planning | 1 · Plan |
| `test-review` | Static quality audit → 0–100 score + violations + fixes | 2–3 · Static review |
| `trace` | Requirement→test matrix + categorical gate (PASS/CONCERNS/FAIL/WAIVED) | 4 · Traceability / 7 · Gate |
| `nfr-assess` | NFR evidence audit | 7 · Gate (governance) |
| `framework` / `ci` / `atdd` / `automate` | Scaffold, pipelines, ATDD, expand suites | Setup / authoring |

TEA's stated enemy is *"AI tests that rot"* — it is a **credibility-side ally**, not a green-pusher.
On its home turf — risk-ranked planning, static review, traceability, and a governance gate with an
NFR/compliance audit trail — reach for TEA. This note is not a takedown; it's a boundary line.

## The two things TEA's own docs show it can't do

### 1. Prove a passing test isn't hollow — the strongest, uncontested differentiator

A test can score **100/100** on TEA's static `test-review` and still be **hollow**: a pinned
assertion, an unreached branch, an expected value quietly edited to match a regression (the trap a
self-healer leaves behind). Static review — TEA's or anyone's — reads the test; it can't tell you
whether the test would *fail if the code broke*, because it never breaks the code.

`audit-test` does exactly that: it proposes the single most-likely-breaking change, runs that one
targeted mutation, and checks whether the test goes red — **execution-grounded, not reasoning**. TEA has no
mutation step of any kind. This is the cleanest, least-contested ground in the whole comparison:
mutation proof is a capability TEA's docs simply don't contain.

> **How to check:** search TEA's workflow docs for mutation / "would this test fail" / kill-score.
> `test-review` scores *test quality* statically; nothing runs a mutation. (Verified 2026-07-17.)

### 2. A risk-weighted, calibrated release confidence that learns from overrides — Witness

TEA's `trace` gate is **categorical** — PASS / CONCERNS / FAIL / WAIVED. Its P0–P3 risk tiers inform
planning, but the ranking never becomes a *weight* on the final gate, the gate algorithm isn't
transparent, and — the load-bearing gap — **TEA is stateless.** It logs a WAIVED decision as a
governance artifact, but it does not track whether that override was later vindicated, doesn't measure
its own agreement with human calls, and doesn't learn. Nothing in TEA improves from the last hundred
gate decisions.

Witness is designed to be that missing layer: aggregate execution + credibility evidence into a
**numeric, risk-weighted** release confidence, and **calibrate** it against your gate overrides over
time. TEA governs each release in isolation; Witness is meant to be the memory across releases.

> **Honest caveat, load-bearing:** the *audit-test* half of this pitch is credible **today** — it's a
> shipping skill you can run on your own tests in ten minutes. The *Witness* half is a **design, not a
> proven capability.** The calibrated number is only as good as the calibration loop, and that loop
> has not yet been shown to work on a real corpus (it needs a labeled flake/verdict history first).
> **Do not read "calibrated release confidence" as a live feature.** Witness ships today as an
> advisory evidence-bundle → ship/canary/hold gate; the calibration that would earn it the verdict is
> parked until there's data to calibrate against. This note over-claims nothing on the Witness side —
> and if the reviewer pitch ever does, that's a bug in the pitch.

## Where the overlap is real (so you don't over-trust this note)

An honest positioning note has to name the ground it *doesn't* win:

- **`coverage-review` vs TEA — SOFT overlap.** TEA's `test-review` + `trace` already cover much of
  what coverage-review does. Coverage-review's edge is narrower than it looks: granularity and *real
  instrumentation* (it reads code→coverage data when present) vs TEA's requirement→test matrix. Real,
  but not a knockout. **Don't lead a "why not just TEA" pitch with coverage.**
- **Static test quality — crowded.** `qa-review`, TEA's `test-review`, and third-party tools like
  Exspec all audit static test quality. Overlapping territory; no clean win for anyone. The uncontested
  ground is (1) mutation proof and (2) calibration — lead with those, not with static review.

## How they fit together — orchestrate, don't replace

The two gaps are **additive to TEA, not a replacement for it.** "Integration" here means
**orchestration, not code**: TEA is a prompt-persona agent, not an API, so the pattern is to route to
it and pass evidence between the tools (the repo's *orchestrate-not-absorb* thesis), not to absorb its
workflows. Two concrete seams, both feeding TEA's gate rather than competing with it:

- **Risk-weighting seam (TEA → Witness).** TEA emits P0–P3 tiers; Witness could use them as the
  *weight* on aggregated, credibility-adjusted execution evidence — a P0 requirement whose tests
  `audit-test` flags as hollow contributes ~0 confidence, not a false pass. (Design sketch; see #96.)
- **Calibration feed (TEA → Witness).** TEA's **WAIVED** decisions are already an audit-trailed
  human-override record (evidence → decision → reason) — exactly the labeled data Witness's calibration
  loop needs. TEA is stateless; Witness becomes the memory, fed by TEA's own audit trail.

Net: **TEA plans and governs; Sentinel proves; Witness (eventually) weighs and remembers.** You can
run TEA for its governance gate and slot `audit-test` in as the mutation proof its `test-review`
structurally lacks — today, without adopting anything else.

## Caveats worth stating plainly

- **The Witness half is a design, not proven** — restated because it's the easiest thing to over-sell.
  Credible today: `audit-test`'s mutation proof. Not yet proven: Witness's calibrated number.
- **Integration = orchestration, not code.** TEA is an agent persona, not an API; route to it, pass
  evidence, don't absorb.
- **Licensing.** TEA is indicated free; confirm its license still permits treating it as an integrable
  dependency before any map or README leans on it as one.

---

*Evidence base and the two-seam design detail: issue #96. Map context: [`../orchestration-map.md`](../orchestration-map.md)
(TEA sits at stages 1 and 7; the evidence-ledger row records the verified absences). All TEA capability
and absence claims verified against [TEA's published docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/),
2026-07-17.*
