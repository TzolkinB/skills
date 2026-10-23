<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# Blind audit — pre-registration (written before any test was read)

- Target: Memory app, branch test/add-gap-tests, commit 865a9697f6aeb7a422d6ea41dca79f794e270f03 (2026-10-22 19:01 -0400).
- Provenance (owner): tests written by the Playwright generator from specs/memory-game-gaps.md; not edited afterwards (owner to confirm any change).
- New test files in the commit (names only; contents NOT read by the orchestrator): accessibility/keyboard-card-activation, decks/{cancel-deck-selection,deck-selection,dismiss-deck-selector-with-escape,select-dragons-deck}, game-outcomes/{red-player-wins,tie-game}, mobile-layout.
- Method: audit-test by hand, one careful mutation per new test, dev-served app (ADR-0016), one auditor agent that chooses its own mutations. Auditor is not told which tests may be weak. No planted controls in this round.
- Outcome to record per test: RED (test caught the break), GREEN (test did not), INVALID (equivalent or no-op mutation, retried once). Counts only; no rate claims.
- Unblinding: the owner reads the GREEN tests afterwards and says whether each is truly weak.
