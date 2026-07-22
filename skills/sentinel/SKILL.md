---
name: sentinel
description: Run a QA judgment pass over a feature branch — test plan gaps, coverage, assertion quality, false-confidence audit, regression risks
argument-hint: "[branch or file path] [--sacred=<glob>] [--explain]"
allowed-tools: [Read, Bash, Glob]
---

Sentinel is the **orchestrator**: it runs no original analysis of its own — it composes the atomic QA skills over a feature branch and synthesizes one QA read (🟢/🟡/🔴) you act on. The question every part serves: do the tests *verify behavior*, or just show green lights? It surfaces the AI-generated suite that passes while guarding nothing before you merge.

## Steps

1. Parse the branch/path from $ARGUMENTS. Also parse:
   - `--sacred=<glob>` (repeatable, or comma-separated) — the **sacred paths** for this run: code/test paths critical enough that a *confirmed* false-confidence there is un-overridable. If absent, no path is sacred and the verdict stays a pure gradient (see Sacred-Path FAIL Override).
   - `--explain` — walkthrough mode.
2. Find all test files and code files in the change
3. If `--explain` is present in $ARGUMENTS, pass it through to every sub-skill call below, and append your own "Why This Matters" section at the end (see Explain Mode).
4. For each file pair (test + code):
   - Run `/test-plan` on the feature description (from commit message or ask) — this section is **reasoned-only** (Likely provenance): its criteria are generated from the commit message, not graded against a written spec, so it never *forces* a verdict on its own
   - Run `/coverage-review` (test vs code)
   - Run `/qa-review` (testability issues)
   - Run `/debug-test` on any failing tests found in the change
5. **Run `/audit-test --changed`** in batch mode over the branch's changed test files (pass `--explain` through if set). Collect its flagged findings — each carries a verdict (🔴 confirmed / 🟡 likely) and the **file path** it lives in. This is the False-Confidence Audit; it answers "do the *passing* tests in this change actually guard anything?", which none of the other four skills ask.
6. Aggregate layer recommendations from the `/test-plan` output and compute a one-line layer distribution summary (`unit/component/integration/e2e`)
7. **Map audit-test findings and coverage-review boundary gaps to sacred paths.** A finding is *sacred* if **either** the test file **or** the code it exercises — its paired source file from step 4 — matches any `--sacred` glob. This matters because an `/audit-test` finding is reported against the *test* file, while a `--sacred` glob is usually written against *source* (e.g. `src/booking/**`); mapping through the test↔code pairing means designating the source path is enough to make a hollow test of it sacred, without the user having to also glob the test directory. **Name the paired source file on each finding** so a reader can see why a `--sacred` glob did or did not trip — a no-fire must be visibly a no-match, never a silent swallow ([ADR-0014](../../docs/adr/0014-sacred-path-integrity-discovery-fails-loud.md)). Determine whether the Sacred-Path FAIL Override fires (see below).
8. Synthesize findings into a **verdict**:
   - 🟢 **PASS**: no major coverage gaps, no testability blockers, no false-confidence findings — **and the False-Confidence Audit actually ran** (not INCONCLUSIVE). PASS is a statement of *static judgment*, never a claim the tests were confirmed; it carries a mandatory provenance line (see Output Format) and never dresses Unexamined tests up as confirmed-solid.
   - 🟡 **CAUTION**: Minor gaps, loose assertions, or an isolated 🟡 likely-false-confidence finding — shippable with notes
   - 🔴 **FAIL**: Major untested paths, brittleness risks, assertions that make no sense, **enough confirmed false-confidence to sink the change** (see How audit-test findings shift the verdict — a lone non-sacred confirmed finding is CAUTION, not FAIL), or a fired Sacred-Path Override
   - The False-Confidence Audit shifts the verdict categorically (see How audit-test findings shift the verdict). A fired Sacred-Path Override is an **un-overridable FAIL** — it cannot be softened to CAUTION regardless of how solid the rest of the branch looks.
