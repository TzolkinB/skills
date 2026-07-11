# audit-test gates a 🔴 behind a harness-reachability check

`audit-test`'s 🔴 "Proven false-confidence" verdict rests on one factual claim: *the mutation ran
and the test stayed green.* That claim is only meaningful if the mutation actually reached the code
the running test exercises. For unit tests run against source that is always true. For **app-driven
tests (Playwright, Cypress)** it often is **not**: when the test drives a stale build
(`build && preview`, a served `dist/`) or a deployed URL, an edit to `src/` never reaches the running
app, so *every* mutation "survives" — and `audit-test` would stamp a confident 🔴 on a test that is
in fact perfectly good. The "prove by execution" tool ([ADR-0001](0001-audit-test-proves-by-execution.md))
would be producing an execution-backed verdict that is wrong.

This was not theoretical. On 2026-07-10, on a real Playwright suite (the `Memory` app), the same
source mutation (`Main.reducer.ts` — the deck builder, sliced to 10 cards) was run two ways against
a test asserting `toHaveCount(12)`:

- **Dev-served** (`vite` dev, source-live): the test **failed** — mutation caught → a correct 🟢.
- **Build-served** (`preview` of a stale `dist/`, no rebuild): the test **passed** — mutation never
  reached the app → `audit-test` would have reported a **false 🔴**.

## Decision

Before recording any 🔴, `audit-test` runs a **reachability check**: it applies a *maximal, unmissable*
control mutation to the same code the test asserts on — one a correctly wired test cannot miss — and
runs just that one test (reverting immediately, under the existing Safety rule).

- Control **caught** (test failed) → the harness reflects source edits → the original survival is
  real → **🔴 confirmed.**
- Control **survived** (test still green) → the mutation is not reaching the tested artifact.
  Execution cannot distinguish "stale/remote harness" from "catastrophically hollow test," so we
  **refuse the confident verdict** and report **🟡**, telling the user the target looks stale/remote
  and to re-run against a source-live target (a dev server, or a rebuild step in the harness).

Refusing rather than guessing is the same challenger-not-oracle stance as ADR-0001 and the
provenance-honesty of [ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md): an
Unproven/ambiguous result is labelled, never dressed up as proof.

## Considered options

- **Sniff the harness config** (is the webServer a build? is the baseURL remote?) to decide
  reachability. Rejected — fragile config heuristics, and they still don't *prove* the running
  artifact is fresh. The control mutation proves reachability by execution, which is the whole ethos.
- **Add a rebuild step to the mutation loop** so `src/` edits always reach a built target. Rejected
  as the default — it makes every audit pay a full build, and for a deployed/remote target there is
  nothing to rebuild. It remains the *user's* fix when the check reports 🟡 (rebuild, or point at a
  dev server); the skill names it in the fallback message rather than forcing it.
- **Do nothing / document the caveat only.** Rejected — a silent false 🔴 is the worst failure for a
  tool whose entire value is that a 🔴 is trustworthy.

## Consequences

- **Unit tests are unaffected** — the control mutation is caught trivially against source, confirming
  🔴 at negligible cost. The check only bites where it must.
- **App-driven tests stop producing false 🔴s.** A stale/remote harness now yields 🟡 + a concrete
  fix, not a fabricated proof.
- **Cost:** one extra single-test run per *candidate* 🔴 — funnel-bounded, since only flagged tests
  that survive their first mutation reach the check.
- **Unblocks the diff-scoped direction.** A trustworthy 🔴 on Playwright/Cypress is the precondition
  for a PR-scoped "hollow changed-test" gate — the reachability guard is what lets that gate run on
  app-driven suites without dying of false positives. See also
  [ADR-0014](0014-sacred-path-integrity-discovery-fails-loud.md) (discovery fails loud) — same
  principle: when the audit can't actually run, say so, don't fake a clean result.
