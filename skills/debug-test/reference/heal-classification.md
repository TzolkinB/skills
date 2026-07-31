# debug-test — Heal Classification (Step 4.5)

Loaded from the main skill's Step 4, the moment the Playwright healer reports a pass. A healer pass is not a result — it is a **change**, and the branch logic this step replaces ("healer passes → done") could not tell a locator touch-up from an assertion rewritten to bless a regression. The second is the self-healer failure mode this repo exists to catch: the test goes green, still kills mutations, and now *enforces* the bug — proven in EXPERIMENT-0002, where a blinded healer greened a red test by editing `toHaveCount(12)` → `toHaveCount(10)` to match a broken deck ([ADR-0017](../../../docs/adr/0017-audit-test-baseline-lock-suspected.md)). What separates the two cases is the diff, and the diff is already sitting there.

Two rules hold throughout:
- **Classify from the diff, never from the healer's account of itself.** "The healer says it fixed the selector" is a self-report; `git diff` is the artifact. Only the second is re-derivable by a reviewer.
- **Propose, never write.** This step runs at the moment a commit is being made, so it also proposes the commit trailers that make the classification durable — but `debug-test` does not own the commit and **never creates or amends one** ([ADR-0047](../../../docs/adr/0047-statelessness-is-a-write-boundary-git-is-the-ledger.md) §2: no skill here writes a store; git is the ledger).

## H1. Get the diff

Before invoking the healer (Step 4), record `git status --porcelain -- <test file>`. After the pass:

```bash
git diff -- <test file>      # what the healer actually changed
git diff --name-only         # did it stay inside the test file?
```

