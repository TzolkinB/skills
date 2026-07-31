# debug-test — Repeat-Heal Check (Step 4.6)

Loaded from Step 4.5, immediately after this heal is classified and a trailer proposed. #190
answers *"what did this heal change?"*; this step answers the question #190 has no way to answer
alone — *"has this test been healed this way before?"* One locator touch-up is nothing. The fourth
locator touch-up on the same spec in six weeks is a test that keeps getting patched instead of
fixed, and only the pattern across heals surfaces that
([#194](https://github.com/TzolkinB/skills/issues/194)).

[ADR-0047](../../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2
decided how: no new store. #190's Step 4.5 already writes the classification as commit trailers
(`Healed-by:` / `Heal-bucket:`) on the commit that carries the heal; this step reads them back with
`git log --follow`, computed fresh every time. Two rules hold throughout:

- **Read git, never re-derive a store.** Nothing here is written or cached between invocations —
  every run starts from `git log` and ends when this report does. If a repo hasn't wired up a way to
  land the trailer reliably (commit template, `prepare-commit-msg` hook, or just habit), that's a
  gap in *their* commit discipline, not a reason to build a side-channel around it.
- **State what history was available, never silently.** An empty or trailer-less read is not "no
  repeats" — it's "no evidence either way," and the finding must say which one it is. Same
  discipline as drift mode's "state the signal is absent, don't fabricate," and #198's denominator
  honesty.

## R1. Resolve the target and read the window

**Read the shared trunk, not just the local branch.** On a team repo, `git log HEAD` alone has a
blind spot in both directions: a teammate's heal merged into the shared trunk *after* this branch
diverged is invisible to it, while a heal already committed earlier in *this* branch (unmerged) is
invisible to reading the trunk alone. Git resolves this natively — pass more than one starting
commit and `git log` walks the union of everything reachable from either, de-duplicating shared
ancestry:

```bash
git fetch origin --quiet
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')
```

Don't hardcode `main` — repos also use `master` or `trunk`, and guessing wrong silently narrows the
read. If `DEFAULT_BRANCH` comes back empty (no `origin` remote — a local-only repo, or a fresh clone
where `origin/HEAD` was never set), the read falls back to `HEAD` alone; **say so explicitly** in the
report rather than presenting a branch-only read as the full team history.

```bash
git log --follow --since="90 days ago" \
  --format='%h %ci%n%(trailers:key=Heal-bucket,valueonly)%n%(trailers:key=Healed-by,valueonly)%n---' \
  ${DEFAULT_BRANCH:+"origin/$DEFAULT_BRANCH"} HEAD -- <test file>
```

Refs go before `--`, the single pathspec goes after — `--follow` accepts exactly one pathspec, but
any number of starting commits. Each record is: short SHA, date, `Heal-bucket` value (blank line if
the trailer is absent), `Healed-by` value (blank line if absent), then the `---` separator.
`--follow` matters on top of the union — a renamed spec file still carries its heal history.

**Check for a shallow clone before trusting a thin or empty result:**

```bash
git rev-parse --is-shallow-repository
```

`true` means history was truncated at clone time — common on CI runners cloning with `--depth`. An
apparent "no prior history" or a suspiciously low count off a shallow clone is an artifact of the
clone, not evidence the file is new or clean; report the shallow flag explicitly whenever it's `true`
rather than letting a truncated clone read as a clean one.

The **current** heal (the one Step 4.5 just classified) is not in git yet — it's uncommitted. Don't
try to read it back; add it to R2's count directly, from the bucket Step 4.5 already assigned.

If the command returns nothing at all, and the repo isn't shallow, that's not "clean" — it's **no
prior history**: either the file is new, or nothing touched it in the window. Say exactly that ("no
prior history — first heal on record for this file") and stop; there is nothing to bucket or fall
back to.

## R2. Determine which reading applies

ADR-0047 §2's ladder has exactly two rungs — trailer present or trailer absent — and this step
doesn't add a third. Grade the trailer coverage across the commits returned:

| Reading | When | What it gives you |
|---|---|---|
| **Bucket-accurate** | *every* commit in the window that touched this file carries a `Heal-bucket` trailer | exact per-bucket counts — proceed to R3 on the real buckets |
| **Churn-only** | *any* commit in the window is missing the trailer — whether none carry it (heals predate #190, or the repo never wired trailers into its commits) or only some do (a human dropped one, or a squash-merge collapsed several heals into one commit that kept only one trailer block) | no bucket breakdown — degrade all the way to a plain file-churn count (R3's churn variant), per the ADR's own resolution of the mixed-coverage case |

One missing trailer is enough to drop the whole read to churn-only — there is no intermediate
"mostly-bucketed" credit. Never silently upgrade a churn-only read to a clean bucket count; the
reading itself is part of what gets reported (see Output Format).

## R3. Threshold and finding

**Bucket-accurate reading:** default threshold is **3 or more heals of the same bucket within the
window, this heal included**. At or above threshold → 🔁 **repeat-heal**, naming the count, the
bucket, and — from commit subjects/dates where available — which element or behavior each
occurrence touched (e.g. "3 `locator` heals on this spec in 41 days: nav link selector twice, now
the settings-menu selector"). Below threshold → still report the count
("2 prior `locator` heals in the last 90 days, below the 3-heal threshold") rather than staying
silent just because nothing fired — the read happened and should be visible.

**Churn-only reading:** there's no bucket to threshold, so the same default (3+) applies to a plain
edit count instead: 🔁 flagged as **elevated churn**, explicitly weaker than a bucket-based finding
— no bucket, no per-occurrence detail, just *"this spec has been modified N times in the last 90
days (no `Heal-bucket` trailers found — falling back to file churn)."*

The 90-day / 3-heal defaults are a starting point, not a fixed law — a repo can tune either; state
whatever values were actually used in the report so the finding is reproducible.

## R4. What this is not

- **Not signature-matching.** ADR-0047 dropped normalized failure-fingerprint matching deliberately
  — bucket + frequency is what the named use case (spot a recurring heal, drive a process change)
  needs. If exact-signature matching is ever genuinely wanted, that's a new decision and a new ADR,
  not a quiet addition here.
- **Not a gate.** 🔁 repeat-heal is a finding for a human to act on — dig into the root cause, or
  accept the churn as expected for this spec — never a block on the heal itself.
- **Not retroactive.** A heal made before #190 shipped left no trailer to read; it only ever shows
  up in the churn fallback, and that's an accepted limit, not a bug in this step.

## Output Format

```
### Repeat-heal check (Step 4.6)
History read: [window] from [origin/<default-branch> ∪ HEAD | HEAD only — no origin remote found][ · ⚠️ shallow clone, history may be truncated] · [bucket-accurate | churn-only (missing/no Heal-bucket trailers found) | no prior history]
[🔁 Repeat-heal — N heals of `[bucket]` in [window], this one included: [what each occurrence touched] | N heals of `[bucket]` in [window], below the 3-heal threshold | 🔁 N total edits to this file in [window] (churn fallback, no bucket data) | first heal on record for this file]
```
