# `ask-sentinel` gains an orchestrated *sequence* mode — situation + stack → an ordered stage path — the second reading of the map, still an option not a mandate

**Status: Accepted (2026-07-16).** Second (capstone) slice of [#47](https://github.com/TzolkinB/skills/issues/47),
building directly on [ADR-0025](0025-ask-sentinel-stack-aware-router-reads-manifests.md) (the whole-map
point-router, shipped in #94). ADR-0025 delivered *"given a situation + stack, here's the **tool**"*;
this ADR delivers the other half the epic asked for — *"…and the **stage order**."* It gives
`ask-sentinel` a **sequence mode**: for a lifecycle/workflow ask, it emits an **ordered path across the
relevant QA stages** — the best tool per stage (stack-aware, provenance-labelled, exactly as ADR-0025
routes) plus the escalation condition between stages — instead of a single point-route. This is the
**"orchestrated" reading** the map already names ([`orchestration-map.md`](../orchestration-map.md),
*"Two ways to use this: à la carte, not a funnel"*): the point-router is à la carte, the sequence is
the orchestrated path. It is **added, not substituted**, and it stays **an option, not a mandate**.

## Context

After ADR-0025, `ask-sentinel` answers *"what one tool fits this situation + stack?"* — a **point
decision**. But the map's thesis is explicitly *sequencing + gap-filling, not links*: **"each stage is
a runnable Skill that says *reach for tool X now; if its result survives condition Y, escalate to
Z*."** The map even documents the two usage modes side by side:

> - **À la carte** — every stage's Skill stands alone… you decide what you need.
> - **Orchestrated** — the stage *order* is the recommended path when you want end-to-end coverage.

ADR-0025 shipped the à-la-carte router and **explicitly deferred** the sequencer ("emitting an *ordered
stage sequence* across the seven stages… is deferred to a later slice"). The epic's own words are
*"recommend the tool **and the stage order** across the map's 7 stages."* The point-router covers the
tool; the **stage order is still just a static diagram** in the SKILL (`## The intended flow`). This
ADR turns that diagram into an **executable, tailored recommendation**.

The distinction that makes this worth a mode rather than always-on: most QA situations are a *single
question at a single moment* ("this test smells", "this spec is red"). A minority are *lifecycle* asks
("I just built this — walk me through QA before I merge", "what's the full path to ship this safely").
The first wants one next step; the second wants the ordered plan. Emitting a seven-stage plan for
"this spec is red" would be the exact noise the router exists to cut.

## Decision

### 1. Add a sequence mode; keep point-routing and the full-map default

`ask-sentinel` now has three responses, chosen by the shape of the ask:

- **Empty args → the full map** (unchanged).
- **A single question at a single moment → one point-route** (ADR-0025, unchanged): "this test smells"
  → `/audit-test`.
- **A lifecycle / workflow ask → an ordered sequence** (new): "I built this feature, walk me through
  QA before merge" → an entry-anchored path across the relevant stages.

The trigger for sequence mode is **span, not topic**: the situation describes a change *moving through
its lifecycle* or explicitly asks for the *path / process / end-to-end / "properly"*, rather than one
artifact or one question. When it is genuinely ambiguous, prefer the **point-route** (the cheaper
answer) and offer the sequence as a follow-up — never inflate a single question into a seven-step plan.

### 2. The sequence is entry-anchored, tailored, and per-stage stack-aware

The path is **not always all seven stages**. It is anchored to **where the change currently sits** —
before code (start at Plan), tests exist (start at Audit/Coverage), everything red (start at Triage),
about to merge (Audit → Gate) — and ordered **forward to the Gate**, including only the stages that
earn a place for *this* situation. Each stage in the emitted path carries:

- the **best tool for that stage given the stack** — external or Sentinel's own — with its
  **Proven/Likely/Unexamined provenance label**, produced by the very same routing ADR-0025 defines
  (Unexamined = a *lead*, not advice; self-healers with their hazard caveat). The sequencer **reuses**
  that per-stage decision; it does not re-derive a second routing table.
- a one-line **why this stage is here** for the situation, and
- the **escalation condition** to the next stage — the map's *"if its result survives condition Y,
  escalate to Z"* (e.g. "Audit flags false-confidence → fix those before spending Coverage").

For the **Audit** stage the sequence routes *into* `/audit-orchestrator` (which owns the
unit-vs-app-driven pick), and the **Gate** stage is `/sentinel` — the sequence *recommends the ordered
plan*; `/sentinel` remains the thing that *executes* the gate. The sequencer plans; it does not run.

### 3. À la carte is preserved and stated

Per Matt Pocock's skills philosophy and the map's own framing, **the orchestration is an option, not a
mandate.** The emitted sequence says so explicitly — *"run as few or as many of these as you need; each
stands alone"* — so a user can take the whole path or lift one stage out of it. The sequence is a
recommended ordering, never a required funnel.

## Considered options

- **Replace the point-router with a sequencer (always emit a path).** Rejected — it violates à la carte
  and floods single-question asks with a seven-step plan. The two modes coexist; span selects between
  them.
- **Always emit all seven stages.** Rejected — an untailored path is noise. The sequence is anchored to
  the change's current position and includes only the stages that matter for the situation.
- **Make the sequencer a separate skill.** Rejected — it is the *same map read the other way*
  (à la carte ↔ orchestrated), and the map names `ask-sentinel` as the single front door to both.
  A second skill would split the front door and duplicate the per-stage routing table.
- **Re-derive a second per-stage routing table inside the sequencer.** Rejected — the per-stage
  external-vs-own + provenance decision already lives in ADR-0025's routing (and `audit-orchestrator`
  for Audit). The sequencer *orders* those decisions; two tables would drift.

## Consequences

- **The map's "orchestrated" mode becomes executable** — `## The intended flow` graduates from a static
  diagram to a tailored, entry-anchored, stack-aware recommendation. #47's *"tool **and** stage order"*
  is now fully delivered.
- **The SKILL gains a sequence-mode step + output format**; the always-loaded file stays well under the
  500-line ceiling.
- **The routing eval gains a sequence case** (this branch) — asserting the ordered stages appear, the
  entry stage matches where the change sits, and the à-la-carte "run as few as you need" line is
  present — so the new mode is guarded against regression like every other behavior (#74 harness).
- **No new provenance machinery** — sequence mode inherits ADR-0025's labels and honest-degradation
  (unreadable stack → route on the plain signal / ask / show the map).
- **Stage-order sequencing leaves the deferred list** ([ADR-0025] consequences); the remaining #47
  follow-up is the research pass to upgrade the Unexamined external tools from lead to labelled advice.
