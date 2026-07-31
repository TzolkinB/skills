# The AI-Test Tooling Orchestration Map

> **New here? Run [`audit-test`](audit-test.md) on one test first** — one command, and you'll see
> straight away whether it finds anything in your suite. Read this when you want the whole picture:
> it's the reference for **which tool to use at which stage, and in what order.**

**What this is:** a guide to which testing tool to use at each stage of QA work — from planning what
to test, through judging whether the tests you already have are any good, to deciding whether a
change is safe to ship.

**There's a skill here for every stage,** and each one is something you run, not a link — it tells you
what to do next with its result. `prune-tests` won't delete a test it suspects is hollow, for
instance; it hands that test to `audit-test` to be proven first.

At each stage the map also names the best free tool someone else built, and says plainly when to reach
for that one instead — the recommendation goes against us wherever it should. The one place those
tools can't help at all is a test that drives a real browser: they work by changing your source and
re-running it under Vitest or Jest, so a Playwright or Cypress test is out of their reach. That gap is
why these skills exist.

## Two ways to use this (à la carte, not a funnel)

Following Matt Pocock's skills philosophy: **the orchestration is an *option*, not a mandate.**

- **À la carte** — every stage's Skill stands alone. Grab `audit-test` for one suspicious test
  without running anything else. Use `debug-test` on a single red spec. Each is independently
  invokable and valuable on its own; you decide what you need.
- **Orchestrated** — the stage *order* is the recommended path when you want end-to-end coverage,
  and it's what lets outputs flow into a single evidence artifact (see Gate).

`ask-sentinel` already works this way — it's a router *to* individual skills, not a pipeline that
drags you through all of them. The map below documents both the standalone value of each item and
the order that connects them.

## The bar: why trust any recommendation here? (no proof → no recommendation)

A curated map that just *asserts* "use X over Y" is the exact slop this repo exists to catch —
one level up. So the map is held to **Sentinel's own evidence standard.** Every recommendation
carries one of the three provenance labels from
[ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md):

