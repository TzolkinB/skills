# Why not *just* a mutation tool? (Stryker / Tautest / Exspec / Pitest·Arcmutate)

**TL;DR** — If your top priority is zero false confidence, and your tests are **unit tests**, use a
real mutation runner. Three options: **[StrykerJS](https://stryker-mutator.io/)** for a full
campaign, **[Tautest](https://github.com/canblmz1/tautest)** for a PR-diff-scoped run, or
**[Pitest](https://pitest.org/)**/**[Arcmutate](https://www.arcmutate.com/)** on the JVM. These tools
*execute*: they change your source code, run the suite again, and show you which mutations survive.
This is a stronger false-confidence signal than any judgment layer gives. The proof needs no
argument: the tool watched the test stay green while the code was broken. **On the unit layer, these
tools win, and this repo routes you to them** ([`audit-orchestrator`](../../skills/audit-orchestrator/SKILL.md),
[ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md): *route, not rivalry*).

Use **`audit-test`** for the layer these tools **cannot enter**: app-driven **Playwright** and
**Cypress** end-to-end tests. This is a structural limit, not a temporary gap. Every one of these
mutation tools works the same way: it mutates the source code, then reruns a unit-test runner (Jest,
Vitest, or JUnit on the JVM). These tools cannot see an end-to-end assertion that does not fail when
the code breaks. `audit-test` runs one targeted mutation against a **dev-served** end-to-end test and
shows whether the test goes red. This is the same execution-grounded proof, one layer up.

Read about **Gate**, too. Gate is an **aggregator that combines evidence**; it is not an executor.
Gate does not rerun anything. If zero false confidence is your bar, your trust comes from the
*execution* underneath Gate: a mutation runner at the unit layer, `audit-test` at the end-to-end
layer. Gate weighs this evidence and reports it. Gate itself does not verify anything.

This note answers "why ours, not just theirs?" It follows the same evidence bar as the rest of this
repository: **every claim here names a real capability boundary, and states it in the tool's favor
where the tool wins.** The central reachability claim carries a **Confirmed** label (Tautest cloned
and read; see the "how to check" lines below). If a future release of any of these tools ships
app-driven end-to-end mutation, this section is wrong. Update it then.

---

## What these tools actually are (and why the question is fair)

These tools are not strawmen. Mutation testing is the **gold standard** for finding a test that does
not fail when the code breaks. "Why not just run a mutation tool?" is a fair question to ask.

| Tool | What it is | Scope | Executes? |
|---|---|---|---|
| **StrykerJS** | Full mutation-testing framework for JS/TS | **Unit** (Jest/Vitest/Jasmine/Karma/…) | **Yes** — mutates source, reruns the suite |
| **Tautest** | PR **diff-scoped** mutation (Stryker under the hood) | **Unit**, JS/TS | **Yes** — mutates only changed lines |
| **Exspec** | Static test-quality linter (assertion-free / over-mocked / coupled tests) | Multi-language, test files | **No** — reads tests, never runs them |
| **Pitest / Arcmutate** | JVM mutation testing (Arcmutate = commercial extensions to the free Pitest engine) | **Unit**, JVM (Java/Kotlin) | **Yes** — mutates bytecode, reruns JUnit |

On their home ground, a mutation runner is the strongest tool that exists for proving a **unit** test
does not fail when the code breaks. Exspec is a genuinely useful, cheap static pre-filter. This note
is not a takedown. It draws a boundary line at the **test layer**, not at tool quality.

## The layered answer: "false confidence" is not one problem

False confidence exists at **every** test layer. The right tool differs at each layer. If you
conflate the layers, you trust the wrong tool.

- **Unit layer: run the mutation tool.** A mutant that survives is execution-grounded proof — the
  unit test does not fail when the code breaks. No judgment layer beats watching a mutant survive.
  `audit-test` does **not** try to out-compete Stryker at this layer. Do not sell it that way:
  `audit-test` is a triage *funnel* that deep-audits the suspicious few tests, not a full campaign.
  Its unit-layer value is narrow and honest. If a full mutation run is impractical — a huge suite, no
  harness set up, a tight CI-time budget — the real alternative is not Stryker. The real alternative
  is **nothing**. A targeted `audit-test` mutation beats no proof at all. It does not beat a full
  mutation campaign that fits your budget.
- **End-to-end and integration layer: the mutation tools cannot help you at all.** This is not a gap
  the tools have not gotten to yet. It is structural (see the next section). Here, the real
  alternative to `audit-test` is nothing. No mutation tool reaches this layer.

## The one thing these tools structurally cannot do — audit an app-driven E2E test

A Playwright test sometimes passes for a bad reason. It never asserts the outcome it claims to check.
Or a self-healer quietly edits the expected value to match a regression. To *prove* either case, break
the code the test exercises and watch whether the test stays green. A mutation runner does exactly
that, but only for code its **unit runner** reaches. Stryker and Tautest mutate source code and rerun
Jest or Vitest. Pitest mutates bytecode and reruns JUnit. **None of them drive a browser, hit a
running app, or run a Playwright or Cypress spec.** The app-driven end-to-end test sits outside their
reach. So the exact false-confidence trap that matters most at the end-to-end layer is the one trap
these tools cannot see.

`audit-test` closes that gap. It proposes the single change most likely to break the code. It runs
that one targeted mutation against a **dev-served** Playwright or Cypress test. It checks whether the
test goes red. This proof comes from real execution, one layer up from where the mutation tools stop.

> **How to check (Confirmed, 2026-07-12):** Clone Tautest. It is Stryker-only, wired to the Jest and
> Vitest runners. Its source has zero Playwright or Cypress code, and its own docs route end-to-end
> testing *out* of mutation scope. StrykerJS's mutate-model is verified at its docs: unit runners
> only. For Pitest, check its runner list: JUnit and TestNG, no browser driver. See the Evidence
> Ledger in [`../orchestration-map.md`](../orchestration-map.md) (Audit row, "reachability wall").

**Frame this precisely.** The win is **coverage scope** — "we reach a test layer they cannot execute
against" — *not* "we out-trust execution." At the unit layer, execution beats this repo's own tools
too. Claiming otherwise is the exact overclaim this repo exists to catch. The scope claim survives a
hostile reviewer. The trust claim does not.

## Where these tools have the advantage — say it plainly

An honest note names the ground where this repo's own tools lose:

- **Unit-layer false-confidence proof: the mutation tools win, full stop.** A full Stryker or Pitest
  campaign is more exhaustive than `audit-test`'s funnel. It carries no judgment-layer caveat. If you
  have a unit suite and the run fits your budget, **run the mutation tool.** This repo's own
  `audit-orchestrator` routes you there, not to `audit-test`.
- **Static test-quality linting: Exspec is a real ally, not a rival.** Exspec flags assertion-free and
  over-mocked tests across languages, cheaply, with no execution cost. `qa-review` overlaps it.
  Neither tool "wins." Run Exspec as a fast pre-filter *before* you spend a mutation on anything.

## Gate is an aggregator, not the trust anchor

If zero false confidence is your priority, be clear-eyed about Gate. Gate **ingests existing evidence
and never reruns anything** ([ADR-0038](../adr/0038-gate-trust-boundary-and-examined-floor-population.md),
[ADR-0010](../adr/0010-execution-out-temporal-deferred-behind-a-seam.md)). Suppose a producer's tests
do not fail when the code breaks, and the producer wants to report the suite as solid anyway. Nothing
stops them: they hand Gate a clean-looking report. Gate's checks make that report *internally
consistent*. They are **not** an independent re-verification of whether the mutation actually ran and
killed the code. Gate says so itself. Its credibility axis is *"a shape-checked, cross-checked
self-report, not an independent re-verification."*

This is a **deliberate** product choice, not a missing feature. If Gate reruns mutations to verify
them independently, it crosses the execution seam. It turns from an aggregator that combines with
*any* test runner into an executor that competes with them — a different product. So the trust in a
Gate verdict is only as strong as the **execution evidence underneath it**: a mutation runner at the
unit layer, `audit-test` at the end-to-end layer. Gate weighs and reports the evidence. The execution
tools verify it.

## How they fit together — orchestrate, do not replace

These tools are **additive**. They layer by test level; none replaces another:

- **Unit layer:** StrykerJS, Tautest, or Pitest/Arcmutate on the JVM prove the unit tests, with Exspec
  as a cheap static pre-filter. `audit-orchestrator` routes suspicious unit tests here.
- **End-to-end and integration layer:** `audit-test` proves the app-driven tests the mutation tools
  cannot reach.
- **Release:** Gate combines both execution results into one readable, advisory ship/canary/hold
  bundle. Gate composes with whatever produced the results; it verifies nothing itself.

Net result: **mutation runners prove the units; `audit-test` proves the end-to-end layer the mutation
tools cannot reach; Gate combines the evidence.** Run Stryker on your unit suite *today*, and add
`audit-test` for the Playwright or Cypress layer it structurally cannot touch. Neither replaces the
other.

## Caveats worth stating plainly

- **The advantage is scope, not superior trust.** At the unit layer, execution beats a judgment
  layer, including this repo's own. Lead with "we reach the end-to-end layer they cannot," never with
  "we are more trustworthy than a mutation run."
- **Gate is orchestration, not verification.** Its verdict is only as trustworthy as the execution
  evidence fed into it. Do not pitch the combined verdict as a trust boundary.
- **`audit-test` is a funnel, not a Stryker substitute** ([ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)).
  It deep-audits the suspicious few. It does not replace a full mutation campaign where one is
  affordable.
- **Arcmutate is commercial and JVM-only.** It sits outside the JS/Playwright/Cypress ecosystem this
  repo targets. It is named here for completeness of the mutation-testing landscape, not as a free
  dependency.

---

*Map context: [`../orchestration-map.md`](../orchestration-map.md). The mutation tools sit at stage 3
(Audit). The evidence-ledger row records the reachability wall as **Confirmed**. Trust-boundary
posture: [ADR-0038](../adr/0038-gate-trust-boundary-and-examined-floor-population.md) and
[ADR-0010](../adr/0010-execution-out-temporal-deferred-behind-a-seam.md). Route, not rivalry, with
Stryker: [ADR-0004](../adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md). This repo
verified the reachability claim against Tautest source on 2026-07-12.*
