---
name: ask-sentinel
description: Router — describe your QA situation (and, if you have one, your stack) and get pointed at the best QA-AI tool for it, Sentinel's own or an external one, across the seven-stage map — with why it fits, the exact way to run it, its evidence label, and where it sits in the flow. The runnable front door to the orchestration map.
argument-hint: "[what you're trying to do, or a file/branch/situation — omit for the full map]"
allowed-tools: [Read, Glob]
---

The best QA-AI tooling is scattered across a dozen Sentinel skills *and* an ecosystem of external tools — more than anyone wants to memorize, and no single one is best at everything. `ask-sentinel` is the front door to the whole map: describe the situation in plain terms — *"AI just wrote 500 lines of tests"*, *"a Playwright test is red"*, *"this passing test smells wrong"* — and it names the **one best tool for your situation and stack**, whether that's a Sentinel skill or an external tool, says why, shows its evidence label, and where that step sits in the wider QA flow. Sentinel's own skills fill the app-driven gaps the external tools can't reach; the external tools own the stages where they're strongest. This router hands you whichever fits.

It **routes; it doesn't analyze.** It may **read your stack manifests** — `package.json`, a `playwright.config.*` / `cypress.config.*`, a published `openapi`/`swagger` doc — to tell whether the best tool at a stage is an external one or a Sentinel gap-filler (e.g. a suspicious *unit* test → external Stryker/Tautest; a suspicious *app-driven* Playwright test → Sentinel's `audit-test`, because the external mutators can't reach it). But it never reads your test or source *logic* to judge it, never runs a test, never emits a verdict, and never runs the tool for you — it hands you the invocation. The one rule worth internalizing: **`/sentinel` is the orchestrator, not a peer** — the other atomic skills run standalone, and each answers exactly one question. Route to an atomic skill for a specific question; route to `/sentinel` for the "am I safe to merge" moment.

