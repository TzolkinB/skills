# Statelessness is a write-boundary property, and git is the heal ledger

**Status: Accepted (2026-07-30). Supersedes [ADR-0046](0046-does-sentinel-become-stateful.md).**
Decides the fork 0046 named but deliberately left open; tracked as
[#200](https://github.com/TzolkinB/skills/issues/200).

## Context

[ADR-0046](0046-does-sentinel-become-stateful.md) established that
[#129](https://github.com/TzolkinB/skills/issues/129) (calibration loop) and
[#194](https://github.com/TzolkinB/skills/issues/194) (heal-ledger) had each been parked on the same
unnamed dependency — a persistent store — and asked the question once: does this repo ever own one?
It set a bar for adopting one: *"a specific, named use case that a user has actually asked for, not
the general appeal of 'we could learn over time.'"*

Three things resolve that bar which 0046 did not have.

**1. The external demand is real, and it is for the storeless half.** A sweep of every LinkedIn item
this repo has ever ingested (14 across the session history, plus the repo and every GitHub issue
comment) found exactly one that touches either issue: a comment on the 2026-07-29 "generating tests
is becoming a commodity" thread — *"a locator heals, the test stays green, but what it's actually
asserting may have drifted… Trust isn't just 'did this test run.' It's 'does this test still verify
what we think it verifies.'"* That is a demand for classifying **this** heal — which is
[#190](https://github.com/TzolkinB/skills/issues/190) and needs no store. Nothing asks for the
pattern *across* heals, and nothing anywhere asks for calibration; the Kane CLI teardown
(`references/kane-cli-competitive-research.md`) confirms even the closest competitor has no analog.
Calibration is white space, but white space is not demand.

**2. The maintainer named a use case for #194** — detecting tests that are repeatedly healed for the
same reason, in order to drive a process change. That clears 0046's bar. So the live question is not
whether #194 is worth building; it is whether it needs a *new* store.

**3. It does not, because the record already exists.** A heal is a file edit, and file edits land in
git. Git is append-only, commit-anchored, team-visible, diffable, merge-safe, retention-solved, and —
decisively for this repo — **re-derivable by a reviewer**. #190 already `git diff`s the test file to
classify the heal, so the classification exists at exactly the moment a commit is being made.

That third point also re-frames the cost of Option B more sharply than 0046 stated it. The
auditability loss is not only that skills stop being self-contained prose readers; it is that a
ledger-derived finding — *"this test has been healed four times"* — **cannot be re-derived from the
inputs at hand**. A reviewer has to trust the file. That is the same self-report laundering the
hostile critiques already charged Gate with, re-introduced deliberately.

And #129 turns out to have been mis-parked: storage was never its blocker (see below).

## Considered options

- **A — stay stateless, drop both.** Rejected in that form: it retires #129 on a diagnosis
  ("needs a store") that is wrong, and it abandons a use case the maintainer named.
- **B — adopt a persistence layer in this repo.** Rejected. The cost lands on the axis this repo
  sells, buys nothing anyone asked for, and is an ongoing tax rather than a one-time build: rebase
  and cherry-pick duplicate append-only entries, rewritten history orphans commit-anchored ones, and
  the gitignored variant is empty on every fresh CI runner — which is where heals actually happen.
- **C — split the concerns: keep this repo stateless, own the store in a separate repo/plugin that
  these skills read.** Rejected *for now*, though architecturally sound — Gate is already a pure
  consumer of artifacts produced elsewhere ([#139](https://github.com/TzolkinB/skills/issues/139)
  input digests), so the seam exists. It loses on three counts: it relocates the auditability cost
  rather than removing it (an unverifiable ledger is unverifiable whichever repo wrote it); it adds a
  second install where distribution, not capability, is the acknowledged bottleneck; and
  [#99](https://github.com/TzolkinB/skills/issues/99) /
  [#130](https://github.com/TzolkinB/skills/issues/130) already own the "second plugin" track and
  gate it on #129 landing. If a future feature genuinely needs a store, C is the shape to revisit —
  by superseding this ADR, not by working around it.
- **D — statelessness as a write-boundary property; derive longitudinal facts from records that
  already exist.** Chosen.

## Decision

**1. No skill in this repo writes a persistent store.** Statelessness is restated precisely: it is a
property of the **write** boundary, not of what a skill may read. Skills already read artifacts
produced by other processes — Gate ingests Playwright/Cypress JSON and `gate-audit-test/v0.3`
emissions and content-digests every one of them. Reading an artifact that exists is in scope forever;
accumulating one of our own is out.

**2. [#194](https://github.com/TzolkinB/skills/issues/194) is re-scoped and unblocked — git is the
ledger.** No `heal-ledger/v0.1` file, no NDJSON, no retention rule, no signature-normalization
research. Instead:

- **Write side.** #190's Step 4.5 already produces the classification. It emits it as commit
  trailers — `Healed-by: debug-test`, `Heal-bucket: locator|assertion-value|flow-data` — for the
  commit that carries the heal. `debug-test` does not own the commit, so it *proposes* the trailer
  block in its report; a repo that wants this reliably enforces it with a commit template or hook.
- **Read side.** Repeat detection is a `git log --follow` over the test file, filtered on the
  trailer, counted per bucket within a window. Computed at read time; nothing is stored that git does
  not already store.
- **Anchoring** is the commit SHA by construction, so this composes with
  [#177](https://github.com/TzolkinB/skills/issues/177) instead of inventing a second scheme —
  the goal #194 stated and would have had to engineer.
- **Degradation is a ladder, and it is stated rather than hidden.** Trailer present → bucket-accurate
  repeat detection. Trailer absent (dropped by a human, or collapsed by a squash-merge that didn't
  carry it into the squash message) → fall back to test-file churn: *"this spec has been modified six
  times in 90 days"* — no bucket, weaker, always available. Either way the finding reports what
  history **was** available; an empty history is never reported as "no repeats." Same pattern as
  [#198](https://github.com/TzolkinB/skills/issues/198) denominator honesty.

**3. [#129](https://github.com/TzolkinB/skills/issues/129) is NOT retired.** It stays open and
parked, with its blocker corrected and its rationale recorded — see the next section.

**4. [`comparisons/tea.md`](../comparisons/tea.md) is corrected.** Its calibration seam currently
reads *"TEA is stateless; Gate becomes the memory, fed by TEA's own audit trail"* — a promise that
this repo accumulates state, which this ADR forbids. The honest version is that the labelled record,
if it is ever assembled, is read from where it already lives.

## Why #129 stays open — recovered rationale

Recorded here because judging it cold, without this, is what nearly retired it.

**Where it came from.** #129 was folded into epic [#49](https://github.com/TzolkinB/skills/issues/49)
from the closed [#96](https://github.com/TzolkinB/skills/issues/96) Part A, which came out of the #47
tool-research pass on TEA. Verified at TEA's own docs on 2026-07-17: TEA has no mutation, no numeric
release confidence derived from execution evidence, and **no calibration** — no override logging, no
agreement tracking, no learning. #96 named those two absences, mutation proof and calibration, as
*"the uncontested ground"* for answering "why not just TEA?" One half shipped as `audit-test`.
Calibration is the other half, and it is the reason the answer is two items long instead of one.

**What else it holds up.** Most load-bearing, from epic
[#49](https://github.com/TzolkinB/skills/issues/49)'s caveats, sourced to
`references/orchestration-map.md`: *"the calibration loop is what earns it the verdict (currently
Unexamined/PARKED)."* That is not a feature note — it is the stated condition under which Gate's
`ship` stops being advisory and becomes a verdict. Retiring #129 would therefore be a decision that
**Gate is permanently advisory**, which is a product-level call about what this repo is, not a
storage cleanup, and it must not be made as a side effect of one.

Downstream of that: [#99](https://github.com/TzolkinB/skills/issues/99) decided Gate earns plugin
independence *when calibration lands*, and [#130](https://github.com/TzolkinB/skills/issues/130)
exists only so that trigger isn't rediscovered as an open question. Gate's schema forbids any numeric
field on purpose, and its arrival is the deliberate signal this has landed (`gate/SKILL.md`, "No
manufactured number"). Retiring #129 silently retires the trigger and leaves that guard with no
stated end condition.

**Its actual blockers** — replacing "needs a store," which was never true:

1. **No labelled outcomes.** A store of gate decisions and overrides supplies the X and never the Y.
   An override records a human's opinion *at gate time*; nothing writes back whether the override was
   vindicated. A loop trained on that calibrates toward agreeing with whoever overrides, not toward
   predicting escapes. #96 leveled this exact criticism at TEA — *"does not track whether that
   override was later vindicated"* — and it applies to us identically.
2. **No usage.** There is nothing to calibrate against until the categorical gate is in real use at
   volume. This is the reason every prior wayfinder pass parked it, and it is unchanged.
3. **The labelled record, if it ever exists, most likely lives elsewhere.**
   [`tea.md`](../comparisons/tea.md) already identifies TEA's WAIVED decisions as an audit-trailed
   override record. Reading such a record is consistent with this ADR; accumulating our own is not.
   *(Unverified: where TEA persists that trail. The 2026-07-29 teardown source-verified `trace`, not
   the WAIVED trail. Check before relying on it.)*

**Revisit trigger.** Reopen the calibration design when there is a real deployment producing (i) gate
decisions at volume and (ii) a written record of what happened *after* an override — not the
overrides alone. Absent (ii), the loop has no ground truth and the number would be the manufactured
magnitude the schema exists to forbid.

## Consequences

- **#200 is decided and closes.** #194 is unblocked and re-scoped to the git-trailer approach; #129
  stays open with its blocker re-pointed away from storage.
- **The outward-copy freeze on calibration stands unchanged.** `positioning.md`'s "claims we must not
  make" still forbids describing it as live or imminent. Nothing about this decision moves it closer.
- **#177 is unaffected** — it was already excluded as provenance-inside-the-report, not storage.
- **#99 / #130 are unaffected.** The plugin-independence trigger survives because #129 does.
- **Accepted costs, named so they aren't rediscovered as surprises:** repeat-heal from git yields
  bucket and frequency, not normalized failure-signature matching; a squash-merge that drops the
  trailer degrades to the churn fallback; and a heal that is never committed is invisible to both.
  If signature-level matching is ever genuinely needed, that is a new decision and a new ADR.
- **Nothing that was demanded is given up.** The one voiced demand in this space — did *this* heal
  change what the test verifies — is #190, which this decision leaves entirely intact.
