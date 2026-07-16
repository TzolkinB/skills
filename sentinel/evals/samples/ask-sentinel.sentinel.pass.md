<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of the branch-level "am I safe to merge?"
     situation to /sentinel, the orchestrator. Per SKILL step 4 it notes /sentinel calls the atomic
     shippability skills for the user — it does NOT tell the user to run them by hand. Used by
     run-eval.mjs --dry-run offline. -->

**You're at:** the merge gate — you want one answer on whether the branch is safe to ship.

**Use:** `/sentinel`
**Why:** this is the branch-level am-I-safe-to-merge decision, and `/sentinel` is the orchestrator that returns a single PASS / CAUTION / FAIL verdict — the one question it answers.
**Run:** `/sentinel`

It orchestrates coverage-review, qa-review, audit-test and debug-test into that one verdict for you — no need to invoke them separately.

**Next in the flow:** — this is the ship gate.
