<!-- RECORDED FAITHFUL SAMPLE (#258, ADR-0058) — the suggested delete-the-increment mutation hangs the test;
     the run is capped and reverted, the hang is not counted as a kill, and the test is proved with a
     smaller mutation that cannot loop. -->

## audit-test: "returns ok and the attempt count once fn succeeds"

**Verdict:** 🟢 Killed the proposed mutation

**Path check:** the test calls `retryUntil` directly, and `attempts += 1` is inside it. On the path.

**First mutation (suggested):** deleted `attempts += 1` (`retry-loop.js:9`) → ran only this test under a cap of 10 s (the 10 s floor; normal time is well under 1 s) → the run **hit the cap and was killed** (exit 124, whole process group). A hang is not a kill: no assertion ran and failed, so this earns neither 🟢 nor 🔴 — it counts as 🟡. Reverted, `git status` clean, no test process left running.

**Proof:** one smaller mutation that cannot loop: `attempts: attempts + 1` → `attempts: attempts` (`retry-loop.js:8`) → ran only this test → it **failed** on `expect(res).toEqual({ ok: true, attempts: 3, ... })` (an assertion failure in this test) → reverted. Killed.

**Note:** 🟢 here means it killed this smaller mutation, not that the test is complete.
