# coverage-review prefers real coverage instrumentation, falling back to static inference

`coverage-review` historically inferred coverage *statically* — it read the test and the code and
reasoned about which paths were exercised. A market analysis of judgment-layer
tools flags this as the suite's weakest moat: ecosystem tools (nyc/istanbul, c8, JaCoCo, `test-coverage-analyzer`) *run*
the suite and read real instrumentation, which is strictly more authoritative for "which lines
executed" than any amount of reasoning. But *requiring* instrumentation would raise an activation
barrier the skill deliberately doesn't have today — many AI-generated repos have no coverage config
at all, and a hard prerequisite would make the skill useless exactly where it's needed most.

## Decision

Two-tier, prefer-real-fall-back-to-static:

- **If coverage output is present** (istanbul/nyc `lcov.info` or `coverage-final.json`, c8, jacoco
  XML, etc.), consume it as **ground truth** for executed / not-executed lines and branches, then
  layer the skill's real value — assertion-quality and edge-case judgment — on top. This turns the
  weakest skill into "the judgment that reads a coverage report like a QA lead."
- **Otherwise** fall back to today's static inference so the skill still works with zero config.
- **Always name the mode** in the report (`Coverage source: instrumentation (lcov)` vs `static
  inference`) so the reader knows whether the line numbers are measured or estimated.
- The assertion-quality / edge-case judgment runs **identically in both modes**.

## Why this shape

- **Read the fact, judge the rest.** *Which lines executed* is a fact a coverage tool measures
  better than reasoning can, so don't re-derive it when it's already been measured. But an executed
  line is not a verified line — the executed-vs-verified gap (loose assertions, missing edge cases)
  is the judgment a coverage number can never give, and it's the durable value here. So real data
  replaces only the part that was always a weak guess, and leaves the part that is the moat.
- **Never a barrier to entry.** Zero-config graceful degradation is a first-class requirement, not a
  fallback of last resort — it's why the skill is adoptable in the AI-generated repos that most need
  it.
- **Read, don't run.** The skill *reads* an existing report; it does not run the suite to generate
  one. That keeps it inside the "read and reason" execution boundary Sentinel draws for most skills
  (ARCHITECTURE → "Execution is scoped, not blanket") — it never crosses into running your test
  suite, which is exactly the heavyweight step Sentinel avoids.

## Consequences

- `coverage-review`'s line/branch numbers become authoritative when a report exists, and clearly
  labelled as estimates when it doesn't.
- The ARCHITECTURE "what I'd change if this became a team tool" note is partially realized, in
  read-only form: consuming coverage is done; *generating* it on demand remains out of scope.
- No new hard dependency and no new `allowed-tools` — detection uses the `Bash` access the skill
  already has to locate a report, and `Read` to parse it.
- This ADR is the skill-content analogue of the packaging-era decisions; it records why the moat
  moved from "infers coverage" to "judges real coverage," so future changes don't quietly reintroduce
  a hard instrumentation requirement.
