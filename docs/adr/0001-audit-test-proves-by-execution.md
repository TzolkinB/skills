# audit-test proves false-confidence by running a targeted mutation, not by reasoning alone

Sentinel's `audit-test` skill audits a *passing* test for false confidence — whether it would
still pass if the code it covers broke. Because Sentinel's whole premise is that a green test is
not proof, `audit-test` must not rely on AI reasoning alone to judge another test's
trustworthiness. It reasons out the single most-likely-breaking change, then **applies that
mutation and runs just that one test** to prove the test stays green. This deliberately breaks the
"no automated tool execution" stance in `ARCHITECTURE.md`.

## Why not static reasoning only

Static-only would repeat the exact failure mode the tool exists to catch — trusting an AI's
say-so that a test is fine — one level up. Execution supplies the ground truth reasoning can't.
The strongest *honest* claim is factual: "I changed the code like this and the test still passed."
Whether that change was behaviorally meaningful stays a visible human judgment — a challenger,
not an oracle.

## Why this stays fast

Runtime is bounded by the triage funnel: only tests flagged as suspicious get a mutation, and each
is verified by running that single test (not the suite), so cost is a handful of single-test runs,
not a full mutation campaign — the heavyweight overhead we explicitly avoid.

## Consequences

- Full-confidence verdicts require a runnable test environment. Without one, `audit-test` degrades
  to the mutation *thought* experiment and labels the verdict **Likely** (vs **Proven**).
- Mutations edit source, so a hard safety rule applies: run only on a clean git tree (or a scratch
  copy) and guarantee revert even on crash/interrupt — never leave the repo dirty.
- `ARCHITECTURE.md`'s "no automated tool execution" tradeoff is now out of date — `debug-test`
  already executes, and `audit-test` now does too. That section needs revising for beta.
