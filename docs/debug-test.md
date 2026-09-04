# debug-test — diagnose a failing Playwright test, no describing required

> **Agent instructions:** [`skills/debug-test/SKILL.md`](../skills/debug-test/SKILL.md)
>
> **Run:** `/debug-test tests/my.spec.ts` (add `--flake` for flake mode, `--drift` for drift mode)

## What it does

If a Playwright test fails, `debug-test` reads and runs it, instead of asking you to describe it. It applies fast QA heuristics across three angles: setup, assertion, and code logic. It routes what it does not resolve on its own. A locator or timing failure goes to the Playwright healer. This is a tool that automatically rewrites a broken locator or wait condition, so the test passes again. A logic failure goes to Matt Pocock's `diagnosing-bugs` skill.

`debug-test` catches the quick wins itself: a missing `await`, a loose assertion, or a fixture that never fires. For each, it reports a root cause and a one-line fix.

When `debug-test` hands a locator or timing failure to the healer, it does not take the healer's green result at face value. **Step 4.5 classifies the heal** from `git diff`:

- A selector or wait touch-up clears on the diff alone. No mutation is spent on this low-risk, common case.
- A changed _expected value_ is the sign of a healer that greens a red test by rewriting what it asserts. This case routes to [`audit-test`](./audit-test.md)'s baseline-lock check, and `debug-test` reports that verdict before it says "done."
- A rewritten setup or fixture is never auto-cleared. This kind of heal changes the test's story, not just its mechanics.

Each of the three buckets, including the cheap one, also gets a proposed `Healed-by:` / `Heal-bucket:` commit-trailer block. This block is proposed, never written, because `debug-test` does not own the commit.

Right after that, **Step 4.6 checks whether this is a repeat.** It reads the test file's own git history: `git log --follow`, filtered on the `Heal-bucket` trailer that Step 4.5 proposed. It reads the _union_ of the shared trunk and the current branch, so a teammate's already-merged heal is not invisible just because this branch has not rebased. If the same bucket shows up three or more times in the last 90 days, this heal included, `debug-test` flags 🔁 **repeat-heal**: a test that keeps getting patched for the same reason, instead of fixed at the root.

Nothing is stored to make this work. `debug-test` computes the count fresh from git every time. If a repo has not carried the trailer into its commits, or the read hits a shallow clone, it falls back to a weaker signal: a plain file-churn count, or an explicit "history may be truncated" flag. `debug-test` states this out loud, instead of quietly reporting "no repeats."

Its **flake mode** (`--flake`) handles the special case most teams get wrong. Most teams `.skip()` a flaky test, or delete it. This is a silent capitulation: it throws away the real signal the test usually guards. Flake mode instead follows three steps — **detect, quarantine, route**. It measures the flake rate with the framework's _own_ burn mechanism. It quarantines the test, non-blocking and never deleted. It routes the _suspected_ cause to the skill that confirms it.

Its **drift mode** (`--drift`) handles a different special case: a _deterministic_ red on a test that was long green, where nothing in the local diff explains the failure. This is the sign of an external service that changed its contract, with no local code change to explain the red. Drift mode does not assume a local regression, and it does not silently blame the provider. It classifies the failure from static signals, in this order: diff relevance, then timing, then the published contract. It quarantines the test, non-blocking. It surfaces the mismatch for a human to decide on. Drift mode never heals the test to green.

## When to reach for it

