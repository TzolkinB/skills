# `/audit-test --changed` counts the tests whose lines changed, with a whole-file fallback

**Status: Accepted (2026-11-25).** From [#276](https://github.com/TzolkinB/skills/issues/276). Amends the
`--changed` population stated in [ADR-0035](0035-gate-examined-floor.md) and
[ADR-0038](0038-gate-trust-boundary-and-examined-floor-population.md) (both said `--changed` = changed files).
Their floor, default, clamp and denominator rule are unchanged.

## Context

The first real `/audit-test --changed --emit-json` + `/gate` run, on Mosaic PR #129 (2026-10-27), audited 75 tests
and deep-audited 31, which is 41%. The floor is 50%, so Gate said `canary`. 44 of the 75 were older e2e tests that
shared a changed spec file with the PR's new tests. A PR that added 6 new e2e tests, all killed, still could not
reach `ship` without `--certify`. E2E spec files are large, so this will recur.

Two situations pull in different directions:

- **A suite that uses these skills from the start.** Older tests in a touched file were audited in earlier PRs. The
  audit is stateless ([ADR-0047](0047-statelessness-is-a-write-boundary-git-is-the-ledger.md)), so Gate cannot know
  that, and re-charges the PR for them.
- **A mature suite that never used them.** Older tests are unknown. That is a backlog, not something this PR
  caused, and a file-level floor makes every PR touching a big spec carry it.

In both cases a floor that every PR must override with `--certify` stops meaning anything.

## Decision

1. **`--changed` audits the tests whose lines changed.** The population is found from
   `git diff -U0 main...HEAD` (plus the working tree): a test is in scope if a changed line range overlaps its
   span. `audited` counts that population, so Gate's examined-floor stays `deepAudited / audited`.
2. **Fallback for shared code, as narrow as it can be.** A changed range outside every test span can change
   many tests at once. Inside a `describe` (a hook, local helper, constant) it brings in that describe's tests.
   At file top level (a shared constant or helper, a changed or removed import) it brings in the whole file. A
   newly added `import` line brings in nothing. If test spans cannot be resolved, the whole file is used. The
   fallback also stops an empty population when only a helper changed.
3. **The population is set from the diff, before triage.** ADR-0038 Decision 1 rejected a denominator drawn from
   the flagged or suspect tests, because the funnel selects those and the ratio would sit near 100%. A population
   chosen by `git diff` is not chosen by suspicion. The 1-of-500 exploit stays closed.
4. **Changed test support brings its importers in.** A modified or deleted page object, fixture or helper
   under a test directory pulls in every test file that imports it directly (one hop), whole file. A newly
   added one brings in nothing, because no existing test used it. Support the runner loads
   without an import (Cypress support files, `playwright.config`, global setup) cannot be narrowed, so the
   population is the whole suite. Application source is not expanded; that is `/e2e-impact`'s job.
5. **The report says what it did.** The `scope` text and the tally name the count and how each test got in, for
   example `--changed (7 of 12 tests in 3 files: 2 by changed lines, 3 via whole-file fallback, 2 via changed support file)`. Gate reads
   `scope` and prints it; it never decides on it ([ADR-0038](0038-gate-trust-boundary-and-examined-floor-population.md)).
6. **Adopting a mature suite is a separate, deliberate run.** `/audit-test <directory>` (with `--certify` if a
   `ship` is wanted) baselines the older tests once. `--changed` does not try to do that job.

## Check against a real diff

Mosaic PR #129 (merged; base `a8b075a`, head `defe884`), counted from `git diff -U0` with a small script of
my own, not by running the skill. Test files changed: 8, with 79 tests. A first, blunter version of the rule
(any hunk outside a test pulls in the whole file; any changed support file pulls in its importers) gave **69 of
79**, so it would not have fixed #276. The cause was two things in `tests/e2e/admin.spec.ts` (46 tests): two
**new** import lines, and a **new** page object `AdminNewBookingPage.ts`. Neither can change an old test. The
rules above exclude both, which gives about **31 of 79**. The original run deep-audited 31 tests; if those are
the same 31, the floor would be 100%, not 41%. Not yet re-run end to end on Mosaic, and my span count is
approximate (it counts 79 tests where the original run reported 75).

## Consequences

- **No Gate code or schema change.** Gate already takes `audited`, `deepAudited` and a free-text `scope`. Only
  audit-test's population rule changed, in `SKILL.md`, `reference/batch-mode.md` and `docs/audit-test.md`.
- **A `ship` from `--changed` now means "the tests this PR changed are credible".** It says nothing about older
  tests in the same file. The scope line says so, which is why decision 5 is not optional.
- **The span rule is a model-read static step**, not a parser. A bad span read can put a test in or out of scope.
  The fallback and the scope line limit the damage. A real parser per language is a possible later change.
- **Not covered:** a second hop (a barrel file or a helper that re-exports another). The skill tells the reader
  when it sees this.
- **`--base=<ref>`** replaces the hardcoded `main`, for repos on `master`/`develop` and for the eval fixture below.
- **Reversible.** Restore "the tests in changed files" in `batch-mode.md` and this ADR is superseded.

## Alternatives considered

- **Keep file-level and document that e2e PRs need `--certify`.** Rejected: it works for neither case above and
  turns `--certify` into routine.
- **A flag that picks file-level or hunk-level.** Rejected: more surface to explain and test, and the default
  would still have to be one of them.
- **Persist which tests were audited, and skip those next time.** Rejected: it breaks the stateless rule
  (ADR-0047) and needs somewhere trusted to keep the record.
- **Lower the floor for `--changed`.** Rejected: a lower number does not change what the population means, and
  ADR-0035 already allows a conscious `--examined-floor` override, never below 25%.

## Clean-room note

No other tool's code or text was used. The idea (scope a check to the changed lines of a diff) is general
practice; no specific tool was the source, so no tool is cited.
