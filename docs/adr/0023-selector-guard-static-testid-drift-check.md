# `selector-guard` is a standalone static test-id reconciliation: it flags every spec selector the app source can no longer produce — *before a browser launches* — as the intra-repo sibling of `contract-guard`

**Status: Proposed (2026-07-15).** A **fast-follow after the v1 Sentinel release** — captured now so the
idea isn't lost, but **deferred behind the open v1 issues**; it blocks nothing shipping. Not yet
implemented and **not yet validated on a Sentinel fixture** (n=0 here); the evidence so far is a **single
external field report** — a bespoke one-day Node script that, on its author's *fully-green* Cypress/Vue
suite (~200 specs, ~6,300 selector call sites, ~1,600 source files, ~1s runtime), found **8 real
automation defects on first run**: 4 stale/renamed test-ids, 1 wrong-page selector, 2 vacuous
absence-assertions guarding deleted UI, 1 trailing-whitespace typo
([source](https://medium.com/@dingraham01/a-one-second-static-check-for-e2e-selector-drift-aff852e94620)).
That is a demand-and-feasibility signal, **not a rate** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
before this graduates to Accepted it needs its own blinded fixture arm (rename a `data-testid` in source,
leave the spec stale → `selector-guard` flags it) on `epic-stack/.drift-fixture` or mosaic, mirroring
[EXPERIMENT-0018](../experiments/EXPERIMENT-0018-drift-triage.md)'s arms.

This is the **third, distinct** kind of drift, and it must not be conflated with the other two:
[ADR-0018](0018-debug-test-drift-triage.md) is *cross-service backend* drift (post-red, judgment-only,
routes to the provider team); [ADR-0021](0021-contract-guard-consumer-side-openapi-differ.md) is the
*API-contract* check across an org boundary. **This is same-repo *selector* drift** — an app-source
`data-testid` renamed under a spec that still selects the old name, with **both sides in the same
repository and usually the same PR**. That absence of an org boundary is the whole point: it makes this
the `contract-guard` *shape* (a consumer-side "did the producer I depend on stop producing what I read?"
static check) **without** `contract-guard`'s hard part — there is no deliberate-vs-accidental oracle
problem, because the app source **is** the oracle. A referenced test-id either exists in source or it does
not; a miss is unambiguous drift with no external contract to consult. That makes `selector-guard` the
*cheaper, higher-confidence* sibling.

## Context

A spec goes red — or worse, silently **stays green** — because someone renamed a `data-test`/`data-testid`
attribute in the app three days ago and the spec still drives the old name. The team pays a full E2E run
(and a morning of investigation) to discover something **the source code already knows statically**: a
selector is just a reference; if the app can't render it, that's checkable before a browser ever launches.
There is nothing external and nothing runtime about it — spec and source are in the same tree.

Sentinel already extracts exactly the signal this needs. [`e2e-impact`](../../skills/e2e-impact/SKILL.md)
pulls test-ids from specs — `getByTestId('x')`, `[data-testid=x]`, `cy.get('[data-testid=x]')`, **project
custom commands** (`cy.getBySel('x')` → `[data-test=x]`, learned from `cypress/support`), and
**partial-match** selectors (`getBySelLike`, `[data-test*=…]`) as substrings — across **Playwright and
Cypress**. But `e2e-impact` runs that extractor in one direction only, and **diff-scoped**: for a given
change, it greps the *changed* files for a referenced id to answer "which specs does this diff hit." It
never runs the *census*: "for **every** test-id **every** spec references, does **any** source file still
produce it?" That whole-suite reconciliation — orphaned references, not diff impact — is the missing
check, and it's a different question with a different output and a different trigger (a pre-flight guard /
CI candidate, not an impact selection).

Notably, Sentinel's extractor is already **strictly more general** than the field script that prompted
this ADR: that script assumed Cypress + a *single* `cy.getByDataTest()` wrapper + `data-test` only, and
explicitly punted on `getByTestId`/`getByRole`/`getByText`. `e2e-impact` handles both frameworks and
custom commands. So the reusable win from the field report is the **reconciliation architecture**
(extract refs → census source attributes → diff the two lists → report orphans), not its extractor.

### The constraint that shapes the design

Like drift-mode, this lives inside [ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)'s
static-judgment moat — and here the fit is even cleaner than for drift-mode. `selector-guard` **runs
nothing**: no browser, no session, no suite, no retry. It reads spec files and source files (pure
consumption of in-repo text) and compares two string sets. The signal is available at PR/CI time with a
~1s cost; the moment the check would need to *render* a component to know whether an id is producible, it
stops and labels that case a gap (below) rather than executing to resolve it.

## Decision

Build `selector-guard` as a **standalone, user-invoked, static-judgment** skill
([ADR-0020](0020-suite-trigger-model-leaves-user-invoked.md)) that **reuses `e2e-impact`'s selector/test-id
extractor** as a shared component and adds the source census + reconciliation. Three parts:

**1. Extract referenced selectors — reuse, don't re-derive.** Call `e2e-impact`'s spec-side extractor
(Playwright + Cypress + custom commands + partial matches). Resolve each call site:
- **exact literal** (`getByTestId('orders-table')`) → the id, checked exactly;
- **template/composed** (`` getByTestId(`${id}-bid-card`) ``) → a **wildcard pattern** (`*-bid-card`);
- **fully dynamic** (`getByTestId(someVar)`) → **skipped but counted** — reported as an unchecked gap,
  never silently dropped and never counted as a pass.

**2. Reconcile against a source census.** Harvest `data-testid` / `data-test` / `data-cy` attributes
across **all** source (this is the inversion of `e2e-impact`'s diff-scope — a whole-tree census, not the
changed files). For each referenced selector, classify producibility and **label confidence**, mirroring
`e2e-impact`'s honest-gaps discipline:
- **exact literal with no matching source attribute → orphan, High confidence** — real drift, the
  headline finding;
- **composed/wildcard reference that matches only a *pattern* attribute → Medium** — because a
  suffix-only match cannot see a **base rename**. This is the field script's own headline blind spot
  (`save-button` still matches `*-button` after `save`→`submit`), and ~85% of real-world ids are composed,
  so `selector-guard` must **not** claim base-rename coverage it doesn't have. It labels these Medium and
  offers an optional strict pass that additionally checks the base token appears as a substring in source.

**3. Surface for human disposition — never auto-rename** ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md),
[ADR-0003](0003-prune-tests-proposes-before-deleting.md)). Report orphans grouped by the *right*
disposition — an orphan is not always a broken selector:
- **Orphan under an ordinary selector** → stale reference, drift. Propose alignment (the source is the
  source-of-truth for what the app renders, so the spec is usually the stale side — but the tool
  *proposes*, the human decides which side moved).