**Every recommendation carries its evidence label** ([ADR-0013](../../docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) — this is the map's *"no proof → no recommendation"* rule applied to routing:

- **Proven / Likely → advice.** Reach for it with confidence; the label says what backs it.
- **Unexamined → a lead, not advice.** "There's a tool here worth checking — we haven't verified it in our context." Never dressed up as a confident recommendation.
- A **self-healer** is surfaced only *with its credibility caveat* — it heals or skips to green, which can mask a real regression; that's a hazard, not an endorsement.

## The Sentinel skills, by the question each answers

| Skill | Question it answers | Reach for it when |
|---|---|---|
| `/test-plan` | What *should* be tested, before any code exists? | You're about to build a feature and want the cases + layers up front |
| `/qa-review` | Is this code testable at all? | Mid code-review — hard-coded deps, `Date.now()`, hidden coupling |
| `/coverage-review` | Of what's testable, what's actually covered? | AI wrote tests; you need the *missing* cases and loose assertions |
| `/audit-test` | Would this *passing* test fail if the code it covers broke? | A test is green and you don't trust it — prove it by mutation |
| `/audit-orchestrator` | Which prover can actually verify this passing test, given my stack? | Same distrust, but you want the right tool auto-selected — unit → Stryker/Tautest, app-driven → `audit-test` |
| `/e2e-impact` | Which E2E specs does this diff plausibly hit? | You have a diff/PR and need to know which Playwright/Cypress specs to run |
| `/contract-guard` | Did the backend response drift from its published contract? | A frontend E2E went red on a suspected backend/contract change |
| `/prune-tests` | Which existing tests cost more than they protect? | The suite is slow/noisy — cut redundant, over-mocked, stale tests |
| `/threat-model` | If this change is wrong, what breaks in production and would anyone notice? | Before shipping something risky — blast radius, detectability, reversibility |
| `/debug-test` | A Playwright test is failing — root cause and fix? | A `*.spec.ts` is red and you want it diagnosed and routed |
| `/bug-report` | How do I hand this off cleanly? | Something broke and you need a structured, repro-able report |
| `/sentinel` | What's the net verdict across all of the above? | The merge gate — full pass on a branch, one PASS/CAUTION/FAIL |

`/audit-orchestrator` is the **stack-aware Audit entry point**; `/audit-test` is its app-driven leaf. Route to `/audit-orchestrator` when the stack is unit, mixed, or unknown and you want the right prover picked for you; route **direct** to `/audit-test` when the situation already names an app-driven Playwright/Cypress test and wants the mutation itself. `/threat-model` and `/bug-report` are core-but-independent — real skills, deliberately **not** in the `/sentinel` chain, because they answer questions (what breaks in production; how to hand off) orthogonal to shippability.

## The wider map: the best tool by stage + stack

Sentinel's skills are the gap-fillers; at each of the seven QA stages the *best* tool may be an external one. This is the ecosystem map (full evidence ledger in [`orchestration-map.md`](../../docs/orchestration-map.md)), distilled to what's routable today. **Advice** = Proven/Likely; **lead** = Unexamined, named but unverified.

| Stage | The question | Reach for (best for your stack) | Label |
|---|---|---|---|
| **1 · Plan** | What should I test / what's the blast radius? | `/test-plan`, `/threat-model` | advice · Proven (own) |
| | | *lead:* Playwright **Planner** agent, **TEA** risk tables | lead · Unexamined |
| **2 · Author** | Write the tests | External first-party generators own this (Playwright **Generator**, **Cypress AI**) — authoring is commodity | lead · Unexamined |
| | Is what they wrote *testable*? | `/qa-review` | advice · Proven (own) |
| **3 · Audit** | Is this *passing* test real? | **unit JS/TS →** `Tautest` (PR diff-mutation) / `StrykerJS` (full) · **app-driven →** `/audit-test`. Let `/audit-orchestrator` pick. | advice · Tautest **Proven**, Stryker **Likely**, audit-test **Proven** |
| **4 · Coverage** | What's untested? | `/coverage-review` (assertion quality, app-driven paths) | advice · own |
| | | *lead:* `coverage-guard` (external AI skill) | lead · Unexamined |
| **5 · Flake** | Is this run stable? | `/debug-test --flake` (detect → quarantine → **route**, never heal-to-hide); Playwright **`flaky` flag** for retry-then-pass | advice · Likely |
| | | *caveat-lead:* self-healers (Healenium, Cypress self-heal) — **heal to green, can mask a regression** | hazard, not advice |
| **6 · Triage** | Why did it fail? | `/debug-test`, `/diagnosing-bugs`, `/bug-report`; `/e2e-impact` (which specs a diff hits); `/contract-guard` (contract drift). Evidence sources: Playwright **trace viewer / Test Replay**, **cypress-flaky-test-audit** (per-command runtime, diagnosis-only) | advice · Proven |
| | | *caveat-lead:* Playwright **Healer** agent — heals/skips to green | hazard, not advice |
| **7 · Gate** | Am I safe to ship? | `/sentinel` (net verdict across the chain) | advice · own |

## Steps

1. Read the situation from $ARGUMENTS. It may be a plain description, a file path, a branch name, or empty.
2. **If $ARGUMENTS is empty**, output the full map (both tables plus the flow below) and stop — that's valid routing guidance on its own.
3. **Detect the stack when it changes the route** — only when the choice hinges on it (which is mainly the Audit and Triage stages, and any app-driven-vs-unit fork). Glob for `playwright.config.*` / `cypress.config.*`, read `package.json` for `@playwright/test` / `cypress` / `jest` / `vitest`, note a published `openapi`/`swagger` doc if present or named. **Read manifests only — never a test or source body.** If the stack is absent, ambiguous (both Playwright and Cypress present), or you're outside a repo, **do not fabricate one**: route on the plain-language signal, ask one clarifying question, or show the full map.
4. Match the situation to exactly one primary tool using the routing signals below — a router that returns five options has routed nothing. If two questions are genuinely in play, prefer the one whose *single question* most directly matches what the user asked, name it first, then the secondary as a follow-up.
5. **Attach the evidence label.** Proven/Likely → recommend it. Unexamined → surface it as a *lead, not advice*. For an external tool, **point — don't absorb**: name it, give the invocation + a one-line setup note, and never claim to run it. For the Audit stage, prefer routing *into* `/audit-orchestrator` rather than re-deriving the unit-vs-app-driven fork yourself.
6. If the situation is the merge/ship decision over a whole branch, route to `/sentinel` and note it will call the atomic shippability skills for you — don't also tell the user to run those by hand.
7. Output the recommendation in the format below: the tool, one line on *why* it fits, the exact invocation, its evidence label, and the natural next step in the flow.
8. If nothing fits cleanly, say so plainly and ask one clarifying question — do not force a bad match.

## Routing signals

- "before I write / about to build / what should I test" → **`/test-plan`** (+ `/threat-model` for blast radius)
- "is this testable / hard to test / hidden dependency / flaky by design" → **`/qa-review`**
- "AI wrote these tests / are the tests complete / what's missing / loose assertion" → **`/coverage-review`**
- "this test passes but I don't trust it / does it actually catch anything / prove it" → **`/audit-test`** (app-driven, direct) or **`/audit-orchestrator`** (let it pick the prover for your stack)
- "which specs does this change touch / what E2E should I run for this diff" → **`/e2e-impact`**
- "frontend went red and I think the backend changed the response / contract" → **`/contract-guard`** (or `/debug-test --drift` to classify first)
- "suite is slow / too many tests / redundant / over-mocked / stale" → **`/prune-tests`**
- "what could go wrong in prod / blast radius / would we even notice / is it reversible" → **`/threat-model`**
- "Playwright test is failing / red spec / locator or timing error" → **`/debug-test`**
- "it's flaky / passes sometimes / non-deterministic" → **`/debug-test --flake`**
- "need to file this / hand it off / write it up for the team" → **`/bug-report`**
- "about to merge / am I safe to ship / full pass on my branch" → **`/sentinel`**

## The intended flow

Sentinel's own skills map onto the life of a change, not a fixed pipeline — most runs touch two or three, not all:

```
BEFORE CODE        /test-plan        define the cases + layers before anything exists
      │
WHILE REVIEWING    /qa-review        is the code even testable?
      │
AFTER TESTS        /coverage-review  what's missing / asserted loosely?
   EXIST           /audit-test       do the green tests actually guard anything? (proven by mutation)
      │            /audit-orchestrator  ...and which prover fits your stack?
      │
SUITE HYGIENE      /prune-tests      cut tests that cost more than they protect
      │
SHIP GATE          /sentinel   ◄──── orchestrates test-plan + coverage-review + qa-review
                                     + debug-test (on failing tests) + audit-test (batch)
                                     into ONE verdict: PASS / CAUTION / FAIL

INDEPENDENT of the chain (call on their own, any time — /sentinel never runs these):
   /threat-model     what breaks in production if this is wrong, and would anyone notice
   /bug-report       structure a failure for handoff
   /e2e-impact       which E2E specs a diff plausibly hits
   /contract-guard   did the backend response drift from its published contract

ALSO STANDALONE (in the chain above, but usable alone the moment one spec goes red):
   /debug-test       a Playwright test is actively red — diagnose and route the fix
```

`/debug-test` is the one skill that lives in two places on purpose: `/sentinel` invokes it over any failing tests it finds on the branch, *and* you can run it standalone the moment a single spec goes red. That's why it sits under "also standalone" here, not under "independent."

## Output Format

For a matched situation:

```
**You're at:** [one line restating the situation in QA terms, incl. detected stack if it mattered]

**Use:** `/skill-name` or **[external tool]**
**Why:** [one sentence tying the tool's one question to the situation]
**Run:** `/skill-name <args>`   (external → the invocation + a one-line setup note)
**Evidence:** [Proven | Likely | Unexamined — one line on what backs it; Unexamined = "a lead, not advice"]

**Next in the flow:** [the natural follow-up tool, or "— this is the ship gate" for /sentinel]
```

For empty $ARGUMENTS, output both tables and the intended-flow diagram above, then one line: "Tell me what you're trying to do — and your stack if you know it — and I'll point you at one."
