# gate — one readable evidence bundle, one advisory ship decision

> **Agent instructions:** [`skills/gate/SKILL.md`](../skills/gate/SKILL.md) · **Run:** `/gate [Playwright results.json and/or Cypress result.json] [audit-test emission .json or report .md] [optional: a trace-matrix .json]`

## What it does

`gate` is the **Gate stage** (stage 7) — the release-verdict layer that [`sentinel`](./sentinel.md) deliberately doesn't speak ([#99](https://github.com/TzolkinB/skills/issues/99)). It ingests a PR's *existing* test evidence — a Playwright JSON report and/or a Cypress Module API result, plus (optionally) an [`audit-test`](./audit-test.md) verdict — and binds them into one readable, in-toto-shaped evidence bundle over content-addressed inputs. From that bundle it derives a categorical **ship / canary / hold** decision by **worst-wins**: if any input proposes `hold`, the decision is `hold`; else if any proposes `canary`, it's `canary`; else `ship`. The arithmetic is deterministic code (`gate.mjs`), not a judgment call — given the same bundle it always yields the same decision.

The bar for `ship` is deliberately hard to clear: every E2E suite passed in must be green **and** clear an **executed-floor** against what the report itself says it discovered (a suite that only ran a sliver of what it found is capped at `canary`, not read as green) — **and** a *parsed* `audit-test` verdict must show no hollow tests among what it deep-audited, with that deep-audited fraction clearing an **examined-floor**. An *opaque* audit-test report (human-readable but not machine-parsed) or no audit-test at all floors the decision at `canary` — a bare green E2E run can never launder into `ship` on its own. The whole bundle can optionally be DSSE-signed with a self-signed ed25519 key so a reader can verify nothing was altered after Gate produced it — self-signed, not Sigstore, and unsigned by default.

## What the floors do and don't catch

Clearing both floors is *required* to get `ship` — but clearing them doesn't mean the suite is
trustworthy, only that it hit a specific minimum. Each bullet below is a way a suite could clear the
floor and still have a real gap the floor doesn't check for:

- **Examined-floor threshold.** Defaults to 50% of everything triaged, overridable down to 25%. If the
  deep-audited fraction falls short of that, the report says so plainly — but the decision stays
  capped at `canary` regardless; a narrow clean audit is never treated as if it cleared the bar.
- **The executed-floor trusts the report's own denominator.** It compares tests run against the tests
  the report says it *discovered*. Because that discovered count comes from the report itself, a
  discovery, filter, or config change that quietly narrows the suite *before* the report is written
  won't be caught — the narrowed suite looks fully executed.
- **A parsed `audit-test` verdict is a shape-checked self-report**, not an independent
  re-verification. Gate never re-runs a mutation ([ADR-0038](./adr/0038-gate-trust-boundary-and-examined-floor-population.md)).
- **Signing scope.** The DSSE envelope wraps an in-toto-*shaped* Statement — **not** consumable by
  standard in-toto tooling as-is. The signature covers four things: the decision itself,
  content-addressed digests of the files Gate ran on, a digest of every parsed evidence entry, and
  `producedOn`/`schemaVersion`. `--verify` proves that bundle wasn't altered after Gate produced it.
  It proves nothing about whether any producer's report was honest in the first place — Gate signs its
  own bundle, not the truthfulness of what went into it.

## Business-risk coverage (optional, `--trace-json`)

