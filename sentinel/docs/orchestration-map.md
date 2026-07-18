# The AI-Test Tooling Orchestration Map (draft v0.1)

**Thesis:** This repo is an *opinionated orchestration layer* over the ecosystem of free AI-test
tools — a curated map of **which tool is best for which stage of the QA workflow, and in what
order** — with **our own tools plugged in where there's a verified gap** (the app-driven
Playwright/Cypress "usefulness" domain).

The moat is **not the inventory** (a bare awesome-list is commodity). It's the **executable
roadmap**: each stage is a runnable Skill that says *reach for tool X now; if its result survives
condition Y, escalate to Z*. Sequencing + gap-filling, not links.

## Two ways to use this (à la carte, not a funnel)

Following Matt Pocock's skills philosophy: **the orchestration is an *option*, not a mandate.**

- **À la carte** — every stage's Skill stands alone. Grab `audit-test` for one suspicious test
  without running anything else. Use `debug-test` on a single red spec. Each is independently
  invokable and valuable on its own; you decide what you need.
- **Orchestrated** — the stage *order* is the recommended path when you want end-to-end coverage,
  and it's what lets outputs flow into a single evidence artifact (see Witness).

`ask-sentinel` already works this way — it's a router *to* individual skills, not a pipeline that
drags you through all of them. The map below documents both the standalone value of each item and
the order that connects them.

## The bar: why trust any recommendation here? (no proof → no recommendation)

A curated map that just *asserts* "use X over Y" is the exact slop this repo exists to catch —
one level up. So the map is held to **Sentinel's own evidence standard.** Every recommendation
carries one of the three provenance labels from
[ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md):

- **Proven** — we ran it and observed the result (an experiment, a clone-and-read, a doc verified at
  source). State *what* was observed.
- **Likely** — reasoned or verified from a primary source, but not demonstrated in our context.
- **Unexamined** — asserted, not yet checked. **An Unexamined recommendation is a to-do, not a
  claim** — it must not be presented as advice until it's at least Likely.

This is not new machinery — [ADR-0004](adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)
already does exactly this for `audit-test` vs Stryker ("route, not rivalry," Situation→Tool table
with reasons). The map generalizes that ADR across all seven stages. **If we can't say why ours
beats the alternative — with evidence, or an honest label admitting we haven't proven it — it
doesn't earn a spot.** See the Evidence Ledger below.

---

## The spine: seven QA workflow stages

```
PLAN ─► AUTHOR ─► AUDIT ─► COVERAGE ─► FLAKE/RELIABILITY ─► TRIAGE ─► GATE
```

Each stage maps to: the **best free tool(s)** for it, the **wall** where those tools stop
(especially the app-driven E2E wall), and **our gap-tool** that fills it.