| Your situation | Where to go |
| --- | --- |
| A `*.spec.ts` test is red, and you want it diagnosed and routed without writing up the problem first | **`/debug-test tests/my.spec.ts`** — this page |
| A self-healer turned a red spec green, and you want to know _what it changed to get there_ before you trust the result | **`/debug-test`** — Step 4.5 classifies the heal from the diff |
| A test fails intermittently, and you want it quarantined with its signal preserved, instead of skipped and forgotten | **`/debug-test --flake`** |
| A long-green test suddenly turned red, and the local diff does not touch anything the test exercises | **`/debug-test --drift`** — checks for an external contract change before you assume a local bug |
| The failure is not Playwright (Jest/Vitest/pytest) | [`diagnosing-bugs`](https://github.com/mattpocock/skills) directly — `debug-test` is scoped to Playwright (flake mode also handles Cypress) |
| You want to file the failure for the team, not diagnose it | [`bug-report`](./bug-report.md) |
| You want a teaching walkthrough | Not `debug-test` — it is procedural and does not support `--explain` |

## Prerequisites

Most of these skills need only Claude Code. `debug-test` is different: it orchestrates external tooling.

- **Playwright** — required. The skill runs `npx playwright test` and is scoped to it.
- **Playwright agents** (`npx playwright init-agents`, once per repo) — optional. This enables the healer's locator and timing auto-repair. Without Playwright agents, those failures fall through to `diagnosing-bugs`.
- **Matt Pocock's `diagnosing-bugs` skill** — the terminal route for logic bugs. Without it, `debug-test` still triages the failure, but it has nowhere to hand a deep diagnosis.

See the README's [Dependencies](../README.md#dependencies) table for install commands, and for what degrades when a tool is missing.

## Worked example

Fixture: [`fixtures/debug-test/`](../fixtures/debug-test/) ([expected findings](../fixtures/debug-test/expected-findings.md)).

```
/debug-test fixtures/debug-test/checkout.spec.ts
```

The test ends with an un-awaited web-first assertion:

```ts
expect(banner).toBeVisible(); // BUG: missing await
```

Playwright's web-first assertions are async, and they retry automatically. Without `await`, this line returns a floating promise that never settles. This makes the assertion one that never fails. `debug-test` catches it with its quick QA heuristics alone: a 🟢 High-confidence root cause, plus the one-line fix, `await expect(banner).toBeVisible()`. It does _not_ route to the healer or to `diagnosing-bugs`, because the failure is neither a locator or timeout error, nor a value mismatch.

## It's Working If

- A locator or timing heal clears on the diff alone without spending a mutation, but a rewritten expected value always routes to `audit-test`'s baseline-lock check before `debug-test` reports "done."
- The repeat-heal count reads fresh from git every time — nothing is stored — and a truncated or shallow clone is flagged out loud, not silently undercounted.
- Flake mode never deletes or silently skips a test — it quarantines, non-blocking, and routes the suspected cause onward.
- Drift mode never heals a test to green on its own — it classifies the failure and surfaces the mismatch for a human to decide.
- Commit-trailer blocks are proposed, never written — `debug-test` does not own the commit.

If `debug-test` ever marks a healer's pass as "done" without checking the diff, or heals a drift failure to green on its own, that is a bug — file it. See [Contributing & Support](../README.md#contributing--support).

## FAQ

**Q: Does a healer's green result mean the test is trustworthy again?**
A: No — a pass is a _change_, not a result. Step 4.5 reads the diff: a selector or wait touch-up clears on the diff alone, but a changed expected value always routes to `audit-test`'s baseline-lock check first.

**Q: What happens if the repo hasn't carried the `Heal-bucket` trailer into its commits, or the read hits a shallow clone?**
A: `debug-test` falls back to a weaker signal — a plain file-churn count, or an explicit "history may be truncated" flag — and states the degraded signal out loud instead of quietly reporting "no repeats."

**Q: Does flake mode delete or skip the flaky test?**
A: No. It quarantines the test, non-blocking and never deleted, and routes the suspected cause to the skill that confirms it.

**Q: Does drift mode ever conclude that the external provider is at fault?**
A: No. It classifies the failure from static signals and surfaces the mismatch. A human decides whether to update the stale test or escalate a suspected break.

## Where it fits

`debug-test` is the one skill that lives in **two** places in the [QA flow](./qa-compass.md):

- **Standalone**, the moment a single spec goes red — diagnose and route the fix.
- **Inside the `/qa-pass` chain** — the orchestrator runs `debug-test` over any failing tests it finds on the branch, before it reaches a verdict.

This is what separates `debug-test` from [`threat-model`](./threat-model.md) and [`bug-report`](./bug-report.md), which sit deliberately _outside_ the `/qa-pass` chain.

Downstream, the routing depends on the failure:

- A confirmed logic bug hands off to `diagnosing-bugs`.
- A flaky test `debug-test` does not fix on its own routes to [`qa-review`](./qa-review.md), [`audit-test`](./audit-test.md), or [`prune-tests`](./prune-tests.md), depending on the suspected cause.
- A suspected external contract change routes to [`bug-report`](./bug-report.md) for a cross-team report, or to [`contract-guard`](./contract-guard.md) when the harder job is needed — locating and diffing the provider's published contract.

## Anti-patterns

- **Describing the bug instead of pointing `debug-test` at the test.** The whole premise is that the skill reads the file, so you do not have to narrate the problem.
- **Using it outside Playwright.** For other runners, `diagnosing-bugs` is the direct route.
- **`.skip()`-and-forget on a flaky test.** That discards a real signal. Flake mode quarantines and routes the test instead. (Deletion _with_ a confirmed cause is [`prune-tests`](./prune-tests.md)'s call.)
- **Treating a flake-mode cause as fact.** Detection and quarantine are reliable. The cause is a routed suggestion for a skill that confirms it.
- **Treating a healer's pass as a result.** A pass is a _change_, not a result. A locator re-sync and an assertion rewritten to bless a regression both end in green. Only the diff tells them apart, and that is what Step 4.5 reads.
- **Expecting `debug-test` to write the commit trailer.** It proposes the block. A human — or the repo's own commit template, or its `prepare-commit-msg` hook — applies it. A heal that is never committed leaves no record. That limit is accepted, not worked around.
- **Healing a test to green after an external contract changed, or deciding on its own that the provider is at fault.** Drift mode classifies the failure and surfaces the mismatch. A human decides whether to update the stale test, or escalate a suspected break.
