# Sentinel skill-eval harness

A lightweight harness that catches a skill regressing **before a user does** — the running
skeleton for [#74](https://github.com/TzolkinB/skills/issues/74). Design and grading stance are
fixed by [ADR-0022](../docs/adr/0022-skill-eval-harness-asserts-tokens-judges-prose.md).

It is deliberately narrow. It does **not** re-litigate whether the skills work (the blinded
[experiments](../docs/experiments/) do that); it protects against a skill edit silently degrading,
on every change, cheaply.

## Three tiers of rigor

| Tier | What | When | Cost | Status |
|---|---|---|---|---|
| **0 — lint** | static checks over `SKILL.md` | every commit | free, no model | ✅ built (`lint.mjs`) |
| **1 — fixture-outcome** | run a skill on its fixture, grade the run | every *changed* skill | 1 agent run × trials | ✅ `audit-test` slice (`run-eval.mjs`) |
| **2 — experiment** | blinded sensitivity/specificity | occasional, ADR-gating | high, manual | existing, unchanged |

This harness is the missing **middle** tier.

## Grading stance (ADR-0022)

- **Assert on tokens, not prose.** Deterministic regex over the `**Verdict:**` emoji, a route name,
  a filename — cheap, model-free, fails fast.
- **Judge the prose against the fixture rubric.** Each `must_surface` / `must_not` item comes
  straight from the skill's `expected-findings.md`. `--judge=llm` is the real grader
  (ADR-0022 §Decision.2): a cheap model (Haiku 4.5) scores each item and must quote a **verbatim**
  transcript line, which the harness re-checks is a real substring before it counts — the
  anti-rubber-stamp gate. `--judge` defaults to **`llm` when `ANTHROPIC_API_KEY` is set**, else the
  **offline anchor-keyword `heuristic`**; pass `--judge=heuristic` to force the free offline grader.
- **Never diff prose.** No golden files, no snapshots — this upholds [`fixtures/README.md`](../fixtures/README.md).
- **Outcomes, not paths. Isolated runs. N trials → a reliability number. Label, don't gate** (yet).

## Layout

```
evals/
  lint.mjs                     Tier 0 — static SKILL.md lint
  run-eval.mjs                 Tier 1 — fixture-outcome runner
  lib/grade.mjs                token asserts + judge dispatch (heuristic | llm)
  lib/judge-llm.mjs            LLM judge — zero-dep fetch to the Messages API, quote-grounded
  cases/audit-test.json        a case = verdict token + must_surface + must_not (from expected-findings)
  samples/
    audit-test.*.pass.md       faithful run — dry-run grades this, expects PASS
    audit-test.*.fail.md       hollow run  — self-test grades this, expects FAIL
    lint/noop-skill/SKILL.md   seeded no-op + dead link for lint --self-test
```

## Run it

```bash
# Tier 0 — lint the suite (exit 1 on any error; --strict fails on warns too)
node sentinel/evals/lint.mjs
node sentinel/evals/lint.mjs --self-test        # prove the detectors fire on a seeded skill

# Tier 1 — grade against recorded samples. Uses the LLM judge when ANTHROPIC_API_KEY
#          is set; add --judge=heuristic to force the free offline grader.
node sentinel/evals/run-eval.mjs --dry-run   cases/audit-test.json --judge=heuristic
node sentinel/evals/run-eval.mjs --self-test cases/audit-test.json --judge=heuristic   # proves discrimination, free

# Tier 1 — real LLM judge (needs ANTHROPIC_API_KEY). --self-test IS the judge meta-eval:
# it must PASS the faithful sample and FAIL the hollow one before you trust the judge.
ANTHROPIC_API_KEY=… node sentinel/evals/run-eval.mjs --self-test cases/audit-test.json --judge=llm

# Tier 1 — live: isolated worktree + real agent, N trials, reliability report
node sentinel/evals/run-eval.mjs --live cases/audit-test.json --trials=3 \
     --agent='claude -p {prompt}'
```

`--self-test` is the harness's own regression guard: it confirms the grader **passes** a faithful run
and **fails** a hollow one (wrong verdict, missing findings, or a boundary violation like proposing to
delete the test). If that ever stops discriminating, the harness is broken.

## Cost

Free paths cost nothing: all of `lint.mjs`, and any run with `--judge=heuristic`. Only `--judge=llm`
and `--live` spend — and note **`--judge` defaults to `llm` when `ANTHROPIC_API_KEY` is set**, so
`--dry-run` / `--self-test` do make API calls in a key-exported shell unless you pass `--judge=heuristic`.

- **The LLM judge is negligible.** Each call is ~830–945 input + ~180 output tokens on Haiku 4.5
  ($1 / 1M in, $5 / 1M out) ≈ **$0.0018 / call**. A judge meta-eval (`--self-test --judge=llm`, 2
  calls) ≈ **$0.004**; a full fan-out (~6 skills × 2 cases × 3 trials ≈ 36 calls) ≈ **$0.07**. Billed
  as prepaid **usage credits** (Console → Billing, $5 minimum — which covers ~2,700 judge calls); no
  subscription is needed for the raw API.
- **`--live` is the real cost driver — and may not hit your API key at all.** Before grading, it runs
  a real coding agent (`claude -p "/audit-test …"`) to *produce* each transcript: roughly
  **$0.20–$0.40 / trial on Opus 4.8** (~150× the judge). If your Claude Code is authenticated via a
  **Claude Pro/Max subscription**, those agent runs cost **$0 in API credits** and only the judge's
  raw `fetch` bills the key; if Claude Code is **API-key-billed**, the agent runs are the whole bill.

Figures are estimates from a chars/token heuristic; `messages/count_tokens` gives exact numbers.

## What's honest about this skeleton

- **Two judges.** `--judge=llm` (Haiku 4.5, quote-grounded) is the real grader and the default when
  `ANTHROPIC_API_KEY` is set; `--judge=heuristic` is the free offline fallback (anchor-keyword
  matching — can match in the wrong place). **Meta-eval the LLM judge before trusting it** —
  `--self-test --judge=llm` must pass
  the faithful sample and fail the hollow one (passed on `audit-test`, Haiku 4.5, 2026-07-15). Token
  asserts and the lint stand on their own regardless.
- **Dry-run grades a recorded transcript**, not a live skill run — it exercises the *grading pipeline*
  offline. `--live` is the real thing and is wired, but nothing here calls a model unless you pass it.

## Next (per #74)

1. ✅ **Done** — `--judge=llm` built, meta-eval'd green (Haiku 4.5, 2026-07-15), and now the default
   when `ANTHROPIC_API_KEY` is set; `heuristic` is the free offline fallback.
2. Fan out `cases/` to the other verdict-emitting skills: `debug-test`, `contract-guard`, `e2e-impact`.
3. **Phase 1b** — a `should-route` / `should-NOT-route` case set for `ask-sentinel` (the acceptance
   test for [#47](https://github.com/TzolkinB/skills/issues/47)).
4. **Phase 2** — detect the changed `SKILL.md` and run only its eval + lint; report first, gate later.
