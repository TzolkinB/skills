<!-- RECORDED NEGATIVE SAMPLE — WRONG: dumps a path starting at Plan even though the feature and its
     tests already exist. Fails to anchor the entry to where the change sits — recommends /test-plan
     when planning is already past (an untailored sequence). /test-plan present → must_not FAIL. -->

**You're shipping:** a finished feature with tests, before merge.

**The path** — run as few or as many as you need; each stage stands alone:

1. **Plan · `/test-plan`** (Confirmed, own) — decide the cases and layers to test.
   ↳ escalate-if: risky path → `/threat-model`.
2. **Coverage · `/coverage-review`** (own) — what's missing or loosely asserted.
   ↳ escalate-if: gaps → add cases.
3. **Gate · `/sentinel`** — one PASS / CAUTION / FAIL over the branch.

**Start at step 1 because:** every change should begin at planning.
