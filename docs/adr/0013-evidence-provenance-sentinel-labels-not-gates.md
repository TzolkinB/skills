# Every /sentinel verdict input carries its evidence provenance — Proven, Likely, or Unexamined — and Sentinel labels, it does not gate on execution

`/sentinel` sells an executed-evidence verdict, but execution is an *optional* sub-step:
`audit-test`'s funnel decides statically which tests earn a live mutation, and only those get run.
The rest are cleared by the same static read `coverage-review` performs — the "AI's say-so"
[ADR-0001](0001-audit-test-proves-by-execution.md) says must never clear a test on its own. Today
those statically-cleared tests land in the same green tally as executed ones ("42 hold up"), so a
reader cannot tell an *executed pass* from an *unlooked-at pass*. That is the exact false confidence
the tool exists to catch, manufactured one level up.

This ADR fixes the honesty, not the mechanics. It does **not** make Sentinel run more, and it does
**not** make PASS require execution — that gate belongs to the separate evidence pipeline
([ADR-0002](0002-sentinel-is-judgment-not-release-evidence.md)). Sentinel stays a static judgment
layer ([ADR-0010](0010-execution-out-temporal-deferred-behind-a-seam.md)); it just stops letting
reasoning wear an execution badge.

## The three provenance labels

Every finding and every verdict input carries exactly one:

- **Proven** — a mutation was run and the test's response observed (the existing `audit-test` sense).
- **Likely** — reasoned about statically; the code could not be, or was not, run (the existing sense).
- **Unexamined** — *new.* Read and triaged, but never advanced past the funnel, so nothing —
  neither execution nor a committed static judgment — actually vouches for it.

The first two already exist in `CONTEXT.md` → "Categorical confidence". This ADR adds the third and
makes all three mandatory on output, because the gap Sentinel was hiding is precisely the
difference between *Likely-good* and *Unexamined*.

## Consequences

- **`audit-test` batch output stops counting Unexamined tests as green.** The tally reads, e.g.,
  "6 changed tests · 2 proven-solid · 1 flagged · 3 unexamined", never "5 hold up". A 🟢 is only
  emitted for a test a mutation was actually run against. Without `--all`, Unexamined tests are
  summarized by count; `--all` lists them — but they are never silently folded into the greens.
- **🟢 is relabeled from "Holds up" to "killed the proposed mutation"** (retaining the existing
  "or no plausible green-surviving change exists" clause). The label states what was observed, not a
  general guarantee about the test.
- **`/sentinel`'s PASS carries a mandatory provenance line** and never asserts execution, e.g.
  *"PASS on static judgment — 2 proven-solid, 1 reasoned-only, 3 unexamined."* PASS means "static
  judgment finds it shippable," not "the tests were proven."
- **Two known circular/stale inputs inherit the label:** the Test Plan Coverage section is marked
  *Likely — criteria model-generated from the commit message*, and a consumed `lcov` older than the
  branch's changes is marked *possibly stale* rather than presented as authoritative ground truth.
- The hard **execution gate** — "no PASS without Proven evidence on changed paths" — is recorded as
  the evidence pipeline's job; its threshold is set empirically there (see PLAN.md, Phase 3), not here.
