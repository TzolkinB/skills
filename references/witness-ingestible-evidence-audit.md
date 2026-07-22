# Witness-ingestible evidence audit — Sentinel stages 3–5 vs. Playwright JSON

Provenance: research for ticket #100, resolved 2026-07-17. Primary sources only — Source 1 = the actual repo files under `sentinel/` (cited `path:line`); Source 2 = official Playwright docs + the reporter type definitions (cited by URL). Scope guardrails from the ticket: Cypress is OUT (Playwright JSON only for the first vertical); `audit-test` labels are the credible-today Sentinel input. This scopes what the evidence-bundle contract (#102) can honestly contain.

---

## TL;DR (the honest answers)

- **Source 1 — Sentinel:** No stage-3–5 skill emits machine-readable output today. `audit-test`, `coverage-review`, and the mutation router (`audit-orchestrator`) all produce **prose Markdown for a human** — emoji-tagged verdict lines and taxonomy labels, nothing structured. This is **deferred by explicit design**, not an accident: ADR-0002 states "Structured/JSON output is deferred… Sentinel output stays markdown; `audit-test`'s structured verdict stays batch-ready but **human-facing**" (`sentinel/docs/adr/0002-sentinel-is-judgment-not-release-evidence.md:22-24`). The credible-today Witness input — `audit-test`'s Proven/Likely/Unexamined provenance labels + the failure taxonomy — exists **only as prose**. A structured emission mode **must be added**; it does not exist to be read.
- The **only** structured artifacts in the repo are (a) the **eval harness's** internal grading objects and exit codes, and (b) the CI gate — but these grade *the skills' own prose transcripts against rubrics* (a meta-test of the skills), **not** an evidence stream from a real audit of a user's app. They are not a Witness input.
- **Source 2 — Playwright JSON:** Already a complete, documented, machine-readable schema. The gate-signal fields exist today: top-level `stats` (expected/unexpected/flaky/skipped), per-spec `ok`, per-test `status` (`expected|unexpected|flaky|skipped`) + `expectedStatus`, per-result `status`/`retry`/`duration`/`error(s)`/`attachments`. The gap to Witness is **ingestion/mapping only** (enable the reporter, map fields, resolve attachment paths) — nothing new has to be emitted.
- **The asymmetry that scopes #102:** Playwright is ingestible *today*; Sentinel is *not*. An honest first evidence bundle can carry Playwright results as data now, but can only carry Sentinel's audit-test verdicts if a structured-output mode is built first (or the bundle ingests Sentinel's prose as an opaque human-facing attachment, not as parsed evidence).

---

# Source 1 — Sentinel stages 3–5 output (repo files)

## 1a. `audit-test` (stage 3 — the credible-today input)

**What it emits today:** prose Markdown only. The skill's `allowed-tools` are `[Read, Bash, Glob]` (`sentinel/skills/audit-test/SKILL.md:5`) — there is no Write tool and no report-file emission; its entire product is the text of the skill response.

**Output shape (single/flagged test)** — an emoji verdict header plus prose fields (`sentinel/skills/audit-test/SKILL.md:64-84`):

```
## audit-test: "rejects overlapping bookings"
**Verdict:** 🔴 Proven false-confidence
**How it fails:** Overmocked — asserts save() was called, never that the overlap was rejected
**Proof:** commented out the overlap guard (booking.ts:34) → ran this test → still passed
**A real test would:** assert the 2nd booking is rejected with 409, not that save() ran
```

The four **verdict states** are emoji-tagged prose labels, not enum values or exit codes (`sentinel/skills/audit-test/SKILL.md:44-52`): 🔴 Proven false-confidence, 🟡 Likely false-confidence, 🟢 Killed the proposed mutation, ⚠️ Baseline-lock suspected. The **failure taxonomy** (8 categories: focal-unit-never-invoked, overmocked, incidental, loose, order-dependent, implementation-coupled, pseudo-tested, baseline-locked) is likewise prose (`sentinel/skills/audit-test/SKILL.md:53-62`).

**Batch mode** (the mode `/sentinel` consumes) reports a **provenance tally as a single prose line** plus flagged entries (`sentinel/skills/audit-test/reference/batch-mode.md:16-25`):

```
Audited 47 · deep-audited 5 (2 🟢 proven-solid · 1 🔴 proven-hollow · 1 🟡 likely-hollow · 1 ⚠️ baseline-lock) · 42 unexamined
🔴 "rejects overlapping bookings" (booking.spec.ts) — overmocked (proof: removed guard, still green)
```

