<!-- RECORDED NEGATIVE SAMPLE — WRONG: instead of routing to the /qa-pass orchestrator, it hands
     the user a checklist of atomic skills to run BY HAND — the exact anti-pattern SKILL step 4
     forbids (/qa-pass calls them for you). The /qa-pass token is absent and the must_not is
     violated → FAIL. -->

**You're at:** about to merge — here's your pre-merge checklist.

Run `/coverage-review` yourself to find gaps, then run `/audit-test` on anything green you doubt, also run `/qa-review` for testability, and run each of these before you merge.
