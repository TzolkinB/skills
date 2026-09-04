# gate — one readable evidence bundle, one advisory ship decision

> **Agent instructions:** [`skills/gate/SKILL.md`](../skills/gate/SKILL.md)
>
> **Run:** `/gate [Playwright results.json and/or Cypress result.json] [audit-test emission .json or report .md] [optional: a trace-matrix .json]`

## What it does

`gate` is the **Gate stage** (stage 7) — the release-verdict layer. [`qa-pass`](./qa-pass.md) does not decide shippability, by design ([#99](https://github.com/TzolkinB/skills/issues/99)).

Gate reads a PR's existing test evidence — a Playwright JSON report, a Cypress Module API result, or both — plus an optional [`audit-test`](./audit-test.md) verdict. It binds these into one readable, in-toto-shaped evidence bundle, with content-addressed inputs. From that bundle, Gate derives one advisory category: **ship**, **canary**, or **hold**.

The bar for `ship` is deliberately hard to clear — see [How Gate decides](#how-gate-decides) below.

## When to use it

| Your situation | Where to go |
| --- | --- |
| End of a PR: you have a Playwright/Cypress result, maybe an `audit-test` verdict, and want one honest release recommendation instead of reading two reports by hand | **`/gate`** — this page |
| You want a tamper-evident record of the exact evidence behind a ship decision | **`/gate`** with a signing key — see [How Gate decides](#how-gate-decides) |
| You want to run the suite or drive a browser | Out of scope, by design — Gate ingests existing evidence only ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)) |
| You want to know if a passing test is hollow | [`audit-test`](./audit-test.md) — Gate _consumes_ its report; Gate does not produce one |
| You want to know which specs a diff hits, or to diagnose a red one | [`e2e-impact`](./e2e-impact.md) or [`debug-test`](./debug-test.md) |
| You want a QA judgment read across a branch | [`qa-pass`](./qa-pass.md) — it feeds Gate, but it does not decide shippability |
| You want requirement-to-test mapping, or a persistent risk register | That is TEA `trace`'s turf — Gate does not rebuild it, by design. It only _joins_ TEA's output against `audit-test`, statelessly, at gate time ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)) |

## Prerequisites

You need Claude Code and Node. Node runs the bundled `gate.mjs` script. You also need at least one already-produced E2E result file: a Playwright JSON reporter output, a Cypress `CypressRunResult`, or both.

Cypress does not write its result to disk on its own; it needs a small Module API wrapper to save the file first.

## How Gate decides

**The rule is worst-wins.** If any input proposes `hold`, the decision is `hold`. If not, and any input proposes `canary`, the decision is `canary`. Otherwise, the decision is `ship`. The rule runs as deterministic code (`gate.mjs`), not as a judgment call — the same bundle always produces the same decision.

**Every E2E suite passed to Gate must be green.** It must also clear an **executed-floor**: the share of the report's own discovered tests that actually ran. A suite that ran only a sliver of what it found is capped at `canary`, not read as green.

**`ship` also needs a _parsed_ `audit-test` verdict.** That verdict must show that no deep-audited test is hollow. (A hollow test passes, even when the code it checks is broken.) The deep-audited fraction must also clear an **examined-floor**.

**An _opaque_ `audit-test` report — human-readable, but not machine-parsed — floors the decision at `canary`.** No `audit-test` at all has the same effect. A bare green E2E run never becomes `ship` on its own.

**Signing the bundle is optional.** Pass a self-signed ed25519 key, and Gate wraps the bundle in a DSSE envelope. A reader then checks that nothing changed after Gate produced it. This is self-signed, not Sigstore. Signing is off by default.

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

| State | What it means |
| --- | --- |
| **Covered and mutation-proven** | Every test mapped to the requirement killed a mutation, confirmed by execution. |
| **Covered but unverified** | A test is mapped to the requirement, but `audit-test` never execution-confirmed it. The test was not deep-audited, or `audit-test` only reasoned about it; a `likely-hollow` or `baseline-lock` finding carries no per-test record. |
| **Covered by a test we proved hollow** | A mapped test **survived** a mutation — the gap the join exists to close. [`comparisons/tea.md`](./comparisons/tea.md) §3 checks the `bmad-testarch-trace` workflow source (v1.19.1). TEA's own `trace` gate is **presence**-based: a requirement is marked covered because a matching test _exists_, not because it fails when the code breaks. So a P0 requirement whose only test is hollow reads as covered, and TEA's gate reports PASS. |
| **Not covered** | The matrix itself says so (`status: NONE`). Gate never invents a row to fill the table. |

This business-risk read is **purely informational**. It never touches the ship/canary/hold decision. Gate appends this entry to the bundle _after_ it computes the decision. The entry never appears among the gate predicate's own `inputs`.