- **Orphan under an *absence* assertion** (`.should('not.exist')`, `expect(...).toHaveCount(0)`) → the
  element is *meant* to be gone; the selector isn't broken, the assertion is now **vacuous** — it guards
  deleted UI and passes forever. This is false confidence, so **route to
  [`/audit-test`](../../skills/audit-test/SKILL.md)**, not a "fix the selector" prompt. (Two of the field
  report's eight defects were exactly this.)
- **Dynamic-skipped** → reported as an explicit unchecked-selectors gap.

The verdict is a **challenger's flag, not an oracle**: "these referenced test-ids have no producer in
source — [N exact / M composed] — human, confirm which side is stale." It never edits a spec or a
component. As a **bonus inverse** (free from the same two lists): a source `data-testid` that **no** spec
references is a cheap coverage-gap lead handed to
[`/coverage-review`](../../skills/coverage-review/SKILL.md).

## Considered options

- **Fold it into `e2e-impact` as a `--census`/`--audit` mode.** Tempting — they share the entire spec-side
  extractor. Rejected as the *primary* home: `e2e-impact` owns **diff-scoped selection** ("which specs does
  *this change* hit"), a single, sharp responsibility with a confidence-labeled per-spec output and a
  run-all fallback. A whole-suite orphan **reconciliation** has a different trigger (pre-flight guard / CI
  gate vs. impact selection), a different output (a defect list, not a spec set), and a different consumer.
  Bolting a census onto a selection skill muddies both. The extractor is shared as a *component*; the
  skills stay separate. (Sentinel's precedent cuts this way: drift folded into `debug-test` because it
  shared a *disposition* (ADR-0018), whereas `contract-guard` stayed standalone because its *build* was
  distinct (ADR-0021) — a census is the latter case.)
- **Fold it into `contract-guard`.** Rejected — `contract-guard` is *cross-service*: an org boundary, a
  published-OpenAPI oracle, the Pact white space, a deliberate-vs-accidental decision. `selector-guard` has
  **none** of these — same repo, source-is-the-oracle, binary producible/not. Same family shape, but the
  simplifications are large enough that sharing the org-boundary machinery would only import complexity this
  check doesn't need. Siblings, not one skill.
- **Ship the field script's approach verbatim (Cypress + single-wrapper + `data-test` only).** Rejected —
  Sentinel's extractor already covers Playwright, Cypress, custom commands, and partial matches; adopting a
  narrower one would regress. The reusable idea is the reconciliation *architecture*, not the extractor.
- **Extend to `getByRole` / `getByText` / `getByLabel` in v0.** Rejected for v0 — role/name and text are
  **computed** (ARIA roles, i18n-derived strings) and not statically producible-checkable the way a literal
  `data-testid` attribute is. `e2e-impact` already treats them as Medium/Low heuristic signals; here they'd
  be false precision. Stated as a v0 boundary and a gap, **not faked**. test-id-only is a legitimate 80/20.
- **Auto-align the stale side (rename the spec, or the attribute).** Rejected — Sentinel proposes, the human
  applies ([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md),
  [ADR-0003](0003-prune-tests-proposes-before-deleting.md)); and which side is stale is a judgment the tool
  must not make (the *source* rename could itself be the accident).
- **Run the suite / render components to confirm producibility.** Rejected — that is the Execution Gap
  ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)); the entire value here is catching
  drift *without* a browser. Runtime-composed ids are labeled a gap, not chased with execution.

