<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# Mosaic isolated baseline: feasibility (issue #264, phase 1)

Verdict: GO WITH CAVEATS

- Isolated clone ran the full Playwright suite (51 tests incl. 1 setup) green twice, workers 1, chromium. [T3]
- Isolation held: project_id mosaic-exp264c, all ports +1000, Next on 3100; only mosaic-exp264c containers created, all removed. [T3]
- The suite resets the DB itself (globalSetup runs `supabase db reset` every run), so no manual reset is needed. [T3]
- Cost per mutated single-test run is about 35s, ~26s of it the DB reset. [T3]
- No flake, no state leakage seen across 2 runs; passes under America/New_York and Asia/Tokyo. [T3]
- Caveat: Playwright browser was missing; installed into the scratch dir, not the user cache.

## Isolation diff (clone only)
- supabase/config.toml: project_id -> "mosaic-exp264c"; api 55321, db 55322, shadow 55320, studio 55323, inbucket 55324, smtp 55325, pop3 55326; auth site_url / redirect URL :3000 -> :3100. (analytics disabled, no other ports.)
- playwright.config.ts: baseURL and webServer.url localhost:3000 -> 3100; command `NODE_ENV=test npm run dev -- -p 3100`.
- Added clone-only `.env.local` with dummy admin creds (admin-exp264c@example.test); globalSetup throws without it. Original .env files never read or copied. Gitignored.
- node_modules rsynced from original; no npm install.
- Credentials check: config writes .env.test.local from `supabase status -o env` (127.0.0.1:55321) and passes via webServer.env; globalSetup keeps .env.local out of process.env. grep found no supabase.co URL in code, only in docs/CLAUDE.md prose.
- Pre-run containers (untouched): pokemon-db, bold_tharp, eager_khorana, welcome-to-docker. Original repo git status: clean.
- Env vars used: PLAYWRIGHT_BROWSERS_PATH=<scratch>/pw-browsers, SUPABASE_KEEP_RUNNING=1 (skip teardown stop).

## Baseline runs [T3]
| Run | Pass | Fail | Skip | Wall | Notes |
|---|---|---|---|---|---|
| 0 (first, cold images, no browser) | 0 | 1 setup | 50 not run | 67s | Chromium not installed; Supabase pull + start happened here |
| 1 | 51 | 0 | 0 | 76s | includes globalSetup reset |
| 2 | 51 | 0 | 0 | 67s | same counts, no failures, no accumulation visible |
| 3 (TZ=Asia/Tokyo) | 51 | 0 | 0 | 70s | extra check |

No test failed, so no failure names. No manual reset between runs (globalSetup does it).

## Single-test runs [T3] (each via `playwright test -g`, includes reset + dev-server boot)
| Test | Spec | Total |
|---|---|---|
| approves a pending booking | admin.spec | 36s |
| submits a booking request and lands on confirmation | booking.spec | 35s |
| CAL-05 room legend | calendar.spec | 35s |
| `supabase db reset` alone | n/a | 26s |

Playwright reports "2 passed" each (setup project + the test). Test itself is under 2s; fixed overhead (reset ~26s, Next dev start/compile ~8s) dominates. A test run without the reset would be ~8-10s, but the config offers no flag to skip globalSetup (not tried; would need a config edit).

## Feasibility for 10-12 mutated tests
- Estimate: ~35-40s per mutated run (T3 basis), so ~7-8 min for 12 tests, plus a full-suite regression check ~70s. Dev server hot-reloads, so a src mutation is picked up at boot; no build step.
- Risks:
  - Reset dominates cost; a faster path would be a config edit that skips `supabase db reset` (not tested).
  - Flakes: none seen in 3 full runs, 150+ test executions at workers 1. Sample is small.
  - State: reset each run makes it clean; untested whether tests pass without reset (commit "data accumulation" suggests some tests need it).
  - Timezone: UTC fix commit 657757d (CON-01). Passed under America/New_York (machine TZ) and Asia/Tokyo. UTC itself not run.
  - Next dev compile on first hit could add time to the first test after a mutation.
  - Dummy admin creds are local-only; real admin test creds unneeded.
- Suggested order: calendar (CAL-05, CAL-06, CAL-09), then booking validation tests, then booking persistence tests (contact/attendee), then admin approve/cancel, then CON-01 conflict test last (most timezone/state sensitive).
- Changes I would make: bake the browser path and ports into a wrapper script; consider a skip-reset env guard for the audit loop; run mutations in a second clone copy of src so the baseline stays pristine.

## Cleanup
`supabase stop --no-backup` run in the clone. docker ps -a now shows only the 4 original containers; 0 volumes matching exp264c; ports 3100 and 553xx free; no next dev process; original repo untouched.
