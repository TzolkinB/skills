<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# Experiment #264: generate, then audit (Memory app)

All runs below are T3 (I ran them). Items marked "inference" are not.

## Summary
- 8 tests mutated, one careful mutation each, on the dev server. Result: 8 RED, 0 GREEN, 0 invalid.
- On this app, the agent-generated suite caught every mutation I tried.
- Two extra single-guard mutations were equivalent (invalid). Together they were RED.
- Throw-first gave the same verdict as the careful mutation on 3 of 3 tests.
- One app, one suite, 8 tests. This does not show the pairing "works" in general.
- Recommendation: keep the label Unexamined. Maybe move to Likely, not Confirmed (see end).

## Provenance (from git, not guessed)
- First commit `9f1317b` (2026-03-16) adds `.github/agents/playwright-test-{planner,generator,healer}.agent.md`, `specs/memory-game.md` and all specs plus `seed.spec.ts` in one go. That fits planner -> generator output.
- Every spec except `seed` and `shuffle` has headers `// spec: specs/memory-game.md` and `// seed: tests/seed.spec.ts`.
- `shuffle.spec.ts` and `seed.spec.ts` have no such header. `shuffle.spec.ts` is a Node unit test of `src`.
- `restart-functionality.spec.ts` came in `bde8c06` as "scenario 2", also carrying the headers.
- Hand or tool edits afterward: `4ffc5bb` ("fixed card-flipping failing test", also edits `card-interactions.spec.ts`). `2c1dfa1` ("clean up tests") rewrote assertions in all core/edge/restart specs: added assertion messages, moved `goto` into `beforeEach`, replaced `waitForTimeout(1000)` with web-first assertions.
- So: generated first, then edited at least twice by the owner or a tool. History cannot say who did what. Not pure generator output.
- Also: `src` was edited in the same commit as the first tests (`Card.tsx`, `Main.reducer.ts`, adding the test ids and seeded shuffle).

## Baseline
- Dev server: `VITE_SHUFFLE_SEED=42 npx vite --port 5199`. I set the seed because the repo's own webServer command sets it and the tests hard-code card positions.
- Chromium, 1 worker: 12 passed, 0 failed, 25.2s (25.8s wall). Nothing excluded.

## Results (one careful mutation each; all in `src/components/Main.reducer.ts`)
| Test | Mutation | Verdict | Sec | Why |
|---|---|---|---|---|
| card-flipping | `handleMismatch`: keep cards face-up (`nextCards = state.shuffledCards`) | RED | 7.7 | `toHaveCount(0)` got 2 |
| game-initialization | `buildDeck`: drop the `shuffle(...)` call | RED | 6.2 | robot ids at positions differ |
| match-detection | `handleMatch`: blue score never increments | RED | 6.3 | score expected 1, got 0 |
| player-turns | `handleMismatch`: remove the `activePlayer` toggle | RED | 6.3 | "Red Player's Turn" never shows |
| win-conditions | finish check `=== totalPairs + 1` (never finishes) | RED | 12.2 | no win toast |
| card-interactions | `handleFlip`: remove the `isFaceUp` / `matchedIndices` guard | RED | 7.2 | caught by a later face-up count check, not the "matched click ignored" check (inference) |
| restart | `RESHUFFLE` returns `state` unchanged | RED | 11.0 | score expected 0, got 1 |
| shuffle (same seed) | `shuffle` ignores its `random` argument | RED | 1.1 | arrays differ |

Counts: 8 RED, 0 GREEN, 0 invalid.
Mutated-run times include about 5s of Playwright's failure timeout on a missing element. Baseline times for the same tests are 0.2 to 10s.

## GREEN explanations
None among the 8 tests.

Extra probes of the "ignored click" claims in `card-flipping`:
- Remove only the `status === 'checking'` guard: test passed (2.8s).
- Remove only the `selectedIndices.length >= 2` / `includes` guard: test passed (2.2s).
- Both are equivalent mutations: the two guards are redundant, so one alone changes nothing observable. This says nothing about the test (invalid, not GREEN).
- Removing both together: RED (7.4s).

## Throw-first comparison (#258)
| Test | Coarse mutation | Verdict | Sec | Same as careful? |
|---|---|---|---|---|
| match-detection | `throw` at top of `handleMatch` | RED | 6.3 | yes (6.3s) |
| card-interactions | `throw` at top of `handleFlip` | RED | 6.3 | yes (7.2s) |
| restart | `throw` in the `RESHUFFLE` case | RED | 10.4 | yes (11.0s) |

3 of 3 agree, and times were similar. In all three the first click or restart crashes the React tree, so any assertion on the page fails. Inference: throw-first is a cheap reachability control here, but it would not catch an assertion that is live yet weak, because it only proves "the test touches this code".
Both approaches would give the same result on this suite, so I could not show a case where careful beats coarse. No such case occurred.

## Problems met
- Prompt said browsers were installed. Playwright 1.62 wants chromium build 1234; cache has up to 1228. Fix: in the copy's `playwright.config.ts` only, set `launchOptions.executablePath` to the 1228 headless shell. All tests ran on it.
- My first rsync excluded `dist`, which also stripped `node_modules/*/dist`; vite would not start. Re-synced `node_modules` into the copy only. The original was not touched (`git status` there is clean).
- Final state: copy's `src` clean after every mutation (verified by `git status --short src` each time). Only `playwright.config.ts` is modified. Dev server killed, port 5199 free.
- Reachability: tests ran on the dev server, so every mutation reached the app. Fast RED results on all 8 are the control (ADR-0016).
- I did not run the baseline-lock check (needs intent signal). The `2c1dfa1` rewrite changed assertions, so a pinned-wrong-value test is possible but not examined.
- Did not use `.env`. Did not run in or commit to the original.

## Limits
- One app: a small 12-test card game, with logic in one reducer file. Easy to hit with E2E.
- One suite. Edited after generation, so this does not isolate "model-written".
- 8 tests, one mutation each. Mutations were chosen by me to break the named behaviour. A different author might find weaker spots (e.g. visual styling, deck selector, dragon deck have no mutation tried).
- Cypress and other generators not tested. No counts here support a rate; 8/8 RED only says "no hollow test found in this sample".

## Recommendation
- Keep "generate, then audit" labeled Unexamined, or at most Likely. One app with 8 of 8 RED is a weak, one-sided data point. It cannot confirm that AI-generated passing tests are hollow, and also cannot confirm they are solid.
- The honest framing: "In one small agent-generated Playwright suite, audit-test found no false confidence." Do not call it Confirmed until at least 2 or 3 more apps and some GREENs have been seen. A pairing claim needs cases where the audit does find something.
