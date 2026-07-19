# Sentinel produces QA judgment, not release evidence — the evidence pipeline is a separate plugin

Sentinel answers "does this branch deserve QA *trust*?" and outputs categorical human judgment.
A separate evidence-pipeline plugin answers "what *artifacts* support release confidence?" —
aggregating CI status, coverage/Playwright reports, a risk score, and signoff into a release
recommendation. These stay two plugins with a clean seam rather than one tool: `/sentinel`'s
verdict may become one *input* to the pipeline, but Sentinel itself never aggregates artifacts
or emits a numeric release score.

## Why the seam

Folding artifact-aggregation and release scoring into Sentinel would (a) require it to execute and
collect CI/coverage data it deliberately doesn't run, and (b) invite invented precision like
"87% release confidence" with no defined inputs — the exact green-light theater Sentinel exists to
fight. Numeric scoring belongs where the inputs are actually defined: the pipeline.

## Consequences

- Sentinel stays categorical everywhere (see `CONTEXT.md` → "Categorical confidence"). The
  `/sentinel` template's invented `Lines Tested: 84%` becomes a categorical statement, since
  Sentinel does not run coverage.
- Structured/JSON output is deferred — it is the pipeline's integration concern, not this build.
  Sentinel output stays markdown; `audit-test`'s structured verdict stays batch-ready but
  human-facing.
