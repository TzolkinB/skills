# Why not *just* a mutation tool? (Stryker / Tautest / Exspec / Pitest·Arcmutate)

**TL;DR** — If your priority is *never being given false confidence*, and your tests are **unit
tests**, reach for a real mutation runner — **[StrykerJS](https://stryker-mutator.io/)** (full
campaign) or **[Tautest](https://github.com/tautest/tautest)** (PR diff-scoped), or
**[Pitest](https://pitest.org/)/[Arcmutate](https://www.arcmutate.com/)** on the JVM. They *execute*:
they mutate your source, re-run the suite, and show you the survivors. That is a stronger
false-confidence signal than any judgement layer, because it can't be talked out of a survivor — it
watched the test stay green while the code was broken. **On the unit layer, they win, and this repo
routes you to them** ([`audit-orchestrator`](../../skills/audit-orchestrator/SKILL.md),
[ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md): *route, not rivalry*).

Reach for **Sentinel** for the layer those tools **structurally cannot enter**: app-driven
**Playwright/Cypress** end-to-end tests. Every one of these mutators is source-mutate + unit-runner
(Jest/Vitest, or JUnit on the JVM); a hollow E2E assertion is invisible to them. `audit-test` runs a
targeted mutation against a **dev-served** E2E test and shows whether it goes red — the same
execution-grounded proof, one layer up.

And read **Gate** for exactly what it is: an **aggregator that composes evidence**, not an executor.
It does not re-run anything. If false confidence is the bar, your trust comes from the *execution*
pieces underneath Gate (a mutation runner at the unit layer, `audit-test` at the E2E layer) — Gate
weighs and reports them, it is **not itself the thing that verifies**.

This is a "why ours, not just theirs?" note, held to the same bar as the rest of the repo: **no claim
here that isn't a real capability boundary, stated in the tools' favor where they win.** The central
reachability claim is **Confirmed** (Tautest cloned + read; see the how-to-check lines). If a future
release of any of these tools ships app-driven E2E mutation, the relevant section is wrong and should
be updated.

---

## What these tools actually are (and why the question is fair)

These are not strawmen — mutation testing is the **gold standard** for detecting a hollow test, and
asking "why not just run a mutation tool?" is the right question to interrogate.

| Tool | What it is | Scope | Executes? |
|---|---|---|---|
| **StrykerJS** | Full mutation-testing framework for JS/TS | **Unit** (Jest/Vitest/Jasmine/Karma/…) | **Yes** — mutates source, re-runs the suite |
| **Tautest** | PR **diff-scoped** mutation (Stryker under the hood) | **Unit**, JS/TS | **Yes** — mutates only changed lines |
| **Exspec** | Static test-quality linter (assertion-free / over-mocked / coupled tests) | Multi-language, test files | **No** — reads tests, never runs them |
| **Pitest / Arcmutate** | JVM mutation testing (Arcmutate = commercial extensions to the free Pitest engine) | **Unit**, JVM (Java/Kotlin) | **Yes** — mutates bytecode, re-runs JUnit |

On their home turf — proving a **unit** test isn't hollow — a mutation runner is the strongest tool
that exists, and Exspec is a genuinely useful cheap static pre-filter. This note is not a takedown;
it's a boundary line, and the boundary is the **test layer**, not the quality of the tool.

## The layered answer: "false confidence" is not one problem

False confidence lives at **every** test layer, and the right tool is different at each. Conflating
them is how you end up trusting the wrong thing.

- **Unit layer → run the mutation tool.** A survived mutant is execution-grounded proof a unit test
  is hollow. Nothing a judgement layer says beats *watching* the mutant survive. `audit-test` does
  **not** try to out-compete Stryker here and shouldn't be sold as if it does — it's a triage
  *funnel* (deep-audit the suspicious few), not a full campaign. Its unit-layer value is narrow and
  honest: when a full mutation run is impractical (huge suite, no harness wired up, CI-time budget),
  the real alternative to a targeted `audit-test` mutation is **nothing** — not Stryker. Targeted
  proof beats flying blind; it does not beat a full mutation campaign you can actually afford to run.
- **E2E / integration layer → the mutation tools cannot help you at all.** This is not a gap they
  haven't gotten to; it's structural (next section). Here the alternative to `audit-test` really *is*
  nothing — no mutation tool reaches this layer.

## The one thing these tools structurally cannot do — audit an app-driven E2E test

A Playwright test can pass because it never actually asserts the outcome it claims to, or because a
self-healer quietly edited the expected value to match a regression. To *prove* that, you have to
break the code the test exercises and watch the test stay green. A mutation runner does exactly that —
but only for code its **unit runner** can reach. Stryker/Tautest mutate source and re-run
Jest/Vitest; Pitest mutates bytecode and re-runs JUnit. **None of them drive a browser, hit a running
app, or execute a Playwright/Cypress spec.** The app-driven E2E test is outside the reachable set —
so the exact false-confidence trap that matters most at the E2E layer is the one they are blind to.

`audit-test` closes that: it proposes the single most-likely-breaking change, runs that one targeted
mutation against a **dev-served** Playwright/Cypress test, and checks whether the test goes red —
execution-grounded, one layer up from where the mutators stop.

> **How to check (Confirmed, 2026-07-12):** clone Tautest — it's Stryker-only, wired to Jest/Vitest
> runners, has zero Playwright/Cypress in source, and its own docs route E2E *out* of mutation scope.
> StrykerJS's mutate-model is verified at its docs (unit runners only). For Pitest, check its runner
> list: JUnit/TestNG, no browser driver. See the Evidence Ledger in
> [`../orchestration-map.md`](../orchestration-map.md) (Audit row, "reachability wall").

**Frame this precisely.** The win is **coverage scope** — "we reach a test layer they cannot execute
against" — *not* "we out-trust execution." At the unit layer, execution out-trusts *us*. Claiming
otherwise is the exact overclaim this repo exists to catch; the scope claim survives a hostile
reviewer, the trust claim would not.

## Where these tools beat us — say it plainly

An honest positioning note names the ground it *loses*:

- **Unit-layer false-confidence proof — the mutation tools win, full stop.** A full Stryker/Pitest
  campaign is more exhaustive than `audit-test`'s funnel and is not subject to any judgement-layer
  caveat. If you have a unit suite and can afford the run, **run the mutation tool** — this repo's
  own `audit-orchestrator` routes you there rather than to `audit-test`.
- **Static test-quality linting — Exspec is a real ally, not a rival.** It cheaply flags
  assertion-free and over-mocked tests across languages with no execution cost. `qa-review` overlaps
  it. Neither "wins"; run Exspec as a fast pre-filter *before* you spend a mutation on anything.

## Gate is an aggregator, not the trust anchor

If your priority is zero false confidence, be clear-eyed about Gate: it **ingests existing evidence
and never re-runs** ([ADR-0038](../adr/0038-gate-trust-boundary-and-examined-floor-population.md),
[ADR-0010](../adr/0010-execution-out-temporal-deferred-behind-a-seam.md)). A producer that wants to
report a hollow suite as solid can hand Gate a clean-looking report; Gate's invariants make that
report *internally consistent*, they are **not** an independent re-verification of whether the
mutation actually ran and killed. Gate says so itself — its credibility axis is *"a shape-checked,
cross-checked self-report, not an independent re-verification."*

That is a **deliberate** product choice, not a missing feature: re-running mutations to independently
verify would cross the execution seam and turn Gate from an aggregator that composes with *any* test
runner into an executor that competes with them — a different product. So the trust in a Gate verdict
is only ever as strong as the **execution evidence underneath it**: a mutation runner at the unit
layer, `audit-test` at the E2E layer. Gate weighs and reports; the execution pieces verify.

## How they fit together — orchestrate, don't replace

These are **additive**, layered by test level, not a replacement for each other:

- **Unit layer:** StrykerJS / Tautest (or Pitest·Arcmutate on the JVM) prove the unit tests, with
  Exspec as a cheap static pre-filter. `audit-orchestrator` routes suspicious unit tests here.
- **E2E / integration layer:** `audit-test` proves the app-driven tests the mutators can't reach.
- **Release:** Gate aggregates both execution results into one readable, advisory ship/canary/hold
  bundle — composing with whatever produced them, verifying nothing itself.

Net: **mutation runners prove the units; `audit-test` proves the E2E layer they can't reach; Gate
composes the evidence.** You can run Stryker on your unit suite *today* and slot `audit-test` in for
the Playwright/Cypress layer it structurally can't touch — without giving up either.

## Caveats worth stating plainly

- **The moat is scope, not superior trust.** At the unit layer, execution beats a judgement layer —
  including ours. Lead with "we reach the E2E layer they can't," never with "we're more trustworthy
  than a mutation run."
- **Gate is orchestration, not verification.** Its verdict is only as trustworthy as the execution
  evidence fed into it. Don't pitch the aggregated verdict as a trust boundary.
- **`audit-test` is a funnel, not a Stryker substitute** ([ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)).
  It deep-audits the suspicious few; it does not replace a full mutation campaign where one is
  affordable.
- **Arcmutate is commercial and JVM-only** — out of the JS/Playwright/Cypress ecosystem this repo
  targets; named here for completeness of the mutation-testing landscape, not as a free dependency.

---

*Map context: [`../orchestration-map.md`](../orchestration-map.md) — the mutation tools sit at stage 3
(Audit); the evidence-ledger row records the reachability wall as **Confirmed**. Trust-boundary
posture: [ADR-0038](../adr/0038-gate-trust-boundary-and-examined-floor-population.md) and
[ADR-0010](../adr/0010-execution-out-temporal-deferred-behind-a-seam.md). Route-not-rivalry with
Stryker: [ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md). Reachability
claim verified against Tautest source, 2026-07-12.*