Note the value that *would* carry gate signal is present in the prose — a test **id/title**, its **file path**, a **verdict label**, a **provenance class** (Proven/Likely/Unexamined per ADR-0013), a **taxonomy category**, and a **proof string** (the mutation applied + observed result). It is all there — but only as human-readable text a consumer would have to regex/parse out of a free-form Markdown response. There is no JSON, SARIF, or exit-code encoding of it (confirmed by grep: zero `sarif|--json|machine-readable|exit code` hits across `sentinel/skills` and `sentinel/scripts`).

**Provenance labels (the honest-today signal):** ADR-0013 makes three labels mandatory on output — **Proven** (mutation run + observed), **Likely** (reasoned only), **Unexamined** (triaged, never mutated) — and forbids folding Unexamined into the greens (`sentinel/docs/adr/0013-evidence-provenance-sentinel-labels-not-gates.md:23-45`). These are the fields with real evidentiary weight for Witness, but the same ADR fixes the stance: "Sentinel **labels, it does not gate**" and the execution gate "is recorded as the evidence pipeline's job" (i.e. Witness's), not Sentinel's (`…0013…:2, :50-52`).

## 1b. `coverage-review` (stage 4)

**Reads real instrumentation as INPUT, emits prose as OUTPUT.** It looks for and parses existing coverage reports — lcov/istanbul/c8/jest/vitest (`coverage/lcov.info`, `coverage-final.json`, `clover.xml`) and JaCoCo (`jacoco.xml`) — and treats them as ground truth when present, falling back to static inference otherwise (`sentinel/skills/coverage-review/SKILL.md:19-24`). Crucially it **does not run the suite or generate coverage** — "No report → static mode, never a coverage run" (`…coverage-review/SKILL.md:85`).

**Output is prose Markdown** (`sentinel/skills/coverage-review/SKILL.md:34-64`): a `**Coverage source:**` line (`instrumentation (lcov) — 84% lines / 71% branches` *or* `static inference`), then free-text sections — Covered Behaviors, GAPS (with HIGH/MEDIUM/LOW risk tags as prose), Loose Assertions, Untested Branches, Recommended Next Tests. The percentages it prints are lifted from the consumed lcov/JaCoCo file; the skill itself emits no structured coverage object. So the machine-readable coverage data lives in the *upstream* tool's report (lcov/JaCoCo/istanbul JSON) that coverage-review reads — not in anything coverage-review produces.

## 1c. Mutation verdicts (Stryker / Tautest)

Nothing in this repo emits or ingests Stryker/Tautest JSON. `audit-test` runs its own *targeted, single* mutations but **deliberately produces no mutation score and no report file** — "it never produces a codebase-wide mutation score… it is the *judgment* tool" (`sentinel/skills/audit-test/SKILL.md:114`). The `audit-orchestrator` skill **routes to** external StrykerJS/Tautest but "**orchestrate, don't absorb**: print the exact command… these are external, source-mutating CLIs the map points *at*, not into" (`sentinel/skills/audit-orchestrator/SKILL.md:36, :60`); its output is a prose recommendation with a copy-paste command (`…audit-orchestrator/SKILL.md:51-52`), not the tools' JSON. So Stryker's `mutation.json` exists as an artifact *in principle* (if a user runs Stryker themselves) but no Sentinel skill emits, captures, or parses it.

## 1d. The eval harness (`sentinel/evals/` — the ticket's "may emit JSON" lead)

**Honest finding: it does not emit JSON, and even its internal structure is not a Witness input.**

- `run-eval.mjs` has modes `--dry-run` / `--self-test` / `--live` and grades skill transcripts, printing a **console text report** and returning **exit codes** (0 pass / 1 fail / 2 usage) (`sentinel/evals/run-eval.mjs:56-68, :135-144`).
- `lib/grade.mjs` *does* build a structured JS object per transcript — `{ pass, tokens, surfaced, violations }` (`sentinel/evals/lib/grade.mjs:74-80`) — but it is **never serialized to JSON output**; `printCase()` renders it as human text (`sentinel/evals/run-eval.mjs:135-141`). The only `JSON.stringify` calls in the harness are for deep-equality checks and a debug print (`sentinel/evals/changed.mjs:216, :228`; `sentinel/evals/lib/judge-llm.mjs:101`), not output.
- `changed.mjs` emits a **Markdown report** + a GitHub job summary and gates via **exit code** under `--gate` (`sentinel/evals/changed.mjs:62-71, :159-194`); CI wires this as the PR gate (`.github/workflows/skill-evals.yml:47-54`).

The decisive point for Witness: this harness grades **whether a skill's own prose surfaced the required findings** against a fixture rubric (`must_surface`/`must_not`/`expect_verdict`/`expect_tokens`, e.g. `sentinel/evals/cases/audit-test.json:17-40`). It is a **meta-test of the skills themselves**, not a machine-readable audit result about a user's application. Its exit codes answer "did the `audit-test` skill regress?", never "is this user's test hollow?". It is not an evidence source Witness can ingest.

## Source 1 — the concrete gap to "ingestible by Witness"

To make `audit-test`'s credible-today labels ingestible, a **structured emission mode must be added** — it is not a matter of reading an existing format. The needed shape is already latent in the prose (per finding: `test_id`/`title`, `file`, `verdict` ∈ {proven-false-confidence, likely-false-confidence, killed-mutation, baseline-lock-suspected}, `provenance` ∈ {Proven, Likely, Unexamined}, `taxonomy_category`, `proof`/`mutation` description). ADR-0002 both confirms the gap and pre-assigns the work: structured output is "the pipeline's integration concern, not this build" (`sentinel/docs/adr/0002-sentinel-is-judgment-not-release-evidence.md:22`) — i.e. Witness (#102) owns defining and emitting it. Until then, the only honest way a bundle carries Sentinel output is as an **opaque human-facing Markdown attachment**, not as parsed structured evidence. (`coverage-review`'s upstream lcov/JaCoCo report *is* machine-readable and could be ingested directly — but that is ingesting the coverage tool, not Sentinel.)

---

# Source 2 — Playwright JSON reporter

Primary sources: Playwright reporter type definitions (`packages/playwright/types/testReporter.d.ts`, microsoft/playwright `main`) and the official API/guide pages on playwright.dev. Every field below is quoted from those.

## Enabling it

Three documented ways (playwright.dev/docs/test-reporters):
- CLI flag: `npx playwright test --reporter=json`
- Env var for output path: `PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json` (also `PLAYWRIGHT_JSON_OUTPUT_DIR`, `PLAYWRIGHT_JSON_OUTPUT_FILE`)
- Config: `reporter: [['json', { outputFile: 'results.json' }]]` in `playwright.config.ts`

## The hierarchy (top → leaf)

From `testReporter.d.ts` (JSON report types):

- **`JSONReport`** — `{ config, suites: JSONReportSuite[], errors: TestError[], stats }`. The top-level **`stats`** object is `{ startTime: string, duration: number, expected: number, unexpected: number, flaky: number, skipped: number }`.
- **`JSONReportSuite`** — `{ title, file, column, line, specs: JSONReportSpec[], suites?: JSONReportSuite[] }` (suites nest).
- **`JSONReportSpec`** — `{ tags: string[], title, ok: boolean, tests: JSONReportTest[], id, file, line, column }`. `ok` is the per-spec pass boolean.
- **`JSONReportTest`** — `{ timeout, annotations, expectedStatus, projectName, projectId, results: JSONReportTestResult[], status }`.
  - `status: "skipped" | "expected" | "unexpected" | "flaky"` — the **aggregate outcome** across attempts.
  - `expectedStatus: "passed" | "failed" | "timedOut" | "skipped"` — what the test was expected to do.
- **`JSONReportTestResult`** — one entry **per attempt** (retry): `{ workerIndex, parallelIndex, shardIndex?, status: TestStatus | undefined, duration, error: TestError | undefined, errors: JSONReportError[], stdout, stderr, retry, steps?, startTime, attachments, annotations, errorLocation? }`.
  - `TestStatus` (per-attempt raw status) = `"passed" | "failed" | "timedOut" | "skipped" | "interrupted"`.
  - `retry: number` — 0-based attempt index.
  - `attachments: Array<{ name: string, path?: string, body?: string, contentType: string }>` — traces, screenshots, videos.
- **`JSONReportError`** — `{ message: string, location? }`. **`JSONReportTestStep`** — `{ title, duration, error, steps? }` (steps nest).

### Status vs. expectedStatus (verified against the API pages)

- `TestResult.status` (per attempt): `"passed" | "failed" | "timedOut" | "skipped" | "interrupted"` (playwright.dev/docs/api/class-testresult).
- `TestCase.expectedStatus`: `"passed" | "failed" | "timedOut" | "skipped" | "interrupted"` — tests marked `skip`/`fixme` expect `skipped`, `fail` expects `failed`, all others expect `passed` (playwright.dev/docs/api/class-testcase). (In the JSON `JSONReportTest.expectedStatus` the enum is narrowed to `passed|failed|timedOut|skipped`.)
- `TestCase.outcome()` returns `"skipped" | "expected" | "unexpected" | "flaky"` — the same four the JSON's `JSONReportTest.status` carries; "flaky" means **the test passed on a retry** (playwright.dev/docs/api/class-testcase).

## How a flaky test is represented

A flaky test = **failed on the first run, passed when retried** (playwright.dev/docs/test-retries). Each retry is a **separate `JSONReportTestResult`** in the test's `results[]` array — e.g. `results[0]` with `status:"failed"`, `retry:0` and `results[1]` with `status:"passed"`, `retry:1`. The **aggregate** `JSONReportTest.status` is then `"flaky"`, and it is counted in the top-level `stats.flaky`, tallied **distinctly** from `passed`/`failed` (playwright.dev/docs/test-retries: "1 flaky" listed separately from "2 passed"). Gate implication: a flaky test that eventually passes is surfaced (in `status:"flaky"` and `stats.flaky`) **without** being folded into `unexpected` — a release gate must read `stats.flaky` explicitly; it will not show up as a failure count.

## Timings, errors, attachments

- **Timings:** `stats.startTime` + `stats.duration` (whole run); `JSONReportTestResult.duration` (ms) and `startTime` per attempt; `JSONReportTestStep.duration` per step.
- **Errors:** `JSONReportTestResult.error` (first) + `errors: JSONReportError[]` (`{ message, location? }`) + optional `errorLocation`; run-level `JSONReport.errors: TestError[]`.
- **Attachments** (traces/screenshots/videos): `JSONReportTestResult.attachments[]` = `{ name, path?, body?, contentType }`. `path` is a file path (often relative to the project `outputDir`); `body` is inline (base64 in JSON) when no path.

## Fields that carry release-gate signal

| Level | Field | Gate signal |
|---|---|---|
| Run | `stats.unexpected` | > 0 ⇒ real failures — hard block |
| Run | `stats.flaky` | > 0 ⇒ instability; surfaced separately (won't appear in `unexpected`) |
| Run | `stats.expected` / `stats.skipped` | ran-as-expected / not-run counts |
| Spec | `JSONReportSpec.ok` | per-spec pass/fail boolean |
| Test | `JSONReportTest.status` (`expected\|unexpected\|flaky\|skipped`) | the aggregate per-test verdict |
| Test | `JSONReportTest.expectedStatus` | distinguishes a real fail from an expected-fail (`test.fail()`) |
| Result | `status` + `retry` | reconstructs the flake pattern (fail→pass across attempts) |
| Result | `error` / `errors` / `errorLocation` | failure triage detail |
| Result | `attachments` (trace/screenshot) | evidence artifacts to bundle |
| Result / Run | `duration` / `stats.duration` | perf-regression / timeout signal |

## Source 2 — the concrete gap to "ingestible by Witness"

**Small and purely integrative — nothing new must be emitted.** The schema is machine-readable, versioned, and complete today. The gap is: (1) **enable** the reporter on the target repo (`--reporter=json` / `PLAYWRIGHT_JSON_OUTPUT_NAME`); (2) **map** `stats` + per-test `status`/`expectedStatus` + per-result `retry`/`status`/`error`/`attachments` into the evidence-bundle schema (#102); (3) **resolve attachment `path`s** (usually relative to `outputDir`) into the bundle and decide inline-`body` vs. path handling; (4) pin a Playwright version, since the JSON shape can evolve across releases. No emission code, no format invention — an ingestion adapter.

---

## Net for the #102 evidence-bundle contract

The first honest Witness vertical can ingest **Playwright JSON as structured evidence today** (adapter-only work). It **cannot** ingest Sentinel `audit-test` verdicts as structured evidence until a JSON emission mode is added to the skill — which ADR-0002 explicitly assigns to the evidence pipeline / Witness, not to Sentinel's build. So the credible first-bundle contract is: **Playwright results as parsed data + Sentinel audit-test output as an attached human-facing Markdown verdict** (opaque, not parsed), with a follow-up to define and emit `audit-test`'s structured label schema when Witness needs it as data.
