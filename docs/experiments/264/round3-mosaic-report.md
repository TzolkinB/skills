<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# exp264c Phase 2 audit report (Mosaic, Playwright, by-hand audit-test)

## Summary
- 12 tests audited by one mutation each: 11 RED, 1 GREEN (single-layer), 0 INVALID. After a better double-layer mutation CON-01 went RED too.
- 6 final-assertion probes: 4 RED, 2 GREEN. Both GREEN are the admin approve and cancel tests.
- Real finding: "approves a pending booking" and "cancels a pending booking" only check the UI after an optimistic update. A server that returns 200 but saves the wrong status passes both. [T3: ran, observed]
- 11 of the 12 first REDs did hit the named behaviour. But the approve/cancel REDs came from a 500 error path, not from persistence (see GREEN section).
- CON-01 survives any single-layer src break: a DB trigger gives the same 409 text. This is defense in depth, not a hollow test. It dies only if both layers are broken.
- One app, 12 tests, mutations chosen by me. No rate claims.

## Baseline
Supabase local at 127.0.0.1:55321 (verified by `supabase status -o env`). Full suite: 51 passed, 0 failed, 0 skipped, 51.5 s test time (includes the setup test and globalSetup reset). No baseline failures, nothing excluded. [T3]

## Step 3 table (each run = `playwright test -g "<title>"`, seconds are wall time incl. DB reset; every restore verified clean)
| spec > test | mutation (file, change) | result | s | why |
|---|---|---|---|---|
| calendar > CAL-05 room legend | CalendarLegend.tsx: `label={room.name}` to `label=""` | RED | 41 | "Main Hall" not found |
| calendar > CAL-06 no status legend | CalendarLegend.tsx: add a `Confirmed` LegendItem | RED | 40 | toBeHidden saw it visible |
| calendar > CAL-09 purpose shown | BookingCalendar.tsx:18 `{event.purpose &&` to `{false && event.purpose &&` | RED | 41 | purpose text missing |
| booking > end before start | BookingForm.tsx:~109 client check `if (new Date(endISO) <= ...)` to `if (false)` | RED | 40 | error text absent (server 400 shows other text) |
| booking > VAL-11 whitespace group | BookingForm.tsx:71 `groupName.trim()` to `groupName` | RED | 40 | error text absent |
| booking > invalid email | BookingForm.tsx:73 regex branch to `else if (false)` | RED | 39 | error text absent |
| booking > contact name persisted | api/bookings/route.ts:113 `contact_name: contactName` to `null` | RED | 36 | admin API row null vs "Dana Booker" |
| booking > contact phone persisted | route.ts:114 `contact_phone` to `null` | RED | 35 | null vs "555-0142" |
| booking > attendee count persisted | route.ts:115 `attendee_count` to `null` | RED | 35 | null vs 27 |
| admin > approves a pending booking | api/bookings/[id]/route.ts: skip status update when "confirmed" | RED* | 41 | *PATCH hit an empty update and failed; see GREEN section |
| admin > cancels a pending booking | same file: skip status update when "cancelled" | RED* | 42 | same artifact |
| admin > CON-01 conflict blocked | bookingOverlap.ts: `if (hasOverlap)` to `if (false)` | GREEN | 36 | DB trigger (migration 008/010) still returns 409 with same message; equivalent, not counted as a finding |
| admin > CON-01 (retry) | above plus route.ts: trigger branch `insertError.message.includes("room_overlap")` to `false` | RED | 41 | both layers gone, 500 instead of conflict text |

Reachability: the dev server picks up src edits at boot, and the controls above (many REDs) show edits reach the running app. No candidate-RED was recorded without that evidence.

## Final-assertion probe
| test | final assertion | probe mutation | result | s |
|---|---|---|---|---|
| CAL-06 | `Main Hall` visible (after two toBeHidden checks) | rename legend aria-label so the region is not found (hidden checks pass vacuously) | RED | 41 |
| contact name persisted | public feed text `not.toContain("Dana Booker")` | GET /api/bookings reads `bookings` via admin client and returns contact_name, phone, attendee_count | RED | 35 |
| contact phone persisted | feed `not.toContain("555-0142")` | same leak mutation | RED | 34 |
| attendee count persisted | feed has no `attendee_count` key | same leak mutation | RED | 35 |
| approves a pending booking | row shows "confirmed" | PATCH saves "cancelled" when asked "confirmed", still returns 200 | GREEN | 36 |
| cancels a pending booking | row shows "cancelled" | PATCH saves "confirmed" when asked "cancelled", still returns 200 | GREEN | 35 |

Not probed: "purpose required" and "contact name empty" (final `not.toHaveURL(/confirmation/)`). The server also rejects empty fields, so I found no src change that fails only that last line. This is inference, not tried.

## GREEN explanations
- Approve and cancel (the real finding). Both click the button, then assert the row text. `useAdminBookings.updateStatus` sets the status locally whenever `res.ok`, using the requested value, not the server's. The tests never reload or re-read the booking. They prove "the PATCH returned 2xx and the UI updated", not "the status was saved". A mutated PATCH that persists the wrong status passes. My first RED on these two was misleading: skipping the update made the Supabase call fail with a 500, which the UI reports as an error. [T3 for the GREEN runs; the mechanism is read from source, inference]
- CON-01 single-layer GREEN: equivalent mutation. The overlap rule lives twice (app RPC check and DB trigger). Removing only the app check changes nothing observable. Not counted as a finding. The test is pinned to the message text, so it would not notice a changed message only if both copies change together.

## Problems met
- `sed -i` on macOS failed with a multi-line pattern. One CON-01 retry therefore ran unmutated (passed, 37 s) and was discarded. I redid it with Python.
- `.env.test.local` is absent after teardown, so the credential check used `supabase status -o env` (127.0.0.1:55321) instead.
- The "1 passed" line in each run is the setup project, not the test.
- No Docker, port, or DB failures.

## Limits
- One app, 12 tests, 6 probes, one mutation each, chosen by me. The suite was AI-written then human-edited.
- Mutations were limited to src. DB rules (RLS, view definitions, triggers) were not mutated, so tests guarding those were judged only through src.
- Timezone: machine default only; no UTC run.
- No flake check on the GREEN results (single run each).
- `purpose required`, `CAL-03/04/08`, auth, edit, delete, room, and filter tests were not audited (Unexamined).

## Cleanup
`supabase stop --no-backup` ran in the clone. `git status` shows only the pre-existing isolation edits (AGENTS.md, playwright.config.ts, supabase/config.toml); `src` clean. No next dev process; ports 3100, 55321, 55322 free. `docker ps -a` shows only pokemon-db, bold_tharp, eager_khorana, welcome-to-docker; the only containers created were mosaic-exp264c, now removed. The original mosaic-room-booking repo was not touched (its git status is clean).