The read degrades honestly. No `--trace-json` means no section at all. Gate never makes a stronger claim than the evidence supports — see the [FAQ](#faq) below for the exact edge-case behavior.

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

## Worked example

Fixtures for Gate live under [`skills/gate/fixtures/`](../skills/gate/fixtures/), not the shared `fixtures/` directory. Gate's decision arithmetic already has its own golden-truth-table self-test: `node skills/gate/gate.mjs --self-test`. The eval here grades the skill's honest _reporting_ of the decision, not the arithmetic itself ([expected findings](../fixtures/gate/expected-findings.md)).

Case one: a green Playwright report, paired with a **present-but-opaque** `audit-test.report.md`. This yields **🟡 CANARY**. Playwright proposes `ship`, but an unparsed Markdown report floors the credibility axis at `canary` — a human still has to read it.

Case two: swap in a **parsed**, confirmed-clean `audit-test` emission (`--audit-test-json`). The same green Playwright report now yields **🟢 SHIP** — the only path to `ship`. Both axes propose `ship`, so worst-wins agrees.

Case three shows the Cypress-specific guard. A Cypress result reads `totalPassed:12, totalFailed:0`, but one test failed, then passed, in `attempts[]`. Gate **derives** a WARNED signal from this, because Cypress emits no aggregate flaky count. WARNED floors the decision at `canary`, even paired with a confirmed-clean audit — a survived flake never turns into a clean green.

Case four shows the business-risk join. [`fixtures/trace-matrix.mixed.json`](../skills/gate/fixtures/trace-matrix.mixed.json), paired with [`fixtures/audit-test.confirmed-with-runs.json`](../skills/gate/fixtures/audit-test.confirmed-with-runs.json) (`--trace-json` plus `--audit-test-json`, same Playwright report), resolves six requirements to **3 mutation-proven · 1 unverified · 1 hollow · 1 not-covered**. The hollow row names the exact test that the matrix's own PASS gate marks as covered.

The decision itself stays `🟡 CANARY`. The audit-test emission's own confirmed-hollow finding floors it there, regardless of whether `--trace-json` is present at all — that independence is the point.

## It's Working If

- `🟢 SHIP` never appears from a bare green E2E run alone — it always pairs with a parsed, confirmed-clean `audit-test` verdict.
- An opaque or missing `audit-test` report floors the decision at `🟡 CANARY`, never `SHIP`.
- A Cypress-derived WARNED signal (a survived flake in `attempts[]`) caps the decision at `CANARY`, even paired with a confirmed-clean audit.
- The gate entry itself carries no numeric confidence field — only `ship`, `canary`, or `hold`.
- The business-risk join reports `covered but unverified`, `covered by a test we proved hollow`, or `not covered` honestly, and never invents a row to fill the table.
- `--verify` on a signed bundle confirms only that the bundle is unchanged since Gate produced it — never a claim about a producer's honesty.

If Gate ever marks `ship` from a bare green run, prints a confidence number, or `--verify` passes on a bundle that changed, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does Gate make network calls?**
A: No. It reads local files only.

**Q: Can I use Gate without `audit-test` at all?**
A: Yes. Gate still runs on Playwright/Cypress results alone, but the decision caps at `canary` — a bare green E2E run never reaches `ship` without a parsed `audit-test` verdict.

**Q: I passed `--trace-json` but no `--audit-test-json` — what happens?**
A: Every mapped requirement reads `covered but unverified`. The same happens if you pass an `--audit-test-json` with no per-test `runs[]`.

**Q: Is a malformed `--trace-json` matrix silently dropped?**
A: No. Gate rejects it outright — the same distinct-state treatment `--audit-test-json` gets.

**Q: On a synthetic requirements oracle, is a clean PASS from TEA good enough on its own?**
A: No. TEA itself downgrades PASS to CONCERNS on a synthetic oracle, so a clean PASS needs formally written requirements ([`comparisons/tea.md`](./comparisons/tea.md) §3).

**Q: Does a test that scores 100/100 on a static review count as "mutation-proven" here?**
A: No. A static-review score does not change a test's state in this join — only an executed mutation does.

## Where it fits

Gate is the last stage of the [orchestration map](./orchestration-map.md). It comes after [`qa-pass`](./qa-pass.md)'s QA read and after [`audit-test`](./audit-test.md)'s credibility audit. Gate is where their evidence becomes an advisory release decision. Gate owns the ship verdict; no stage upstream of it does.

## Anti-patterns

- **Treating `canary` or `hold` as a build-blocker.** The decision is advisory only. Gate does not abort a build or a deployment; your CI or your team acts on the decision.
- **Reading a confidence number into the decision.** There is none, by design. The schema forbids a numeric field on the gate entry.
- **Recomputing or overriding the script's decision.** The decision is deterministic code. Present it exactly as returned.
- **Calling a self-signed bundle "Sigstore-verified" or a "trusted publisher."** Signing proves integrity and continuity. It never proves third-party identity.
- **Reading the business-risk join as a risk register, or reading its absence as "no risk."** It is a stateless join over whatever `--trace-json` and `--audit-test-json` were actually supplied. No matrix means no section — not a clean bill of health ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)).
