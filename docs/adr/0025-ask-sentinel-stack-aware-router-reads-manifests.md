# `ask-sentinel` routes the *whole* orchestration map — own **and** external tools, stack-aware and provenance-labelled — generalizing `audit-orchestrator` from one stage to seven

**Status: Accepted (2026-07-16).** First slice of the parked epic
[#47](https://github.com/TzolkinB/skills/issues/47) (stack-aware orchestration router), unblocked by
**#43** (the stage-3 `audit-orchestrator`, closed) — the router now has an executable stage to route
*into*. This ADR resolves open question #2 of
[`orchestration-map.md`](../orchestration-map.md) — *"does the ecosystem map become
the new top-level router?"* — with **yes**. It decides four things and defers two.

**Decides:** (1) `ask-sentinel`'s routing scope is the **whole ecosystem map — external tools *and*
Sentinel's own skills — not just the twelve Sentinel skills**; it becomes the runnable front door to
the single-source-of-truth map. (2) Every recommendation, external or own, **carries its
Proven/Likely/Unexamined provenance label** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md));
**Proven/Likely are advice, Unexamined are surfaced as *leads*, not advice** — the map's own "no proof
→ no recommendation" rule, applied to the router. (3) `ask-sentinel` may **read build/config
manifests** to detect the stack and pick *external-best vs Sentinel-gap-filler* per stage — a
deliberate refinement of its "never reads your code" contract. (4) The map is **committed into the
tracked tree** at [`docs/orchestration-map.md`](../orchestration-map.md) (it was previously
gitignored local notes) so it becomes the real in-repo evidence ledger; the routing table is **distilled
inline** in the SKILL — the always-loaded, self-contained pattern `audit-orchestrator` already uses —
with the committed map as the ledger it's derived from.

**Defers:** emitting an *ordered stage sequence* across the seven stages (the epic's larger ambition —
its own later slice); and the **research pass** that upgrades the currently-Unexamined external tools
to a label — so this first slice routes to the **already-vetted** tools as advice and names the rest as
leads.

## Context

`ask-sentinel` today is a flat **situation → skill** router over the nine core Sentinel skills — it
names the one skill answering a plain-language QA situation, says why, and shows where it sits in the
flow. Its load-bearing identity: *"It **routes; it doesn't analyze** — never reads your code, never
runs a test, never emits a verdict."* It routes **only within Sentinel**.

But the repo's actual thesis is bigger than Sentinel's own skills.
[`orchestration-map.md`](../orchestration-map.md) is *"an opinionated orchestration
layer over the ecosystem of free AI-test tools… with our own tools plugged in where there's a verified
gap"* — it catalogs **external** tools (Playwright Planner/Generator/Healer agents, Cypress AI,
StrykerJS, Tautest, Exspec, TEA, trace viewer, cypress-flaky-test-audit) mapped to seven QA stages,
with Sentinel's gap-fillers slotted in at the verified walls. Its **open question #2** asks whether
that ecosystem map should *become the top-level router*. Answering "own tools only" would leave the
single-source-of-truth map as a static document and the router as a parochial index — the timid
version. This ADR answers "the whole map."

