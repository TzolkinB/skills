# gate — one readable evidence bundle, one advisory ship decision

> **Agent instructions:** [`skills/gate/SKILL.md`](../skills/gate/SKILL.md)
>
> **Run:** `/gate [Playwright results.json and/or Cypress result.json] [audit-test emission .json or report .md] [optional: a trace-matrix .json]`

## What it does

`gate` is the **Gate stage** (stage 7). It is the release-verdict layer. [`qa-pass`](./qa-pass.md) does not decide shippability, by design ([#99](https://github.com/TzolkinB/skills/issues/99)).

Gate reads a PR's existing test evidence: a Playwright JSON report, a Cypress Module API result, or both. It also reads an optional [`audit-test`](./audit-test.md) verdict. Gate binds these inputs into one readable evidence bundle. The bundle is in-toto-shaped, and its inputs are content-addressed.

From the bundle, Gate derives one advisory category: **ship**, **canary**, or **hold**, by **worst-wins**. If any input proposes `hold`, the decision is `hold`. If not, and any input proposes `canary`, the decision is `canary`. Otherwise, the decision is `ship`. The rule runs as deterministic code (`gate.mjs`), not as a judgment call — the same bundle always produces the same decision.

The bar for `ship` is deliberately hard to clear. Every E2E suite passed to Gate must be green. It must also clear an **executed-floor**: the share of the report's own discovered tests that actually ran. A suite that ran only a sliver of what it found is capped at `canary`, not read as green.

`ship` also needs a _parsed_ `audit-test` verdict. That verdict must show that no deep-audited test is hollow. (A hollow test passes, even when the code it checks is broken.) The deep-audited fraction must also clear an **examined-floor**.

An _opaque_ `audit-test` report — human-readable, but not machine-parsed — floors the decision at `canary`. No `audit-test` at all has the same effect. A bare green E2E run never becomes `ship` on its own.

Signing the bundle is optional. Pass a self-signed ed25519 key, and Gate wraps the bundle in a DSSE envelope. A reader then checks that nothing changed after Gate produced it. This is self-signed, not Sigstore. Signing is off by default.

## What the floors do and don't catch

Clearing both floors is required to reach `ship`. Clearing them does not mean the suite is trustworthy — it means the suite hit a specific minimum. Each bullet below shows a gap that clearing a floor does not close:

- **Examined-floor threshold.** The default is 50% of everything triaged. Lower the threshold if needed; the minimum is 25%. If the deep-audited fraction falls short of the threshold, the report states this plainly. The decision still stays capped at `canary` — a narrow clean audit never counts as if it cleared the floor.
- **The executed-floor trusts the report's own denominator.** It compares the tests that ran against the tests the report says it _discovered_. That discovered count comes from the report itself. Because of this, a discovery, filter, or config change that narrows the suite _before_ the report is written stays uncaught. The narrowed suite looks fully executed.
- **A parsed `audit-test` verdict is a shape-checked self-report.** It is not an independent re-verification. Gate never re-runs a mutation ([ADR-0038](./adr/0038-gate-trust-boundary-and-examined-floor-population.md)).
- **Signing scope.** The DSSE envelope wraps an in-toto-_shaped_ Statement. Standard in-toto tooling does **not** consume this bundle as-is. The signature covers four things: the decision itself, content-addressed digests of the files Gate ran on, a digest of every parsed evidence entry, and `producedOn`/`schemaVersion`. `--verify` proves that the bundle did not change after Gate produced it. It proves nothing about whether any producer's report was honest — Gate signs its own bundle, not the truthfulness of what went into it.

## Business-risk coverage (optional, `--trace-json`)

This section answers one question: _"What business risks are actually covered?"_ Gate answers it as a **stateless join**. Gate never maintains a risk register of its own ([#199](https://github.com/TzolkinB/skills/issues/199), [ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)).

Pass an optional requirement-to-test traceability matrix with `--trace-json`, alongside `--audit-test-json`. The matrix uses Gate's **own** minimal shape, [`gate-trace-matrix/v0`](../skills/gate/schema/trace-matrix.v0.schema.json) — not any external tool's internal format. ([`tea-to-trace-matrix.mjs`](../skills/gate/tea-to-trace-matrix.mjs) converts a TEA `trace` run into this shape; see below.)

With both flags passed, Gate resolves each requirement into one of four states. A traceability matrix alone gives you only a bare presence bit. Gate gives you this instead:

- **covered and mutation-proven** — every test mapped to the requirement killed a mutation, confirmed by execution.
- **covered but unverified** — a test is mapped to the requirement, but audit-test never execution-confirmed it. The test was not deep-audited, or audit-test only reasoned about it; a `likely-hollow` or `baseline-lock` finding carries no per-test record.
- **covered by a test we proved hollow** — a mapped test **survived** a mutation. This is the gap the join exists to close: [`comparisons/tea.md`](./comparisons/tea.md) §3 checks the `bmad-testarch-trace` workflow source (v1.19.1). TEA's own `trace` gate is **presence**-based. A requirement is marked covered because a matching test _exists_, not because it fails when the code breaks. So a P0 requirement whose only test is hollow reads as covered, and TEA's gate reports PASS.
- **not covered** — the matrix itself says so (`status: NONE`). Gate never invents a row to fill the table.

This business-risk read is **purely informational**. It never touches the ship/canary/hold decision. Gate appends this entry to the bundle _after_ it computes the decision. The entry never appears among the gate predicate's own `inputs`.

The read degrades honestly. No `--trace-json` means no section at all. A malformed matrix is **rejected**, not silently dropped — the same distinct-state treatment `--audit-test-json` gets. A valid matrix with no paired `--audit-test-json` (or one with no per-test `runs[]`) reads every mapped requirement as `unverified`. Gate never makes a stronger claim than the evidence supports.

Two caveats carry over from `comparisons/tea.md` §3. On a _synthetic_ oracle, TEA itself downgrades PASS to CONCERNS, so a clean PASS needs formal requirements. Also, a test that scores 100/100 on a static review does not change its state here — only an executed mutation does.

```
node "<skill base dir>/gate.mjs" --playwright=results.json --audit-test-json=tally.json \
     --trace-json=trace-matrix.json --commit=<sha> --out=gate-bundle.json
```

### Converting a TEA `trace` run into a matrix

Do not hand-author this file ([#220](https://github.com/TzolkinB/skills/issues/220), [ADR-0050](./adr/0050-tea-trace-converts-from-its-phase-1-json-never-its-markdown.md)). Use the converter instead:

```
node "<skill base dir>/tea-to-trace-matrix.mjs" --trace-md=docs/test-artifacts/traceability-matrix.md \
     --gate-json=docs/test-artifacts/gate-decision.json --audit-test-json=tally.json \
     --out=trace-matrix.json
```

TEA writes four artifacts. Only one is convertible. `e2e-trace-summary.json` and `gate-decision.json` carry aggregates and a gate signal, but no requirement rows. `traceability-matrix.md` carries the rows, but it identifies each mapped test only as `` `id` `` - `file`:`line`, with **no test title**. Gate's join key is `<file>::<title>`. Building a key from that Markdown file produces a fabricated value. Or it produces a guess from a line number that goes stale at the next edit. Either way, the key joins to nothing. It renders as plausible-looking `unverified` coverage instead of an error.

The **Phase-1 coverage-matrix JSON** is convertible. TEA's own step-05 reads this file back. It carries per-requirement rows, with per-test `title`/`file`/`line`/`level`. TEA writes it to `/tmp`, and records its path in the `.md` file's frontmatter, as `tempCoverageMatrixPath`. `--trace-md` follows that pointer; `--coverage-matrix` takes the file directly.

The converter refuses rather than approximates. It refuses an unrecognized coverage value, a missing priority, a test with no title, or a contradictory row. For each, it names the row, writes nothing, and exits with code 2.

The converter flattens TEA's five-valued vocabulary into Gate's three values. `UNIT-ONLY` and `INTEGRATION-ONLY` both map to `PARTIAL`, never to `FULL` — a conversion must not widen TEA's own presence call. Each row also keeps TEA's original value, as `teaCoverage`.

Pass `--audit-test-json` to check, before you gate, how many keys actually join. TEA spells files as repo paths; an `audit-test` emission sometimes uses basenames instead. A zero-match matrix still produces a complete, plausible-looking report, in which every requirement reads `unverified`. `--test-key=basename` is the documented fix for this. It refuses when two directories share a spec basename, because a wrong join is worse than no join.

The input is a temp file. Convert it in the same session as the `trace` run.

## When to use it

- At the end of a PR. Gate turns a Playwright/Cypress result and an `audit-test` verdict into one honest, human-readable release recommendation. You no longer read two separate reports by hand.
- You want a tamper-evident record of the exact evidence behind a ship decision.

## When _not_ to use it

- **You want to run the suite or a browser.** This is out of scope, by design. Gate ingests existing evidence only ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
- **You want to know if a passing test is hollow.** Use [`audit-test`](./audit-test.md) instead. Gate _consumes_ its report; Gate does not produce one.
- **You want to know which specs a diff hits, or to diagnose a red one.** Use [`e2e-impact`](./e2e-impact.md) or [`debug-test`](./debug-test.md).
- **You want a QA judgment read across a branch.** Use [`qa-pass`](./qa-pass.md). It feeds Gate, but it does not decide shippability.
- **You want requirement-to-test mapping, or a persistent risk register.** That is TEA `trace`'s turf. Gate does not rebuild it, by design ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)). Gate only _joins_ TEA's output against `audit-test`, statelessly, at gate time.

## Prerequisites

You need Claude Code and Node. Node runs the bundled `gate.mjs` script. You also need at least one already-produced E2E result file: a Playwright JSON reporter output, a Cypress `CypressRunResult`, or both.

Cypress does not write its result to disk on its own; it needs a small Module API wrapper to save the file first.

Gate makes no network calls. It reads local files only.

## Worked example

Fixtures for Gate live under [`skills/gate/fixtures/`](../skills/gate/fixtures/), not the shared `fixtures/` directory. Gate's decision arithmetic already has its own golden-truth-table self-test: `node skills/gate/gate.mjs --self-test`. The eval here grades the skill's honest _reporting_ of the decision, not the arithmetic itself ([expected findings](../fixtures/gate/expected-findings.md)).

Case one: a green Playwright report, paired with a **present-but-opaque** `audit-test.report.md`. This yields **🟡 CANARY**. Playwright proposes `ship`, but an unparsed Markdown report floors the credibility axis at `canary` — a human still has to read it.

Case two: swap in a **parsed**, confirmed-clean `audit-test` emission (`--audit-test-json`). The same green Playwright report now yields **🟢 SHIP** — the only path to `ship`. Both axes propose `ship`, so worst-wins agrees.

Case three shows the Cypress-specific guard. A Cypress result reads `totalPassed:12, totalFailed:0`, but one test failed, then passed, in `attempts[]`. Gate **derives** a WARNED signal from this, because Cypress emits no aggregate flaky count. WARNED floors the decision at `canary`, even paired with a confirmed-clean audit — a survived flake never turns into a clean green.

Case four shows the business-risk join. [`fixtures/trace-matrix.mixed.json`](../skills/gate/fixtures/trace-matrix.mixed.json), paired with [`fixtures/audit-test.confirmed-with-runs.json`](../skills/gate/fixtures/audit-test.confirmed-with-runs.json) (`--trace-json` plus `--audit-test-json`, same Playwright report), resolves six requirements to **3 mutation-proven · 1 unverified · 1 hollow · 1 not-covered**. The hollow row names the exact test that the matrix's own PASS gate marks as covered.

The decision itself stays `🟡 CANARY`. The audit-test emission's own confirmed-hollow finding floors it there, regardless of whether `--trace-json` is present at all — that independence is the point.

## Where it fits

Gate is the last stage of the [orchestration map](./orchestration-map.md). It comes after [`qa-pass`](./qa-pass.md)'s QA read and after [`audit-test`](./audit-test.md)'s credibility audit. Gate is where their evidence becomes an advisory release decision. Gate owns the ship verdict; no stage upstream of it does.

## Anti-patterns

- **Treating `canary` or `hold` as a build-blocker.** The decision is advisory only. Gate does not abort a build or a deployment; your CI or your team acts on the decision.
- **Reading a confidence number into the decision.** There is none, by design. The schema forbids a numeric field on the gate entry.
- **Recomputing or overriding the script's decision.** The decision is deterministic code. Present it exactly as returned.
- **Calling a self-signed bundle "Sigstore-verified" or a "trusted publisher."** Signing proves integrity and continuity. It never proves third-party identity.
- **Reading the business-risk join as a risk register, or reading its absence as "no risk."** It is a stateless join over whatever `--trace-json` and `--audit-test-json` were actually supplied. No matrix means no section — not a clean bill of health ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)).