## Consequences

- **A new user-invoked leaf**, the intra-repo sibling of `contract-guard`: `contract-guard` guards the
  *API shape* a spec's reads depend on across a service boundary; `selector-guard` guards the *DOM test-id*
  a spec's selectors depend on within the repo. Together they cover "the producer moved under my test" on
  both axes Sentinel cares about, the cross-service one *and* the same-repo one.
- **Reuses `e2e-impact`'s extractor; no duplicated selector-parsing logic.** One extractor, two consumers
  (diff-scoped selection; whole-suite census) — whichever ships first hardens the parser for the other.
- **Feeds `audit-test` a cheap, static false-confidence detector.** Orphaned ids under absence assertions
  are vacuous-assertion candidates surfaced in ~1s, before `audit-test` does its heavier
  prove-by-mutation reasoning — the detector/analyzer compose by routing, not function call
  (ADR-0020).
- **Feeds `coverage-review` a free inverse signal** — source ids no spec references.
- **Static-judgment moat preserved and cleanly so** ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)):
  reading spec + source text is consumption; nothing renders or runs. This is the least execution-adjacent
  drift skill of the three.
- **Green-lock defense, again** ([ADR-0017](0017-audit-test-baseline-lock-suspected.md)): it refuses to
  auto-rename a spec to whatever the app now renders (which would be a same-repo green-lock) — it surfaces
  the mismatch and lets the human decide which side is stale.
- **Honest limits carried, not hidden** ([ADR-0013](0013-evidence-provenance-sentinel-labels-not-gates.md)):
  composed-id base renames are Medium-confidence-at-best (the ~85% blind spot), dynamic ids are an explicit
  unchecked gap, and role/text selectors are out of v0 scope — all labeled, none faked. The single external
  field report is a demand signal; the **rate claim waits on a Sentinel fixture arm**.
- **Sequencing:** fast-follow after v1. It depends on `e2e-impact`'s extractor (already built) and blocks
  none of the open v1 issues; a tracking issue (the *what*, sibling to this ADR's *why*) can be filed
  whenever the v1 issues are cleared.
