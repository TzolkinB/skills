# The AI-Test Tooling Orchestration Map

> **New here? Run [`audit-test`](audit-test.md) on one test first.** One command shows you right
> away whether it finds anything in your suite. Read this document when you want the whole
> picture. It is the reference for **which tool to use at each stage, and in what order.**

**What this is:** a guide to the testing tool to use at each stage of QA work. The stages run from
planning what to test, through judging whether your existing tests are any good, to deciding
whether a change is safe to ship.

**A skill exists here for every stage.** Each one is something you run, not a link. Each skill
tells you what to do next with its result. For example, `prune-tests` does not delete a test it
suspects checks nothing real. Instead, it hands that test to `audit-test`, to confirm the
suspicion first.

At each stage, the map also names the best free tool someone else built, and states plainly when
to reach for that tool instead. The recommendation favors the other tool wherever the evidence
supports it. **One gap stops those tools completely: a test that drives a real browser.** They
work by changing your source code and running the test again under Vitest or Jest, so a Playwright
or Cypress test is out of their reach. That gap is why these skills exist.

---

## The seven QA workflow stages

```
PLAN ─► AUTHOR ─► AUDIT ─► COVERAGE ─► FLAKE/RELIABILITY ─► TRIAGE ─► GATE
```

Each stage lists three things: the best free tool or tools for it, the point where those tools
stop (especially the point where app-driven E2E work stops them), and this project's own tool
that fills that gap.

| # | Stage | Best free tool(s) | Where free tools stop | This project's tool |
|---|-------|-------------------|------------------------|----------------------|
| 1 | **Plan** — turn a ticket or feature into a risk-ranked plan | **Playwright Planner agent** (explores the running app and writes a Markdown plan; first-party; `init-agents --loop=claude`); **TEA** (risk tables) | Planner explores the app. It does not rank tasks by *this diff's* blast radius or by threat model | `test-plan`, `threat-model` |
| 2 | **Author** — write the tests | **Playwright Generator agent** plus **Cypress AI** (`cy.prompt()`, Studio AI, the `cypress-author` skill — both first-party, app-driven, and verify selectors and assertions live) | Generation is now a solved, common capability. *Trustworthy* generation is not — these tools optimize toward a **green** result, not toward a *meaningful* one | `qa-review` (testability) |
| 3 | **Audit** — is this *passing* test proof of anything real? | **StrykerJS** (full mutation), **Tautest** (PR diff-mutation, JS/TS **unit**), **Exspec** (a static test-quality linter — flags assertion-free, over-mocked, and coupled tests, multi-language, no execution) | The mutation tools change source code and run only under Vitest or Jest → they **cannot reach app-driven Playwright or Cypress tests** (the reachability wall). Exspec is a real ally, but it is **static — it cannot prove through mutation that an assertion *matters***. **No first-party agent audits at all.** | **`audit-test`** (mutation-proof on **dev-served** Playwright/Cypress tests) — the ADR-0016 staleness guard is the net-new piece |
| 4 | **Coverage** — what code has no test? | V8/istanbul (Vitest/Jest), Playwright coverage; `coverage-guard` (an AI skill — **auto-generates tests in a loop until it reaches 100% line coverage → a manufactured-confidence hazard**, not a credibility check) | A line-coverage number is not the same as assertion quality — and `coverage-guard` *manufactures* its number by auto-writing tests to reach it (no check on assertion quality); it is also blind to app-driven paths | `coverage-review` |
| 5 | **Flake / reliability** — is this test run stable? | Playwright's own **`flaky` status**; auto-repair tools (Playwright Healer, Cypress self-heal, Healenium, CodeceptJS heal); Tautest's static `flakiness` check | The `flaky` status catches only a test that **fails, then passes on retry**; the auto-repair tools **hide instability — they change the test until it passes, and the pass hides the problem** (a credibility hazard); the static check never runs a test | **`debug-test` flake mode** (finds instability by running the test, sets it aside, and routes the cause — it does *not* auto-repair the test to hide the problem) |
| 6 | **Triage / repair** — why did the test fail? | **Playwright Healer agent** (replays the test, relocates elements, and patches it — it **skips the test if the app's behavior looks broken**); Cypress self-heal; trace viewer/Test Replay; **cypress-flaky-test-audit** (Cypress-side, per-command runtime evidence — queue order versus execution order, timing, a retry comparison, commands that never ran; **diagnosis only — it does *not* auto-repair the test to force a pass**) | The auto-repair tools push the test toward a pass, and sometimes **mask a real regression or skip it silently** — none of them judges whether the failure was a *real defect*, and none of them records *what* changed to reach a pass | `debug-test` (Step 4.5 **classifies the repair** from the diff — a selector or wait fix clears cheaply, a changed expected value routes to `audit-test`'s baseline-lock check, a rewritten setup blocks the automatic clear — and proposes the `Heal-bucket:` commit trailer), `diagnosing-bugs`, `bug-report` |
| 7 | **Gate** — is this change ready to ship? | CI pass/fail; **TEA** (evidence artifacts, categorical) | Pass/fail on the raw suite gives no credibility check (it does not ask whether the green result is real), no live-execution evidence bundle, and no calibration | **Gate** (combines execution evidence and credibility evidence into a **categorical, worst-wins** decision; a calibration loop is planned) — see below |