- **Confirmed** — we ran it and observed the result (an experiment, a clone-and-read, a doc verified at
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

## Head-to-head comparisons — "why ours, not just theirs?"

Per-competitor notes, each held to the no-unverified-claim bar and stated in the other tool's favor
where it wins. Read these when you're deciding between a specific external tool and ours:

- **[`comparisons/mutation-tools.md`](comparisons/mutation-tools.md)** — Stryker / Tautest / Exspec /
  Pitest·Arcmutate. The layered false-confidence answer: **run the mutation tool at the unit layer
  (they win there); reach for `audit-test` at the app-driven E2E layer they structurally can't enter;
  Gate composes, it doesn't verify.**
- **[`comparisons/tea.md`](comparisons/tea.md)** — BMAD TEA. Use it for risk planning + governance
  gate; reach for Sentinel for the mutation check and calibration TEA's docs show it can't do.

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
| 6 | **Triage / heal** — why did it fail? | **Playwright Healer agent** (replays, relocates elements, patches — can **skip if functionality looks broken**); Cypress self-heal; trace viewer/Test Replay; **cypress-flaky-test-audit** (Cypress-side per-command runtime evidence — queue-vs-execution order, timing, retry diff, never-run commands; **diagnosis-only, does *not* heal-to-green**) | Healers push to green and can **mask a real regression or skip it silently** — no judgment on whether the failure was a *real defect*, and no record of *what* was changed to get green | `debug-test` (Step 4.5 **classifies the heal** from the diff — selector/wait clears cheap, a changed expected value routes to `audit-test`'s baseline-lock check, a rewritten setup blocks auto-clear — and proposes the `Heal-bucket:` commit trailer), `diagnosing-bugs`, `bug-report` |
| 7 | **Gate** — is this shippable? | CI pass/fail; **TEA** (evidence artifacts, categorical) | Pass/fail on the raw suite — no credibility axis (*is* the green real?), no live-execution evidence bundle, no calibration | **Gate** (aggregate execution + credibility evidence → **categorical worst-wins** decision → (planned) calibration) — see below |

**The through-line (sharpened after verifying first-party agents):** the *entire* free/first-party
app-driven ecosystem — Playwright's planner/generator/healer, Cypress AI, Healenium, CodeceptJS —
**optimizes tests toward GREEN.** Authoring and self-healing are now commodity and first-party.
**Nobody in the app-driven space proves that green means anything** — and self-healing is actively
*hostile* to credibility (it heals or *skips* to green, masking regressions and hiding flake). So
Kim's lane is not "build Playwright/Cypress author/heal tools" (first-party already owns that) — it
is the **trust/credibility counterweight** to a green-pushing ecosystem: **Audit** (prove green),
**honest Flake** (detect + quarantine, don't heal-to-hide), and **Gate** (aggregate + calibrate).
That is the sharpest, most defensible statement of the gap.

## Denominator honesty

**State the denominator, not just the numerator: every result says what it was drawn from, so a clean
number can never be read as broader than the run that produced it.**

"100/100 health" means nothing if one page of forty was tested — that is the *coverage illusion*
under another name, and commercial tools now sell the fix as a feature ("pages tested vs pages
available"). Four places in this repo already state their denominator, arrived at independently and
never connected to each other; two are worth reading in full. The name is here so the move stops
being re-explained each time — and so the place it's **missing** is visible.

**Worked example 1 — `gate`'s executed-floor (stage 7).** A framework reports `PASSED` after running
one test of a thousand: skipped and pending tests sit outside the pass/fail counts, so a discovery,
filter, or config mistake reads as a clean green. Gate compares tests *executed* against the tests
the report itself says it *discovered*, and prints that fraction next to every execution suite that
ran at least one test — red, flaky or green, not only the one it caps:
`"12 of 180 discovered tests executed — 7%; 168 skipped"`. A suite under the floor (default 50%,
overridable but never below 25%) is capped at `canary` rather than `ship`
([#157](https://github.com/TzolkinB/skills/issues/157); `skills/gate/gate.mjs`, self-tested). The
limit is stated too: the discovered count comes from the report, so a suite narrowed *before* the
report was written still looks fully executed ([`gate.md`](gate.md)).

**Worked example 2 — `e2e-impact`'s run-all / unmapped bucket (stage 1).** Tracing a diff to the E2E
specs it hits is heuristic — a spec never imports the source it drives — so some changed files match
nothing. Those files go into an explicit **run-all / unmapped** bucket in the output instead of
falling out of the impacted-spec list, and a changed global (root layout, router table, shared
primitive) goes there too rather than being resolved into a plausible-looking subset. The bucket is
an edge to *every* spec, not a missing edge, and `debug-test --drift` has to union it back in when it
inverts the map ([`e2e-impact/SKILL.md`](../skills/e2e-impact/SKILL.md)).

**Same shape, two more places:** gate's **examined-floor** compares deep-audited tests against
everything the audit triaged, and pins that denominator at *all triaged* precisely so the ratio can't
be flattered by shrinking it
([ADR-0038](adr/0038-gate-trust-boundary-and-examined-floor-population.md), in `gate.mjs` alongside
the executed-floor). `audit-test` batch mode is instructed to print its certified scope as a fraction
of the suite (`"12 of ~180 suite test files"`) so a `--changed` `ship` can't read as a whole-suite
one — and, where that suite count isn't cleanly computable, to name the scope *without* a fraction
rather than invent one.

**Where it's missing — `coverage-review`.** It is file-pair scoped by contract (`[test file path]
[code file path]`), so it can tell you which branches of the one file in front of it are unguarded,
but nothing in its output says how many of the repo's source files were never handed to it at all.
The line percentage it reports for that one file in instrumentation mode is a *within-file*
denominator, not a repo-level one. Supplying the repo-level one needs a driver that can find an
*untested* module — a file with no test to pair it with — which is exactly the seam
[#180](https://github.com/TzolkinB/skills/issues/180) exists to fill
([ADR-0044](adr/0044-repo-level-coverage-inventory-obligation-driver.md)); until it lands, this gap
is stated rather than papered over.

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
  independent target.** A team runs both: thermo-nuclear (is the code well-built?) + audit-test (do the
  tests prove it works?). Nearest in-repo neighbor is `qa-review` / `codebase-design`, not audit.
- **Strategic signal:** the majors are shipping static code-*quality* review, **not** test-*credibility*
  proof — which *reinforces* the audit lane rather than closing it. A Cursor user with thermo-nuclear
  installed still has the exact hollow-test gap `audit-test` fills.

---

## Evidence ledger — the "why ours, and is it proven?" column

Each core claim, with its provenance label ([ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) and what backs it. **This is the answer to "why use our recommendation over another."** Unproven ≠ deleted — it's labeled and given a path to proof.

| Claim | Label | Backed by / what would upgrade it |
|---|---|---|
| Stryker/Tautest can't audit app-driven Playwright/Cypress (reachability wall) | **Confirmed** | Tautest cloned + read: Stryker-only, Vitest/Jest runners, zero Playwright/Cypress in source, explicitly routes E2E out of mutation scope. StrykerJS mutate-model verified at docs. |
| `audit-test` *can* prove an app-driven Playwright test, on dev-served targets | **Confirmed** | Ran on Memory app: mutated `Main.reducer.ts:38`, dev-served → test failed (real 🟢); stale `preview(dist)` → false 🔴 (the staleness-guard gap, ADR-0016). |
| Playwright/Cypress first-party agents optimize toward green and don't audit | **Confirmed** | Playwright docs verified: healer "skips the test if functionality appears broken." Cypress AI = author + self-heal. Neither has an auditor. |
| **`audit-test` catches a Playwright-Healer-produced green-locked regression** | **Confirmed (with caveat)** — EXPERIMENT-0002 (internal, un-tracked), run 2026-07-11 | Blinded healer green-locked a real regression (assertion 12→10); blinded `audit-test` flagged it 🔴/🟡 ("enforces the regression, would reject the fix"). **Caveat:** the catch relied on intent being recoverable from source — *pure mechanical mutation alone missed it* (assertion still had teeth). Robust defense = Audit **+** assertion-diff/intent signal. No single stage catches the healer alone. |
| Gate's marginal value on hard-failure ambiguous E2E cases is nil-to-negative today | **Confirmed** | Ran real `witness-claude` CLI: `classifyFlaky` only fires on retry-then-pass; gate HOLDs on every red (EXPERIMENT-0001). |
| Gate earns the ship-verdict via a calibration loop | **Unexamined — PARKED** | Design intent only; calibration is longitudinal (can't prove in a session) and props up the part experiments already deflated (nil-to-negative on hard E2E cases). Not worth a dedicated experiment now. Must not be pitched as a live capability. |
| ~~`debug-test` flake mode beats "Playwright flag + read the trace" on the ambiguous subset~~ → **REFRAMED**: flake mode's value = **disposition + routing**, not detection | **Likely (by inspection 2026-07-11)** | Vetted SKILL + ADR-0012 directly: detection *is* the framework's own burn (`--repeat-each`/`status:"flaky"`) = the baseline, **by design** — it claims no detection edge. Marginal value = quarantine-not-skip + routing the cause to a skill that can *confirm* it (`audit-test`). Honest-by-design: unlike Gate it explicitly **refuses to verdict the cause**. But it's a workflow prescription whose technical proof is **borrowed from `audit-test`** (already Confirmed); no independent win. The heavy injected-corpus A/B tests a claim the tool doesn't make (ambiguous-subset *resolution*) → **not worth running.** |
| cypress-flaky-test-audit does per-command queue/execution-order, timing, retry-diff and never-run-command tracing for Cypress (HTML/console/terminal), diagnosis-only, does not heal-to-green | **Confirmed (README at source, 2026-07-12)** | Fetched the GitHub README directly; features match. Upgrade: run it on a real flaky Cypress spec and confirm the reported command graph. |
| cypress-flaky-test-audit is the Cypress-side stage-6 root-cause evidence source that `debug-test` flake mode should *route to* (symmetric to Playwright trace viewer); orchestrate-not-absorb | **Likely (reasoned 2026-07-12)** | Follows from the map's orchestrate-not-rebuild thesis + the tool being diagnosis-only (aligned with honest-flake). Not yet demonstrated: no live handoff run. Upgrade: flake mode flags a Cypress spec → hand to this tool → confirm the root cause is legible end-to-end. |
| **TEA** (BMAD Test Architect, free) does P0–P3 risk tables (Plan) + a categorical PASS/CONCERNS/FAIL/WAIVED governance gate with NFR/compliance evidence (Gate) | **Confirmed (docs at source, 2026-07-17)** | [BMAD TEA docs](https://bmad-code-org.github.io/bmad-method-test-architecture-enterprise/explanation/tea-overview/): `test-design` risk tables, `trace` categorical gate, `nfr-assess`. **Credibility/governance-side ally**, not a green-pusher (its stated enemy: "AI tests that rot"). Verified *absences* → the Sentinel/Gate gap: **no mutation, no live-execution ingest, no calibration** (see #96; reviewer-facing writeup: [`comparisons/tea.md`](comparisons/tea.md)). |
| **TEA `trace` gates on coverage *presence*** — Step 3 maps each requirement to a matching test (FULL/PARTIAL/NONE) and Step 5 is deterministic arithmetic over those percentages (`P0 < 100 → FAIL`; `P0 = 100 ∧ P1 ≥ 90 ∧ overall ≥ 80 → PASS`), with **no** mutation or credibility input → a P0 requirement covered only by a **hollow** test gates **PASS** | **Confirmed (workflow source, `main` @ v1.19.1, 2026-07-29)** | Read `bmad-testarch-trace/steps-c/step-03-map-criteria.md` + `step-05-gate-decision.md`; **zero** hits for mutation/hollow/would-fail/kill-score across the whole trace tree (SKILL, instructions, 671-line checklist, 4 step files); test quality appears only as a printed step-04 recommendation, not a gate input. **Limits:** a *synthetic* oracle downgrades PASS→CONCERNS, so the clean PASS needs formal requirements; composing `test-review` doesn't close the presence gap either — static review isn't mutation proof. **Not TEA-specific** — presence-based coverage is the category default; TEA is just the one with readable source (Qase **Likely**, docs-only; closed tools **Unexamined**). Falsifier: a TEA release adding a credibility input to Step 5. Detail: [`comparisons/tea.md`](comparisons/tea.md) §3 |
| **Playwright Planner agent** explores the running app → a human-readable Markdown test plan (first-party) | **Confirmed (docs at source, 2026-07-17)** | [playwright.dev/docs/test-agents](https://playwright.dev/docs/test-agents). Green-pushing (front of the authoring pipeline); doesn't rank by *this diff's* blast radius → yields to `test-plan`/`threat-model`. |
| **Playwright Generator agent** turns the plan into executable tests, verifying selectors/assertions live | **Confirmed (docs at source, 2026-07-17)** | Same docs. Green-pushing — live-authoring *correctness*, not a credibility proof (would it fail if the code broke?) → `qa-review`/`audit-test` downstream. |
| **Cypress AI** (`cy.prompt()` NL→tests + self-heal, Studio AI auto-assert, first-party `cypress-author` skill) | **Confirmed (docs at source, 2026-07-17)** | [cy.prompt](https://docs.cypress.io/api/commands/prompt) / [Studio AI](https://docs.cypress.io/app/guides/cypress-studio) docs + [ai-toolkit](https://github.com/cypress-io/ai-toolkit). Green-pushing; `cy.prompt()` self-heals → **surface with the heal-to-green hazard caveat** (ADR-0025). |
| **Exspec** is a *static test-quality linter* (multi-lang incl. TS/Jest+Vitest) — flags assertion-free tests, over-mocking, oversized tests, implementation coupling, naming (17 rules, zero-LLM, no execution) | **Confirmed (README at source, 2026-07-17)** | [morodomi/exspec](https://github.com/morodomi/exspec). **Credibility-side ally**, not a green-pusher — a cheap static pre-screen for the same smells `qa-review`/`coverage-review`/`prune-tests` catch. Static can't mutation-prove an assertion *matters* → `audit-test` downstream. |
| **coverage-guard** auto-generates + updates tests, looping until **100% line coverage** (JS/TS AI skill) | **Confirmed (README at source, 2026-07-17)** | [sametcelikbicak/coverage-guard](https://github.com/sametcelikbicak/coverage-guard). **Green-pusher — a manufactured-confidence hazard**, not credibility advice: 100% line coverage from auto-gen tests with no assertion-quality check is the exact slop `coverage-review`/`audit-test` exist to catch. Surface with a caveat, like the self-healers. |

| **Schema validation against a published OpenAPI doc catches retypes but is near-blind to drop/rename** — 98.6% / 23.8% / 25.2% kill rates across 1,152 published response schemas, because **62.6% declare no `required`** (drop caught **0.0%** in those) | **Confirmed** — [EXPERIMENT-0049](experiments/EXPERIMENT-0049-schema-permissiveness.md) Arm A, run 2026-07-31 | 18,648 mutants (drop/rename/retype — ADR-0021's three named drifts) over apis.guru, one spec per provider, AJV 8.20 (the engine `core-ajv-schema-validator` wraps). Bimodal: 57.6% of schemas sit at exactly 33.3% (types only), 19.0% at 100%. **Falsifier:** an internal-spec corpus showing materially higher `required` coverage. |
| **"Hollow" response schemas — ones that catch nothing — are ~1% of the wild, so a hollow-schema auditor has no population** | **Confirmed** — EXPERIMENT-0049 Arm A | 9 of 1,111 (0.8%) fully hollow; a further 3.6% declare no properties at all. Published schemas nearly always declare `type`. This is why ADR-0049 builds a per-operation `required` read instead of an auditor skill. |
| **OpenAPI generators split on `required`: FastAPI/Pydantic and NestJS emit it automatically, springdoc only on annotation** | **Confirmed** — EXPERIMENT-0049 Arm B (generated + source-verified, 2026-07-31) | FastAPI 0.141.1/Pydantic 2.13.4 and `@nestjs/swagger` 8.1.1 both emitted `required:["id","label","capacity","owner"]` from the source type. swagger-core `ModelResolver`: every `addRequiredItem` site needs `@Schema`/`@JsonProperty(required)`/`@NotNull`-family, and the type-aware overload is documented to *ignore* the JavaType (`ModelResolver.java:2440`). **Consequence:** neither a blanket recommendation nor a blanket caveat is correct → read the spec per-operation. **Unexamined:** .NET (Swashbuckle/NSwag), and the NestJS CLI-plugin path. |
| `cypress-schema-validator` / `playwright-schema-validator` (MIT, both wrapping `core-ajv-schema-validator`) validate a live response against a published OpenAPI/Swagger doc **from inside the test** — the insertion point an SDET can adopt without touching production code | **Confirmed (READMEs + npm manifests at source, 2026-07-31)** | [cypress-schema-validator](https://github.com/sclavijosuero/cypress-schema-validator) 2.0.0 / playwright-schema-validator 1.0.0. **Route-to, don't rebuild** — `contract-guard` Tier 1b ([ADR-0049](adr/0049-contract-guard-test-boundary-validation-tier.md)) proposes them, never installs or runs them. **Name the current packages:** the far more-downloaded `cypress-ajv-schema-validator` (14k/mo) and `playwright-ajv-schema-validator` (24k/mo) are superseded predecessors — the legacy README says so at source. Must be surfaced **with** the drift-coverage caveat above, or it becomes a green-pusher. |

**Reading rule:** anything **Unexamined** in this ledger is a *research to-do we are honest about*,
not advice we're giving. A recommendation graduates to advice only at **Likely** (verified reasoning)
and to a *claim of superiority* only at **Confirmed** (observed result).

---

## Where Gate fits

Gate is **our gap-tool at the Gate stage (7)** — the execution/evidence pipeline: ingest
Playwright/Cypress JSON + an `audit-test` verdict → one content-addressed evidence bundle → a
**categorical, worst-wins** `ship`/`canary`/`hold` decision (**no** confidence number — the gate
reasons over categories, not magnitudes, and the schema's honesty guard forbids a numeric field in
the gate entry) → (planned) calibration loop.

But its role in *this* framing is bigger and more defensible than "smarter flake classifier"
(experiments killed that claim — see caveats). In an orchestration layer, **the single source of
truth is the aggregated evidence artifact at the end of the pipeline. Gate *is* that artifact.**

> **Gate = the confluence point.** It's the layer that ingests the *outputs of every other
> cataloged tool* — Stryker/Tautest mutation verdicts, coverage numbers, `audit-test`
> confirmed/likely/unexamined labels, Playwright/Cypress results — into **one evidence bundle + one
> gate.** Not a competitor to any single tool; the place the whole map converges. This is the
> "single source of truth + workflow orchestration" win literally instantiated as a tool.

So Gate plays two roles:
1. **Stage-7 gate tool** for E2E release confidence (its original scope).
2. **The orchestration substrate** — the evidence contract + gate that the rest of the map feeds
   into. This is the stronger, more defensible position.

**Honest caveats (carry these forward — they're load-bearing):**
- On the **ambiguous hard-failure** cases that carry the real E2E-triage burden, Gate's marginal
  value over "Playwright `flaky` flag + read the trace" is **nil-to-negative** today: its
  `classifyFlaky` only runs on retry-then-pass tests, and its gate HOLDs on every red (can't tell a
  real defect from a non-defect flake on a hard fail). *Don't sell Gate as a better classifier.*
- Gate is **downstream of the review-burden problem** that actually drives adoption — a green
  Gate score over slop tests is manufactured confidence. It presupposes trustworthy tests, which
  is stages 3–5's job. **Gate without the earlier stages is theater.** That's exactly why it
  belongs *at the end of an orchestrated pipeline*, not standalone.
- The **calibration loop** (log human overrides, track judge-agreement, revise) is the thing that
  earns Gate the right to own the verdict. It's the rigor no other QA-AI tool has. Without it,
  the 0–100 score is the false-precision the repo's own honesty rules exist to fight.
- Gate now ingests **both** Playwright (JSON report) and **Cypress** (Module API `CypressRunResult`)
  on one worst-wins execution axis (ADR-0030) — Cypress's flaky signal is *derived* from per-test
  `attempts[]` (it emits no flaky count), labelled `flakyDerived`. Unit/component ingest is still a later
  increment.

**Net:** Gate's defensible home in this repo is *the evidence-aggregation + gate substrate the
orchestration map converges on*, backed by the calibration loop — **not** a standalone smarter-flake
tool. It only has value sitting on top of trustworthy stages 3–5.

---

## Open questions

1. **Cataloged vs. owned boundary** — for each stage, is our tool a thin wrapper that *invokes* the
   best free tool (e.g. `audit-test` orchestrating Stryker where it fits), or a genuine replacement
   in the E2E domain? Probably *both, per stage*.
2. **Router — resolved.** `ask-sentinel` *is* the ecosystem's top-level router now ([ADR-0025](adr/0025-ask-sentinel-stack-aware-router-reads-manifests.md),
   [ADR-0027](adr/0027-ask-sentinel-orchestrated-sequence-mode.md)): stack-aware, routes to external tools and to these skills alike,
   and returns either one best tool (à la carte) or an ordered stage path (a lifecycle ask). It routes across
   thirteen skills plus itself.
3. **The gate-verdict ownership question — resolved.** (from `sentinel-witness-split`):
   Sentinel stages 3–5 emit *credibility evidence*; Gate stage 7 owns the *ship verdict*,
   earned via calibration. `skills/sentinel/SKILL.md` and `docs/sentinel.md` now say plainly
   that `/sentinel` is a QA judgment read, not the release gate, and point to `/gate` for the
   actual ship/canary/hold decision ([#99](https://github.com/TzolkinB/skills/issues/99)).
4. **Spin-out** — user flagged this may become its own project. Decide when the map stabilizes.

## Next artifact — shipped
The proposal below was to turn one stage into a fully executable Skill proving the
"orchestrate free tools + fill the gap" pattern end-to-end. **Done**: `audit-orchestrator`
(issue #43) is that Skill for stage 3 — it detects the stack, routes unit JS/TS to
Tautest/StrykerJS where they fit, and falls back to `audit-test` (dev-served) for app-driven
Playwright/Cypress, with the ADR-0016/0019 staleness guard.