- **Tree was already dirty on that file** → the diff conflates the healer's edit with edits that were there first. Classify best-effort and **say so** — never present a mixed diff as the healer's work. (Same reason `audit-test` and `prune-tests` refuse to run on a dirty tree: an edit you can't attribute is an edit you can't classify.)
- **Empty diff** → the healer changed nothing, so there is nothing to classify and nothing to record. A pass with no edit means the red was environmental or non-deterministic — go back to Step 1's flake check rather than reporting a clean heal.
- **Files changed outside the test file** (a page object, a fixture module, production source) → never cleared here. Report the extra paths and require human review: a "heal" that edits production source is a code change wearing a test change's clothes. This is a flag on top of the bucket, not a fourth bucket — the trailer still carries whatever the *test file's* own diff scored (and if the test file didn't change at all, nothing was healed: no bucket, no trailer, just the paths and the review).

## H2. Bucket the diff — three buckets, one vocabulary

| Bucket | What the diff shows | `Heal-bucket:` | Disposition |
|---|---|---|---|
| **Selector / timeout / wait only** | a locator string, role/test-id, `timeout:`, an added or lengthened wait | `locator` | done, as before — **H5** trailer only |
| **Expected-value literal changed** | the argument to an assertion: a count, string, status, threshold, enum | `assertion-value` | **H3** — baseline-lock check |
| **Setup / fixture / flow changed** | `beforeEach`, fixture data, seeded state, step order, a step added or dropped | `flow-data` | **H4** — no auto-clear |

The trailer values are exactly these three; they are the vocabulary [#194](https://github.com/TzolkinB/skills/issues/194) reads, so don't coin a fourth or rename one.

- **An assertion *removed* (or `.skip()`ed) is not an expected-value change** — it's the story changing. Bucket it `flow-data` and take H4's disposition; a deleted assertion is coverage loss, and only `prune-tests` removes coverage with justification.
- **Mixed diff → worst wins**, in the order `flow-data` > `assertion-value` > `locator`. Run the disposition for **every** bucket that fired, but emit **one** trailer line carrying the worst. Accepted cost, named so it isn't rediscovered: a mixed heal's cheap half never reaches #194's per-bucket count. The alternative — several `Heal-bucket:` lines — is a second vocabulary for the read side to reconcile, which is the thing the taxonomy exists to prevent.

## H3. Expected-value → hand it to audit-test's baseline-lock check

Invoke `/audit-test <test file>` (via the **`Skill`** tool) and ask for the [Baseline-lock check](../../audit-test/reference/baseline-lock-check.md) on the co-change. Don't re-implement it here — `audit-test` owns it, and this is the same self-invoking seam that reaches `diagnosing-bugs` ([ADR-0010](../../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md)).

**Pass the co-change in the invocation — don't assume `audit-test` can find it.** The check's primary signal is an assertion diff, and it normally reads one that `--changed` resolved from `git diff --name-only main...HEAD` — *committed* changes. The healer's edit is sitting uncommitted in the working tree, so a bare `/audit-test <file>` reaches the check with nothing to read and correctly reports "couldn't run" — on the one case this step exists for. Two more things the invocation has to carry: `audit-test` funnels (only tests flagged in its Step-3 triage advance), and its baseline-lock check hangs off the 🟢 branch of Step 4, so a freshly-healed test that triages clean would never reach it. State the suspicion so the funnel keeps it.

```
Skill: /audit-test <test file>
  Suspected baseline-lock (from debug-test Step 4.5) — treat this test as a triage suspect.
  Assertion co-change, uncommitted, from the Playwright healer:
    - await expect(cards).toHaveCount(12);
    + await expect(cards).toHaveCount(10);
  Pre-heal failure: [the red the healer was handed]
  Run the Baseline-lock check against this diff (signal 1). If the in-code source of truth
  disagrees with the new value, that's signal 2.
```

Report the verdict **inline, before "done"** — one of:
- **⚠️ Baseline-lock suspected** — show the co-change (`old → new`) and the intent source it contradicts. Not a failed heal: a question for the human — restore the intended value, or update the code's declared intent to match. Never green-locked on this skill's authority.
- **Clean** — the changed value is consistent with the code's declared intent; the heal stands.
- **Couldn't run** — no usable diff and no in-code intent oracle. Say that; do **not** read it as a pass (ADR-0017's third branch: an honest gap beats a fabricated clear).

## H4. Setup / fixture / flow → surface it, don't clear it

This is **healed by changing the story, not the mechanics** — the test now sets up a different world and passes in it. Show the diff verbatim, state what the test used to require versus what it requires now, and require human review. Auto-clear is not available in this bucket.

Do **not** route it to `audit-test`: a mutation answers "does this assertion still bite?", not "is this still the same test?" A rewritten `beforeEach` can kill mutations perfectly while quietly narrowing what the spec ever exercised — no mutation will see that, so spending one here buys a green that means nothing.

## H5. Propose the commit-trailer block

```
Healed-by: debug-test
Heal-bucket: locator|assertion-value|flow-data
```

- **All three buckets get a trailer, `locator` included.** Suppressing the cheap one looks tidy and is the single most damaging thing this step could do: *"the same spec healed four times for a locator"* is precisely the repeat-heal pattern #194 exists to surface, and it is invisible without the cheap rows.
- **Proposed, never applied.** Print the block for the human to paste, or for the repo's own `commit.template` / `prepare-commit-msg` hook to enforce. A repo that wants this reliably wires it up itself; this skill does not commit.
- **Accepted limit, don't try to solve it:** a heal that is never committed is invisible to this record. ADR-0047 names that cost; closing it would mean owning the commit, which is out of scope.
- **Nothing is stored.** The read side (`git log --follow` over the test file, filtered on the trailer, counted per bucket — plus a churn fallback when trailers are absent) is [#194](https://github.com/TzolkinB/skills/issues/194)'s job, computed at read time from what git already holds.

## Output Format

```
## debug-test (heal): [Test Name]

### Healer → passed
[what the healer reported, one line]

### Heal classification → [Selector / timeout / wait only | Expected-value literal | Setup / fixture / flow]
`git diff -- [test file]`: [what changed — old → new]
[assertion-value] → /audit-test Baseline-lock check: [⚠️ Baseline-lock suspected — [signal] | clean | couldn't run: no diff, no in-code oracle]
[flow-data] ⛔ Not auto-cleared — was: [what the test required] → now: [what it requires]. Human review required.

### Healing justification
[what changed] · [which check ran] · [verdict]

### Proposed commit trailers  (proposed, not applied — debug-test does not own the commit)
Healed-by: debug-test
Heal-bucket: [locator | assertion-value | flow-data]
```