**The core pattern, confirmed by checking the first-party agents directly:** the *entire* free,
first-party, app-driven ecosystem **optimizes tests toward a GREEN result.** This ecosystem
includes Playwright's planner, generator, and healer; Cypress AI; Healenium; and CodeceptJS.
Writing tests and auto-repairing them are now common, first-party capabilities. **Nothing in the
app-driven space proves that a green result means anything** — and auto-repair is actively
*hostile* to credibility: it repairs the test, or *skips* it, to reach green, and that hides both real
regressions and test instability. So Kim's own focus is not "build Playwright or Cypress tools
that author or auto-repair tests" (first-party tools already own that) — it is the **trust and
credibility counterweight** to a green-pushing ecosystem: **Audit** (prove the green result is
real), **honest flake handling** (find instability, set the test aside, and route the cause,
never auto-repair to hide the problem), and **Gate** (combine the evidence, and, in future,
calibrate it). That is the clearest, most defensible statement of the gap.

## Two ways to use this: standalone, or in sequence

Matt Pocock's skills philosophy applies here: **the orchestration is an *option*, not a
requirement.**

- **Standalone.** Each stage's skill stands alone. Grab `audit-test` for one suspicious test,
  without running anything else. Use `debug-test` on a single red spec. You invoke each skill
  independently, and each skill has value on its own. You decide what you need.
- **In sequence.** The stage *order* is the recommended path when you want coverage from start to
  end. That order is also what lets each stage's output flow into a single evidence artifact (see
  Gate).

`qa-compass` already works this way. It routes you *to* individual skills; it does not force you
through all of them as one pipeline. The map below documents both the standalone value of each
item and the order that connects them.

## The bar for trusting a recommendation here

A curated map that just *asserts* "use X over Y" has the same low quality this repo exists to
catch — one level up. So the map holds itself to **this repo's own evidence standard.** Every
recommendation carries one of three provenance labels, from
[ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md):

- **Confirmed** — the team ran the tool and observed the result: an experiment, a clone-and-read,
  or a doc verified at the source. The label states *what* the team observed.
- **Likely** — reasoned or verified from a primary source, but not demonstrated in this project's
  own context.
- **Unexamined** — asserted, not yet checked. **An Unexamined recommendation is a to-do, not a
  claim.** It is not advice until it reaches at least Likely.

This is not new machinery.
[ADR-0004](adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md) already does exactly this
for `audit-test` versus Stryker: "route, not rivalry," with a Situation-to-Tool table and reasons.
This map applies that same ADR across all seven stages. **A claim earns a spot on this map two
ways.** It states why this project's tool beats the alternative, backed by evidence. Or, it
carries an honest label that admits the team has not proven the claim yet. **A claim with
neither does not earn a spot.** See the Evidence Ledger below.

---

## Direct comparisons with other tools

These are per-competitor notes. Each one holds to the no-unverified-claim bar, and each states
where the other tool is the better choice. Read these when you decide between a specific external
tool and one of these skills:

- **[`comparisons/mutation-tools.md`](comparisons/mutation-tools.md)** — Stryker, Tautest,
  Exspec, and Pitest·Arcmutate. The layered answer to false confidence: run the mutation tool at
  the unit layer — it is the better choice there. Use `audit-test` at the app-driven E2E layer, where those
  tools structurally cannot enter. Gate combines the evidence; it does not verify it.
- **[`comparisons/tea.md`](comparisons/tea.md)** — BMAD TEA. Use TEA for risk planning and its
  governance gate. Use these skills for the mutation check and the calibration work that
  TEA's own docs show it does not do.