*"What business risks are actually covered?"* — answered as a **stateless join**, never a risk
register Gate maintains itself ([#199](https://github.com/TzolkinB/skills/issues/199),
[ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)). Pass an optional
requirement→test traceability matrix (`--trace-json`, [`gate-trace-matrix/v0`](../skills/gate/schema/trace-matrix.v0.schema.json)
— Gate's **own** minimal shape, not any external tool's internal format;
[`tea-to-trace-matrix.mjs`](../skills/gate/tea-to-trace-matrix.mjs) converts a TEA `trace` run into it,
see below) alongside `--audit-test-json`, and Gate resolves each requirement into
one of four states instead of the bare presence bit a traceability matrix alone gives you:

- **covered and mutation-proven** — every test mapped to the requirement was execution-confirmed to
  kill a mutation.
- **covered but unverified** — a test is mapped, but audit-test never execution-confirmed it (not
  deep-audited, or only reasoned-about — likely-hollow/baseline-lock carry no per-test record).
- **covered by a test we proved hollow** — a mapped test **survived** a mutation. This is the gap the
  join exists to close: [`comparisons/tea.md`](./comparisons/tea.md) §3 verifies (against the
  `bmad-testarch-trace` workflow source, v1.19.1) that TEA's own `trace` gate is **presence**-based —
  a requirement is marked covered because a matching test *exists*, never because it would fail if the
  code broke — so a P0 requirement whose only test is hollow reads as covered and gates PASS.
- **not covered** — the matrix itself says so (`status: NONE`); Gate never fabricates a row to fill
  the table.

This is **purely informational** — it never touches the ship/canary/hold decision (the entry is
appended to the bundle *after* the decision is computed, and never appears among the gate predicate's
own `inputs`), and it degrades honestly: no `--trace-json` means no section at all; a malformed one is
**rejected**, not silently dropped (the same distinct-state treatment `--audit-test-json` gets); a
valid matrix with no paired `--audit-test-json` (or one carrying no per-test `runs[]`) reads every
mapped requirement as `unverified` rather than a stronger claim the evidence doesn't support. Two
caveats carry over from `comparisons/tea.md` §3: on a *synthetic* oracle TEA itself downgrades
PASS→CONCERNS, so a clean PASS needs formal requirements; and a test scoring 100/100 on static review
doesn't change its state here — only an executed mutation does.

```
node "<skill base dir>/gate.mjs" --playwright=results.json --audit-test-json=tally.json \
     --trace-json=trace-matrix.json --commit=<sha> --out=gate-bundle.json
```

### Getting that matrix out of a TEA `trace` run

Don't hand-author it ([#220](https://github.com/TzolkinB/skills/issues/220),
[ADR-0050](./adr/0050-tea-trace-converts-from-its-phase-1-json-never-its-markdown.md)):

```
node "<skill base dir>/tea-to-trace-matrix.mjs" --trace-md=docs/test-artifacts/traceability-matrix.md \
     --gate-json=docs/test-artifacts/gate-decision.json --audit-test-json=tally.json \
     --out=trace-matrix.json
```

TEA writes four artifacts and only one is convertible. `e2e-trace-summary.json` and `gate-decision.json`
carry aggregates and a gate signal, no requirement rows. `traceability-matrix.md` carries the rows but
identifies each mapped test as `` `id` `` - `file`:`line` — **no test title** — and Gate's join key is
`<file>::<title>`, so a key transcribed from it would be fabricated or guessed from a line number that
goes stale on the next edit, joining to nothing and rendering as plausible `unverified` coverage. What
*is* convertible is the **Phase-1 coverage-matrix JSON** TEA's own step-05 reads back: per-requirement
rows with per-test `title`/`file`/`line`/`level`, written to `/tmp` with its path recorded in the `.md`'s
frontmatter as `tempCoverageMatrixPath`. `--trace-md` follows that pointer; `--coverage-matrix` takes the
file directly.

The converter refuses rather than approximates — an unrecognized coverage value, a missing priority, a
test with no title, a contradictory row, each names the row and writes nothing (exit 2). It flattens
TEA's five-valued vocabulary into Gate's three (`UNIT-ONLY`/`INTEGRATION-ONLY` → `PARTIAL`, never `FULL`
— a conversion may not widen TEA's own presence call), keeping the verbatim value on each row as
`teaCoverage`. Passing `--audit-test-json` cross-checks how many keys actually join **before** you gate:
TEA spells files as repo paths while an `audit-test` emission may use basenames, and a zero-match matrix
produces a complete, plausible report in which every requirement reads `unverified`. `--test-key=basename`
is the disclosed fix, and it refuses when two directories share a spec basename (a wrong join is worse
than no join). Because the input is a temp file, convert in the same session as the `trace` run.

## When to use it

- At the end of a PR, to turn a Playwright/Cypress result and an `audit-test` verdict into one honest, human-readable release recommendation instead of eyeballing two separate reports.
- You want a tamper-evident record of the exact evidence a ship decision was based on.

## When *not* to use it

- **You want to run the suite or a browser** → out of scope by design; Gate ingests existing evidence only ([ADR-0010](./adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).
- **You want to know if a passing test is hollow** → [`audit-test`](./audit-test.md); Gate *consumes* its report, it doesn't produce one.
- **You want which specs a diff hits, or to diagnose a red one** → [`e2e-impact`](./e2e-impact.md) / [`debug-test`](./debug-test.md).
- **You want a QA judgment read across a branch** → [`sentinel`](./sentinel.md), which feeds Gate but doesn't itself speak shippability.
- **You want requirement→test mapping or a persistent risk register** → that's TEA `trace`'s turf, deliberately not rebuilt here ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)); Gate only *joins* its output against `audit-test`, stateless, at gate time.

