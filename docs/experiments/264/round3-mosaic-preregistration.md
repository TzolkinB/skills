<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# Mosaic audit (round 3) — pre-registration, written before any audit run

- Target: owner's mosaic-room-booking, clone at commit 88f50c1170b12c742a0f441befbef787dcdeb09c (2026-10-24). Isolated local Supabase (project mosaic-exp264c, ports +1000, Next on 3100).
- Provenance: tests written by Claude from a test plan (commit 95968a9, 2026-05-18, Sonnet 4.6), then edited in 29 commits (AI-assisted fixes, human edits). Not a clean generator sample.
- Baseline (phase 1): 51/51 pass twice, about 70 s; single mutated run about 35 s (26 s is the DB reset).
- Method: audit-test by hand, one auditor agent, about 12 tests, order: calendar, booking validation, booking persistence, admin approve/cancel, CON-01 conflict last. One careful mutation per test, then a probe of the final assertions.
- Outcomes recorded per test: RED / GREEN / INVALID (+ seconds). Counts only, no rate claims.
- Orchestrator had not read any test content at the time of writing.