9. Output a **Sentinel Report** with risk summary

## How audit-test findings shift the verdict

The False-Confidence Audit is not just an extra section — it moves the verdict, categorically (Sentinel never emits a numeric score; see [ADR-0002](../../docs/adr/0002-sentinel-is-judgment-not-release-evidence.md)). Map count-and-severity onto the gradient:

- **No false-confidence findings** → the audit doesn't hold the verdict back; PASS stays reachable on the other signals — **but only if the audit ran.** If it returned **INCONCLUSIVE** (no recognized test files, per [ADR-0014](../../docs/adr/0014-sacred-path-integrity-discovery-fails-loud.md)), the flagship check contributed nothing: report INCONCLUSIVE and drop to CAUTION at best — never a clean PASS. A tally that is mostly **Unexamined** is reported as "shippable on static judgment, N tests unexamined," never as confirmed-solid ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)).
- **One or more 🔴 confirmed false-confidence (non-sacred)** → **cannot be PASS.** A single confirmed-hollow test is CAUTION at best; several of them, or one on an important-but-not-sacred path, is a FAIL. Confirmed means a mutation actually ran and the test stayed green — treat it as hard evidence, not a hunch.
- **🟡 likely false-confidence only** → informs the report and can pull PASS down to CAUTION, but reasoning-only never *forces* a FAIL by itself. This mirrors audit-test's own confirmed-vs-likely discipline: don't dress up reasoning as proof.
- **Any 🔴 confirmed false-confidence on a sacred path** → the Sacred-Path Override fires (below). Un-overridable FAIL.

"Proportional" here is categorical, not arithmetic: more and higher-severity findings push further toward FAIL, but there is no percentage.

## Sacred-Path FAIL Override

CAUTION is the right default for most gaps — it keeps Sentinel a QA conversation, not a CI gate ([why a 3-state verdict](../../ARCHITECTURE.md)). But on the paths that actually matter, "shippable with notes" is the wrong answer to *confirmed-hollow protection*. So Sentinel borrows J-Rig-style binary rigor for sacred paths only ([ADR-0007](../../docs/adr/0007-sentinel-sacred-path-fail-override.md)):

**The override fires when — on a sacred path (matched via the test↔code mapping in step 7) — either:**
- `/audit-test` returns a **🔴 confirmed false-confidence** finding (a test that guards the sacred behavior guards nothing, confirmed by mutation), **or**
- `/coverage-review` finds an **unhandled boundary condition** in the sacred logic.

**When it fires, the verdict is an un-overridable 🔴 FAIL.** It cannot be reduced to CAUTION by an otherwise-solid branch, and the report must name which sacred path tripped it and why. Everything *not* on a sacred path keeps the normal gradient — CAUTION is still available for non-sacred minor gaps.

Guardrails that keep this honest:
- **Confirmed only.** A 🟡 *likely* false-confidence never fires the override — reasoning alone isn't enough to burn a hard FAIL. If the code couldn't be run, say so and leave the verdict on the gradient.
- **The user designates sacred paths**, per run, via `--sacred`. Sentinel never guesses what's critical. No `--sacred`, no override — and that's a valid way to run.

## Output Format

