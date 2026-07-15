# Expected findings — contract-guard

`contract-guard` reads *consumer code* + a *published contract*, so it needs real frontends that
consume a backend over HTTP. The targets are the same warm fixtures EXPERIMENT-0018 used (siblings in
`~/projects/`, not vendored): `mosaic-room-booking` (validates responses) and `epic-stack/.drift-fixture`
(untyped, out-of-band drift). Each case below was traced by hand.

## Case 0 — Tier 0: consumer already validates → recommend nothing  (mosaic-room-booking)
Consumer: `src/app/shared/hooks/useRooms.ts` runs `z.array(RoomSchema).safeParse(data)` on the
`GET /api/rooms` response; `RoomSchema` requires `name`.
Run: `/contract-guard GET /api/rooms`
- **Tier 0.** The `safeParse` **is** the consumer-side contract — a `label`→`name` drift makes
  `safeParse` fail loudly, so drift is self-revealing. **Recommend no new guard;** `/debug-test --drift`
  reads this schema as its oracle. This is the EXPERIMENT-0018 mosaic finding: the differ would be
  **redundant** here.

## Case 1 — Tier 1: untyped consumer → recommend + scaffold validation  (.drift-fixture)
Consumer: `.drift-fixture/server.cjs` page reads `room.label` straight off `r.json()` — **no** response
validation. `tests/rooms.spec.ts` (`ROOM-01`) asserts `Main Hall` is visible.
Run: `/contract-guard GET /api/rooms` (no published spec supplied)
- **Tier 1.** The consumer reads untyped JSON → **propose** response-schema validation at the fetch
  boundary and **scaffold** it from the field the consumer reads:
  `z.array(z.object({ id: z.number(), label: z.string() }))` — *proposed, the human applies it*. This
  promotes the fixture into the Tier-0 case so future drift self-reveals. The lighter play
  EXPERIMENT-0018 named "weigh first."

## Case 2 — Tier 2: empty-diff drift, differ against the published spec  (.drift-fixture)
Setup: the "backend team" renames the field out-of-band (`echo name > /tmp/drift-field`) — the consumer
repo's `git diff` is **empty**, yet `ROOM-01` goes red (legend empty; the page still reads `.label`).
Run: `/contract-guard GET /api/rooms <openapi>`. The verdict turns on **whether the published spec still
matches what the consumer reads** (E = `.label`), not on the live response (which a static pass can't see):
- **Published spec has moved to `name`** — the provider *documented* the rename:
  ```yaml
  # GET /api/rooms → 200 → array items:
  properties: { id: {type: integer}, name: {type: string} }
  ```
  E (`.label`) ≠ S (`name`) → the spec sanctions the new shape → **`stale-consumer`** (deliberate
  evolution): the frontend is behind a documented rename → *offer* `room.label → room.name`. **Not** a
  green-lock — the published spec is the evidence it was intended; the human confirms.
- **Published spec still says `label`** — the drift was *not* documented: E (`.label`) = S (`label`), yet
  the legend is empty → the live response is deviating from the provider's *own* contract → **`suspected-
  break`** → route to `/bug-report` pointing at `label`. Do **not** green-lock to `name`.
- **No spec supplied / endpoint unlocatable / malformed doc** → **`no-spec`** → *cannot confirm intent →
  suspected break*; recommend Tier 1 + a cross-team ask. **Never** a fabricated verdict.

## Case 3 — Tier 2 verdict variants: drop, retype, optional/nullable  (illustrative, on the same endpoint)
The `stale-consumer` verdict fires the same way for any **S-moved-away-from-E** shape, not just renames —
each *offers* the aligning update, never green-locks:
- **Field dropped.** Consumer reads `.description`; S no longer lists `description` → E ≠ S (absent in S) →
  **`stale-consumer`**: provider deliberately dropped it → offer removing the consumer's dependency /
  handling absence.
- **Field retyped.** Consumer reads `.capacity` as a number; S has `capacity: { type: string }` → E ≠ S
  (type differs) → **`stale-consumer`**: offer coercing/parsing at the boundary.
- **Optional/nullable (latent, secondary flag — not the primary verdict).** Consumer treats `.capacity`
  as always-present; S marks it `nullable: true` / not in `required` → flag a **latent intermittent
  break**: today's red may be a different field, but the consumer will break whenever the provider omits
  `capacity`. Surfaced alongside the verdict, independently of it.
- **Malformed / unlocatable spec.** `<openapi>` is invalid YAML/JSON, or `GET /api/rooms` has no matching
  path item → **`no-spec`** (honest degrade), never a guessed `stale-consumer`.

## Boundary notes (what it must NOT do)
- **Static-judgment only** (ADR-0010) — reads source, in-code schemas, and the *published* contract
  (file or URL). Never runs the suite, drives a browser, or snapshots a *live* response.
- **Human disposition** (ADR-0013) — surfaces the mismatch + both dispositions; never silently heals the
  test, silently edits the consumer, or unilaterally blames the backend.
- **Propose, don't apply** (ADR-0002/0003) — the Tier-1 schema and the Tier-2 stale-consumer update are
  offered as diffs; the human adopts them.
- **Honest degrade** — no spec / unlocatable endpoint / malformed doc → `no-spec`, never a guessed match.
- **Composes, doesn't duplicate** — `/debug-test --drift` keeps its inline check and *recommends* this
  skill for the harder job; `contract-guard` routes a suspected break to `/bug-report` (ADR-0018/0021).
