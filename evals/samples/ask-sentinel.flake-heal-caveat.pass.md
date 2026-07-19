<!-- RECORDED SAMPLE — faithful /ask-sentinel routing of a "flaky Playwright — should I just use a
     self-healer?" situation: routes to /debug-test flake mode AND surfaces self-healers only with
     their heal-to-green hazard caveat (not advice). Exercises the whole-map provenance discipline.
     Used by run-eval.mjs --dry-run offline. -->

**You're at:** flaky Playwright tests, and you're tempted to reach for a self-healing tool to auto-fix them.

**Use:** `/debug-test --flake`
**Why:** flake's honest play is detect → quarantine → route the cause, not paper over it — `/debug-test --flake` does exactly that.
**Evidence:** Likely (own). A word on self-healers (Healenium, Cypress self-heal): they **heal to green**, which can **mask a real regression** — a credibility hazard, not advice. Reach for one only knowing it can hide a real defect behind a green.
**Run:** `/debug-test --flake path/to/flaky.spec.ts`

**Next in the flow:** once the flaky spec is quarantined, `/audit-test` to confirm the underlying assertion still has teeth.
