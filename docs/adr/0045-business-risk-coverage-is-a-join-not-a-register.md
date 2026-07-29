# Business-risk coverage is a stateless join over an external traceability matrix, not a risk register of our own

**Status: Accepted (2026-07-29).** The rejection (don't build a register) is firm. The join design is
scoped but unbuilt — filed as [#199](https://github.com/TzolkinB/skills/issues/199). No code changes in this ADR; it records the direction and
retires the register idea before someone builds it.

## Context

A recurring market ask — voiced in QA-practitioner discussion and by every commercial tool in the
category — is *"what business risks are actually covered?"* This repo cannot answer it today:

- [`threat-model`](../threat-model.md) ranks consequence for **a change** (blast radius × detectability)
  and is deliberately outside the `/sentinel` chain.
- [`test-plan`](../test-plan.md) produces cases **before** code.
- Both are session-scoped. Neither persists, and nothing anywhere maps a *risk* to the tests that
  guard it, let alone to whether those tests were ever verified.

The obvious move is to build a risk register: a persistent risk → test → status mapping. Two findings
kill that.

**First, it is already someone else's turf.** TEA's `trace` workflow produces a requirement→test
traceability matrix plus a categorical PASS/CONCERNS/FAIL/WAIVED gate. It is free, it is a
credibility-side ally, and [`comparisons/tea.md`](../comparisons/tea.md) already routes traceability
to it. Rebuilding it violates the repo's orchestrate-don't-absorb thesis.

**Second — and this is what creates the actual opening — TEA's matrix is presence-based.** Verified
against the `bmad-testarch-trace` workflow **source** (`main` @ v1.19.1, 2026-07-29):
`steps-c/step-03-map-criteria.md` marks each requirement FULL/PARTIAL/NONE by mapping a *matching
test*, with every validation rule a presence check; `steps-c/step-05-gate-decision.md` is
deterministic JS over those percentages (`if (p0Coverage < 100) → FAIL`). There are **zero**
occurrences of mutation/hollow/would-fail across the entire trace tree, and test quality appears only
as a printed recommendation in step-04, never as a gate input.

So a P0 requirement whose only test is **hollow** is counted covered and gates **PASS**. The category
default is to establish coverage by demonstrating a test *exists*.

## Decision

**1. Do not build a risk register.** It duplicates TEA `trace`, which is free and better positioned.
Route risk planning and requirement→test mapping to TEA.

**2. Business-risk coverage is a *join*, not a store.** Read TEA's traceability-matrix output
alongside an `audit-test` emission and resolve each requirement into three states rather than one bit:

- **covered and mutation-proven**
- **covered but unverified**
- **covered by a test we proved hollow** — i.e. the risk is actually unguarded

That third state is the honest answer the category cannot currently produce, and it needs no register
because TEA supplies the left column and `audit-test` supplies the verification.

**3. This is *not* a persistence feature.** Both inputs are files, read at gate time. That is exactly
the ingest pattern [`gate`](../gate.md) already ships (Playwright/Cypress JSON + an `audit-test`
emission). It therefore does **not** belong with the genuinely stateful cluster —
[#129](https://github.com/TzolkinB/skills/issues/129) calibration and
[#194](https://github.com/TzolkinB/skills/issues/194) heal-ledger — and must not be blocked behind
[ADR-0046](0046-does-sentinel-become-stateful.md).

## Considered options

- **Build a risk register.** Rejected — duplicates TEA `trace`; orchestrate-don't-absorb; and a
  register we maintain is a persistence commitment (ADR-0046) for a capability someone already gives
  away.
- **Route to TEA and stop.** Rejected — it leaves the presence gap unaddressed, and that gap *is* the
  value. Routing a user to a matrix that marks hollow-tested requirements as covered would make us
  complicit in the coverage illusion the repo exists to expose.
- **Stateless join over TEA's matrix + `audit-test`.** Chosen.

## Consequences

- **Depends on TEA being run.** The join has no left column without a `trace` output. Degrade
  honestly: with no matrix, say so — never synthesize requirements to fill the table.
- **Two limits carry into any claim made about this** (both recorded in `comparisons/tea.md`): on a
  *synthetic* oracle TEA downgrades PASS→CONCERNS, so the clean PASS needs formal requirements — the
  failure bites hardest for the **most** mature teams; and composing TEA's `test-review` does not
  close it, since a test can score 100/100 static and still be hollow.
- **Not a TEA takedown.** The finding is about the category; TEA is simply the one whose source is
  open, which is what makes the claim verifiable rather than inferred. Framing per
  [`positioning.md`](../positioning.md).
- **`positioning.md` forbids claiming business-risk coverage** until this ships. That entry stands.
- **Falsifier:** a TEA release that adds a credibility input to Step 5's arithmetic would close the
  gap and retire this ADR.
