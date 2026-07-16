<!-- RECORDED NEGATIVE SAMPLE — WRONG: jumps straight to /audit-test, ignoring that the user asked
     for the right prover to be PICKED for their stack (unit vs app-driven). Skips the stack-aware
     router. No /audit-orchestrator token, no "right prover for your stack" rationale → FAIL. -->

**You're at:** a green test you don't trust.

**Use:** `/audit-test`
**Why:** audit-test runs a targeted mutation to prove the test catches a regression.
**Run:** `/audit-test path/to/suspect.spec.ts`

**Next in the flow:** `/coverage-review` if it turns out hollow.
