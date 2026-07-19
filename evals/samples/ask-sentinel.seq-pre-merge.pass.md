<!-- RECORDED SAMPLE — faithful /ask-sentinel SEQUENCE-mode response to a "feature + tests done, walk
     me through QA before merge" ask. Entry ANCHORED at Coverage/Audit because tests already exist —
     the Plan stage is dropped, not dumped. → Gate, à-la-carte close. --dry-run offline. -->

**You're shipping:** a finished feature with its tests written — you're past planning and authoring, sitting just before the merge.

**The path** — run as few or as many as you need; each stage stands alone:

1. **Coverage · `/coverage-review`** (own) — of what's testable in the change, what's still missing or asserted loosely.
   ↳ escalate-if: gaps → add cases before trusting the suite.
2. **Audit · `/audit-orchestrator`** (advice — Tautest Proven, Stryker Likely, audit-test Proven) — prove the green tests would actually fail if the code broke; it picks the prover for your stack.
   ↳ escalate-if: false-confidence flagged → fix those tests, then continue.
3. **Gate · `/sentinel`** — one PASS / CAUTION / FAIL over the branch.

**Start at step 1 because:** the code and tests already exist, so planning and authoring are past — Coverage is the first stage with something to act on.
