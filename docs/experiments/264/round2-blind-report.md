<!-- TEMPORARY working file for issue #264. Delete this folder when #264 is closed. -->

# exp264b blind audit: Memory app, test/add-gap-tests @ 865a969

## Summary
- 8 new spec files in the commit (the 8 listed in pre-registration; `.mcp.json` and the spec doc also added, not used).
- 2 of 8 tests fail at baseline (keyboard, mobile layout), so they were not mutation-audited.
- The other 6 each got one targeted mutation: 6 RED, 0 GREEN, 0 INVALID (one first attempt was a bad edit by me, redone; see Problems).
- No false-confidence finding on the 6 audited tests. This says nothing about the 2 unaudited ones.
- All runs T3 (executed by me), dev-served Vite on :5199, seed 42, chromium, workers 1.
- Clean tree restored after every mutation; copy only; Memory repo untouched.

## Baseline (T3)
Dev server, chromium: 20 tests, 18 passed, 2 failed, 51.7s wall total.
Failed at baseline (excluded, not fixed):
1. `accessibility/keyboard-card-activation` "Flip cards with keyboard controls": fails at `getByRole('button',{name:'Face-down card with robots 3'})` toBeVisible (line 17) after 4 Tabs. The first card did hold focus, so card 0 is apparently not robot id 3 under seed 42 (inference).
2. `mobile-layout` "Game controls and cards fit a phone viewport": strict-mode violation at line 68, `/Classic Robots/` matches 2 buttons ("Change Deck (Classic Robots)" and the deck-option "Classic Robots Robot preview").
Not investigated further. Inference only: `Card.tsx` has `onClick` but no key handler on a `div role=button`, so the Enter/Space steps in test 1 may also not work; I did not test this.

## Table
Mutation seconds = wall-clock of the single-test mutated run (includes Playwright startup).

| Test (file > title) | Mutation (file:line, change) | Result | s | Why |
|---|---|---|---|---|
| decks/cancel-deck-selection > Cancel deck selection without changing the current game | DeckSelectorModal.tsx:82 Cancel `onClick={onHide}` -> `onClick={() => onSelectDeck(selectedDeck)}` (Cancel resets the game) | RED | 8 | blue score expected 1, got 0 at line 21 |
| decks/deck-selection > Switch decks after making progress | Main.reducer.ts:181 SELECT_DECK keeps `blueMatches` after reset | RED | 9 | blue score expected 0, got 1 at line 30 |
| decks/dismiss-deck-selector-with-escape > Dismiss deck selection with Escape | DeckSelectorModal.tsx:29 `onClose={onHide}` -> `onClose={() => {}}` | RED | 6 | modal stays visible after Escape (line 23) |
| decks/select-dragons-deck > Select the dragons deck from a fresh game | decks.ts:~26 second card of each dragon pair `id: dragon.id` -> `dragon.id + 1000` (pairs broken) | RED | 2 | expected 7 identities, got 14 (line 52) |
| game-outcomes/red-player-wins > Red player wins after the final pair | Main.reducer.ts:93 `return 'red-win'` -> `'blue-win'` | RED | 12 | "Red Player Wins!" not found (line 44) |
| game-outcomes/tie-game > The game reports a tie | Main.reducer.ts:96 `return 'tie'` -> `'blue-win'` | RED | 12 | "It is a tie!" not found (line 48) |
| accessibility/keyboard-card-activation > Flip cards with keyboard controls | not audited | BASELINE-FAIL | - | see Baseline |
| mobile-layout > Game controls and cards fit a phone viewport | not audited | BASELINE-FAIL | - | see Baseline |

## GREEN explanations
None. No test survived its mutation.

## Problems met
- First attempt on select-dragons used a sed that changed both lines of the dragon pair, which keeps pairs intact (near-equivalent). I caught it from the diff before running, reverted, and redid with only the second line. That run is the one reported; the first never ran.
- No Chromium build problem; default Playwright browser worked, no executablePath override needed.
- Hardcoded `VITE_SHUFFLE_SEED=42` exported to the vite process; other tests passing at baseline confirm the seed was effective.

## Limits
- One mutation per test, chosen by me, mostly single-assertion-targeted (RED on one assertion does not show the other assertions are live). Example: red/tie tests also end with "click card 0 after game over, scores unchanged"; that tail assertion is trivially true because all cards are already face-up, and I did not mutate the `finished` guard in `handleFlip` (Main.reducer.ts:58) to check. Unverified whether it is live.
- Cancel test covers both Cancel and the Close (X) button; I only mutated Cancel. Close path unmutated.
- deck-selection and select-dragons were mutated at a single point each; no check of the "all 14 cards face-down" loops.
- Two tests unaudited due to baseline failure; mobile layout is mostly CSS/viewport and I did not attempt CSS mutations because it cannot run to a pass.
- specs/memory-game-gaps.md not read (step 1 said only after step 2; I had no need). Counts only, no rate claim.
- Dev server killed; port 5199 confirmed free.
