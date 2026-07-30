# Positioning — the single source of truth

Every user-facing surface derives from this file: the README opening, skill descriptions,
`ask-sentinel` routing language, talks, and social copy. If a claim isn't sanctioned here, it doesn't
ship. If this file and a surface disagree, **this file wins and the surface is a bug.**

Held to the repo's own evidence bar ([ADR-0013](adr/0013-evidence-provenance-sentinel-labels-not-gates.md)):
no claim here is stronger than its label.

---

## Audience

**QA and SDET professionals** — people who already own a test suite and already believe hollow tests
are real.

This is a deliberate change. `CONTEXT.md` previously aimed first at *developers without a QA
background*. The signals all point the other way: the practitioners articulating this problem in
public are QA people talking to QA people, the "learn business-risk fluency" argument is being made
as *QA career* advice, and the maintainer's own domain is app-driven integration/E2E.

What follows from it:

- **Don't sell the problem.** This audience has been burned by a green suite. Lead with the proof,
  not with an explanation of what false confidence is.
- **Assume a running suite.** Playwright/Cypress, CI, a PR workflow. We don't have to justify E2E.
- **Respect their skepticism.** They have watched a decade of tools over-claim. Under-claiming is a
  feature here, not modesty.
- **Speak their words, not ours.** See the vocabulary bridge below.

## The one-liner

> **Know which green tests you can trust.**

Longer form, when there's room:

> Every other tool in this space confirms a test *exists*. This one breaks your code and checks the
> test notices.

**Two rejected drafts, and why — the trap is worth remembering.**

*"Prove your green tests would go red"* was the first attempt. It fails twice. It **drops the
conditional** — the claim is "would go red *if the code broke*," and without that clause it reads as
"make your green tests red," which is the inverse of the value. And its frame is
guilty-until-proven-innocent: we don't want tests going red, we want warranted confidence. For an
audience that already fights being seen as the "no" department, leading with an accusation is the
wrong trade — and it maximises the "proof delivers bad news" weakness this very document says to
manage.

The opposite failure is just as easy: *"confidence you can trust," "release readiness you can rely
on."* That's the unfalsifiable language Qase and TestResults already use, and it makes us
interchangeable with them.

**The target is confidence framing with the mechanism still visible.** "Know which" does that — it
presumes some tests are fine and you want to know which, so it discriminates rather than accuses,
while "green tests" keeps the concrete object in view.

## Scope note — plugin vs. flagship

*Lead with `audit-test`* governs **narrative order**, not scope description. The
`.claude-plugin` descriptions and any "what is this?" answer must describe **all fourteen skills** —
planning, testability and coverage review, audits, flake triage, the gate. A description that only
describes the mutation check is wrong even though the mutation check is the hook: it undersells
thirteen skills and misleads on install. Lead with the strongest claim, then state the real scope.

## What we lead with — and why

**Lead with [`audit-test`](audit-test.md).** Everything else is depth you find after you're convinced.

It earns the lead on three grounds no other surface can match:

1. **It's demonstrable in one command on one test** — no adoption, no pipeline, no config.
2. **It's the only Confirmed capability that's also unique.** Mutation proof on *dev-served,
   app-driven* Playwright/Cypress is ground no free tool occupies.
3. **It has survived foreign code** — validated outside our own fixtures (Epic Stack 🟢, Cypress
   RWA 🔴, 2026-07-13).

The seven-stage [orchestration map](orchestration-map.md) stays the product *thesis*, but it is not
the *hook*. A map is a claim about judgment, and judgment has to be earned before it's read. Lead
with the thing that proves itself in ten minutes; let the map be what they find next.

**Corollary:** do not lead with Gate. Its honest caveats are extensive and load-bearing, and a
newcomer meeting them first reads hedging rather than rigor. Gate is what a convinced user adopts,
not what an unconvinced one is handed.

## Vocabulary bridge — their words ↔ ours

Our terms are internally precise and externally unsearchable. In outward-facing copy, lead with the
left column and introduce the right one once, in context.

