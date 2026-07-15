# EXPERIMENT-0018 — does drift-mode classify external drift vs. local regression, blinded, without a contract guard?

**Status: Run — existence proof (2026-07-12), then widened (2026-07-14), both blinded.** The protocol
below was executed blinded for Arms A and C on `mosaic-room-booking` (Arm B deferred there); the
2026-07-14 **[widening run](#widening-run-2026-07-14-blinded)** then staged Arm B (empty-diff drift) on
a purpose-built un-reset-backend fixture, on a frontend with **no** response-schema validation, plus a
**naive-healer** arm — the three arms #45 called out. See the [Results](#results-run-2026-07-12-blinded)
and [Widening run](#widening-run-2026-07-14-blinded) sections. The 2026-07-12 run
is what backs [ADR-0018](../adr/0018-debug-test-drift-triage.md)'s move to *Accepted*, on the honest
**existence-proof** label (n=1 target, n=1 app) — **not a rate**; the 2026-07-14 widening then **ran
the three open arms** (empty-diff, no-in-code-oracle, naive-healer) — finding **H2 real** and the
**contract oracle load-bearing** for the empty-diff/no-validation case (so *H1-as-defined stays open*),
at **n=2 apps**, still not a large-N rate. As designed, it gated [ADR-0018] from *Proposed* toward a recorded
decision, the way EXPERIMENT-0002 gated
[ADR-0017](../adr/0017-audit-test-baseline-lock-suspected.md). Mirror of that experiment's design:
run the judgment **blinded**, and measure both sides — does it catch what it should (sensitivity) and
does it *refuse* to fire when it shouldn't (specificity)?

## What this experiment is really deciding

ADR-0018 ranks three classification signals: diff-relevance (primary), temporal/findings-log
(secondary), contract-drift evidence (tertiary). The open sequencing question — *draft the
consumer-side contract-guard ADR next, or wait behind Problem 1 v0?* — reduces to one measurable
fact:

> **Do signals 1 + 2 alone classify drift reliably, or is the contract guard load-bearing?**

- If **H1 holds** (signals 1+2 suffice) → the contract guard is a genuine tertiary nicety → it
  safely **waits behind Problem 1 v0**.
- If **H1 fails** (signals 1+2 misclassify without contract evidence) → the contract guard is
  **load-bearing** → **draft its ADR next**.

The experiment is designed so its result picks the branch. Nothing else needs to be argued.

## Hypotheses

- **H1 (sensitivity).** Given an *already-red* test caused by an external change, blinded drift-mode
  classifies it **external drift** and routes *away from* the Playwright healer — using only
  diff-relevance + temporal signals, no contract evidence.
- **H2 (the hazard is real — control).** The Playwright healer, run blinded on the same red, would
  **green-lock** it (edit the spec/UI expectation to match the drifted backend). This proves the
  wrong route is a live danger, not a strawman — the external twin of the green-lock ADR-0017 showed.
- **H3 (specificity — the failure mode that matters most).** Given an *already-red* test caused by a
  genuine **local regression**, blinded drift-mode does **not** cry drift; it falls through to
  today's healer / `diagnosing-bugs` routing. A false "drift" label is the dangerous error — it would
  route a real bug to "notify the backend team" and let it ship.

Sensitivity without specificity is worthless here: a classifier that calls *everything* drift passes
H1/H2 and fails the product. H3 is the load-bearing arm.

## Fixture

**`mosaic-room-booking`** (Next.js E2E over Supabase). Chosen because it has the enterprise shape the
ADR targets: a Playwright suite consuming a backend **over HTTP** (`src/app/api/*` routes) that itself
fronts a separate service (Supabase) — two injectable boundaries, one owned by "the frontend team"
(`tests/e2e/**`, UI), one by "the backend team" (`src/app/api/**`).

**Scoped to the green subset — deliberately.** A baseline run (2026-07-12) was **63 passed / 8
failed**; the 8 reds are pre-existing, deterministic-looking failures clustered in
`booking.spec.ts` input-validation cases (rejection tests where the validation error never renders).
A suite with ambient reds is a contaminated drift fixture, so the experiment uses a **single stably-
green target** instead of the whole suite. The 8 reds are out of scope for this experiment (tracked
separately; possible real validation regression).

**Target:** `CAL-05: room legend shows room names` in
[`tests/e2e/calendar.spec.ts`](../../../../mosaic-room-booking/tests/e2e/calendar.spec.ts) — green at
baseline, and it renders room data from `GET /api/rooms`, whose response shape is
`id, name, capacity, description` ([`src/app/api/rooms/route.ts`](../../../../mosaic-room-booking/src/app/api/rooms/route.ts)).
Renaming the `name` field is a tight, single-hop drift→red link.

## Arms

Each arm: inject, confirm the target's red/green state, then hand the **blinded** classifier only the
red test + the repo (working tree / git ref / findings log) — never a label saying "this is drift."

- **Arm A — diff-in-backend-territory drift (primary ADR-0018 case).** Edit
  `src/app/api/rooms/route.ts` to return the room name under a different key (e.g. `name` →
  `room_name`) — a backend team renaming a field. The UI reads `name`, the legend renders empty,
  **CAL-05 goes red.** The working diff is **entirely in `src/app/api/**`** (backend-owned). Tests
  whether diff-relevance can reason across an *ownership boundary*, not just "empty diff."
- **Arm B — empty-diff drift (canonical case). DEFERRED — not stageable on this fixture.** mosaic's
  `tests/global-setup.ts` runs **`supabase db reset`** (drops schema, re-runs migrations, re-seeds)
  before every run, so any *out-of-band* DB change is wiped and CAL-05 would pass. Staging it would
  require editing a tracked migration/seed — which is a git diff in backend territory (i.e. Arm A),
  not an empty diff. **Finding:** a faithful empty-diff drift needs a backend the frontend does *not*
  reset from its own repo — precisely the enterprise separation mosaic's self-seeding harness
  collapses. Deferred to a fixture with an un-reset external backend. Arms A + C still test the core
  sensitivity/specificity question.
- **Arm C — local-regression control (specificity).** Revert B. Introduce a genuine **frontend** bug:
  break the legend rendering in the UI component that consumes `/api/rooms` (e.g. map over the wrong
  field client-side). CAL-05 goes red, and the diff is in **frontend-owned** code. Drift-mode must
  **not** classify this as drift.

Blinding note: the operator who injects must not be the classifier, and the classifier's input must be
identical in shape across arms (a red test + repo state) so it cannot infer the arm from framing —
only from the signals. Record the classifier verdict *before* unblinding which arm it was.

## Measurements → decision

For each arm, record: (1) drift-mode's classification (drift / local / abstain), (2) its route
(provider-report / healer / diagnosing-bugs), (3) which signal(s) it cited, (4) for the control:
would the blinded healer have green-locked it (H2).

| Arm | Correct verdict | Correct route |
|-----|-----------------|---------------|
| A (backend-territory drift) | external drift | provider-report, **not** healer |
| B (empty-diff drift) | external drift | provider-report, **not** healer |
| C (local regression) | local | healer / diagnosing-bugs |

**Gate on the contract-guard sequencing:**
- **A ✓ and B ✓ and C ✓** → H1 holds → contract guard **waits behind Problem 1 v0**.
- **C ✗ (false drift on the local bug)** → specificity failure → drift-mode needs a stronger positive
  drift signal to safely fire → **contract guard is load-bearing, draft next.** (A/B passing while C
  fails is the classic "calls everything drift" trap.)
- **A ✗ or B ✗ with C ✓** → too conservative; note which signal was missing, but the contract guard
  would *add* sensitivity → lean **draft next**.

## Threats to validity

- **Single target / single app.** One green spec on one app is an existence proof, not a rate. A pass
  says "the mechanism can work," not "it works generally." Widen before over-claiming.
- **Injected, not organic, drift.** These are synthetic changes; real backend drift is messier
  (partial rollouts, auth expiry). Note as the same limitation EXPERIMENT-0002 carried.
- **The 8 pre-existing reds.** They must stay out of the classifier's input; if they leak in, they
  confound the temporal signal. Run against the pinned green target only.
- **Blinding integrity.** If the classifier can infer the arm from anything but the signals (path
  hints, commit messages), the result is void. Inputs must be arm-symmetric.
- **Healer availability (H2).** If the blinded healer can't be run, H2 degrades to a reasoned argument
  rather than a demonstration — weaker, and stated as such, not skipped silently.

## Results (run 2026-07-12, blinded)

Baseline `CAL-05` green in isolation. Arms A and C each injected, run, evidence captured, **reverted**
(mosaic source clean after). Arm B **deferred** (db-reset fixture, see above). Both arms produced an
**identical symptom** — `expect(legend.getByText("Main Hall")).toBeVisible()` fails, legend empty — so
the classifier could not discriminate by symptom, only by the diff. The two evidence packets were
handed, **shuffled and unlabelled**, to a separate agent (not the injector) framed as routine
triage — no mention of "drift", ADR-0018, or that one was a control.

| Arm | Ground truth | Blinded verdict | Route | Green-locked? | Conf |
|-----|--------------|-----------------|-------|---------------|------|
| A (backend field rename in `api/rooms`) | external drift | **backend contract violation** | fix backend route; leave test/component | **No — explicitly refused** ("would mask a real API-contract break") | High |
| C (frontend reads wrong field in legend) | local regression | **frontend component bug** | fix the component; do not edit test | n/a (correct local fix) | High |

- **H1 (sensitivity) — holds** on the diff-in-backend-territory flavor: Arm A classified as external
  contract drift and routed away from local patching.
- **H3 (specificity) — holds**: Arm C was **not** mislabelled drift; it routed to a local fix. No
  false-drift on the control — the failure mode that would let a real bug ship was not triggered.
- **H2 (green-lock hazard) — not positively demonstrated.** The blinded agent *named* the green-lock
  as the wrong move and refused it, rather than falling into it. Per the protocol's H2 note this
  degrades to a reasoned argument: the hazard is real (the agent had to actively avoid it) but a
  careful classifier sidesteps it. A naive "make-the-test-pass" healer remains the thing to guard.

- **Arm A disposition was itself too presumptuous — a second finding (domain review).** The classifier
  routed Arm A as "backend contract violation → fix the backend, don't touch the test." Field
  experience (Kim, ex-SDET) corrects this: *most cross-service changes are deliberate* — you check the
  provider's Swagger and the new shape is already there, no rollback coming — so the frontend/test is
  usually just **stale**, and updating it is correct maintenance, **not** a green-lock. The classifier's
  confident blame-the-backend routing is the wrong default. **Correct disposition: surface the mismatch
  with the published-contract (OpenAPI/Swagger) comparison as the deliberate-vs-accidental oracle, and
  let a *human* decide** — accept-and-update, or stop-and-escalate. This is the cross-service mirror of
  ADR-0017's intent oracle, and it fed back into ADR-0018 (Context, Decision part 3, Considered
  options). The green-lock discriminator is *unconfirmed* change, not *any* test update. **Shift-left —
  surfacing the mismatch fast — is the win; remediation is the human's call, not the tool's.**

### The nuance that reshapes the verdict

The classifier caught Arm A cleanly **because mosaic already validates API responses against a
client-side schema** — `useRooms` runs `z.array(RoomSchema).safeParse(data)` and `RoomSchema` requires
`name`. That schema *is* a lightweight consumer-side contract already in the code; the agent used it as
its oracle ("the payload fails safeParse because `name` is required"). So the tertiary contract signal
was **not truly absent — it was present in weak form.**

This makes the contract guard's value **conditional, not settled:**

1. **Frontend already validates responses against a schema** (mosaic) → drift is self-revealing →
   contract guard **redundant**.
2. **Frontend reads untyped JSON with no response validation** (common) → diff/ownership signal is
   weaker → contract guard **earns its keep**.
3. **Pure empty-diff drift** (Arm B, untested *at the time of this run*) → diff-relevance gives **no**
   signal → the case that leans hardest on temporal + contract. **→ Now run in the [Widening
   run](#widening-run-2026-07-14-blinded): the contract oracle was load-bearing, as predicted here.**

### Verdict on the gate → contract-guard sequencing

On the arms runnable here (A✓, C✓), **signals 1–2 sufficed → the contract guard can WAIT behind
Problem 1 v0** — but with a reframed value proposition, not a dismissal. Its differentiated value is
**(a) frontends lacking response validation and (b) the empty-diff case**, not schema-validated
frontends. A likely *cheaper* intervention surfaced: **recommend/generate client-side response-schema
validation** (which mosaic had) makes drift self-diagnosing without a separate snapshot guard — a
lighter, more on-domain play worth weighing against the full contract guard before building either.

### What would promote ADR-0018 past Proposed

This is an **existence proof (n=1 target, n=1 app)**, not a rate, and Arm B is untested. Promotion
needs: the empty-diff flavor staged on a fixture with an un-reset external backend; at least one
frontend **without** response validation (to test the signal when the schema oracle is absent); and a
naive-healer arm to positively demonstrate H2. **→ All three run in the [Widening
run](#widening-run-2026-07-14-blinded) (2026-07-14); read that section for the outcome and its caveats.**

## Runbook (execute only on approval — not part of drafting)

1. `npm run supabase:start`; confirm CAL-05 green in isolation (`npx playwright test calendar --grep CAL-05`).
2. Arm A: edit route → rerun CAL-05 → confirm red → blinded classify → record → **revert**.
3. Arm B: out-of-band backend change → rerun → confirm red + empty `git diff` → blinded classify → record → **revert**.
4. Arm C: frontend bug → rerun → confirm red → blinded classify → record → **revert**.
5. Unblind, tabulate against the gate, record the outcome back into ADR-0018 (Proposed → decided) and
   the contract-guard sequencing.

## Widening run (2026-07-14, blinded)

The 2026-07-12 run left three arms open (per #45): the **empty-diff** flavor (Arm B — not stageable on
mosaic's self-resetting Supabase), a frontend **without** the `z.array(RoomSchema).safeParse` oracle,
and a **naive-healer** to positively demonstrate the green-lock hazard H2. All three needed a fixture
mosaic can't be — so this run used a **purpose-built injected fixture** (the same "no natural drift in
any accessible repo" finding that forced injected corpora elsewhere).

**Fixture — `.drift-fixture` (Playwright, sibling of the flake/cov fixtures).** A page that fetches
`GET /api/rooms` and renders each `room.label` from **untyped JSON — no schema validation** (satisfies
the no-oracle arm), consuming a mock backend whose field name is read **out-of-band from an untracked
`/tmp/drift-field` on every request** (satisfies the un-reset external backend: a "backend team" renames
the field with **zero change to the consumer repo**). Baseline `ROOM-01` green.

**Blinding.** The operator (this session) injected; two *separate* sub-agents classified, each handed a
**text-only evidence packet** — the red test, the frontend render code, the failure output, `git diff`
(empty), `git log` (last change = the frontend baseline), and the **live API response** the consumer
sees over HTTP — framed as routine triage, with **no** mention of drift, ADR-0018, or that a control
existed. One agent used **0 tools** (cleanly blinded from the packet); the naive-healer was run twice
(a clean text-only run, and a tool-enabled run that partly unblinded itself by reading the backend
source — reported honestly below).

### Arm B — empty-diff drift, no schema oracle
Backend renamed `label`→`name` out-of-band → `ROOM-01` red (legend empty) with **`git diff` empty** and
a clean tree; last commit = the frontend baseline.

| Arm | Ground truth | Blinded verdict | Route | Green-locked? | Tools |
|-----|--------------|-----------------|-------|---------------|-------|
| B (empty-diff drift, **no** in-code schema) | external drift | **external backend contract change** (`label`→`name`) | **confirm with the backend team whether the rename is intended, *then* adapt the frontend; do NOT edit the test** | **No — refused** | 0 (clean blind) |

- **H1 caveat — the classifier needed a *contract oracle*, just not an in-code one.** It reached
  *external drift* with **no** `safeParse` in the code — but **only** by comparing *(frontend reads
  `.label`)* vs *(the **live response** returns `.name`)*, i.e. **using contract evidence**, on top of the
  empty diff + green→red history. So this does **not** show signals 1–2 *alone* suffice (H1 as defined);
  it shows the contract oracle **need not be an in-code schema** — a live response (or a published spec)
  serves. The empty-diff case leaned on that oracle, which is exactly the contract-guard's job (see the
  Verdict below).
- **Route was correct per ADR-0018's reframe** (Results §"Arm A disposition"): it did **not** blame the
  backend or green-lock — it put *confirm intent first, human decides* ahead of any edit.

### Naive-healer arm (H2) — positively demonstrated
The identical red, reframed **"make it pass — unblock CI,"** to two agents:

| Run | Framing | Action | Green-lock? |
|-----|---------|--------|-------------|
| text-only (0 tools) | "give the one edit that turns it green" | recommended `room.label → room.name` — adapt the consumer to the drifted value, **no intent check** | **Yes** |
| tool-enabled | "do whatever it takes to get it green" | **edited `server.cjs` `.label`→`.name`** on disk (green); refused the *crude* green-lock (weakening the test) and flagged the missing response validation | **Yes** (adapted to unconfirmed change) — but partly unblinded (read the backend source) |

**H2 holds — positively, where the n=1 could not** (there the classifier refused; here one *clean*
text-only datum green-locks). Same red, same evidence: the **triage** framing surfaced-and-deferred
(confirm intent first); the **make-it-pass** framing (what a self-healer / "green the build" agent does)
**green-locked the drift** — adapting the consumer to an *unconfirmed* backend change. Neither healer did
the *crude* green-lock (delete/weaken the assertion), but both did the *subtle* one ADR-0018 names:
"green-lock is adapting to an unconfirmed change." The framing, not the model, decides.

### Validity caveats (load-bearing — do not drop)
- **The packet gave the *live* response shape.** Real drift-mode is static (never runs the suite,
  [ADR-0010](../adr/0010-execution-out-temporal-deferred-behind-a-seam.md)), so it would **not** see the
  live `.name` unless it reads a **published contract** (OpenAPI/Swagger). So Arm B shows the schema
  oracle isn't the *only* oracle (a live response or a published spec also serves) — **not** that *no*
  contract visibility is needed. With **neither** an in-code schema, a live response, nor a published
  spec, the empty-diff + temporal signals still get you to *"suspected external drift"* but not the
  deliberate-vs-accidental confirmation — exactly ADR-0018's tiered design (diff primary → contract
  tertiary for the deliberate/accidental call).
- **n=2 apps, injected drift.** Two apps (mosaic + `.drift-fixture`), three arm-types (A backend-territory,
  B empty-diff, C local control), sensitivity + specificity + H2 — **past a bare existence proof, still
  not a large-N rate.** Injected, not organic (same limitation EXPERIMENT-0002 carried).
- **One healer partly unblinded itself** via tool access; the text-only healer is the clean H2 datum.

### Verdict on the gate → contract-guard sequencing (REVISED by the wider data)
Combined with the n=1 (A✓, C✓), the widening adds a **positive H2** and an **empty-diff arm — but that
arm does *not* pass H1 as the gate defined it.** H1 is "classify drift using **signals 1–2 alone, no
contract evidence**"; the gate's own branch is "H1 fails without contract evidence → the contract guard
is **load-bearing** → draft next." On the empty-diff case, diff-relevance gives **no** signal, and the
classifier reached *external drift* only because it was handed a **contract oracle** — the live response
shape — the very thing the contract-guard supplies. So the honest reading is **not** "signals 1–2
suffice": for the **empty-diff + no-in-code-validation** segment, **contract visibility was load-bearing**,
which by the gate's logic points *toward* the guard, not away.

What the widening therefore **revises**: the contract-guard's differentiated value is no longer merely
*argued* — it is **demonstrated** for its target segment (frontends that (a) lack response-schema
validation **and** (b) face an empty-diff drift a static pass can't resolve without a published contract).
It can still be **sequenced pragmatically behind Problem 1 v0** (`e2e-impact`, #44) *if* that segment is
the minority and the schema-validated / diff-visible cases (where signals suffice — Arm A + mosaic) are
the common path — but the wider data moved the evidence **toward** the guard being load-bearing; it did
**not** confirm "signals alone suffice." The cheaper on-domain alternative gains from the same finding:
**recommend/generate client-side response-schema validation**, which makes the empty-diff drift
self-revealing and lets signals 1–2 close it *without* a separate guard — worth weighing first.

### ADR-0018 status after widening
Upgraded from **n=1 existence proof** to **n=2 apps**, with the empty-diff and naive-healer arms run.
Honest scope: **H1 *as defined* (signals 1–2 alone) was not closed** — the empty-diff arm needed a
contract oracle (the live response) to resolve, so it demonstrates the *contract signal is load-bearing*
for the no-validation/empty-diff segment, **not** that signals alone suffice. Specificity (H3) held; H2
(green-lock) positively demonstrated on **one clean datum** (+ one contaminated tool run). Gaps re-stated,
not oversold: **large-N / organic drift**, and a **true no-contract-visibility empty-diff arm**. All five
#45 acceptance criteria met (criterion 4 taken on its "or the gap re-stated" branch).