**The precedent already exists one stage down.** `audit-orchestrator`
([SKILL.md](../../skills/audit-orchestrator/SKILL.md), closed as #43) *is* this pattern for **stage 3**:
it detects the stack, routes unit JS/TS → **Tautest/StrykerJS** (external) and app-driven
Playwright/Cypress → **`audit-test`** (own gap-filler), carries **inline provenance labels** on each
route ("Tautest — *Proven*; StrykerJS — *Likely*"), and holds "orchestrate, don't absorb" (point at
the external CLI, print its command, never reimplement it). **`ask-sentinel` is that same pattern
generalized from one stage to all seven.** The design is not novel; it is a generalization of a shipped
one.

Three of Sentinel's own newer skills are also still **orphaned** from the flat router —
`e2e-impact`, `audit-orchestrator`, `contract-guard` — flagged in the SKILL as *"reach these three
directly for now… a separate stack-aware orchestration-router effort."* That effort is this. They come
in as part of the whole-map wiring, each **stack-conditional** (they presuppose a Playwright/Cypress or
API-consumer stack), which is precisely why the router needs a stack signal.

## Decision

### 1. Scope: route the whole map, own + external

`ask-sentinel` recommends the best tool for the *situation + stack* across all seven stages, **whether
it is external or Sentinel's own** — realizing open question #2. It becomes the executable front door
to the map: the human-readable ledger's routing distilled into a run-it-now recommendation. It
generalizes `audit-orchestrator`'s inline-provenance, stack-aware, orchestrate-don't-absorb routing
from stage 3 to the whole spine.

### 2. Provenance discipline: Proven/Likely is advice, Unexamined is a *lead*

Routing to external tools means the router now *asserts* "use tool X here" — and the map holds every
such assertion to its evidence bar: *"no proof → no recommendation… an Unexamined recommendation is a
to-do, not a claim; it must not be presented as advice."* So every route carries its **ADR-0013**
label with a one-line "what backs this," exactly as `audit-orchestrator` does:

- **Proven / Likely → advice.** Routed with a confident "reach for X." (Tautest *Proven*, StrykerJS
  *Likely*, `audit-test` *Proven*, Playwright trace viewer / Test Replay, cypress-flaky-test-audit
  *Proven-at-source*, etc.)
- **Unexamined → a lead, not advice.** Named as "there's a tool here worth checking — we haven't
  verified it" (TEA, Exspec, the Planner/Generator agents, coverage-guard, the self-healers), **never**
  a confident recommendation. A self-healer is additionally surfaced *with its credibility-hazard
  caveat* (it heals/skips to green), per the map.
- **Orchestrate, don't absorb.** For an external tool the router *points* — names it, prints the
  invocation + a one-line setup note — and never claims to run or reimplement it, mirroring
  `audit-orchestrator`'s Tautest/Stryker handling.

This makes the anti-slop stance apply to the router itself: a curated map that just asserts "use X" is
the exact slop this repo exists to catch, one level up.

### 3. Stack-awareness is the external-vs-own selector; manifests are readable for routing

The stack is *how the router chooses external-best vs Sentinel-gap-filler at each stage* — the map's
central thesis made executable. At the Audit stage: **unit JS/TS → Stryker/Tautest (external);
app-driven Playwright/Cypress → `audit-test` (own, because the external tools hit the reachability
wall).** To make that choice, `ask-sentinel` may **read stack manifests** — `package.json` dependency
presence, the existence of `playwright.config.*` / `cypress.config.*`, a published `openapi`/`swagger`
document if present or named. Reading a manifest to detect the stack is **consumption for routing**,
categorically distinct from analyzing code for a verdict — the same move
[ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md) made ("reading a published contract
is consumption, not execution"). The contract is **refined, not abandoned**: `ask-sentinel` still never
reads your test/source *logic* to judge it, never runs a test, never emits a QA verdict, and never
calls the leaf skills ([ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md) — it *recommends* an
invocation the human runs). The SKILL's identity paragraph is updated to state this boundary
explicitly. When manifests are absent or ambiguous (both Playwright and Cypress present; invoked
outside a repo), it **does not fabricate a stack** — it routes on the plain-language signal, asks one
clarifying question, or shows the full map (honest degradation, as
[ADR-0021](0021-contract-guard-consumer-side-openapi-differ.md)'s `no-spec` path).

### 4. Commit the map as the tracked SSOT; distill the routing table into the SKILL

The map was previously **gitignored local notes** (`references/` is ignored wholesale), so nothing in
the repo could point at it without a dead link, and the "single source of truth" it claims to be lived
only on one machine. It is therefore **committed into the tracked tree** at
[`docs/orchestration-map.md`](../orchestration-map.md) — bundled with the plugin, linkable
from the SKILL and this ADR, and the real in-repo evidence ledger. The routing table is still
**distilled inline in the SKILL** rather than read from the map at runtime: the SKILL stays
self-contained and always-loaded, matching the pattern `audit-orchestrator` already uses (it hard-codes
its Situation→Tool table with inline labels). The committed map is the ledger those labels are derived
from — edited first when a label graduates, with the distilled table following. For the **Audit stage
specifically**, `ask-sentinel` routes *into* `audit-orchestrator` rather than duplicating its
unit-vs-app-driven detection — one owner for that fine-grained routing. For the **Audit stage specifically**, `ask-sentinel` routes *into*
`audit-orchestrator` rather than duplicating its unit-vs-app-driven detection — one owner for that
fine-grained routing.

### 5. First slice = vetted-only external + own; leads for the rest

This slice wires the whole-map *structure* + stack detection, routing to the external tools **already
labelled Proven/Likely** in the ledger plus Sentinel's own skills, and names the **Unexamined**
external tools as leads. It does **not** ship the stage-order sequencer, and does **not** run the
research pass to label the remaining Unexamined tools — both are follow-ups. `allowed-tools` stays
`[Read, Glob]` (Glob for config files, Read for `package.json`; no `Bash`, no execution).

## Considered options

- **Route to Sentinel's own tools only.** Rejected (the initial draft's scope). It leaves the
  single-source-of-truth map a static document and contradicts the epic's *"orchestration router"* and
  open question #2. The whole point is to hand you the *external* tool when it's best and Sentinel's
  gap-filler when the external ones hit the wall.
- **Recommend every external tool the map lists, regardless of label.** Rejected — that is the slop the
  repo exists to catch. Unexamined tools are leads, not advice; the label gates the confidence.
- **Read the committed map at runtime as the single source (no distilled table).** Rejected even though
  the map is now bundled — distilling keeps the routing table in the always-loaded, self-contained SKILL
  (no runtime read of a large doc on every invocation) and matches `audit-orchestrator`'s inline-table
  pattern. The committed map stays the maintained ledger the table is derived from.
- **Duplicate `audit-orchestrator`'s unit-vs-app-driven detection in the router.** Rejected — two
  copies of the stack-routing table would drift. Route *into* `audit-orchestrator` for the Audit stage.
- **Read test/source files to detect the stack.** Rejected — that crosses from manifest-consumption
  into code analysis and erodes the very contract this ADR refines. Manifests answer "what kind of
  project" without opening a test body; that ceiling is the point.
- **Ship the full stage-order sequencer now.** Deferred — biggest surface and the biggest churn against
  #74's `ask-sentinel` routing eval before whole-map membership is settled. Sequenced as a follow-up.

## Consequences

- **`ask-sentinel` becomes the runnable front door to the whole map** — the single-source-of-truth for
  the best QA-AI tools, own and external, made executable. The map graduates from notes to a router.
- **The "not yet wired" disclaimer is retired**, and the three orphaned Sentinel skills join under
  their stack conditions.
- **The identity contract is explicitly refined, not silently broken** — SKILL states that
  manifest-reading for routing is in scope while code analysis, execution, and verdicts stay out.
- **Provenance discipline is now a router-level obligation** — the distilled table carries a label per
  route, and the honesty rule (advice only at Likely+; Unexamined = lead) is stated in the SKILL, so a
  future editor adding a tool must attach its label.
- **A research follow-up is filed** to upgrade the Unexamined external tools (TEA, Exspec, Planner/
  Generator agents, coverage-guard, self-healers) from lead to labelled advice — each an evidence task,
  not a code one.
- **The #74 `ask-sentinel` routing eval needs new cases** — positives for each newly-routable tool
  under a supporting stack, and negatives confirming a tool does **not** fire on an unsupporting stack
  (Cypress advice on a Vitest repo → route elsewhere/`none`), plus a case asserting an **Unexamined**
  tool is surfaced as a *lead* not advice. Those cases live in `evals/**`, which is **#74's
  territory and deliberately not touched on this branch** ([[judge-grounding-polarity-gap]]: one
  groundable proposition per `must_surface`, back each with a token, negatives grade token-less) —
  filed as the coordinated follow-up so the two efforts don't collide on the eval file.
- **Stage-order sequencing remains the next #47 slice**, building on this foundation.
- **Validated by the fixture + `claude plugin validate`**, consistent with the other skills — the
  routing behaviour's regression proof is the #74 eval once its cases land, not a unit runner.