---

## Denominator honesty

**State the denominator, not only the numerator. Every result names what it was drawn from, so a
clean number never reads as broader than the run that produced it.**

"100/100 health" means nothing if the test run covered one page of forty. That is the *coverage
illusion* under another name, and commercial tools now sell the fix as a feature ("pages tested
versus pages available"). Four places in this repo already state their denominator. Each place
reached this conclusion independently; none of them connects to the others. Two are worth reading
in full. This document names the pattern here so nobody re-explains it each time — and so the one
place it is **missing** stays visible.

**Worked example 1 — `gate`'s executed-floor (stage 7).** A test framework reports `PASSED` even
after it runs one test out of a thousand. Skipped and pending tests sit outside the pass/fail
counts. So a mistake in discovery, a filter, or a config file reads as a clean green result. Gate
compares the tests it *executed* against the tests the report itself says it *discovered*. It
prints that fraction next to every execution suite that ran at least one test — red, unstable, or
green, not only the suite it caps:
`"12 of 180 discovered tests executed — 7%; 168 skipped"`. A suite under the floor (default 50%;
an operator overrides it, but never below 25%) is capped at `canary` instead of `ship`
([#157](https://github.com/TzolkinB/skills/issues/157); `skills/gate/gate.mjs`, self-tested). The
limit is stated too: the discovered count comes from the report itself, so a suite narrowed
*before* the report was written still looks fully executed ([`gate.md`](gate.md)).

**Worked example 2 — `e2e-impact`'s run-all / unmapped bucket (stage 1).** Tracing a diff to the
E2E specs it affects is a heuristic method. A spec never imports the source code that drives it,
so some changed files match no spec at all. `e2e-impact` puts those files into an explicit
**run-all / unmapped** bucket in its output, instead of dropping them from the impacted-spec list
silently. A changed global file (a root layout, a router table, a shared primitive) also goes into
that bucket, instead of being resolved into a subset that looks plausible but is not proven. The
bucket is an edge to *every* spec, not a missing edge, and `debug-test --drift` has to combine it
back in when it inverts the map ([`e2e-impact/SKILL.md`](../skills/e2e-impact/SKILL.md)).

**The same pattern appears in two more places.** Gate's **examined-floor** compares deep-audited
tests against everything the audit triaged. It fixes that denominator at *all triaged tests*,
precisely so shrinking it never flatters the ratio
([ADR-0038](adr/0038-gate-trust-boundary-and-examined-floor-population.md), in `gate.mjs`
alongside the executed-floor). `audit-test` batch mode prints its certified scope as a fraction of
the suite (`"12 of ~180 suite test files"`), so a `--changed` `ship` result does not read as a
whole-suite result. Where that suite count is not cleanly computable, it names the scope
*without* a fraction, instead of inventing one.

**Where the denominator is missing — `coverage-review`.** Its contract scopes it to one
test-and-code file pair (`[test file path] [code file path]`). It tells you which branches of the
one file in front of it have no guard. Nothing in its output says how many of the repo's source
files never reached it at all. The line percentage it reports for that one file, in
instrumentation mode, is a *within-file* denominator, not a repo-level one. A repo-level
denominator needs a driver that finds an *untested* module — a file with no matching test. That
is exactly the seam [#180](https://github.com/TzolkinB/skills/issues/180) exists to fill
([ADR-0044](adr/0044-repo-level-coverage-inventory-obligation-driver.md)). Until that lands, this
document states the gap plainly, instead of hiding it.

## Flake-diagnosis evidence: Cypress and Playwright have matching tools (feeds stages 5–6)

`debug-test` flake mode's honest approach at stage 5 is **detect, set aside, then route the
cause**, and it explicitly *refuses to judge the cause itself* — it hands the root cause to a tool
that carries real evidence. Playwright already has that evidence source, first-party (**trace
viewer / Test Replay**). Cypress's side was thin. **cypress-flaky-test-audit** fills that gap, on
the Cypress side:

- **What it is** (README verified at the source, 2026-07-12): a runtime tracer for Cypress
  internals. It hooks the command queue. It records the **order commands enter the queue versus
  the order they run, per-command timing, internal retries, pass or fail, and commands that never
  ran**, rendered as console, terminal, or HTML output, with command graphs and side-by-side
  retry comparisons. It is a **diagnosis** aid for test instability — it explains *why* a Cypress
  test is unstable. It does **not** detect instability for you. It does **not** change the code.
  It does **not** judge credibility. This matters: it also **does not push the test toward a
  pass** (unlike the auto-repair tools), so it works with the honest-flake approach, not against
  it.
- **Where it sits:** *downstream* of `debug-test`'s instability detection (stage 5), as the
  Cypress-side root-cause evidence for stage 6 — the exact slot the Playwright trace viewer
  occupies. The symmetry is clean: **an unstable Cypress test routes to
  cypress-flaky-test-audit; an unstable Playwright test routes to the trace viewer.**
- **Point to it; do not absorb it.** The right move is a *pointer* — flake mode routes a flagged
  Cypress spec here for command-level root cause. Building queue-interception into this project's
  own tools turns a skills-and-orchestration layer into a runtime-instrumentation plugin (a
  change of category, against the thesis and against Kim's own focus). Some ideas are worth
  pulling as *heuristics* `debug-test` references, not as code to copy: an
  enqueue-versus-execution mismatch and commands that never ran, both as instability signals; a
  side-by-side retry comparison as the root-cause lens.
- **Not an overlap with `audit-test`.** The two work on entirely different axes: timing and
  order, versus credibility. There is no competition with stage 3.

> **Provenance note:** an external Gemini "comparative architecture" report on this tool versus
> Sentinel was **fabricated** — it invented a version of Sentinel that is a "runtime
> telemetry/observability framework," with an "MVP0 Playwright core," "queue interception," and a
> "driver-adapter pattern," and its headline advice (build a Cypress driver adapter *into*
> Sentinel) applies only to that invented product. The team discarded the report. Only its
> *description of cypress-flaky-test-audit itself* matched the real README. This is the
> [[external-review-reliability]] pattern again — verify an LLM's design claims against the
> source.

## Adjacent: code-quality and design review (not this project's lane)

Some tools review the *design of the code*, not the *credibility of the tests* — a different
axis, at the same point in a PR review. This map catalogs them so the map is honest about its
neighborhood, but these tools sit outside this project's competitive lane:

- **Cursor `thermo-nuclear-code-quality-review`** (first-party, free in cursor-team-kit) — an
  aggressive **static** review of maintainability and architecture (abstraction quality, files
  over 1,000 lines, tangled conditional logic, missed simplifications). Verified from the source
  (SKILL.md, 2026-07-12): it does **not** execute code, does **not** verify test behavior, has no
  mutation check, and has no E2E check. Its own rule, *"do not approve merely because behavior
  seems correct,"* echoes this project's own rule, *"a green result is not proof"* — **the same
  skeptical spirit, aimed at a different target.** A team runs both: thermo-nuclear asks whether
  the code is well built; `audit-test` asks whether the tests prove it works. The nearest
  neighbor to this tool inside this project is `qa-review` or `codebase-design`, not audit.
- **Strategic signal:** the major AI-coding tools ship static code-*quality* review, not
  test-*credibility* proof. This *reinforces* the audit lane rather than closing it. A Cursor
  user with thermo-nuclear installed still has the exact gap `audit-test` fills: a passing test
  that checks nothing real.

---

## Evidence ledger: why this recommendation, and is it proven?

Each core claim below carries its provenance label
([ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) and the evidence that
backs it. **This table answers "why use this recommendation over another one."** An unproven
claim is not deleted — the table labels it, and gives it a path toward proof.

| Claim | Label | Backed by / what upgrades it |
|---|---|---|
| Stryker and Tautest cannot audit app-driven Playwright or Cypress tests (the reachability wall) | **Confirmed** | The team cloned and read Tautest: Stryker-only, Vitest/Jest runners, zero Playwright/Cypress code in the source, and it explicitly routes E2E tests out of mutation scope. The team verified StrykerJS's mutate-model at its docs. |
| `audit-test` proves an app-driven Playwright test, on dev-served targets | **Confirmed** | Run on the Memory app: the team mutated `Main.reducer.ts:38`. Dev-served, the test failed (a real 🟢); a stale `preview(dist)` build gave a false 🔴 (the staleness-guard gap, ADR-0016). |
| Playwright and Cypress first-party agents optimize toward a green result and do not audit | **Confirmed** | Verified at the Playwright docs: the healer agent "skips the test if functionality appears broken." Cypress AI writes tests and self-heals. Neither product has an auditor. |
| **`audit-test` catches a Playwright-Healer-produced regression locked in by a green result** | **Confirmed (with caveat)** — EXPERIMENT-0002 (internal, not tracked), run 2026-07-11 | A blinded healer locked in a real regression as green (an assertion changed from 12 to 10); a blinded `audit-test` flagged it 🔴/🟡 ("enforces the regression, would reject the fix"). **Caveat:** the catch depended on recovering intent from the source code — *mechanical mutation alone missed it* (the assertion still had teeth). A robust defense needs Audit **plus** an assertion-diff or intent signal. No single stage catches the healer alone. |
| Gate's extra value on hard-failure, ambiguous E2E cases is nil-to-negative today | **Confirmed** | Run against the real `witness-claude` CLI: `classifyFlaky` only fires on a fail-then-pass-on-retry result; gate HOLDs on every red result (EXPERIMENT-0001). |
| Gate earns the ship-verdict through a calibration loop | **Unexamined — PARKED** | Design intent only. Calibration needs data collected over time, so a single session gives no proof of it. It also props up the exact part experiments already deflated — nil-to-negative value on hard E2E cases. A dedicated experiment is not worth running now. This claim must not appear as a live capability. |
| ~~`debug-test` flake mode beats "Playwright flag + read the trace" on the ambiguous subset~~ → **REFRAMED**: flake mode's value is **disposition and routing**, not detection | **Likely (by inspection, 2026-07-11)** | The team checked the SKILL file and ADR-0012 directly: detection *is* the framework's own signal (`--repeat-each`/`status:"flaky"`) — that is the baseline, **by design** — it claims no detection edge over that baseline. Its value is quarantine instead of skip, plus routing the cause to a skill that *confirms* it (`audit-test`). It is honest by design: unlike Gate, it explicitly **refuses to judge the cause**. But this is a workflow prescription, and its technical proof is **borrowed from `audit-test`** (already Confirmed) — it has no independent proof of its own. A heavy injected-test-corpus A/B test proves a claim this tool does not make (resolving the ambiguous subset), so **it is not worth running.** |
| cypress-flaky-test-audit traces, per command, the queue order versus execution order, timing, a retry comparison, and commands that never ran, for Cypress (as HTML, console, or terminal output); diagnosis only; it does not auto-repair the test to force a pass | **Confirmed (README at the source, 2026-07-12)** | The team fetched the GitHub README directly; the features match. To upgrade this: run the tool on a real unstable Cypress spec and confirm the reported command graph. |
| cypress-flaky-test-audit is the Cypress-side stage-6 root-cause evidence source that `debug-test` flake mode routes to (symmetric to the Playwright trace viewer); point to it, do not absorb it | **Likely (reasoned, 2026-07-12)** | This follows from the map's own thesis of pointing to a tool instead of rebuilding it, plus the tool being diagnosis only (aligned with the honest-flake approach). Not yet demonstrated: no live handoff has run yet. To upgrade this: flake mode flags a Cypress spec, hands it to this tool, and the team confirms the root cause reads clearly end to end. |
| **TEA** (BMAD Test Architect, free) produces P0–P3 risk tables (Plan), plus a categorical PASS/CONCERNS/FAIL/WAIVED governance gate with NFR and compliance evidence (Gate) | **Confirmed (docs at the source, 2026-07-17)** | [BMAD TEA docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/): `test-design` risk tables, the `trace` categorical gate, `nfr-assess`. TEA is a **credibility and governance-side ally**, not a tool that pushes toward green (it states its target as "AI tests that rot"). The team verified what TEA *lacks* — the audit and Gate gap: **no mutation check, no live-execution ingest, no calibration** (see #96; the reviewer-facing writeup is [`comparisons/tea.md`](comparisons/tea.md)). |
| **TEA's `trace` gate checks only whether coverage exists, not whether it works** — Step 3 maps each requirement to a matching test (FULL/PARTIAL/NONE/UNIT-ONLY/INTEGRATION-ONLY), and Step 5 is deterministic arithmetic over those percentages (`P0 < 100 → FAIL`; `P0 = 100 ∧ P1 ≥ 90 ∧ overall ≥ 80 → PASS`), with **no** mutation or credibility input → a P0 requirement covered only by a test that checks nothing real still gates **PASS** | **Confirmed (workflow source, `main` @ v1.19.1, 2026-07-29; re-verified unchanged @ v1.21.4, 2026-08-04; re-verified unchanged @ v1.24.0, 2026-09-04)** | The team read `bmad-testarch-trace/steps-c/step-03-map-criteria.md` and `step-05-gate-decision.md`; **zero** hits for mutation/hollow/would-fail/kill-score in the decision-path source (SKILL file, instructions, checklist, every `steps-c/e/v` file). Two additions since the last check, both confirmed **not** critical to the gate: a `live` coverage level (v1.22.1) caps PASS at CONCERNS when a requirement's only evidence is a one-time runtime observation — an evidence-permanence check, not a hollowness check, and it never fires on an ordinary (non-`live`) automated test, however hollow; and a new `evidence-integrity.md` knowledge fragment names "hollow green" checks by name, but is absent from both `step-05-gate-decision.md` and `test-review`'s own scoring rubric (`criteria-registry.md`) — advisory knowledge, not an arithmetic input. **Limits:** a *synthetic* oracle downgrades PASS to CONCERNS, so a clean PASS needs formally written requirements; adding `test-review` does not close the gap either — a static review is not mutation proof. **This is not specific to TEA** — presence-based coverage is the default across this category of tool; TEA is simply the one whose source the team read directly (Qase **Likely**, docs only; closed tools **Unexamined**). Falsifier: a TEA release that adds a credibility input to Step 5, or wires `evidence-integrity.md` into `criteria-registry.md`'s scored rows. Detail: [`comparisons/tea.md`](comparisons/tea.md) §3 |
| **Playwright Planner agent** explores the running app and produces a human-readable Markdown test plan (first-party) | **Confirmed (docs at the source, 2026-07-17)** | [playwright.dev/docs/test-agents](https://playwright.dev/docs/test-agents). It pushes toward green (it sits at the front of the authoring pipeline) and does not rank tasks by *this diff's* blast radius → it yields to `test-plan`/`threat-model` for that. |
| **Playwright Generator agent** turns the plan into executable tests, and verifies selectors and assertions live | **Confirmed (docs at the source, 2026-07-17)** | Same docs. It pushes toward green — it authors for live *correctness*, not for credibility proof (does the test fail when the code breaks?) → `qa-review`/`audit-test` handle that downstream. |
| **Cypress AI** (`cy.prompt()` turns natural language into tests, plus self-heal; Studio AI auto-asserts; first-party `cypress-author` skill) | **Confirmed (docs at the source, 2026-07-17)** | [cy.prompt](https://docs.cypress.io/api/commands/prompt) / [Studio AI](https://docs.cypress.io/app/guides/cypress-studio) docs + [ai-toolkit](https://github.com/cypress-io/ai-toolkit). It pushes toward green; `cy.prompt()` self-heals → **state this alongside the auto-repair-to-green hazard caveat** (ADR-0025). |
| **Exspec** is a *static test-quality linter* (works across languages, including TS/Jest and Vitest) — flags tests with no assertion, over-mocked tests, oversized tests, tests coupled to implementation details, and naming problems (17 rules, no LLM, no execution) | **Confirmed (README at the source, 2026-07-17)** | [morodomi/exspec](https://github.com/morodomi/exspec). A **credibility-side ally**, not a tool that pushes toward green — a cheap, static, first pass for the same problems `qa-review`/`coverage-review`/`prune-tests` catch. A static check cannot prove through mutation that an assertion *matters* → `audit-test` handles that downstream. |
| **coverage-guard** auto-generates and updates tests, in a loop, until it reaches **100% line coverage** (a JS/TS AI skill) | **Confirmed (README at the source, 2026-07-17)** | [sametcelikbicak/coverage-guard](https://github.com/sametcelikbicak/coverage-guard). It **pushes toward green — a manufactured-confidence hazard**, not credibility advice: 100% line coverage from auto-generated tests, with no check on assertion quality, is exactly the low-quality result `coverage-review`/`audit-test` exist to catch. State this alongside a caveat, the same way as the auto-repair tools. |

| **Schema validation against a published OpenAPI doc catches a changed type, but nearly misses a dropped or renamed field** — kill rates of 98.6% / 23.8% / 25.2% across 1,152 published response schemas, because **62.6% declare no `required` field** (in those, drop caught **0.0%**) | **Confirmed** — [EXPERIMENT-0049](experiments/EXPERIMENT-0049-schema-permissiveness.md) Arm A, run 2026-07-31 | 18,648 mutants (drop, rename, retype — the three types of change ADR-0021 names) over apis.guru, one spec per provider, AJV 8.20 (the engine `core-ajv-schema-validator` wraps). The result is bimodal: 57.6% of schemas sit at exactly 33.3% (types checked only), 19.0% at 100%. **Falsifier:** an internal-spec corpus that shows materially higher `required` coverage. |
| **Response schemas that catch nothing are about 1% of the wild, so a tool that audits only for empty schemas has almost nothing to check** | **Confirmed** — EXPERIMENT-0049 Arm A | 9 of 1,111 (0.8%) caught nothing at all; a further 3.6% declared no properties at all. Published schemas almost always declare a `type`. This is why ADR-0049 builds a per-operation `required` read, instead of an auditor skill. |
| **OpenAPI generators differ on `required`: FastAPI/Pydantic and NestJS emit it automatically; springdoc emits it only with an annotation** | **Confirmed** — EXPERIMENT-0049 Arm B (generated and source-verified, 2026-07-31) | FastAPI 0.141.1/Pydantic 2.13.4 and `@nestjs/swagger` 8.1.1 both emitted `required:["id","label","capacity","owner"]` directly from the source type. In swagger-core's `ModelResolver`, every `addRequiredItem` call site needs a `@Schema`, `@JsonProperty(required)`, or `@NotNull`-family annotation, and the type-aware overload is documented to *ignore* the JavaType (`ModelResolver.java:2440`). **Consequence:** neither a blanket recommendation nor a blanket caveat is correct here — read each spec per operation. **Unexamined:** .NET (Swashbuckle/NSwag), and the NestJS CLI-plugin path. |
| `cypress-schema-validator` / `playwright-schema-validator` (MIT, both wrapping `core-ajv-schema-validator`) validate a live response against a published OpenAPI/Swagger document **from inside the test** — the insertion point an SDET adopts without touching production code | **Confirmed (READMEs + npm manifests at the source, 2026-07-31)** | [cypress-schema-validator](https://github.com/sclavijosuero/cypress-schema-validator) 2.0.0 / playwright-schema-validator 1.0.0. **Point to these tools; do not rebuild them** — `contract-guard` Tier 1b ([ADR-0049](adr/0049-contract-guard-test-boundary-validation-tier.md)) proposes them, and never installs or runs them itself. **Name the current packages:** the far more-downloaded `cypress-ajv-schema-validator` (14k/month) and `playwright-ajv-schema-validator` (24k/month) are superseded predecessors — the legacy README says so, at the source. State this **alongside** the caveat above, about gaps in mismatch coverage, or the claim becomes a push toward green. |

**Reading rule:** anything labeled **Unexamined** in this ledger is a *research to-do this
project states honestly*, not advice. A recommendation becomes advice only at **Likely** (verified
reasoning), and becomes a *claim of superiority* only at **Confirmed** (an observed result).

---

## Where Gate fits

Gate is **this project's gap-tool at the Gate stage (7)** — the execution and evidence pipeline.
It ingests Playwright/Cypress JSON and an `audit-test` verdict, combines them into one
content-addressed evidence bundle, and derives a **categorical, worst-wins**
`ship`/`canary`/`hold` decision. It carries **no** confidence number: the gate reasons over
categories, not magnitudes, and the schema's honesty guard forbids a numeric field in the gate
entry. A calibration loop is planned.

**Gate's role, in this framing, is bigger and more defensible than "a smarter classifier of test
instability"** — experiments already ruled that claim out; see the caveats below. In an
orchestration layer, **all evidence combines into one artifact at the end of
the pipeline. Gate *is* that artifact.**

> **Gate is where all the evidence comes together.** It is the layer that ingests the *outputs of
> every other cataloged tool* — Stryker/Tautest mutation verdicts, coverage numbers, `audit-test`
> confirmed/likely/unexamined labels, Playwright/Cypress results — into **one evidence bundle and
> one gate decision.** It does not compete with any single tool; it is where the whole map's
> evidence comes together. This combines one authoritative artifact with workflow orchestration,
> built directly into a tool.

So Gate plays two roles:
1. **The stage-7 gate tool** for E2E release confidence (its original scope).
2. **The orchestration substrate** — the evidence contract and gate that the rest of the map
   feeds into. This is the stronger, more defensible position.

**Honest caveats — carry these forward; they are critical:**
- On the **ambiguous hard-failure** cases that carry the real E2E-triage burden, Gate's extra
  value over "read the Playwright `flaky` status and check the trace" is **nil-to-negative**
  today. Its `classifyFlaky` function only runs on a test that fails, then passes on retry. Its
  gate HOLDs on every red result. On a hard failure, it cannot tell a real defect from an unstable
  test. *Do not sell Gate as a better classifier.*
- Gate sits **downstream of the review-burden problem** that actually drives adoption — a green
  Gate score over low-quality tests is manufactured confidence. Gate assumes trustworthy tests
  already exist, which is stages 3–5's job. **Gate without the earlier stages is not meaningful on its own.** That
  is exactly why Gate belongs *at the end of an orchestrated pipeline*, not on its own.
- The **calibration loop** (log human overrides, track judge agreement, revise) is what qualifies
  Gate to own the verdict. It is rigor no other QA-AI tool has. Without it, a 0–100
  score is exactly the false precision this repo's own honesty rules exist to fight.
- Gate now ingests **both** Playwright (JSON report) and **Cypress** (Module API
  `CypressRunResult`) on one worst-wins execution axis (ADR-0030) — Cypress's instability signal
  is *derived* from per-test `attempts[]` (Cypress emits no aggregate instability count), and is
  labeled `flakyDerived`. Ingest for unit and component tests is still a later step.

**Net result:** Gate's defensible place in this repo is *the evidence-aggregation and gate
substrate the orchestration map converges on*, backed by the calibration loop — **not** a
standalone, smarter classifier of test instability. It only has value on top of trustworthy
stages 3–5.

---

## It's Working If

- Every stage names a free tool *and* this project's tool — never a bare "use X" with no note on
  where the free tool stops.
- Every recommendation carries a **Confirmed**, **Likely**, or **Unexamined** label. An
  **Unexamined** claim reads as a to-do, never as advice.
- A result that states a fraction (executed tests, examined tests, certified scope) also states
  what it was drawn from — never a number alone. See [Denominator honesty](#denominator-honesty).
- `gate`'s decision is categorical — `ship`, `canary`, or `hold` — never a numeric confidence
  score.
- A tool cataloged as outside this project's lane (thermo-nuclear, TEA's governance gate) still
  gets its due: the map states where it is the better choice, not only where it is not.

If a recommendation here ever asserts "use X over Y" with no provenance label, or a claim sits at
**Unexamined** but reads like advice, that is a bug in this document — file it. See
[Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Is this project's tool a thin wrapper around the best free tool, or a genuine replacement?**
A: Open, per stage. `audit-test`, for example, orchestrates Stryker where Stryker fits. Whether it
is a genuine replacement instead, in the E2E domain, is not yet settled. The likely answer is
*both, per stage*.

**Q: Is there one router that points me at the right skill for my situation?**
A: Yes. `qa-compass` *is* the ecosystem's top-level router
([ADR-0025](adr/0025-ask-sentinel-stack-aware-router-reads-manifests.md),
[ADR-0027](adr/0027-ask-sentinel-orchestrated-sequence-mode.md)). It is stack-aware, and it routes
to external tools and to these skills alike. It returns either one best tool (for a standalone
ask) or an ordered stage path (for a lifecycle ask). It routes across thirteen skills, plus
itself.

**Q: `qa-pass` or `gate` — which one owns the ship verdict?**
A: `gate` does (resolved via `sentinel-witness-split`). Stages 3–5 emit *credibility evidence*;
Gate, stage 7, owns the *ship verdict*, earned through calibration. `skills/qa-pass/SKILL.md` and
`docs/qa-pass.md` state plainly that `/qa-pass` is a QA judgment read, not the release gate, and
point to `/gate` for the actual ship/canary/hold decision
([#99](https://github.com/TzolkinB/skills/issues/99)).

**Q: Could this map become its own project someday?**
A: Maybe. The user flagged this map as a candidate for its own project. Decide this once the map
stabilizes.

## Next artifact — shipped
The proposal below was to turn one stage into a fully executable skill, to prove the "combine
free tools and fill the gap" pattern end to end. **Done:** `audit-orchestrator` (issue #43) is
that skill, for stage 3 — it detects the stack, routes unit JS/TS tests to Tautest/StrykerJS
where they fit, and falls back to `audit-test` (dev-served) for app-driven Playwright/Cypress
tests, with the ADR-0016/0019 staleness guard.