```
# Sentinel Report: [Branch Name]

## Overview
**Verdict:** 🟡 CAUTION  
**Provenance:** static judgment — 0 confirmed-solid · 1 confirmed-hollow · 1 likely-hollow · 4 unexamined (audit ran; not INCONCLUSIVE)  
**Risk Level:** Medium  
**Shippable:** Yes, with notes  
**Sacred paths:** `src/payments/**` (1 designated) — none tripped (the flagged tests cover booking, not payments)

---

## Test Plan Coverage
_Provenance: Likely — criteria model-generated from the commit message, not verified against a written spec._
✓ Happy path mapped  
✓ Edge cases listed  
⚠ Error paths incomplete (database failure not tested)
Layers: 2 unit / 3 component / 4 integration / 1 e2e

---

## Coverage Review Summary
**Coverage:** Broadly covered, high-risk gaps below (source: static inference — no instrumentation run)  
**High-Risk Gaps:**
- Line 42: Database write error handling — no test
- Line 15: Date boundary condition (midnight) — not tested

**Loose Assertions:**
- `expect(result).toBeDefined()` (line 8) — should assert structure

---

## False-Confidence Audit
Audited 6 changed tests · deep-audited 2 (0 🟢 confirmed-solid · 1 🔴 confirmed-hollow · 1 🟡 likely-hollow) · 4 unexamined
🔴 "rejects overlapping bookings" (BookingService.test.js) — overmocked, confirmed (removed the overlap guard → test stayed green) — paired to `src/booking/BookingService.js`
🟡 "sends confirmation email" (BookingService.test.js) — likely incidental (env not runnable, reasoned only) — paired to `src/booking/BookingService.js`
→ 1 confirmed false-confidence, none on a sacred path — holds the verdict at CAUTION (confirmed-hollow ⇒ not PASS). The 4 unexamined tests are triaged-clean only, not proof. The flagged test pairs to `src/booking/`, which no `--sacred` glob matched, so no override fired; had `src/booking/**` been sacred, this confirmed finding would force an un-overridable FAIL.

---

## Testability Audit
🔴 **HIGH** Hard-coded API URL (line 12) — can't test with mock  
⚠ **MEDIUM** Uses Date.now() directly (line 28) — flaky tests  
✓ All error paths have catch blocks with logging

---

## Assertion Quality
_Provenance: reused from `/coverage-review`'s static read — not a separate analysis Sentinel performs._
- Tests are verifying behavior (not just green lights) ✓
- Mocks are set up correctly ✓
- Async/await handled properly ✓
- One suspicious test (line 45): `expect(bookings.length).toBeGreaterThan(0)` — too loose

---

## Risk Summary
| Category | Count | Severity |
|----------|-------|----------|
| Untested paths | 2 | HIGH |
| Confirmed false-confidence | 1 | HIGH |
| Likely false-confidence | 1 | MEDIUM |
| Testability issues | 2 | MEDIUM |
| Loose assertions | 1 | MEDIUM |
| Brittleness risks | 1 | LOW |

---

## Recommendations
1. **BEFORE SHIPPING:** Strengthen "rejects overlapping bookings" — assert the 2nd booking is rejected with 409, not that save() ran (confirmed false-confidence)
2. **BEFORE SHIPPING:** Mock the API URL (testability)
3. **BEFORE SHIPPING:** Add test for database write failure
4. **FOLLOW-UP:** Refactor Date.now() to injectable clock
5. **NICE TO HAVE:** Tighten assertion on line 45 to check structure

---

## Notes
- Sentinel report generated at 2026-07-07 15:42 UTC
- Branch: `feat/booking-calendar`
- Files reviewed: BookingService.test.js, BookingService.js
- Sacred paths designated: `src/payments/**` — none tripped this run
```

## Explain Mode (`--explain`)

Usage: `/sentinel feature-branch --explain`

When present:
- Every sub-skill call includes `--explain`, so each of their reports carries its own "Why This Matters" section
- Add one additional top-level section after the Risk Summary:

```
### Why This Matters (Overall)
[2-3 sentences tying the verdict to the core Sentinel philosophy: tests verify behavior,
not green lights. Point to the specific finding in this run that best illustrates it.]
```

This is the mode to use when reviewing a branch with someone newer to testing — the report becomes a walkthrough, not just a checklist.

## Notes

- Prioritize recommendations by shippability impact — BEFORE SHIPPING vs FOLLOW-UP vs NICE TO HAVE, as in the example. A report that just lists every issue is useless.
- `/threat-model` exists as a separate skill and is intentionally NOT part of this chain — it answers a different question (what breaks in production) than shippability (are the tests solid). Call it on its own when that's the question; don't assume `/sentinel` covers it.
