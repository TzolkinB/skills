# audit-test — Reachability check (why a 🔴 needs it)

Run this before recording **any** 🔴 (a mutation that survived). Loaded from Step 4.

A 🔴 claims the mutation ran and the test stayed green — but that only means false confidence if the mutation actually reached the code the running test exercises. **App-driven tests (Playwright, Cypress) are the trap:** when the test drives a stale build (`build && preview`, a served `dist/`) or a deployed URL, an edit to `src/` never reaches the app, so *every* mutation "survives" and audit-test would fabricate a 🔴 on a perfectly good test. (Proven empirically — see [ADR-0016](../../../docs/adr/0016-audit-test-reachability-guard.md).)

So before recording any 🔴, prove the harness is source-live:

1. Apply a **maximal, unmissable mutation** to the same code the test asserts on — one a correctly wired test cannot miss (e.g. replace the asserted value/output with an obviously wrong constant, or break the covered unit outright). Run just that one test; **revert immediately** (same Safety rule).
2. **Probe caught (test failed)** → the running app reflects source edits → the original survival is real → **🔴 confirmed.**
3. **Probe survived (test still green)** → the mutation is not reaching the tested artifact. Execution cannot distinguish "stale/remote harness" from "catastrophically hollow test," so **do not claim 🔴** — report **🟡** with: *"mutation did not reach the running app — the test target looks like a stale build or a deployed artifact; re-run against a source-live target (a dev server, or add a rebuild step to the harness) and re-audit."*

**Dev-served targets — force the mutation live *before* trusting a survival ([ADR-0019](../../../docs/adr/0019-audit-test-reachability-warm-dev-propagation.md)).** A warm dev server (Vite/webpack HMR, watch-mode SSR) is source-live but propagates edits **asynchronously** — within a single run a mutation can be live for some assertions and not others, which can make a solid test *survive* (false 🔴) **and** make the control probe above flaky (false 🟡). A `sleep`/settle doesn't fix it (a ~4s settle still raced). So on a dev-served app-driven target, don't trust in-place propagation: run against a **fresh-boot-per-run harness** — a built/CI server, or a container that boots the app from current source each run (e.g. Cypress via `cypress/included`) — **or** restart/hard-reload the dev server after mutating and wait for ready, *then* run the mutated test and the control probe. A survival that wasn't confirmed live is **inconclusive, not 🔴** — force it live and re-run.

For unit tests run against source (Jest/Vitest/pytest/…) the probe is caught trivially and confirms 🔴 at negligible cost — the check only bites where it must. This keeps audit-test's core promise honest: a 🔴 is *execution-proven false confidence*, never an artifact of a stale test harness.
