# Changelog

All notable changes to the kimbell-skills plugin are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Versioning is per-plugin. The authoritative version lives in
`.claude-plugin/plugin.json`; this changelog records what changed at each
version. A "release" is the version bump landing on the default branch, consumed by
users via a marketplace update; there's no separate publish step.

PRs append their change under `## [Unreleased]`, using the appropriate `Added` /
`Changed` / `Deprecated` / `Removed` / `Fixed` / `Security` subheading (see
`CONTRIBUTING.md`). `scripts/release.sh <version>` promotes those entries to a dated
release heading.

## [Unreleased]

### Added

- **`sentinel`: a live eval fixture for step 7's test↔code pairing, the Sacred-Path Override's load-bearing
  mechanism** — [#210](https://github.com/TzolkinB/skills/issues/210), narrowed from
  [#188](https://github.com/TzolkinB/skills/issues/188), harness mechanism decided in
  [ADR-0051](docs/adr/0051-live-eval-fixtures-materialize-as-a-permanent-git-ref.md). No tier exercised it for real: `--self-test` only
  proves the grader discriminates between two fixed recorded transcripts, and `--live` had nothing to run
  against — `fixture_files` was never read by the live path, and the prose `branch-scenario.md` fixture
  stated the pairing answer ("paired to `src/payments/refund.js`") directly, so feeding it to a live run
  would grade a copy-forward, not a derivation (the #81/#84 substring-not-entailment leak).
  `evals/run-eval.mjs` now supports a case-level `fixture_ref`: `--live` checks out that ref into the
  isolated worktree instead of always `HEAD`. `evals/cases/sentinel.json` points it at a new permanent
  branch, `fixture/sentinel-payments-refund` — a real, runnable `node --test` project with a genuinely
  mutation-survivable overmocked refund test (hand-verified: removing the refund-amount guard leaves it
  green) on the sacred `src/payments/**` path, plus non-sacred `src/reports/**` noise (loose assertion,
  hard-coded URL) so the "otherwise-tidy branch" softening pressure the rubric needs stays in the same
  fixture as the pairing mechanism. `branch-scenario.md` is now the spec that real branch was built from,
  not a stand-in fed to the live run. `must_surface` was re-checked against the real fixture and one claim
  that hard-coded a synthetic test count was loosened to stay accurate. Also documents `node:test`'s
  single-test command in `audit-test`'s `reference/run-one-test.md`, which this fixture needed and no
  case had exercised before.

- **`contract-guard`: Tier 1b (test-boundary validation) + per-operation drift-coverage reporting** —
  [#217](https://github.com/TzolkinB/skills/issues/217), decided in
  [ADR-0049](docs/adr/0049-contract-guard-test-boundary-validation-tier.md), backed by
  [EXPERIMENT-0049](docs/experiments/EXPERIMENT-0049-schema-permissiveness.md) (two arms, both
  Confirmed). ADR-0021's Tier 1 proposes response-schema validation at the *application's* fetch
  boundary — production code the stranded QA/SDET usually can't merge. Tier 1b is the complement: when
  the consumer reads untyped JSON and a published spec is available, `contract-guard` now also proposes
  validating the response **inside the suite** the SDET already owns, naming the stack-matching
  plugin (`cypress-schema-validator` / `playwright-schema-validator` — the current MIT packages, not
  the more-downloaded superseded `*-ajv-schema-validator` predecessors). Tier 1 keeps precedence;
  Tier 1b is proposed and never installed or run (ADR-0003/ADR-0010). The recommendation is qualified,
  not flat: EXPERIMENT-0049 mutation-tested 1,152 published response schemas and found the plugin
  catches retypes 98.6% of the time but misses drop/rename ~75% of the time wherever the operation's
  schema declares no `required` (62.6% of the corpus) — so every Tier 1b recommendation now carries a
  per-operation drift-coverage line, reading `required` on the resolved operation and stating
  categorically which of rename/drop/retype the validation would actually catch, naming the uncovered
  fields (no percentage, no global claim, ADR-0013). The same `required` read promotes the
  optional/nullable flag from a footnote to a first-class output. An unresolvable operation or
  malformed document degrades the coverage line to `no-spec`, the same honest-degrade path Tier 2
  already uses — never a fabricated coverage claim.

- **`gate`: producer-recorded SHA provenance — bind an execution/audit-test report to the commit it actually ran against** —
  [#177](https://github.com/TzolkinB/skills/issues/177), the mature closure
  [ADR-0043](docs/adr/0043-report-to-commit-provenance-over-git-timestamp.md) scoped over a git-timestamp
  cross-check that was considered and rejected (it doesn't even catch a report regenerated *now* for the wrong
  commit, and its only usable signal false-positives the ordinary test-then-commit local workflow). The
  Playwright/Cypress ingest adapters now record the git commit `gate.mjs` was run against — `GITHUB_SHA` (or an
  equivalent CI-supplied SHA; authoritative in CI) if set, else `git rev-parse HEAD` (the honest local signal) —
  plus a dirty-worktree flag from `git status --porcelain`, captured once per invocation, always on, no new
  flag. The `audit-test` emission carries its own version — `commitSha`/`dirty`, captured by the model at audit
  time (`gate-audit-test/v0.4`). `gate()` cross-checks the recorded `commitSha` against `--commit`: a mismatch
  caps an otherwise-`ship` proposal at `canary`, named in rationale prose only — **no new field on
  `gatePredicate.inputs[]`** (honesty guard #1/#3 unaffected, same discipline `--max-age` already holds itself
  to); a report with no recorded SHA is unaffected either way (necessary-not-sufficient, same as
  content-addressing and the examined/executed floors). A dirty worktree at capture time is disclosed in
  rationale, never a cap on its own — a mutation audit legitimately runs against uncommitted changes,
  and there is no single commit that fully describes evidence captured that way. Schema bumped to
  `gate-evidence-bundle/v0.9` (additive — `producer.commitSha`/`producer.dirty`); a bundle that never records
  either is byte-for-byte unaffected. Honest, not adversary-proof: a producer can lie about its own recorded
  SHA (but then the content-addressed input bytes wouldn't correspond to the real commit either) — this closes
  the *accidental* wrong-commit case, not a motivated adversary, consistent with Gate's advisory/self-signed
  posture everywhere else.

- **`gate`: `tea-to-trace-matrix.mjs` — convert a real TEA `trace` run into `--trace-json`, instead of hand-authoring it** —
  [#220](https://github.com/TzolkinB/skills/issues/220), decided in
  [ADR-0050](docs/adr/0050-tea-trace-converts-from-its-phase-1-json-never-its-markdown.md). #199 shipped the
  business-risk join but not its last mile: pointing it at a real TEA run meant writing the JSON by hand.
  Re-reading the `bmad-testarch-trace` source at **v1.21.4** (up from #199's v1.19.1; the §3 presence-gap
  claim re-verified **unchanged**) corrected the premise the issue was filed on — `e2e-trace-summary.json`
  and `gate-decision.json` carry aggregates and a gate signal only, and `traceability-matrix.md` carries
  rows but **no test titles**, while step-04 writes a **Phase-1 coverage-matrix JSON** carrying both, with
  its path recorded in the `.md` frontmatter as `tempCoverageMatrixPath`. The converter reads that JSON
  (directly, or by following the pointer from `--trace-md`) and never parses the Markdown body: Gate's join
  key is `<file>::<title>`, so a key transcribed from that body would be fabricated or guessed from a
  drifting line number, and a wrong key renders as plausible `unverified` coverage rather than as an error.
  TEA's five-valued coverage vocabulary flattens to Gate's three (`UNIT-ONLY`/`INTEGRATION-ONLY` →
  `PARTIAL`, never `FULL` — a conversion may not widen TEA's own presence call), keeping the verbatim value
  on each row as `teaCoverage`. Anything unconvertible **refuses**, names the row, and writes nothing
  (exit 2); the output is validated by importing `gate.mjs`'s own `parseTraceMatrix`, so it can never emit
  bytes Gate would reject. `--audit-test-json` cross-checks how many keys actually join *before* gating —
  TEA spells files as repo paths while an `audit-test` emission may use basenames, and a zero-match matrix
  yields a complete, honest-looking report in which every requirement reads `unverified`; `--test-key=basename`
  is the disclosed fix, refused when two directories share a spec basename **among the files TEA mapped** (an
  ambiguity that exists only on the `audit-test` side is undetectable by construction — which is why `path` is
  the default). **`gate.mjs` gains no gate logic** — only three `export` keywords, so the converter shares its
  constants instead of copying them; the conversion stays a separate script precisely so the gate never learns
  a tool's private format. The TEA-side fixture is built from TEA's source, not captured from an observed
  `trace` run: **Confirmed at source, Unexamined at runtime** (ADR-0050 Consequences).

- **`gate`: business-risk coverage — a stateless join over an external trace matrix + `audit-test`, not a risk register** —
  [#199](https://github.com/TzolkinB/skills/issues/199), builds
  [ADR-0045](docs/adr/0045-business-risk-coverage-is-a-join-not-a-register.md). TEA's `trace` workflow is
  presence-based — verified against its source (v1.19.1): a requirement is marked covered because a
  matching test *exists*, never because it would fail if the code broke, so a P0 requirement whose only
  test is hollow reads as covered and gates PASS
  ([`comparisons/tea.md`](docs/comparisons/tea.md) §3). A new optional `--trace-json` reads a
  requirement→test matrix in Gate's own minimal shape
  ([`gate-trace-matrix/v0`](skills/gate/schema/trace-matrix.v0.schema.json), not TEA's internal format)
  and joins it against `--audit-test-json`'s `runs[]` on test identity, resolving each requirement to
  **mutation-proven** (every mapped test execution-confirmed solid), **unverified** (mapped, no
  execution-confirmed evidence), **hollow** (a mapped test survived a mutation — the exact gap this
  closes), or **not-covered** (the matrix already says so). Deliberately kept out of `gate()`'s decision
  loop — the entry is appended to the bundle only *after* the ship/canary/hold decision is computed, so
  it can never become a decision input and a bundle with no `--trace-json` is byte-for-byte unaffected
  (schema bumped to `gate-evidence-bundle/v0.8`, additive). A malformed matrix is **rejected**, the same
  distinct-from-absent treatment `--audit-test-json` gets. TEA (`bmad-testarch-trace`) is MIT-licensed
  (BMad Code, LLC) — confirmed at source; this join reads its own independently-defined schema, not any
  of TEA's code.
- **`debug-test`: Step 4.5 classifies the heal instead of trusting the healer's green** —
  [#190](https://github.com/TzolkinB/skills/issues/190), write side of
  [ADR-0047](docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2. The old branch
  logic was "healer passes → done," which collapsed a locator touch-up and *an assertion rewritten to
  match a regression* into the same outcome — the self-healer failure mode
  [ADR-0017](docs/adr/0017-audit-test-baseline-lock-suspected.md) exists to catch, and one a mutation
  can never see (the green-locked assertion still kills mutations). Step 4.5 now `git diff`s the test
  file after a healer pass and buckets it, in
  [`skills/debug-test/reference/heal-classification.md`](skills/debug-test/reference/heal-classification.md):
  **selector / timeout / wait only** clears on the diff alone (no mutation spent on the low-risk common
  case), **an expected-value literal changed** routes to `audit-test`'s baseline-lock check via the
  `Skill` tool — the invocation carries the assertion co-change itself and names the test as a triage
  suspect, because the healer's edit is uncommitted and `audit-test` resolves `--changed` from committed
  history — with the verdict reported inline before "done", and **setup / fixture / flow changed**
  is never auto-cleared — that heals by changing the story, not the mechanics, so it shows the diff and
  requires human review. Mixed diffs are worst-wins (`flow-data` > `assertion-value` > `locator`), and an
  assertion *removed* counts as `flow-data`, not as a value change. Classification reads the diff, never
  the healer's account of itself.
- **`debug-test`: a proposed `Healed-by:` / `Heal-bucket:` commit-trailer block** — the durable half of
  #190. Step 4.5 runs at exactly the moment a commit is being made, so it emits the trailers that make
  the classification readable later, with the three buckets as the single vocabulary
  [#194](https://github.com/TzolkinB/skills/issues/194) will read (`locator` | `assertion-value` |
  `flow-data`). **All three buckets get a trailer, `locator` included** — "the same spec healed four
  times for a locator" is precisely the repeat-heal pattern the cheap rows make visible. **Proposed,
  never applied:** `debug-test` does not create or amend a commit and writes no store of its own — git
  is the ledger. The accepted limit is named rather than engineered around: a heal that is never
  committed leaves no record.
- **`evals`: two `debug-test` heal-classification cases** — `heal-classification-assertion-value` (the
  `toHaveCount(12)` → `toHaveCount(10)` green-lock must reach the baseline-lock check, not "done") and
  `heal-classification-locator-cheap-path` (the cheap bucket must stay cheap *and* still emit a trailer).
  Their negative samples record the two ways this goes wrong: reporting the healer's pass as done, and
  suppressing the locator trailer as noise while spending a mutation on it.
- **`debug-test`: Step 4.6 reads git history for a repeat-heal pattern** — [#194](https://github.com/TzolkinB/skills/issues/194),
  read side of [ADR-0047](docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2. Right
  after Step 4.5 classifies a heal, this step reads the test file's own history —
  `git log --follow` filtered on the `Heal-bucket` trailer #190 writes — and flags 🔁 **repeat-heal**
  when the same bucket shows up 3+ times in the last 90 days (this heal included), naming the count,
  bucket, and what each occurrence touched. Nothing new is written or stored:
  [`skills/debug-test/reference/repeat-heal.md`](skills/debug-test/reference/repeat-heal.md) computes it
  fresh from git every time. The trailer-coverage read is graded on the two-rung ladder ADR-0047 itself
  specifies, nothing added: **bucket-accurate** (every relevant commit carries the trailer) or
  **churn-only** (even one missing trailer degrades the whole read to a plain, bucket-less file-edit
  count, labelled as the weaker signal — no intermediate "mostly-bucketed" credit). An empty or
  trailer-less read is never reported as "no repeats" — it always says what history was actually
  available. **Reads the shared trunk, not just the local branch:** the `git log` starts from the
  union of `origin/<default-branch>` (resolved dynamically via `git symbolic-ref`, never hardcoded as
  `main`) and `HEAD`, so a teammate's already-merged heal isn't invisible on an unrebased branch, and
  a heal already committed on the current branch isn't invisible either. Falls back to `HEAD` alone,
  stated explicitly, when there's no `origin` remote; flags a shallow clone rather than letting a
  truncated history read as clean.
- **`evals`: two `debug-test` repeat-heal cases** — `repeat-heal-trailer-based` (three same-bucket heals,
  all trailer-tagged, must surface as a named 🔁 finding rather than disappear because each was the cheap
  bucket) and `repeat-heal-churn-fallback` (an all-trailerless history must degrade to the weaker churn
  count, not read as "clean"). Their negative samples record the two ways this goes wrong: reporting a
  matching history as "no repeats found," and treating an untrailered history as clean rather than
  unreadable.
- **A shared `--digest` evidence card across the seven judgment skills** (`test-plan`, `qa-review`,
  `coverage-review`, `audit-test`, `prune-tests`, `threat-model`, `sentinel`) — [#193](https://github.com/TzolkinB/skills/issues/193),
  [ADR-0048](docs/adr/0048-shared-digest-card-and-inline-next-footers.md). `--digest` replaces the full
  report with a header line carrying scope + tally and at most three cards: **Risk** (one line) /
  **Evidence** (the exact observation — `file:line`, the literal assertion, the command and its exit code)
  / **Action** (one concrete step) / **Confidence** (`Confirmed` | `Likely` | `Unexamined`). It generalizes
  the four-field shape `audit-test`'s single-test entry already had, and it is defined **once** in
  [`skills/shared/digest-format.md`](skills/shared/digest-format.md) — each skill's Output Format links it
  rather than restating it. The load-bearing rule: **a digest may only say less than the report it
  replaces, and never upgrades a label.** The shared doc fixes a confidence ceiling per skill —
  `Likely` for the four that execute nothing, split for `coverage-review` (`Confirmed` only for
  line/branch facts from a *fresh* instrumentation report), verdict-mapped for `audit-test`, and
  worst-wins for `sentinel` — so seven skills can't each invent their own answer to "how well is this
  known."
- **A one-line `Next:` footer on every judgment report** (full *and* `--digest`), tabulated in
  [`skills/shared/next-footers.md`](skills/shared/next-footers.md) and derived from `ask-sentinel` —
  its routing signals plus its intended-flow diagram. Not a copy of them: the router is keyed by
  *situation*, a footer by *result* (a 🔴 `audit-test` routes back into a re-run after the fix; a 🟡
  routes to making the code runnable, or to `/audit-orchestrator` if it can't be). Generalizes the
  inline hand-off `prune-tests` already shipped as `Deferred to audit-test`, so the next step arrives
  with the finding instead of behind a second `/ask-sentinel` lookup, with `ask-sentinel` authoritative
  where the two ever name different destinations. `debug-test`, `e2e-impact`,
  `contract-guard`, `bug-report`, `audit-orchestrator`, and `gate` are named as out of scope for now
  rather than silently skipped.
- **`evals`: an `audit-test --digest` case** (`digest-honest-label`) asserting the digest keeps the four
  fields, the footer, and the label the full run earned; its negative sample is the failure the flag
  invites — the full report emitted unchanged, with no card, no footer, and evidence dropped to a
  characterization.
- **`coverage-review`: an "Escalate to audit-test" section** — [#191](https://github.com/TzolkinB/skills/issues/191).
  Turns the Loose Assertions findings it already produces into named `/audit-test` candidates, one line
  each: the assertion, why it's worth a mutation, and the invocation. Copies `prune-tests`' existing
  `Deferred to audit-test` hand-off pattern rather than adding new analysis, and is omitted entirely when
  there are no loose or incidental assertions to escalate — coverage-review still never runs a mutation
  itself, the section only names the candidate.
- **`prune-tests`: `--audit-evidence=<path>` ingests an `audit-test` emission to close the Hand-off loop**
  — [#192](https://github.com/TzolkinB/skills/issues/192). Reads a prior `/audit-test --emit-json=<path>`
  run and promotes a `Deferred to audit-test` entry to a new **Confirmed Prune (mutation-backed)**
  category — the highest confidence tier this skill can carry — when the evidence's `runs[]` trace names
  that exact test as `confirmedHollow`. Deliberately narrow: it matches by test *identity*, never by
  count alone, so `likelyHollow` and `baseline-lock` verdicts never promote (they never get a `runs[]`
  record to match against in the first place), a missing evidence file leaves the Deferred list
  unchanged, and a schema-version mismatch is ignored rather than guessed at. Still proposal-only, still
  gated behind `--apply`.

### Fixed

- **`evals/changed.mjs` missed the shared-contract surface.** A `skills/shared/**` edit changes seven
  skills' output but matches no `skills/<name>/SKILL.md` path, so change detection would have selected
  **zero** evals for it. It now fans a shared-contract change out to every skill with a case, the same
  way a harness-core change does, with a self-test row proving it.
- **`evals/cases/coverage-review.json`: the `must_not` anchor on bare `"mutation"` was over-broad.** It
  fired on a faithful run that merely *names* `/audit-test` as the next step — the exact hand-off the new
  footer makes — rather than on one that actually ran a mutation. Narrowed to the doing-it phrasings
  (`applied the mutation`, `ran the mutation`, `mutation survived`, …) and the rubric now says naming the
  escalation is allowed. The pass sample carries the footer, so the case guards the distinction instead of
  tripping over it.

## [1.0.0] - 2026-07-27

### Added

- **`gate.mjs --max-age=<minutes>`: opt-in report-freshness check** (hostile-review finding #3,
  2026-07-25, [ADR-0042](docs/adr/0042-gate-rejected-credibility-state-and-freshness-floor.md)). Compares an
  execution entry's recorded `producer.startedOn` (Playwright's `stats.startTime` / Cypress's
  `startedTestsAt`, already captured but never read) against the bundle's `producedOn`; a report claiming to
  have started longer ago than the window caps at `canary` instead of `ship-baseline`, with the staleness
  named in the rationale. **No default**: unlike the examined/executed floors there's no universally-safe
  staleness threshold, so the check is off unless requested. An entry with no recorded start time is
  unaffected. Closes the "a stale leftover `results.json` from an earlier run gates cleanly" gap for the
  common case; doesn't (yet) bind a report to the specific `--commit` named on the bundle, that remains open
  (see `gate/SKILL.md`'s "Report freshness" note, and `docs/roadmap.md` item 3).

### Fixed

- **`gate/SKILL.md` now requires stating plainly, every run, that the Gate ingested existing evidence and
  did not run the suite or launch a browser.** Found via a live-eval pass (`evals/run-eval.mjs --live`,
  freshly repaired — see below): the disclosure was documented as a background principle ("Ingests, never
  executes") but never mandated as a line the skill actually has to say, and neither Output Format reference
  example modeled it, so real invocations frequently omitted it even though the recorded eval sample did
  say it. Step 3 now requires the line explicitly, and both reference outputs model it; verified by hand
  against a live run.
- **`evals/run-eval.mjs --live` actually runs now** — four blocking bugs fixed: `REPO_ROOT` resolved outside
  the repo entirely (every worktree creation failed instantly); the `{prompt}` template substitution was
  unquoted, so a multi-word invoke got word-split by the shell and `-p` only ever received the first token;
  two cases' embedded `$(cat fixture)` shell substitution needed resolving separately once that was quoted;
  and headless `claude -p` had no permission bypass, so a mutation-based skill (`audit-test`) silently
  stalled on an Edit approval prompt it could never answer. Also now passes `--plugin-dir` at the isolated
  worktree it builds — without it, `--live` silently graded whatever `kimbell-skills` build happened to be
  globally installed, never the worktree's own checkout, making the isolation cosmetic.

- **`gate.mjs` persists a rejected `audit-test-json` emission as its own distinct state, not identically to
  `absent`** (closes hostile-review finding #2, 2026-07-25, [ADR-0042](docs/adr/0042-gate-rejected-credibility-state-and-freshness-floor.md)).
  A malformed or arithmetically-inconsistent emission, the single strongest signal Gate can produce about a
  broken or dishonest producer, previously only reached a stderr warning; the bundle and rendered report then
  read exactly as if nothing had been sent at all. `auditTestRejectedEntry()` now persists a
  `{ rejected: true, reason }` evidence entry, content-addressed into the bundle's subjects like any other
  ingested input; `gate()` gives it its own rationale line and a `rejected: true` flag on the gate predicate's
  input (still floors at `canary`, the decision is unchanged, honesty guard #1 intact); `renderReport()` shows
  `rejected`, not `absent`, in the Inputs list. `schemaVersion` bumps `v0.6` to `v0.7` (additive: a bundle that
  never uses `rejected` validates identically); the committed signed fixture is regenerated under v0.7. Proven
  via a real CLI subprocess (not just the underlying pure functions), matching the existing `--certify`
  self-test's shell-out pattern.

- **`gate.mjs` no longer crashes on a malformed execution report or a missing credibility-evidence path**
  (closes hostile-review finding #4, 2026-07-25, the one flagged as shouldn't wait). A truncated/unparseable
  Playwright or Cypress JSON threw an uncaught `SyntaxError`; a missing `--audit-test`/`--audit-test-json`
  path threw `ENOENT`, both exited 1 with a raw stack trace despite the file's own "advisory, NEVER fails the
  build" claim. `readJsonInputForCli` now returns a `readError` instead of throwing; an unreadable execution
  report degrades to an `EMPTY` entry (the same, already-understood "unrun report is not a pass" path, #111),
  capping the decision at `hold` rather than crashing. A missing audit-test path warns and falls back to
  whatever else is available (or absent). Exit code stays 0 in both cases; `--verify` and internal
  bundle-shape-validation failures remain the only paths that exit non-zero. Proven via a real CLI subprocess
  spawn against a truncated fixture and a nonexistent path, not just a unit test of the parser.

- **`gate.mjs`'s rendered report now surfaces whether a `ship` verdict's run trace was actually cross-checked**
  (closes hostile-review finding #5, 2026-07-25). `runsVerified` was computed at ingest
  (`auditTestParsedEntry`, #142/ADR-0037 §3) but never read by `renderReport`, so two `ship` verdicts of
  materially different evidential weight (a per-test run trace cross-checked vs a bare tally) printed
  identically apart from an input digest. The `audit-test` line in "Inputs, worst-wins" now states either
  `(N run records cross-checked)` or `(no run trace carried, tally unverified against per-test records)`.
  Pure rendering change: reads the audit-test evidence entry's own metrics; the gate predicate and the
  decision itself are untouched (honesty guard #3 intact).

- **`gate.mjs` widens the DSSE signed scope to evidence entries + `producedOn`/`schemaVersion`** (closes
  #158, ChatGPT Tier 2.3 critique finding F5, [ADR-0040](docs/adr/0040-widen-gate-signed-scope-to-entries.md),
  narrowly amends [ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §1). Previously the signature covered
  only the gate decision and the bundle's content-addressed *input* digests (#139/ADR-0037 §2): a signed
  bundle's *displayed* evidence entry (a Playwright/Cypress/`audit-test` verdict, e.g. flipping `PASSED` to
  `FAILED`), plus `producedOn` and `schemaVersion`, could be edited after signing with `--verify` still
  exiting 0. `gateStatementPayload` now also digest-binds each parsed evidence entry (`entrySubjects`, one
  subject per non-gate entry, digest-bind-entries rather than sign-the-whole-bundle so entries ride in as
  content-addressed *subjects*, integrity, never endorsement, and the DSSE payload stays a valid in-toto
  Statement) and folds `producedOn`/`schemaVersion` into the signed Statement's header (never into the gate
  *predicate*, honesty guard #3 stays untouched). Adds a small zero-dep `canonicalize()` (recursive key-sort,
  not JCS) so signing/verification are stable across formatting. `schemaVersion` bumps `v0.5` to `v0.6`
  (minor, additive; `validateBundle` already hard-rejects any off-version bundle, so this is
  regenerate-not-migrate); binding it into the signed payload also makes the bundle downgrade-resistant. The
  self-test reproduces the issue's own exploit as a tamper row (now caught), plus `producedOn`/`schemaVersion`
  tamper cases; the committed signed fixture is regenerated under v0.6. README/`gate/SKILL.md` now say the
  **whole bundle**, not just the decision and input digests, is tamper-evident when signed.

- **`gate.mjs` guards execution-completeness, a near-all-skipped suite no longer reads `PASSED` → `ship`**
  (closes #157, ChatGPT Tier 2.3 critique finding F9). `deriveResult`/`deriveCypressResult` computed `PASSED`
  from `expected+unexpected+flaky` (Playwright) / `totalPassed+totalFailed` (Cypress) alone, excluding
  skipped/pending from the denominator, so a discovery/filter/config mistake that ran 1 of 1000 tests still
  read `PASSED`, and paired with a confirmed `audit-test` verdict, reached `ship` with the skip count buried
  in the bundle metrics and absent from the terminal rationale. Adds an **executed-floor** (default 50%,
  `--executed-floor` overridable down to a 25% minimum), mirroring the existing examined-floor (#127,
  ADR-0035): the gate now states the executed-vs-discovered split in its rationale for every execution suite,
  and caps a `PASSED` suite at `canary` instead of proposing `ship-baseline` when skips dominate. Applies to
  both Playwright (`skipped`) and Cypress (`totalPending`/`totalSkipped`). No new field on the gate predicate
  or bundle schema, the capped state is detectable from the existing `result`/`proposed` fields alone, so
  honesty guard #3 and the schema version are both unaffected. `README.md` and `gate/SKILL.md`'s "every E2E
  suite is green" wording is reconciled with the new completeness semantics; the issue's own
  `expected:1, skipped:999` exploit is pinned as a self-test regression row, alongside a Cypress analog and
  the floor override/clamp checks.

- **`gate.mjs` hardens the `audit-test` self-report contract: exact outcome accounting + run-trace
  exit-signal/uniqueness** (closes #155, ChatGPT Tier 2.3 critique findings F1 + F3,
  [ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §3 amended). `parseAuditEmission` now enforces
  `Σ(outcomes) === deepAudited` (was `≤`), so an emission claiming deep audits with no recorded outcome,
  e.g. `{deepAudited:100, confirmedSolid:1, rest:0}`, is rejected instead of deriving `confirmed`. The
  optional `runs[]` cross-check gains two guards: a record's `exitCode` must agree with its outcome
  (`killed ⇒ exitCode ≠ 0`, `survived ⇒ exitCode === 0`), and each `(test, mutation, command)` triple must be
  distinct (duplicated records can no longer pad a `killed` count). All three degrade a violating emission to
  opaque, never a silent upgrade, and none opens a new path to `ship`. Honesty guard #3 intact (no numeric
  field enters the gate predicate). `audit-test/SKILL.md` and the emission JSON schema document the new
  requirements; the exact F1/F3 exploit inputs are pinned as regression rows.

- **`audit-test`'s 🟢 verdict no longer has a reasoning-only escape hatch, it now requires an executed,
  failing mutation** (closes #156, ChatGPT Tier 2.3 critique finding F2,
  [ADR-0039](docs/adr/0039-audit-test-green-requires-execution.md)). `SKILL.md:50` and `:76` both carried
  "(or no plausible green-surviving change exists)" as an alternate path to 🟢/`confirmedSolid`, the exact
  `emit-json` count that lets `/gate` reach `ship`. That let an *inability to devise a mutation* (pure
  reasoning) count as execution-confirmed, when it's closer to unexamined/hollow than solid. Both clauses are
  cut: 🟢 now requires a mutation that actually ran and failed; reasoning-only outcomes route to 🟡 Likely or
  Unexamined. **Behavior change**: some runs that previously tallied `confirmedSolid` will now tally
  `likelyHollow` or `unexamined` instead. No schema change; the `runs[]` contract already required a real
  command/mutation/exit-code per 🟢 and had no matching gap.

- **`gate.mjs --verify` now shape-validates the bundle before trusting the signature, and reports the narrow
  scope it actually vouches for** (post-#141 signature-verification hardening). Two gaps in the DSSE verify
  path, both fail-*closed* (neither could forge a decision): (1) `--verify` called `verifyGateBundle` without
  first running `validateBundle`, and `verifyGateBundle` binds to the *first* gate entry it finds, so a
  structurally-invalid bundle (e.g. a duplicate gate entry) could print "✓ signature valid" despite violating
  the contract. `--verify` now runs `validateBundle` first and refuses to vouch for a malformed bundle.
  (2) The signature deliberately covers only the gate Statement (the decision + the content-addressed input
  digests), never `producedOn`/`schemaVersion`/the ingested evidence entries ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md)
  §1), but a bare "✓ valid" invited reading it as "the whole file is authentic." `verifyGateBundle` now
  returns an `attested` object (the decision + subject names), the `--verify` message states that scope
  explicitly, and `skills/gate/SKILL.md` spells out what is inside vs. outside the signature. Self-test gains
  rows for the attested-scope report and the duplicate-gate shape guard.

- **`evals/changed.mjs`: `REPO_ROOT` resolved one directory too high, so the change-detection gate ran every
  git call outside the repo and always silently reported zero affected skills** (closes #148, found while
  implementing #140). `REPO_ROOT` was a hand-rolled `resolve(EVALS_ROOT, '../..')`, one `..` too many now that
  `evals/` sits directly under the repo root (likely a leftover from before
  [ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)'s flatten). Every `git` call ran with
  that wrong `cwd`, failed (not a git repo), and was silently swallowed by a `status !== 0` fallback written
  for a different, legitimately-benign case (an unfetched base ref), so `changedFiles()` was always empty and
  `node evals/changed.mjs` always printed "nothing to run," confirmed both locally and on a real PR's `--gate`
  CI run. Fixed three ways: (1) `REPO_ROOT` now resolves via `git rev-parse --show-toplevel` (run with
  `cwd=EVALS_ROOT`, always inside the repo regardless of nesting depth) instead of a hardcoded relative path;
  (2) the shared `git()` helper splits into `gitStrict()` (throws on any unexpected failure) and
  `gitAllowMissingRef()` (the one call, the committed-diff leg against a possibly-unfetched `baseRef`, where a
  failure is genuinely expected and benign), so a real error can no longer be conflated with and swallowed as
  the benign case; (3) `--self-test` gains a real git-integration check (`REPO_ROOT` contains `.git` and
  `evals/changed.mjs`; a trivial `changedFiles('HEAD')` call must not throw) alongside the existing
  pure-classifier check, since the previous self-test only ever fed a synthetic file list and structurally
  could not have caught this. Verified: `node evals/changed.mjs --self-test` green (mapping, harness-core
  fan-out, repo-root, git-integration all `true`); `node evals/changed.mjs --base=<a pre-#140 commit>` now
  correctly reports `audit-test` as affected and runs its self-test + lint, where it previously reported zero
  affected skills for the same diff.

### Changed

- **Gate docs honesty pass, build-coupled wording for DSSE signing**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) Decision 4, capability A, part of #141). Docs-only,
  committed separately from the signing capability's code (same PR, separate commit, per ADR-0037's rule that
  build-coupled wording must not land before its capability). `skills/gate/SKILL.md` now says a bundle is a
  "DSSE-signed in-toto attestation" **only** when a signing key was supplied; the unsigned default keeps
  saying "in-toto-shaped, not a signed attestation," ADR-0032's hedge, verbatim. Adds a "sign the bundle"
  usage block (`--gen-key`/`--sign-key`/`--verify`), a Notes bullet on the self-signed scope (proves integrity
  + continuity, never third-party identity, explicitly not Sigstore, never "verified identity" or "trusted
  publisher"), and a `signed:`/`unsigned:` line in both Output Format examples. `README.md`'s `/gate` bullet
  gets one added sentence noting the optional signing. Addresses finding 5 of
  [`references/critique2-chatgpt.md`](references/critique2-chatgpt.md).

- **Gate docs honesty pass, build-independent wording batch**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) Decision 4, closes #138). Docs-only, no code or schema
  changes: `skills/gate/SKILL.md` and `README.md` now spell out the worst-wins rule in plain English (any
  `hold` → `hold`; else any `canary` → `canary`; else `ship`), state plainly that the Gate is advisory only,
  it does not abort the build and a `hold`/`canary` does not by itself stop a deployment, and scope the
  "deterministic" claim to the gate *decision* step, not the upstream Playwright/Cypress/`audit-test`
  evidence-gathering that fills the bundle. `skills/gate/SKILL.md` also gets a naming note recording that
  pre-rename ADRs say "Witness" by design ([ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md))
  and are not being rewritten. `README.md`'s Contributing & Support section now opens with an explicit
  **Status: prototype** line. Addresses findings 3, 7, 8, 9, 10 of
  [`references/critique2-chatgpt.md`](references/critique2-chatgpt.md).

- **`ask-sentinel`/`audit-orchestrator` routing-evidence label: `Proven` → `Confirmed`**
  ([ADR-0036](docs/adr/0036-ask-sentinel-audit-orchestrator-confirmed-rename.md), closes #131). The residual
  scope ADR-0034/#126 deliberately deferred: these two skills apply the same `Proven`/`Likely`/`Unexamined`
  ternary ([ADR-0013](docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md)) to grade a *routing
  recommendation*'s evidence, not `audit-test`'s per-test mutation verdict, but the same headline-word risk
  applied, and leaving it unrenamed after #126 shipped would have been a fresh inconsistency (schema says
  `confirmed`, the skills routing to/from it still said `proven`). Same word swap, same scope discipline as
  ADR-0034 (ordinary-verb "proven"/"provenance" untouched): `skills/ask-sentinel/SKILL.md`,
  `skills/audit-orchestrator/SKILL.md`, `docs/orchestration-map.md` (plus one stray lowercase
  `audit-test proven/likely/unexamined labels` mention on the same page, the #126 axis, found while sweeping
  this one), `evals/cases/audit-orchestrator.json`, the affected `evals/samples/ask-sentinel.*` /
  `evals/samples/audit-orchestrator.*` samples, and `fixtures/audit-orchestrator/expected-findings.md` (the
  rubric backing the touched eval case). No schema-version bump, prose/eval-fixture only, no JSON field.
  Historical ADRs, CHANGELOG, and the locked `references/witness-ingestible-evidence-audit.md` contract audit
  stay untouched (ADR-0034 §5 precedent). Verified: both skills' `run-eval.mjs --self-test` green
  (pass-samples pass, negative-samples still correctly fail), `evals/lint.mjs` clean on both `SKILL.md`
  files, `evals/lint.mjs`/`evals/changed.mjs` self-tests green, repo-wide grep confirms no remaining
  routing-evidence `Proven` mentions outside the excluded historical set.

### Added

- **Gate: prove certification mode's `ship`-vs-`canary` split at the golden self-test seam, and close the
  Gate-side "(forthcoming)" reference** (closes #171, the build half of
  [ADR-0038](docs/adr/0038-gate-trust-boundary-and-examined-floor-population.md) Decision 1(b); design + spec
  landed in #170/ADR-0041). `audit-test`'s new opt-in `--certify` batch mode
  (`skills/audit-test/reference/batch-mode.md`) needs **no** Gate code change, a certification run just
  produces a bigger `deepAudited` on the same suite, which the existing examined-floor logic (#127, ADR-0035)
  already handles. `gate.mjs --self-test` now proves that at the seam instead of asserting it: two new
  fixtures on the **same** `audited` population, `fixtures/audit-test.certify-floor-clearing.json` (50%
  deep-audited → `ship`) and `fixtures/audit-test.diagnostic-below-floor.json` (suspects-only, ~17% →
  `canary`), plus an honesty row (ADR-0041's "surprising call") proving a floor-clearing certify tally that
  still carries one sampled suspect's `likelyHollow` derives `WARNED` → `canary`, never `ship`, certification
  can never launder a real suspicion signal into a clean count. A second self-test seam runs the **actual
  documented shell one-liner** from `batch-mode.md` (the fixed-seed sha256 hash-and-sort draw) against a
  checked-in `triaged-ids` fixture and asserts its output equals a checked-in golden ordering, not a JS
  re-implementation, which would risk exactly the drift this project exists to catch, guarding the
  cross-machine reproducibility claim against the real artifact an agent runs. Also drops the "(forthcoming)"
  hedge from the below-examined-floor report line now that `--certify` exists. No schema or Gate decision
  logic changed; `AUDIT_EMISSION_SCHEMA` stays `gate-audit-test/v0.3`.

- **Gate: cross-check the `audit-test` tally against its run trace**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §3, capability B2, closes #142). `gate.mjs` now parses
  the optional `runs[]` per-test run trace a `gate-audit-test/v0.3` emission may carry (added by #140) and
  cross-checks it against the tally it rides alongside: `confirmedSolid` must equal the count of `killed`
  records, `confirmedHollow` the count of `survived` records, and `runs.length` must never exceed
  `deepAudited`. A tally that disagrees with its own trace, or a malformed run record, is rejected the same
  way an arithmetically-impossible tally is today: the whole emission degrades to the opaque report or
  absence, never a silent upgrade. An emission with no `runs[]` is unaffected (purely additive). When a trace
  passes the cross-check, its record count surfaces as a `runsVerified` metric on the audit-test *evidence*
  entry, never on the gate predicate, so honesty guard #3 (no numeric field in the gate predicate) stays
  intact. Ship-eligibility is unchanged: this hardens the evidence behind a `confirmed` label, it does not
  open a new path to `ship`. `AUDIT_EMISSION_SCHEMA` moves to the already-published exact-match string
  `gate-audit-test/v0.3` (the old `v0.2` string is no longer accepted, per the existing exact-match-not-a-prefix
  rule, a bogus/stale version degrades the emission rather than being silently honored). No bundle
  `schemaVersion` bump: same entry shape, only the audit-test entry's own `metrics` array gains an optional
  item. New fixture `skills/gate/fixtures/audit-test.confirmed-with-runs.json`. Verified: golden self-test
  gains rows for a consistent trace, a killed-count mismatch, a survived-count mismatch, an over-count, a
  malformed run record, a non-array `runs`, the `runsVerified` metric appearing/not-appearing, the gate
  predicate staying number-free with it present, and an unchanged ship-eligibility check, all green. The docs
  commit softening the audit-test self-report caveat to state the new cross-check property lands separately
  (ADR-0037 Decision 4).

- **`audit-test`: optional per-test run trace (`runs[]`) in `--emit-json`**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §3, capability B2 prefactor, closes #140). The
  `--emit-json` emission gains an optional `runs[]` array, one record per test a mutation was actually
  **executed** against: `test` (identifier), `mutation` (what changed), `command` (the exact single-test
  command run), `outcome` (`"killed"` | `"survived"`), and `exitCode`. Only the execution-confirmed subset
  gets a record: every 🟢 confirmed-solid and 🔴 confirmed-hollow verdict; 🟡 Likely (env not runnable) and
  ⚠️ Baseline-lock tests stay reasoned-only and carry no record, and Unexamined tests never had a mutation
  proposed at all. Docs-only/schema-only change: `audit-test` is model-driven prose with no execution code of
  its own, so this is `skills/audit-test/SKILL.md` instructing the run trace and
  `skills/gate/schema/audit-test-emission.v0.schema.json` shaping it, nothing here validates or cross-checks
  the trace yet (that's Gate's job, #142, the T5 follow-up). The emission schema takes an additive minor bump,
  `gate-audit-test/v0.2` → `v0.3` (`runs[]` optional; an emission with no `runs[]` is unchanged from v0.2 and
  still behaves exactly as today). Verified: the `audit-test` eval gains a case grading honest trace
  reporting, a faithful sample whose `runs[]` matches what the transcript says happened, and a negative
  sample that fabricates a record for a test that was never executed, which the eval must fail.

- **Gate: DSSE-sign the gate Statement, opt-in, self-signed ed25519**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §1, capability A, closes #141). With a signing key,
  `gate.mjs` now emits a [DSSE](https://github.com/secure-systems-lab/dsse) envelope over the gate Statement:
  `payloadType` is the in-toto JSON media type, `payload` is base64 of `{_type, predicateType, subject,
  predicate}` reconstructed from the bundle's `subject[]` (pr-head + the #139 input digests) and the gate
  entry's `predicate`, and `signatures[].sig` is an ed25519 signature over the DSSE pre-authentication encoding
  (not the raw JSON) with `keyid` = sha256 of the public key. Pairing with #139 means the signature covers the
  content-addressed inputs, not just the decision. With no key, the bundle keeps the same unsigned *shape* it
  had before this capability (no new required field, `dsseEnvelope` simply absent), signing is strictly
  additive and opt-in; only `schemaVersion` itself moves, the same additive-minor-bump treatment every prior
  Gate capability has gotten. New pure, exported primitives,
  `dsseSign`/`dsseVerify`/`keyidFromPublicKey`/`signGateBundle`/`verifyGateBundle`, take key material and
  bytes/objects as arguments and never touch the filesystem; key loading and generation live in the CLI
  wrapper only (`--sign-key=<path>` to sign, `--gen-key=<prefix>` to write a fresh PKCS8/SPKI PEM pair,
  `--verify --bundle=<path> --pubkey=<path>` to check an existing bundle). `verifyGateBundle` checks the
  envelope's signature AND that its signed payload still matches the bundle's current `subject`/gate
  `predicate`, so editing the decision or an input digest after signing while leaving a stale envelope in
  place is caught, not just a raw signature mismatch. Zero new dependency (`node:crypto`'s built-in ed25519).
  `schemaVersion` takes an additive minor bump, `gate-evidence-bundle/v0.4` → `v0.5` (the optional top-level
  `dsseEnvelope`, every existing field and an unsigned bundle's shape are unchanged). The terminal report now
  states a bundle's signed/unsigned status plainly. Verified: golden self-test gains keyid-derivation,
  sign→verify round-trip, wrong-key-fail, tampered-payload-fail, decision-tampered-after-signing-fail, and
  input-digest-tampered-after-signing-fail rows, plus an end-to-end check against a newly committed fixture
  (`skills/gate/fixtures/gate-bundle.signed.json` + its demo keypair, fixture-only, not a secret), all
  offline, in-memory keys. Self-signed ed25519 proves integrity + continuity, never third-party identity, not
  Sigstore; the docs commit updating `SKILL.md`'s wording to say "signed"/"attestation" only for signed
  bundles lands separately (ADR-0037 Decision 4).

- **Gate: content-address the inputs, sha256 into the gate Statement subject**
  ([ADR-0037](docs/adr/0037-gate-evidence-integrity.md) §2, capability B1, closes #139). Every ingested input
  file (the Playwright JSON, the Cypress JSON, the `audit-test` emission and/or report) is now sha256-digested
  and recorded as a subject of the gate Statement's `subject[]`, alongside the existing `pr-head` git-commit
  subject, so swapping or editing an input after the bundle is produced means its recorded digest no longer
  matches: the decision is now cryptographically bound to the exact bytes it ingested, not a typed commit
  string. Digests are lowercase hex **strings** living in `subject`, never in the gate **predicate**, honesty
  guard #3 (no numeric field in the gate predicate) is unaffected. `assembleBundle` gains an
  `inputs: [{name, bytes}]` parameter; the hashing (`sha256Hex`, `inputSubjects`) is pure, taking bytes as
  arguments, all file I/O stays in the CLI wrapper (`main()`), keeping the new behavior exercisable offline in
  the self-test. The terminal report gains an "Input digests" section so a reader can see the binding.
  `schemaVersion` takes an additive minor bump, `gate-evidence-bundle/v0.3` → `v0.4` (`resourceDescriptor`'s
  shape is unchanged, so an old bundle with only the `pr-head` subject still validates). Verified: golden
  self-test gains known-bytes→known-digest, one-subject-per-input, and swap-changes-digest rows
  (function-level and bundle-level); CLI smoke-tested, hashing a fixture reproduces its real `shasum -a 256`,
  and editing a Playwright report's bytes changes the recorded digest end to end.

- **Gate: coverage-aware ship gate, the examined-floor** ([ADR-0035](docs/adr/0035-gate-examined-floor.md),
  closes #127). A confirmed-clean `audit-test` verdict used to be enough to propose `ship` regardless of how
  small the deep-audited fraction was, the shipped fixture was `deepAudited:4, unexamined:8` (33% examined),
  disclosed in the rationale (#112) but not gated on, exactly the "1-of-500" gap a hostile review flagged as
  the sharpest unresolved finding. `gate()` now ALSO requires `deepAudited`/`audited` to clear an
  **examined-floor**, default 50%, overridable via `--examined-floor` but clamped (with a warning) to a 25%
  minimum, never silently honored below it. No new categorical rung: a confirmed-clean-but-below-floor result
  proposes `canary`, same as every other under-proven credibility state, with a rationale line naming the
  fraction, the floor, and #127. No schema-version bump (a `gate.mjs` runtime rule change, same precedent as
  ADR-0029's B→A graduation); the floor's numbers live only in rationale prose, never as a predicate field
  (honesty guard #3 unaffected). `fixtures/audit-test.confirmed.json` updated from 4-of-12 to 6-of-12 so the
  shipped fixture demonstrates a run that clears the new default floor. Verified: golden self-test gains the
  issue's own 33%-examined example (now `canary`, was `ship`), a 25%-override case, and a clamp-to-25% case;
  CLI smoke-tested end to end for ship / below-floor / override / clamp.

- **Gate ingests Cypress**, a second E2E framework on the execution axis
  ([ADR-0030](docs/adr/0030-witness-cypress-ingest.md), epic #49). `witness.mjs` gains a `--cypress` input
  that reads the **Cypress Module API result** (`CypressRunResult`, what `cypress.run()` resolves to) and maps
  it to the same `PASSED/WARNED/FAILED → ship-baseline/canary/hold` scale as Playwright. The gate generalises
  from a Playwright-only branch to an **execution axis** (`{playwright, cypress}`) taken **worst-wins across
  every suite present**, so `ship` now requires *every* E2E suite green (a green Playwright can't paper over
  a red Cypress). **Honest asymmetry, documented not hidden:** Playwright emits `stats.flaky`; Cypress emits
  no flaky count, so Gate **derives** the WARNED signal by scanning per-test `attempts[]` for a
  failed-then-passed retry (the pattern Cypress's own docs show) and labels the metric `flakyDerived`. The
  SKILL documents the tiny `cypress.run()` wrapper that produces the result file and **why** it's required
  over `cypress run --reporter json` (the mocha reporter has no `attempts`, so it would silently drop the
  flake). No schema-version bump, `stage` is a free string (contract Q1), the exact additive extension v0 was
  designed to absorb. Verified: 70/70 gate self-tests (Cypress derivation truth table, attempts-based flake
  incl. the ended-failed-is-not-a-flake guard, Cypress-only + both-frameworks worst-wins, fixture e2e) +
  real-CLI drive of the ship/hold/mixed paths. Schema-faithful fixtures + verified docs, now backed by a
  **Docker ground-truth run** (`cypress/included`, 2026-07-18): a real `cypress.run()` over a pass /
  hard-fail / retried-then-passed spec confirmed the live `CypressRunResult` matches every fixture assumption,
  no aggregate flaky count anywhere, the flake surviving only in `attempts[]`, and `witness.mjs` deriving
  correctly against it (native Cypress run is macOS-blocked, Docker-only, matching how Playwright ingest was
  validated; see ADR-0030 follow-up).

- **`gate` eval, Cypress false-green case** (follow-up to ADR-0030, harness #74). A third `gate` eval case
  (`cypress-flaky-derived`) grades the Cypress-specific honesty surface the arithmetic self-test can't: on a
  Cypress run that reads **12/12 in `totalPassed`** but hides a retried-then-passed flake, the skill must
  present the **derived** `canary` (WARNED from `attempts[]`, not a Cypress field) and must **not** launder
  `totalPassed:12` into a clean-green `ship`. Faithful + hollow samples; offline self-test discriminates (the
  CI gate), keeping the Cypress reporting path trust-gated like the Playwright cases.

- **Positioning note: "Why not *just* TEA?"** ([`docs/comparisons/tea.md`](docs/comparisons/tea.md),
  issue #96 Part B). Reviewer-facing / README-adjacent writeup answering why Sentinel/Gate earns its keep
  alongside [TEA](https://github.com/bmad-code-org/bmad-method-test-architecture-enterprise) (the free BMAD
  Test Architect method, which overlaps most map stages). Held to the repo's evidence bar: every "TEA can't"
  is a *verified absence* (TEA docs, 2026-07-17), leads with the two uncontested gaps (**mutation proof** via
  `audit-test`, **calibrated risk-weighted confidence** via Gate), concedes the soft overlaps
  (`coverage-review`, static quality vs `test-review`/Exspec), and carries the load-bearing caveat that the
  Gate half is **design-not-proven**. First of the `comparisons/` notes.

- **`contract-guard`** skill (consumer-side contract check, issue #48 / spec #71): gives the *stranded*
  enterprise frontend team the coverage Pact structurally can't (Pact needs provider participation). Tiered,
  cheapest-first: **Tier 0** detect existing response validation (schema present → drift self-revealing,
  recommend nothing); **Tier 1** untyped frontend → propose/scaffold client-side response-schema validation
  (the lighter play); **Tier 2** empty-diff + no-validation → **differ** the shape the consumer expects
  against the provider's **published** OpenAPI/Swagger, carrying the deliberate-vs-accidental oracle (matches
  spec → deliberate/stale, offer update; contradicts / no spec → suspected break → `/bug-report`).
  Static-judgment only (ADR-0010), reads the *published* contract, never snapshots a live response; human
  disposition only (ADR-0013), proposes never applies (ADR-0002/0003). Is the detector `/debug-test --drift`
  was scoped to consume (ADR-0018 → ADR-0021). User-invoked leaf (ADR-0020).

- **`audit-orchestrator`** skill (stage-3 Audit router, issue #43): detects a suspicious passing test's stack
  (Playwright/Cypress app-driven vs Vitest/Jest unit) and routes it, unit JS/TS → Tautest (PR diff-mutation) /
  StrykerJS (full) where they fit; app-driven → `/audit-test` (dev-served) with the ADR-0016/0019 reachability
  guard, because source-mutating tools can't reach app-driven code (the reachability wall). Emits a
  provenance-labelled verdict (ADR-0013), never a gate. Proves the "orchestrate the best free tools + fill the
  E2E gap" pattern end-to-end. User-invoked leaf (ADR-0020).

- `debug-test` flake mode now routes **root-cause runtime evidence by framework** (new step F3):
  Playwright → trace viewer / Test Replay; Cypress → [`cypress-flaky-test-audit`](https://github.com/sclavijosuero/cypress-flaky-test-audit)
  (command-queue enqueue-vs-execution order, timing, never-run commands, retry diff), with a one-line "how to
  read it for a flake". Evidence *downstream of detection*, a pointer, not rebuilt instrumentation. (issue #46)
- **`e2e-impact`** skill (E2E test-impact-analysis v0, issue #44): maps a working/PR diff → the
  Playwright/Cypress specs it plausibly hits, via test-side-import, route, and selector/test-id signals (incl.
  project custom commands + substring matches), each with a confidence and an honest **run-all / unmapped**
  fallback, never silently dropping a changed file. Emits a source→spec relevance map that
  `/debug-test --drift` reads inverted (ADR-0018). Heuristic v0: correctness-with-honest-gaps over false
  precision. User-invoked leaf (ADR-0020).

### Changed

- **External-tool provenance pass** (issue #47 follow-up): six external tools the map named only as *Unexamined leads*
  were verified against their **primary sources** and promoted per ADR-0013. Now **advice (Proven)**: **TEA**
  (BMAD Test Architect, risk tables + governance gate; a *credibility-side ally*), **Playwright Planner/Generator**
  agents, **Cypress AI** (`cy.prompt()` surfaced **with its self-heal hazard caveat**), and **Exspec** (static
  test-quality linter, a cheap credibility pre-screen for `qa-review`/`coverage-review`). **coverage-guard** was
  verified but stays a **hazard-caveat lead, not advice**, it auto-generates tests looping to 100% line coverage
  (manufactured confidence, the exact slop `coverage-review`/`audit-test` counter). Updates the orchestration-map
  Evidence Ledger + the `ask-sentinel` wider-map table; corrects the map's earlier (wrong) claim that Exspec/coverage-guard
  had no owning source. TEA↔Sentinel/Gate integration seams captured in #96.
- **`ask-sentinel` gains a sequence mode** ([ADR-0027](docs/adr/0027-ask-sentinel-orchestrated-sequence-mode.md),
  issue #47 capstone slice): the whole-map router now has a second reading. A *single question* still returns **one**
  best tool (à la carte, ADR-0025); a *lifecycle / workflow ask*, "walk me through QA before I merge", "the full path
  to ship this safely", now returns an **ordered stage path** (orchestrated): the best tool per relevant stage with its
  provenance label, the escalate-if condition between stages, closing on `/sentinel` at the Gate. The path is
  **entry-anchored** to where the change sits (before code → Plan; tests exist → Audit/Coverage; red → Triage) and
  **tailored**, only the stages that matter, never an untailored seven-stage dump, and it stays **à la carte** (run as
  few or as many as you need; a recommendation, not a mandate). Reuses ADR-0025's per-stage routing + labels; no new
  provenance machinery. Guarded by two routing-eval cases (`seq-before-code`, `seq-pre-merge`, the latter asserts
  entry-anchoring: a pre-merge path must not start at `/test-plan`). Delivers the "tool **and** stage order" half of #47;
  the map's "orchestrated" mode is now executable.
- **`ask-sentinel` becomes the whole-map router** ([ADR-0025](docs/adr/0025-ask-sentinel-stack-aware-router-reads-manifests.md),
  issue #47 first slice): it now routes to the best QA-AI tool for a situation, **external tools *and* Sentinel's own
  skills**, not just the twelve Sentinel skills, resolving open question #2 of the orchestration map (the map graduates
  from notes to a runnable front door, and is now **committed as the tracked evidence ledger** at
  `docs/orchestration-map.md`, previously gitignored local notes). It is **stack-aware**: it may read build/config *manifests* (`package.json`,
  `playwright.config.*`/`cypress.config.*`, a published OpenAPI/Swagger) to pick external-best vs Sentinel-gap-filler per
  stage, while still never reading test/source *logic*, running a test, or emitting a verdict (contract refined, not
  broken). Every route **carries its provenance label** (ADR-0013): Proven/Likely is advice, **Unexamined is a *lead*, not
  advice**, and self-healers are surfaced only with their heal-to-green caveat. Wires in the three previously-orphaned
  app-driven skills (`e2e-impact`, `audit-orchestrator`, `contract-guard`), retiring the "reach these three directly for
  now" disclaimer. **Deferred** to later slices: emitting an ordered stage sequence, and a research pass to upgrade the
  Unexamined external tools (TEA, Exspec, Planner/Generator agents, coverage-guard) from lead to labelled advice. The
  matching `#74` routing-eval cases are a coordinated follow-up (left untouched here to avoid colliding with that effort).
- **Suite trigger model** ([ADR-0020](docs/adr/0020-suite-trigger-model-leaves-user-invoked.md)): the eight leaf skills
  (`audit-test`, `coverage-review`, `debug-test`, `prune-tests`, `qa-review`, `threat-model`, `test-plan`, `bug-report`)
  are now **user-invoked** (`disable-model-invocation: true`); discovery routes through the two model-invoked entry
  points, `ask-sentinel` and `sentinel`. Always-on descriptions drop from 10 to 2. Skills stay independently invocable
  and orchestration is unchanged (the router/`sentinel`/`debug-test` invoke leaves by name). Applies Matt Pocock's
  *writing-great-skills* trigger axis.
- **`debug-test` and `audit-test` restructured** for progressive disclosure (*writing-great-skills* structure axis):
  branch-only material moved into `reference/*.md` behind context pointers, loaded only when its trigger fires,
  `debug-test` Flake/Drift modes; `audit-test` Reachability check, Baseline-lock check, Batch mode, run-one-test.
  Behavior unchanged; the always-loaded `SKILL.md` shrinks ~63% (debug-test) / ~46% (audit-test).
- `audit-test` reachability guard now covers **warm dev-server mutation propagation**, not just stale
  builds (ADR-0019). On a dev-served app-driven target it forces the mutation live, a fresh-boot-per-run
  harness (e.g. Cypress `cypress/included`, or a built/CI server) or a dev-server restart, before
  trusting a *survival* as 🔴, closing a false-🔴 (and flaky-🟡) window where an HMR edit hadn't
  propagated to every assertion in a run. A `sleep`/settle doesn't fix it. (issue #54)
- **Gate `ship` now states its examined-vs-unexamined scope** (#112). The ship rationale, the report note,
  and the `gate` SKILL bullet spell out how much of the suite `audit-test` actually mutation-audited (e.g.
  "no hollow tests among the deep-audited subset, 4 of 12 mutation-audited; 8 unexamined, not evidence of
  health"), so `ship` no longer implies the *whole* suite was proven. Counts ride in prose only, honesty-guard
  #3 (no numeric field in the gate predicate) is untouched.
- **Evidence-bundle contract v0 → v0.1** ([ADR-0031](docs/adr/0031-witness-evidence-bundle-v0.1-empty-result.md)).
  Additive and backward-compatible: the new `EMPTY` execution result (see Fixed, #111) widens the `result` enum,
  so the schema, `schemaVersion`, `$id`, and both `result` enums, bumps to record it rather than let the
  published contract lie about a value the producer emits. First bump of the #102-locked contract; the reserved
  `confidence`/calibration bump signal (a MAJOR event, still blocked by honesty-guard #3) is unaffected, this
  is a MINOR enum widening with no number.
- **Honesty pass on trust wording** (#114, from the pre-launch critique). Reworded overclaiming copy to
  match what the code actually does, **no behavior change**: `audit-test`'s "**proof, not reasoning**" →
  "an execution-grounded counterexample, not reasoning (one mutation, not a suite-wide score)"; the gate's
  "certifies ship … execution-proven trustworthy" → "recommends ship … a shape-checked self-report, not an
  independent re-verification"; baseline-lock's "**catches** a 🟢 pinned to a regression" → "**flags** … a
  heuristic suspicion raised for human review, not yet a proven catch"; and every "**Nothing leaves your
  machine**" → "adds no network calls of its own", Sentinel runs *inside* Claude Code, so your code reaches
  Anthropic's API like any session (the README privacy note now says so, and names the eval harness as the
  one maintainer-tooling Anthropic call).
- **Gate `gate` listed in the README; skill counts reconciled** (#116). The release-gate skill now
  appears in both the README skill table and the **privacy table**, that table asserts completeness, so
  an unlisted executing skill was a real gap. Count reconciled to **fourteen skill directories** (thirteen
  skills + the `/ask-sentinel` router) across the README and `evals/README` (was 12 / 13 / 14). Docs only.
- **Fine-print gaps closed** (#115). Three places where a load-bearing caveat contradicted the pitch above
  it: the TEA note's **TL;DR** now marks Witness's calibrated/learning half as a **design, not a live
  feature** (matching the body's own caveat); the reviewer quick-start (`REVIEWERS.md`) surfaces the
  **warm-dev-server / HMR** caveat (an unconfirmed-live survival is 🟡, not 🔴) instead of leaving it only in
  `reachability-check`; and the README `audit-test` pitch states the **`@cypress/grep`** single-test-isolation
  requirement instead of burying it in `run-one-test`. Docs only.
- **Internal `witness://` identifiers renamed to `gate://`** ([ADR-0033](docs/adr/0033-witness-internal-identifier-rename.md),
  completes #113). The prose/brand rename ([#122](https://github.com/TzolkinB/skills/pull/122)) deliberately
  left the plumbing alone; this finishes it: `witness.mjs` → `gate.mjs`; the `witness://` producer namespace
  and `witness.local` predicate domain → `gate://` / `gate.local`; the two schema constants bump,
  `witness-evidence-bundle/v0.1` → **`gate-evidence-bundle/v0.2`**, `witness-audit-test/v0` →
  **`gate-audit-test/v0.1`**, a rename only, no data-model change, MINOR per the same honesty-guard-#3
  reasoning as ADR-0031 (v1.0 stays reserved for calibration). Default output filename
  `witness-bundle.json` → `gate-bundle.json`. Verified: gate self-test 81/81, `lint`/`changed` self-tests,
  all touched JSON valid, eval samples resynced.
- **`proven` taxonomy renamed to `confirmed`** ([ADR-0034](docs/adr/0034-proven-confirmed-taxonomy-rename.md),
  closes [#126](https://github.com/TzolkinB/skills/issues/126)). A second hostile review kept keying on the
  headline word "proven" over its own hedges; renamed everywhere it named this evidence-provenance tier, not
  just `gate`'s schema, since `sentinel` and the project's own top-level docs quote the same tally.
  Schema fields `provenSolid`/`provenHollow` → `confirmedSolid`/`confirmedHollow`, derived `label: 'proven'`
  → `'confirmed'`; two more MINOR bumps, same honesty-guard-#3 reasoning, `gate-audit-test/v0.1` →
  **`gate-audit-test/v0.2`**, `gate-evidence-bundle/v0.2` → **`gate-evidence-bundle/v0.3`** (the label enum
  lives in both). `audit-test`/`gate`/`sentinel`/`debug-test` SKILL prose, `GLOSSARY.md`, and the top-level
  docs (README/ARCHITECTURE/CONTEXT/PLAN/REVIEWERS) updated to match; `ask-sentinel`/`audit-orchestrator`'s
  separate routing-evidence "Proven" convention deliberately left alone, tracked as
  [#131](https://github.com/TzolkinB/skills/issues/131). Verified: gate self-test green (every string
  deliberately reworded, not find-replaced blind), `lint`/`changed` self-tests, all touched JSON valid.

### Fixed

- **Gate: in-toto hedge applied consistently** (closes #132). [ADR-0032](docs/adr/0032-flatten-to-single-kimbell-skills-plugin.md)
  already decided the permanent wording, "in-toto-*shaped* Statements (not signed attestations)," never
  unqualified "in-toto Statements," never silent about the shape, but three spots had drifted from it since:
  `gate.mjs`'s header comment still said bare "in-toto Statements" (the code comment was never updated when
  ADR-0032 landed); `gate/SKILL.md` overcorrected the other way and dropped "in-toto" entirely, keeping only
  "not a signed attestation"; and `schema/evidence-bundle.v0.schema.json`'s nested `statement.description`
  said bare "An in-toto Statement" while the file's own top-level `description` two lines up correctly said
  "in-toto-shaped." All three now cite ADR-0032 and use its exact hedge. No schema-version bump, a
  description-string wording fix, not a shape/field change. The literal `_type` constant
  (`https://in-toto.io/Statement/v1`) is untouched, per [ADR-0033](docs/adr/0033-witness-internal-identifier-rename.md)
  ("the real external type... was never a 'Witness' identifier"). No new ADR, this corrects drift from an
  existing decision, not a fresh one. Verified: `gate.mjs --self-test` green, schema JSON valid,
  `evals/lint.mjs` clean on `gate/SKILL.md`.

- **Gate no longer launders non-evidence into a green `ship`** (#111, from the pre-launch critique
  `references/critique-synthesis.md`). Two disclosed exploits closed: (1) an **empty / zero-test / unrun
  execution report** (`{}`, a wrong `--playwright` path, a suite that never ran) used to derive `PASSED` and
  propose `ship-baseline`; it now derives the new **`EMPTY`** result → `hold`. (2) `parseAuditEmission` accepted
  any `witness-audit-test/*` prefix and any non-negative counts, so a hand-written `{provenSolid:1, deepAudited:0}`
  (arithmetically impossible) reached `PASSED`+`proven`+`ship`; it now matches the schema version **exactly** and
  **rejects inconsistent tallies** (`audited == deepAudited + unexamined`; `Σ(outcomes) ≤ deepAudited`), degrading
  a malformed emission to opaque/absent, never a silent upgrade. Advisory decision on the exploits: empty+fake →
  `hold`, impossible-tally → `canary`; the legit green-Playwright + real-proven-audit path still ships. 11 new
  gate self-test rows (81 total).

## [0.2.0] - 2026-07-13

### Added

- `audit-test` **reachability guard** (ADR-0016): before recording a 🔴, it proves the harness is
  source-live via a maximal probe mutation. An app-driven Playwright/Cypress test that drives a stale
  build (`build && preview`, a served `dist/`) or a deployed URL now returns an honest 🟡 (the
  mutation never reached the running app) instead of a fabricated 🔴.
- `audit-test` **baseline-lock** ⚠️ suspicion flag (ADR-0017): catches the mirror failure a mutation
  can't see, a *live* assertion pinned to a regressed value (the fingerprint an AI self-healer leaves
  when it "fixes" a red test by rewriting the expected value). Reads as caution, never a pass.
- `audit-test` / `debug-test`: guidance for when the **Cypress runner won't launch** (macOS 26 /
  Electron 36 incompatibility), framed as an environment reachability failure (honest "can't execute
  here", not a fabricated verdict), with the Docker (`cypress/included`) / CI-Linux remedy.
- `audit-test`: Playwright & Cypress added to the run-one-test guidance (single-test isolation via
  `--project` / `@cypress/grep`).
- `debug-test` **drift mode**: classifies an already-red test as external drift vs local regression
  from static signals (diff-relevance → temporal → published-contract), quarantines it non-blocking,
  and surfaces the mismatch for a human to dispose, never healing to green or unilaterally blaming
  the provider. Entered via `--drift` or a deterministic red whose diff doesn't touch the code the
  test exercises. Sibling of flake mode; backed by a blinded n=1 existence proof (ADR-0018,
  EXPERIMENT-0018, issue #42).
- Per-skill human-facing docs tree under `docs/`: one page per skill (what it does, when to use /
  when not, a worked example against the fixtures, anti-patterns), plus a skill-index table in
  `README.md` linking each skill to its doc page and its `SKILL.md`. Docs sit at a distinct altitude
  from `SKILL.md`, they describe why/when, not how the agent executes (issue #10).
- `ask-sentinel` router skill: a front-door that maps a QA situation to the right one of the
  nine skills and describes the intended flow, naming `/sentinel` as the orchestrator. It is a
  router, not one of the nine, and never joins the `/sentinel` chain (issue #8).
- Release discipline: `CHANGELOG.md`, a per-plugin semver source of truth, and a
  `scripts/release.sh` release script (ADR 0008).
- ADR 0009: `coverage-review` consumes line-coverage as evidence, it does not produce it,
  positions `test-coverage-analyzer` / NYC / JaCoCo as a route into `coverage-review`, not a
  rival, mirroring the Stryker seam in ADR 0004.
- ADR 0010: scope decision for the market analysis's two open gaps, live-execution stays out
  (delegated across `debug-test`'s healer / `diagnosing-bugs` routing seam), temporal memory is
  in-scope-by-philosophy but deferred behind a defined seam.

## [0.1.0] - 2026-07-09

### Added

- Initial Sentinel plugin: QA-first testing skills for Claude Code.