| # | Stage | Best free tool(s) | The wall (where free tools stop) | Our gap-tool |
|---|-------|-------------------|----------------------------------|--------------|
| 1 | **Plan** — ticket/feature → risk-ranked plan | **Playwright Planner agent** (explores the running app, writes a Markdown plan; first-party, `init-agents --loop=claude`); **TEA** (risk tables) | Planner explores; it doesn't rank by *this diff's* blast radius or threat model | `test-plan`, `threat-model` (Sentinel) |
| 2 | **Author** — write the tests | **Playwright Generator agent** + **Cypress AI** (`cy.prompt()`, Studio AI, `cypress-author` skill — both first-party, app-driven, verify selectors/assertions live) | Generation is a solved commodity now; *trustworthy* generation is not — these optimize toward **green**, not toward *meaningful* | `qa-review` (testability) |
| 3 | **Audit** — is this *passing* test actually real? | **StrykerJS** (full mutation), **Tautest** (PR diff-mutation, JS/TS **unit**), **Exspec** (static test-quality linter — flags assertion-free/over-mocked/coupled tests, multi-lang, no execution) | The mutators are source-mutate + Vitest/Jest only → **can't touch app-driven Playwright/Cypress** (reachability wall). Exspec is a real ally but **static — can't mutation-prove an assertion *matters***. **No first-party agent audits at all.** | **`audit-test`** (mutation-proof on **dev-served** Playwright/Cypress) — ADR-0016 staleness guard is the net-new piece |
| 4 | **Coverage** — what's untested? | V8/istanbul (Vitest/Jest), Playwright coverage; `coverage-guard` (AI skill — **auto-generates tests looping to 100% line coverage → a green-pusher/manufactured-confidence hazard**, not credibility) | Line coverage ≠ assertion quality — and `coverage-guard` *manufactures* the number by auto-writing tests to hit it (no assertion-quality check); blind to app-driven paths | `coverage-review` |
| 5 | **Flake / reliability** — is this run stable? | Playwright **`flaky` flag**; **self-healers** (Playwright Healer, Cypress self-heal, Healenium, CodeceptJS heal); Tautest `flakiness` (static lint) | Flag catches only **retry-then-pass**; self-healers **hide flake by healing to green** (a credibility hazard); linter never runs a test | **`debug-test` flake mode** (empirical detect → quarantine → route, *don't* heal-to-hide) |
| 6 | **Triage / heal** — why did it fail? | **Playwright Healer agent** (replays, relocates elements, patches — can **skip if functionality looks broken**); Cypress self-heal; trace viewer/Test Replay; **cypress-flaky-test-audit** (Cypress-side per-command runtime evidence — queue-vs-execution order, timing, retry diff, never-run commands; **diagnosis-only, does *not* heal-to-green**) | Healers push to green and can **mask a real regression or skip it silently** — no judgment on whether the failure was a *real defect* | `debug-test`, `diagnosing-bugs`, `bug-report` |
| 7 | **Gate** — is this shippable? | CI pass/fail; **TEA** (evidence artifacts, categorical) | No numeric aggregation, no live-execution ingest, no calibration | **Witness** (aggregate → confidence → gate → calibration) — see below |

**The through-line (sharpened after verifying first-party agents):** the *entire* free/first-party
app-driven ecosystem — Playwright's planner/generator/healer, Cypress AI, Healenium, CodeceptJS —
**optimizes tests toward GREEN.** Authoring and self-healing are now commodity and first-party.
**Nobody in the app-driven space proves that green means anything** — and self-healing is actively
*hostile* to credibility (it heals or *skips* to green, masking regressions and hiding flake). So
Kim's lane is not "build Playwright/Cypress author/heal tools" (first-party already owns that) — it
is the **trust/credibility counterweight** to a green-pushing ecosystem: **Audit** (prove green),
**honest Flake** (detect + quarantine, don't heal-to-hide), and **Gate** (aggregate + calibrate).
That is a sharper, more defensible gap than v0.1 stated.

## Flake-diagnosis evidence: the Cypress ↔ Playwright symmetry (in-lane, feeds stage 5–6)

`debug-test` flake mode's honest stance (stage 5) is **detect → quarantine → route the cause**, and
it explicitly *refuses to verdict the cause itself* — it hands root-cause off to a tool that carries
real evidence. Playwright already has that evidence source first-party (**trace viewer / Test
Replay**). Cypress's side was thin. **cypress-flaky-test-audit** fills it symmetrically:

- **What it is** (README verified at source, 2026-07-12): a Cypress-internals runtime tracer. Hooks
  the command queue and records **enqueue-vs-execution order, per-command timing, internal retries,
  pass/fail, and never-run (dead) commands**, rendered as console/terminal/HTML with command graphs
  and side-by-side retry diffs. It is a flake **diagnosis** aid — it explains *why* a Cypress test is
  flaky. It does **not** detect flakiness for you, does **not** mutate, does **not** judge
  credibility, and — importantly — **does not push to green** (unlike the self-healers), so it's
  aligned with, not hostile to, the honest-flake stance.
- **Where it sits:** *downstream* of `debug-test` flake detection (stage 5), as the Cypress-side
  root-cause evidence for stage 6 — the exact slot Playwright trace viewer occupies. Clean symmetry:
  **Cypress flake → cypress-flaky-test-audit; Playwright flake → trace viewer.**
- **Orchestrate, don't absorb.** The right move is a *pointer* — flake mode routes a flagged Cypress
  spec here for command-level root cause. Building queue-interception into Sentinel would drag a
  skills/orchestration layer into a runtime-instrumentation plugin (category change, against the
  thesis and Kim's lane). Ideas worth pulling as *heuristics* debug-test can reference (not code to
  port): enqueue-vs-execution mismatch and never-run commands as flake signals; retry side-by-side
  diff as the root-cause lens.
- **Not an audit-test overlap.** Different axis entirely: timing/order vs. credibility. No
  competition with stage 3.

> **Provenance note:** an external Gemini "comparative architecture" report on this tool vs. Sentinel
> was **fabricated** — it invented a Sentinel that is a "runtime telemetry/observability framework"
> with an "MVP0 Playwright core," "queue interception," and a "driver-adapter pattern," and its
> headline advice (build a Cypress driver adapter *into* Sentinel) is for that fictional product.
> Discarded. Only its *description of cypress-flaky-test-audit itself* matched the real README. This
> is the [[external-review-reliability]] pattern again — verify LLM design claims against source.

## Adjacent: code-quality / design review (complementary, NOT our lane)

Some tools review the *code's design*, not the *tests' credibility* — a different axis, same
PR-review moment. Cataloged so the map is honest about the neighborhood, but out of our competitive
lane:

- **Cursor `thermo-nuclear-code-quality-review`** (first-party, free in cursor-team-kit) — aggressive
  **static** maintainability/architecture review (abstraction quality, file-size >1000 lines,
  spaghetti conditionals, missed simplifications). Verified from source (SKILL.md, 2026-07-12): does
  **not** execute, does **not** verify test behavior, no mutation, no E2E. Its *"do not approve merely
  because behavior seems correct"* rhymes with our *"a green is not proof"* — **same skeptical spirit,
  orthogonal target.** A team runs both: thermo-nuclear (is the code well-built?) + audit-test (do the
  tests prove it works?). Nearest in-repo neighbor is `qa-review` / `codebase-design`, not audit.
- **Strategic signal:** the majors are shipping static code-*quality* review, **not** test-*credibility*
  proof — which *reinforces* the audit lane rather than closing it. A Cursor user with thermo-nuclear
  installed still has the exact hollow-test gap `audit-test` fills.

---

## Evidence ledger — the "why ours, and is it proven?" column

Each core claim, with its provenance label ([ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) and what backs it. **This is the answer to "why use our recommendation over another."** Unproven ≠ deleted — it's labeled and given a path to proof.

| Claim | Label | Backed by / what would upgrade it |
|---|---|---|
| Stryker/Tautest can't audit app-driven Playwright/Cypress (reachability wall) | **Proven** | Tautest cloned + read: Stryker-only, Vitest/Jest runners, zero Playwright/Cypress in source, explicitly routes E2E out of mutation scope. StrykerJS mutate-model verified at docs. |
| `audit-test` *can* prove an app-driven Playwright test, on dev-served targets | **Proven** | Ran on Memory app: mutated `Main.reducer.ts:38`, dev-served → test failed (real 🟢); stale `preview(dist)` → false 🔴 (the staleness-guard gap, ADR-0016). |
| Playwright/Cypress first-party agents optimize toward green and don't audit | **Proven** | Playwright docs verified: healer "skips the test if functionality appears broken." Cypress AI = author + self-heal. Neither has an auditor. |
| **`audit-test` catches a Playwright-Healer-produced green-locked regression** | **Proven (with caveat)** — EXPERIMENT-0002 (internal, un-tracked), run 2026-07-11 | Blinded healer green-locked a real regression (assertion 12→10); blinded `audit-test` flagged it 🔴/🟡 ("enforces the regression, would reject the fix"). **Caveat:** the catch relied on intent being recoverable from source — *pure mechanical mutation alone missed it* (assertion still had teeth). Robust defense = Audit **+** assertion-diff/intent signal. No single stage catches the healer alone. |
| Witness's marginal value on hard-failure ambiguous E2E cases is nil-to-negative today | **Proven** | Ran real `witness-claude` CLI: `classifyFlaky` only fires on retry-then-pass; gate HOLDs on every red (EXPERIMENT-0001). |
| Witness earns the ship-verdict via a calibration loop | **Unexamined — PARKED** | Design intent only; calibration is longitudinal (can't prove in a session) and props up the part experiments already deflated (nil-to-negative on hard E2E cases). Not worth a dedicated experiment now. Must not be pitched as a live capability. |
| ~~`debug-test` flake mode beats "Playwright flag + read the trace" on the ambiguous subset~~ → **REFRAMED**: flake mode's value = **disposition + routing**, not detection | **Likely (by inspection 2026-07-11)** | Vetted SKILL + ADR-0012 directly: detection *is* the framework's own burn (`--repeat-each`/`status:"flaky"`) = the baseline, **by design** — it claims no detection edge. Marginal value = quarantine-not-skip + routing the cause to a skill that can *confirm* it (`audit-test`). Honest-by-design: unlike Witness it explicitly **refuses to verdict the cause**. But it's a workflow prescription whose technical proof is **borrowed from `audit-test`** (already Proven); no independent win. The heavy injected-corpus A/B tests a claim the tool doesn't make (ambiguous-subset *resolution*) → **not worth running.** |
| cypress-flaky-test-audit does per-command queue/execution-order, timing, retry-diff and never-run-command tracing for Cypress (HTML/console/terminal), diagnosis-only, does not heal-to-green | **Proven (README at source, 2026-07-12)** | Fetched the GitHub README directly; features match. Upgrade: run it on a real flaky Cypress spec and confirm the reported command graph. |
| cypress-flaky-test-audit is the Cypress-side stage-6 root-cause evidence source that `debug-test` flake mode should *route to* (symmetric to Playwright trace viewer); orchestrate-not-absorb | **Likely (reasoned 2026-07-12)** | Follows from the map's orchestrate-not-rebuild thesis + the tool being diagnosis-only (aligned with honest-flake). Not yet demonstrated: no live handoff run. Upgrade: flake mode flags a Cypress spec → hand to this tool → confirm the root cause is legible end-to-end. |
| **TEA** (BMAD Test Architect, free) does P0–P3 risk tables (Plan) + a categorical PASS/CONCERNS/FAIL/WAIVED governance gate with NFR/compliance evidence (Gate) | **Proven (docs at source, 2026-07-17)** | [BMAD TEA docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/): `test-design` risk tables, `trace` categorical gate, `nfr-assess`. **Credibility/governance-side ally**, not a green-pusher (its stated enemy: "AI tests that rot"). Verified *absences* → the Sentinel/Witness gap: **no mutation, no numeric release-confidence, no calibration** (see #96). |
| **Playwright Planner agent** explores the running app → a human-readable Markdown test plan (first-party) | **Proven (docs at source, 2026-07-17)** | [playwright.dev/docs/test-agents](https://playwright.dev/docs/test-agents). Green-pushing (front of the authoring pipeline); doesn't rank by *this diff's* blast radius → yields to `test-plan`/`threat-model`. |
| **Playwright Generator agent** turns the plan into executable tests, verifying selectors/assertions live | **Proven (docs at source, 2026-07-17)** | Same docs. Green-pushing — live-authoring *correctness*, not a credibility proof (would it fail if the code broke?) → `qa-review`/`audit-test` downstream. |
| **Cypress AI** (`cy.prompt()` NL→tests + self-heal, Studio AI auto-assert, first-party `cypress-author` skill) | **Proven (docs at source, 2026-07-17)** | [cy.prompt](https://docs.cypress.io/api/commands/prompt) / [Studio AI](https://docs.cypress.io/app/guides/cypress-studio) docs + [ai-toolkit](https://github.com/cypress-io/ai-toolkit). Green-pushing; `cy.prompt()` self-heals → **surface with the heal-to-green hazard caveat** (ADR-0025). |
| **Exspec** is a *static test-quality linter* (multi-lang incl. TS/Jest+Vitest) — flags assertion-free tests, over-mocking, oversized tests, implementation coupling, naming (17 rules, zero-LLM, no execution) | **Proven (README at source, 2026-07-17)** | [morodomi/exspec](https://github.com/morodomi/exspec). **Credibility-side ally**, not a green-pusher — a cheap static pre-screen for the same smells `qa-review`/`coverage-review`/`prune-tests` catch. Static can't mutation-prove an assertion *matters* → `audit-test` downstream. |
| **coverage-guard** auto-generates + updates tests, looping until **100% line coverage** (JS/TS AI skill) | **Proven (README at source, 2026-07-17)** | [sametcelikbicak/coverage-guard](https://github.com/sametcelikbicak/coverage-guard). **Green-pusher — a manufactured-confidence hazard**, not credibility advice: 100% line coverage from auto-gen tests with no assertion-quality check is the exact slop `coverage-review`/`audit-test` exist to catch. Surface with a caveat, like the self-healers. |

**Reading rule:** anything **Unexamined** in this ledger is a *research to-do we are honest about*,
not advice we're giving. A recommendation graduates to advice only at **Likely** (verified reasoning)
and to a *claim of superiority* only at **Proven** (observed result).

---

## Where Witness fits

Witness is **our gap-tool at the Gate stage (7)** — the execution/evidence pipeline: ingest
Playwright JSON → weighted `ReleaseConfidence` (0–100) → ship/canary/hold gate → evidence bundle
→ (planned) calibration loop.

But its role in *this* framing is bigger and more defensible than "smarter flake classifier"
(experiments killed that claim — see caveats). In an orchestration layer, **the single source of
truth is the aggregated evidence artifact at the end of the pipeline. Witness *is* that artifact.**

> **Witness = the confluence point.** It's the layer that ingests the *outputs of every other
> cataloged tool* — Stryker/Tautest mutation verdicts, coverage numbers, `audit-test`
> proven/likely/unexamined labels, Playwright/Cypress results — into **one evidence bundle + one
> gate.** Not a competitor to any single tool; the place the whole map converges. This is the
> "single source of truth + workflow orchestration" win literally instantiated as a tool.

So Witness plays two roles:
1. **Stage-7 gate tool** for E2E release confidence (its original scope).
2. **The orchestration substrate** — the evidence contract + gate that the rest of the map feeds
   into. This is the stronger, more defensible position.

**Honest caveats (carry these forward — they're load-bearing):**
- On the **ambiguous hard-failure** cases that carry the real E2E-triage burden, Witness's marginal
  value over "Playwright `flaky` flag + read the trace" is **nil-to-negative** today: its
  `classifyFlaky` only runs on retry-then-pass tests, and its gate HOLDs on every red (can't tell a
  real defect from a non-defect flake on a hard fail). *Don't sell Witness as a better classifier.*
- Witness is **downstream of the review-burden problem** that actually drives adoption — a green
  Witness score over slop tests is manufactured confidence. It presupposes trustworthy tests, which
  is stages 3–5's job. **Witness without the earlier stages is theater.** That's exactly why it
  belongs *at the end of an orchestrated pipeline*, not standalone.
- The **calibration loop** (log human overrides, track judge-agreement, revise) is the thing that
  earns Witness the right to own the verdict. It's the rigor no other QA-AI tool has. Without it,
  the 0–100 score is the false-precision the repo's own honesty rules exist to fight.
- Witness now ingests **both** Playwright (JSON report) and **Cypress** (Module API `CypressRunResult`)
  on one worst-wins execution axis (ADR-0030) — Cypress's flaky signal is *derived* from per-test
  `attempts[]` (it emits no flaky count), labelled `flakyDerived`. Unit/component ingest is still a later
  increment.

**Net:** Witness's defensible home in this repo is *the evidence-aggregation + gate substrate the
orchestration map converges on*, backed by the calibration loop — **not** a standalone smarter-flake
tool. It only has value sitting on top of trustworthy stages 3–5.

---

## Open questions

1. **Cataloged vs. owned boundary** — for each stage, is our tool a thin wrapper that *invokes* the
   best free tool (e.g. `audit-test` orchestrating Stryker where it fits), or a genuine replacement
   in the E2E domain? Probably *both, per stage*.
2. **Router** — `ask-sentinel` already routes across nine skills. Does the ecosystem map become the
   new top-level router (skills repo → "given your situation + stack, here's the tool + order")?
3. **The gate-verdict ownership question** (from `sentinel-witness-split`) resolves cleanly here:
   Sentinel stages 3–5 emit *credibility evidence*; Witness stage 7 owns the *ship verdict*,
   earned via calibration. Stop having `/sentinel` speak in shippability verdicts.
4. **Spin-out** — user flagged this may become its own project. Decide when the map stabilizes.

## Next artifact
Turn one stage (proposal: **Audit**, stage 3 — the sharpest verified gap) into a fully executable
Skill that: detects the stack, invokes Tautest/Stryker where they fit, and falls back to
`audit-test` (dev-served) for app-driven Playwright/Cypress — with the ADR-0016 staleness guard.
That proves the "orchestrate free tools + fill the gap" pattern end-to-end on the strongest stage.