## Prerequisites

Claude Code, plus Node to run the bundled `gate.mjs` script and at least one already-produced E2E result file (a Playwright JSON reporter output and/or a Cypress `CypressRunResult` — Cypress requires a small Module API wrapper to persist, since it doesn't write one to disk on its own). No network calls; it reads local files only.

## Worked example

Fixtures live under [`skills/gate/fixtures/`](../skills/gate/fixtures/) rather than the shared `fixtures/` directory, since Gate's decision arithmetic has its own golden-truth-table self-test (`node skills/gate/gate.mjs --self-test`) — the eval here grades the skill's honest *reporting* of that decision, not the numbers ([expected findings](../fixtures/gate/expected-findings.md)).

A green Playwright report paired with a **present-but-opaque** `audit-test.report.md` yields **🟡 CANARY**: Playwright proposes `ship`, but an unparsed Markdown report can only floor the credibility axis at `canary` — a human has to read it. Swap in a **parsed** confirmed-clean `audit-test` emission (`--audit-test-json`) and the same green Playwright report yields **🟢 SHIP** — the only path to it: both axes propose `ship`, worst-wins agrees. A third case shows the Cypress-specific guard: a Cypress result reading `totalPassed:12, totalFailed:0` but with one test that failed-then-passed in `attempts[]` is **derived** as WARNED (Cypress emits no aggregate flaky count) and floors the decision at `canary` even paired with a confirmed-clean audit — a survived flake never launders into a clean green.

A fourth case shows the business-risk join: [`fixtures/trace-matrix.mixed.json`](../skills/gate/fixtures/trace-matrix.mixed.json) paired with [`fixtures/audit-test.confirmed-with-runs.json`](../skills/gate/fixtures/audit-test.confirmed-with-runs.json) (`--trace-json` + `--audit-test-json`, same Playwright report) resolves six requirements to **3 mutation-proven · 1 unverified · 1 hollow · 1 not-covered** — the hollow row names the exact test the matrix's own PASS gate would have called covered. The decision itself stays `🟡 CANARY` (the audit-test emission's own confirmed-hollow finding floors it there) — unaffected by whether `--trace-json` is present at all, which is the point.

## Where it fits

The last stage of the [orchestration map](./orchestration-map.md) — after [`sentinel`](./sentinel.md)'s QA read and after [`audit-test`](./audit-test.md)'s credibility audit, Gate is where their evidence becomes an advisory release decision. It owns the ship verdict; nothing upstream of it does.

## Anti-patterns

- **Treating `canary`/`hold` as a build-blocker.** The decision is advisory only — Gate doesn't abort a build or a deployment; that's on your CI or team to act on.
- **Reading a confidence number into the decision.** There is none, deliberately — the schema forbids a numeric field on the gate entry.
- **Recomputing or overriding the script's decision.** It's deterministic code; present it as returned.
- **Calling a self-signed bundle "Sigstore-verified" or "trusted publisher."** Signing proves integrity and continuity, never third-party identity.
- **Reading the business-risk join as a risk register, or its absence as "no risk."** It's a stateless join over whatever `--trace-json` + `--audit-test-json` were actually supplied — no matrix means no section, not a clean bill of health ([ADR-0045](./adr/0045-business-risk-coverage-is-a-join-not-a-register.md)).