| They say | We say | How to bridge |
|---|---|---|
| **coverage illusion** | false-confidence test | Their phrase, and it maps exactly. Use theirs first — it's the single best gift this market has handed us. |
| business risk coverage | — (we have no risk register) | Don't claim it. Say: the risks are only as covered as the tests behind them, and we're what checks those. |
| traceability matrix / requirements coverage | presence-based coverage | "Presence is not proof" — a requirement is marked covered because a test *exists*, never because it bites. |
| release readiness | ship / canary / hold | Ours is categorical and advisory, deliberately without a score. |
| explainability / "justify the AI's decision" | provenance labels — Confirmed / Likely / Unexamined | Closest thing we have to their ask, and it's genuinely strong. Lead with it in AI-trust conversations. |
| self-healing broke my traceability | heal-to-green hazard, baseline-lock | Their framing is better. Adopt it. |
| flaky test management | detect → quarantine → route | Emphasize what we *refuse* to do: heal it to green. |
| test quality score | (nothing) | We don't emit scores. Say so plainly; it's a differentiator, not a gap. |

## Claims we can make

Each with its label. Never state one above its label.

| Claim | Label |
|---|---|
| `audit-test` runs a real mutation on dev-served Playwright/Cypress and reports whether the test caught it | **Confirmed** |
| Mutation tools (StrykerJS, Tautest) structurally cannot reach app-driven E2E — they mutate source and run Vitest/Jest | **Confirmed** |
| Playwright/Cypress first-party agents optimize toward green; the healer skips a test if functionality appears broken | **Confirmed** (docs at source) |
| TEA's `trace` gates on coverage *presence*, so a P0 requirement covered only by a hollow test gates PASS | **Confirmed** (workflow source, v1.19.1) |
| `audit-test` caught a Playwright-Healer green-locked regression | **Confirmed *with caveat*** — the catch needed intent recoverable from source; pure mechanical mutation alone missed it. Never cite this one without the caveat. |
| Presence-based coverage is the category default, not a TEA quirk | **Confirmed** for TEA (source) · **Likely** for Qase (docs) · **Unexamined** for closed tools |

## Claims we must not make

These are not stylistic preferences. Each is a decided position with an ADR behind it, and breaking
one costs exactly the trust this audience is slowest to give.

- **No numeric confidence.** No score, no percentage, no "87% confident." The schema forbids it on
  purpose; calibration ([#129](https://github.com/TzolkinB/skills/issues/129)) is parked and must
  never be described as live.
- **Gate is not an independent verifier.** It ingests self-reports and never re-runs a mutation
  ([ADR-0038](adr/0038-gate-trust-boundary-and-examined-floor-population.md)). Say "integrity, not
  endorsement."
- **Signing is self-signed.** Never "Sigstore," never "trusted publisher," never third-party identity.
- **Don't sell Gate as a better flake classifier.** On ambiguous hard-fail E2E its marginal value over
  "Playwright `flaky` flag + read the trace" is nil-to-negative (EXPERIMENT-0001).
- **Don't claim we beat mutation tools at the unit layer.** They win there. Route to them
  ([ADR-0004](adr/0004-audit-test-is-judgment-not-a-stryker-substitute.md)).
- **A killed mutation is not a blanket guarantee.** It confirms the test catches *that specific*
  break. Nothing more.
- **No takedowns.** The TEA finding is a claim about the *category*, and TEA is the readable instance
  that lets us make it. TEA is a credibility-side ally; framing it as a target costs us the one
  community already predisposed to agree.
- **Don't claim business-risk coverage.** We have no risk register and are not building one — that's
  TEA `trace`'s turf.

## The honest weaknesses

State these when asked. They cost less than being caught omitting them.

- **Distribution, not capability, is the real constraint.** Being right is not being adopted.
- **Proof delivers bad news.** A traceability matrix says "87% mapped"; we say "your green test is
  hollow." That is a harder sell, and it's the same reason the lane is empty.
- **Gate presupposes trustworthy stages 3–5.** Gate over slop tests is manufactured confidence.
- **Cypress needs single-test isolation** for a clean proof, or the audit falls back to 🟡.

## Derived surfaces

Update these together; drift between them is a bug in the surface, not here.

- `README.md` — headline + opening
- `CONTEXT.md` — audience statement
- `.claude-plugin/plugin.json` + `.claude-plugin/marketplace.json` — the install-time descriptions,
  and for many users the *first* line they ever read
- `skills/*/SKILL.md` — descriptions
- `skills/ask-sentinel/` — routing language
- [`orchestration-map.md`](orchestration-map.md) — the thesis, positioned as depth
- [`comparisons/`](comparisons/) — per-competitor notes, same no-takedown rule
