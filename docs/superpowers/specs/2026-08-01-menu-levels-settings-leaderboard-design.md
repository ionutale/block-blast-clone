# Main Menu, Levels, Settings, Leaderboards — Design

Date: 2026-08-01
Status: Approved

## Goal

Turn the single-screen Block Blast clone into a full mobile-game shell: candy-themed main menu (Classic Column layout — user-validated), puzzle challenge levels with stars, settings, and an online leaderboard backed by the existing MongoDB API.

## Screens & Navigation

SPA with hash routing, no build step (stays static on Vercel):

| Route | Screen |
|---|---|
| `#/` | Main menu — Classic Column: title, PLAY, LEVELS, SETTINGS, LEADERBOARD, footer |
| `#/levels` | Level select — scrollable 5-column grid, 20 levels, stars shown, 🔒 locks |
| `#/settings` | Settings rows (see below) |
| `#/leaderboard` | Top-10 board with Endless / Challenge tabs |
| `#/play` | Endless mode (current game) |
| `#/level/N` | Challenge mode for level N |

- `js/router.js` — hashchange listener; each route renders its screen (toggle DOM sections), mounts/unmounts the game canvas container, scrolls to top, handles back navigation.
- `index.html` restructured: one section per screen + the game section (HUD + canvas + overlays). The game-over overlay gains a name input + "submit score" flow.
- The canvas game loop runs only while a play screen is active: `game.js` gains `stop()` (cancels rAF; `start()` already exists).

## Main Menu (Classic Column — validated in browser)

Title "BLOCK BLAST" (gradient pink→purple), subtitle "CANDY EDITION", stacked buttons: PLAY (gradient pink, big), LEVELS / SETTINGS / LEADERBOARD (outlined purple), footer. All existing styles reused from the candy theme.

## Levels (Puzzle Challenges with Stars)

`js/levels.js` — 20 definitions:

```js
{ id: 1, goal: { type: 'lines', target: 2 }, moves: 8 }
```

- Goal types: `lines` (total lines cleared) and `score` (points).
- **Move budget**: one successful placement = one move (failed drops don't consume).
- **Stars**: complete = 1★; moves left ≥ 1 = 2★; moves left ≥ `ceil(moves / 3)` = 3★.
- **Progression**: level N unlocks when N−1 completed (any stars). Highest unlocked + stars persisted in localStorage.
- **End**: goal met → complete overlay (stars, score, submit-to-leaderboard). Moves exhausted before goal → failed overlay (retry).
- 20-level table (moves, goal) — tuned so a good player finishes with ~1–2 moves spare; score targets scaled to be reachable with a few clears:

| Lv | Goal | Moves | Lv | Goal | Moves |
|---|---|---|---|---|---|
| 1 | 2 lines | 8 | 11 | 1600 pts | 14 |
| 2 | 3 lines | 10 | 12 | 8 lines | 20 |
| 3 | 300 pts | 9 | 13 | 2000 pts | 15 |
| 4 | 4 lines | 12 | 14 | 9 lines | 22 |
| 5 | 600 pts | 11 | 15 | 2500 pts | 16 |
| 6 | 5 lines | 14 | 16 | 10 lines | 24 |
| 7 | 900 pts | 12 | 17 | 3000 pts | 17 |
| 8 | 6 lines | 16 | 18 | 12 lines | 26 |
| 9 | 1200 pts | 13 | 19 | 4000 pts | 20 |
| 10 | 7 lines | 18 | 20 | 15 lines | 28 |

## Settings

Rows in a card (validated mockup):
- **Player name** — free-text input (≤ 12 chars), persisted, used by leaderboard
- **Music volume** slider → `audio.setMusicVolume(v)` (musicGain)
- **SFX volume** slider → `audio.setSfxVolume(v)` (sfxGain)
- **Haptics** toggle → `navigator.vibrate(10)` on placement, `vibrate([10,30,10])` on clear (guarded: feature-detect, skip in test mode)
- **Reset progress** — confirm dialog → wipe all `block-blast-*` localStorage keys
- Quick-mute button (🔊) stays top-right, unchanged behavior

`js/storage.js` — settings/progress/name load+save with safe try/catch (private-mode safe). Keys: `block-blast-settings`, `block-blast-progress`, `block-blast-name`.

## Game Mode Changes (`js/game.js`)

- `createGame` options gain: `mode: 'endless' | 'challenge'` (default endless), callbacks `onMovesLeft(n)`, `onGoal(remainingText)`, `onLevelComplete({ stars, score })`, `onLevelFailed()`.
- Challenge state: `movesLeft`, goal progress (lines cleared / score), decremented on successful placement.
- Endless behavior unchanged; `checkGameOver` only runs in endless mode.
- `stop()` added (cancel rAF). Debug API gains `setLevel(level)` for tests if needed.
- HUD: challenge adds a moves-left counter + goal line above the board (DOM, updated via callbacks); endless HUD unchanged. Canvas renderer untouched except nothing.

## Leaderboard (Online, MongoDB)

`api/leaderboard.js` — same serverless pattern as `api/online.js` (`_db.js` Mongo client):

- `GET /api/leaderboard?mode=endless|challenge` → `{ entries: [{ name, score }] }` top 10 by score desc
- `POST /api/leaderboard` body `{ name, score, mode }` → upsert `{ name, mode }` keeping **highest** score per player per mode (`$max`), returns `{ rank, entries }`
- Validation: name trimmed 1–12 chars, score finite int 0 ≤ score ≤ 10⁹, mode in set; else 400. DB failure → 500.
- Client `js/leaderboard.js` — fetch wrapper with loading/offline states; submit on game over (endless) / level complete (challenge) with inline name prompt; shows rank in the result overlay; "Leaderboard" buttons route to `#/leaderboard`.

## Files

- New: `js/router.js`, `js/levels.js`, `js/storage.js`, `js/leaderboard.js`, `js/screens.js`, `api/leaderboard.js`
- Modify: `index.html`, `js/main.js`, `js/game.js`, `js/audio.js` (volumes), `js/renderer.js` (nothing — verify), `css/style.css` (screens, level grid, sliders, rows), `e2e/helpers.js` (route to `#/play` in test mode)
- New e2e specs: `e2e/menu.spec.js` (navigation), `e2e/levels.spec.js` (unlock flow, stars persist), `e2e/settings.spec.js` (persistence, reset), `e2e/leaderboard.spec.js` (mock POST/GET)

## Testing

- Unit: `js/levels.test.js` (star math, progression), `js/storage.test.js` (round-trip, corruption safety), `js/leaderboard.test.js` (validation — pure function)
- E2E: existing 4 specs updated (helpers route to `#/play`); 4 new specs above
- `?test=1` mode: audio/haptics off, leaderboard fetch mocked or skipped

## Out of Scope (YAGNI)

- Daily challenges, skins, accounts/auth, per-level online leaderboards, sounds for menu (menu clicks reuse place SFX — none added)
