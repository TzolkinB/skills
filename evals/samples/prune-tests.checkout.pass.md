<!-- RECORDED SAMPLE — a faithful /prune-tests run with --audit-evidence on the checkout.spec.js
     fixture (#192). Neither test is redundant, over-mocked (the gateway mock is a correct external
     boundary), or stale, so both start as Deferred to audit-test. The paired evidence file's runs[]
     trace names `processes payment` confirmedHollow (a mutation ran and survived) and `applies
     discount code` only likelyHollow (no runs[] record — never executed), so a faithful run promotes
     only the first, matched by test identity, not by the aggregate confirmedHollow:1 count. Used by
     run-eval.mjs --dry-run offline; a representative transcript, not a live capture. -->

## Prune Review: checkout.spec.js

Tests reviewed: 2   |   Proposed: 0 remove / 0 merge / 0 rewrite / 0 keep

Neither test is redundant, over-mocks an internal collaborator, or has drifted stale — the `gateway`
mock is a correct external boundary (a third-party payment API), so this isn't an over-mocking finding.
Both look like they may never verify their code, so both hand off rather than getting judged here.

### Deferred to audit-test
- **`applies discount code`** — no mocking involved, but `expect(typeof total).toBe('number')` passes
  whether or not `SAVE10` actually discounted anything. Not a redundancy call. Run `/audit-test` to
  prove or clear it before deciding.

Read `--audit-evidence=fixtures/prune-tests/checkout.audit-evidence.json` (`gate-audit-test/v0.3`,
recognized). Its `runs[]` trace names `checkout.spec.js::processes payment` confirmedHollow
(`outcome: "survived"`) — that match promotes it below. `checkout.spec.js::applies discount code` has
no matching `runs[]` record (the evidence marks it `likelyHollow`, and a likelyHollow verdict is never
executed, so it never gets a record to match against) — it stays Deferred above, unchanged.

### Confirmed Prune (mutation-backed)
- **`processes payment`** — was Deferred above; `--audit-evidence` matched it to a `confirmedHollow`
  record: the mutation removed the `amount` argument from `gateway.charge(amount)` (charging $0
  regardless of the cart total) and the test still passed. Zero protection, execution-confirmed.
  `audit-test`'s own default advice is to strengthen a hollow test rather than delete it; this category
  names it as a legitimate removal candidate for a team that isn't going to invest in that fix.
  - confidence: high | action: remove | evidence: `--audit-evidence=fixtures/prune-tests/checkout.audit-evidence.json` (`gate-audit-test/v0.3`)

**Next:** `/audit-test fixtures/prune-tests/checkout.spec.js` on the remaining Deferred entry (`applies
discount code`) before deciding — don't delete what only it can clear
