<!-- RECORDED SAMPLE — faithful /ask-sentinel SEQUENCE-mode response to a lifecycle ask ("starting a
     feature, walk me through QA from planning to shipping"). Ordered path anchored at Plan (no code
     yet) → Gate, best tool per stage with labels, escalate-if between stages, à-la-carte close.
     Used by run-eval.mjs --dry-run offline. -->

**You're shipping:** a new checkout feature from a blank slate — no code or tests exist yet, so you're at the very start of the change's life.

**The path** — run as few or as many as you need; each stage stands alone:

1. **Plan · `/test-plan` (+ `/threat-model`)** (Confirmed, own) — decide the cases and layers before any code exists, and rank them by blast radius.
   ↳ escalate-if: the plan surfaces a genuinely risky path → `/threat-model` on that path first.
2. **Author · `/qa-review`** (Confirmed, own) — as the code lands, check it's even testable (hidden deps, `Date.now()`, coupling) before trusting any generated tests.
   ↳ escalate-if: untestable seams → fix them before writing assertions.
3. **Audit · `/audit-orchestrator`** (advice — Tautest Confirmed, Stryker Likely, audit-test Confirmed) — once tests are green, prove they'd fail if the code broke; it picks the prover for your stack.
   ↳ escalate-if: it flags false-confidence → fix those tests before spending Coverage.
4. **Coverage · `/coverage-review`** (own) — of what's testable, what's still missing or asserted loosely.
   ↳ escalate-if: material gaps → add cases, then re-audit.
5. **Gate · `/sentinel`** — one PASS / CAUTION / FAIL over the branch when you're ready to merge.

**Start at step 1 because:** nothing is built yet — planning is the live stage, and Audit / Coverage / Gate have nothing to act on until code and tests exist.
