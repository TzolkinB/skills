# Baseline check: is this test already red on the base commit?

Runs once, before Step 1 of the main flow. Skip it for `--flake` and `--drift` (drift mode never runs anything; flake mode has its own burn). Definitions of the labels live in [baseline-failures](../../shared/baseline-failures.md).

## Why it comes first

If the test already fails on the base branch, your change did not break it. Healing it, or diagnosing it as a bug in your change, sends you after the wrong cause.

## Steps

1. **Find the base commit.** `git merge-base HEAD origin/<default-branch>`. Resolve the default branch dynamically, never hardcode `main`. No `origin` remote, or the same commit as `HEAD`: say "baseline not checked" and go to Step 1.
2. **Check for a supplied baseline.** If the caller gave a known-failures list and it names this test with the same error first line, label it **pre-existing** and skip step 3.
3. **Run the one test on a detached worktree** of the base commit, in a temp directory outside the repo:
   ```bash
   git worktree add --detach "$TMP/base" "$BASE_SHA"
   ```
   Run the same command Step 1 would run, from that directory. It needs the project's dependencies: link or reuse `node_modules`. If the test cannot run there (missing dependencies, a build step, a service), label it **unknown** and say why. Remove the worktree when done (`git worktree remove --force`). Never touch the working tree you were given.
4. **Label it** using the table in the shared file, and read the error first line from the base run.

## What each label does

- **pre-existing** → stop. Report that the test is already red on the base commit, with the base SHA, the shared error line, and (if known) the owner. Do not heal and do not diagnose it as a defect in this change.
- **new** → continue to Step 1.
- **flaky** → follow [flake-mode](flake-mode.md).
- **unknown** → continue to Step 1 and print "baseline not checked: [reason]" in the report.

## Cost and limits

One extra run of one test, never the suite. A test that is red on base for a flaky reason can read as pre-existing from a single run; the label says "one run".
