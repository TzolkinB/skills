# debug-test — Drift Mode

Loaded from the main skill's Step 0 (`--drift`) or Step 1 (a deterministic red whose diff doesn't touch the code the test exercises). This is the mirror of [Flake Mode](flake-mode.md) for a *deterministic* red with **no relevant local cause** — the failure a long-idle consumer eats when an external service (a backend another team owns, on its own release cadence) moves a contract, payload shape, auth flow, or env value underneath a test that never changed. Treating it as a local bug sends it to the healer, which green-locks the test to the drifted value *without asking whether the change was intended* ([ADR-0018](../../../docs/adr/0018-debug-test-drift-triage.md)).

Same three-part shape as Flake Mode — **classify → quarantine → surface** — but the disposition is tuned for a boundary this skill must *not* adjudicate. Two rules hold throughout:
- **Judgment only, never a run.** Drift mode acts on an *already-red* test (a human or CI produced the red; it is an input, not something this skill runs to discover). It reads diffs, history, and published contracts — it does **not** drive the app, retry, or run the suite. The moment it would need to execute to get a signal, it routes across a seam instead. Entering via `--drift` runs nothing at all; the Step-1 auto-path first spends flake mode's own burn to rule out non-determinism — that is the flake gate, not a drift signal, and drift classification itself adds no execution. (Static-judgment moat — [ADR-0010](../../../docs/adr/0010-execution-out-temporal-deferred-behind-a-seam.md).)
- **The verdict is a challenger's flag, not an oracle.** Frame it as: *"suspected external drift — the local diff is empty/irrelevant, history shows this test was green, and the response [matches / contradicts] the published contract for X."* It never asserts the backend is wrong on its own authority, and never green-locks the consumer to an *unconfirmed* change.

## D1. Classify — from signals the suite already owns (never from a run)
Signals, most reliable first. A verdict can rest on the first alone; the lower two sharpen it.
- **Diff relevance (primary, static, cheap).** Does the working/PR diff (`git diff --name-only main...HEAD`, plus the working tree) touch any source this failing test plausibly exercises? An **empty or drift-irrelevant diff under a previously-green test is the drift signature.** (Same source→test relevance map that E2E impact-analysis builds — read here in the inverse direction: "did *any* change hit this red at all?")
- **Temporal (secondary).** Was this test **green in the recorded findings log and now red with no relevant local change**? Read the green→red transition where the log exists; where it does not, **state the signal is absent — do not fabricate history.**
- **Published-contract comparison (tertiary — and the deliberate-vs-accidental oracle).** Compare the drifted response against the provider's **published contract** (OpenAPI/Swagger — usually readable across the org boundary even when the provider won't run contract verification — or an in-repo response schema such as a Zod validator, if one exists). It does double duty: positive drift evidence ("the depended-on field moved"), and the deliberate-vs-accidental discriminator —
  - response **matches the published spec → deliberate** API evolution: the test/frontend is merely **stale**, and updating it is correct maintenance;
  - response **contradicts the spec, or no spec exists → suspected break**: escalate.
  The suite **consumes** the contract; it does not snapshot live responses to produce one (an execution-layer artifact, out of scope here by ADR-0010).

If the diff *does* touch code the test exercises, this is **not** drift — return to the main skill's normal flow (Step 2 heuristics → healer / diagnosing-bugs), unchanged.

## D2. Quarantine — non-blocking, never `.skip()`-and-forget, never deleted
Identical disposition to Flake Mode: recommend a quarantine lane / tag so CI stops blocking on a red the team can't fix locally, **while the test keeps running and reporting.** A drifted test still guards real behavior — silently skipping it lets the *next*, real, local regression ship invisibly.

## D3. Surface the mismatch for human disposition — shift-left, do not auto-"fix"
Drift mode does **not** presume the backend erred, and does **not** heal to green. Because most cross-service changes are *deliberate*, the two dispositions are both legitimate and only a human can choose — present both, with the contract evidence:
- **Deliberate evolution** (response matches the published spec) → the test/frontend is *stale*; offer the exact test/frontend update to accept it. This is correct maintenance, **not** a green-lock — green-lock is adapting to an *unconfirmed* change, and the spec check is precisely what tells them apart.
- **Suspected break** (contradicts the spec, or no spec exists) → route to **`/bug-report`** (via the `Skill` tool) to structure a cross-team report pointing at the field that moved — **not** to the Playwright healer, which would blindly green-lock.

The choice — accept-and-update, or stop-and-escalate — is **always the human's.** The win is the *surfacing itself*: the earlier a frontend/backend mismatch is reported, the cheaper it is for everyone. Speed-to-surface beats auto-remediation.

Drift mode **consumes** a published contract (OpenAPI/Swagger or an in-repo response schema) and does a *lightweight inline* check when one is at hand. When the harder job is needed — no in-code schema, an untyped frontend, or an empty-diff drift where the provider's published spec must be located, parsed, and diffed against the shape the consumer expects — **recommend `/contract-guard`** (via the `Skill` tool), the dedicated consumer-side contract check ([ADR-0021](../../../docs/adr/0021-contract-guard-consumer-side-openapi-differ.md), the scoped-out follow-up [ADR-0018](../../../docs/adr/0018-debug-test-drift-triage.md) pointed at). It produces the verdict this mode consumes; the classifier stays here, the contract comparison lives there.

## Output Format
```
## debug-test (drift): [Test Name]

### Classification → Suspected external drift  (challenger's flag, not a verdict)
Signals: local diff empty/irrelevant (no change to code this test exercises) · findings log: green→red [or: not available] · response [matches | contradicts] published contract for `[endpoint/field]`

### Disposition → Quarantine (non-blocking)
Tag / quarantine lane — keeps running and reporting, stops blocking CI. NOT skipped, NOT deleted.

### Surfaced for human disposition (not auto-fixed)
[Deliberate evolution] response matches the spec → test is stale; proposed update: [diff]. Accept only if the change was intended.
[or: Suspected break] contradicts the spec / no spec → routed to `/bug-report` pointing at `[field]`. Not green-locked, backend not unilaterally blamed.
```
