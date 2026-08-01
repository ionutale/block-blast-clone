# Killer Sounds — Design

Date: 2026-08-01
Status: Approved

## Goal

Replace the synthesized Web Audio bleeps with killer, license-free sounds: jsfxr-generated WAV sound effects for every game event (modern juicy pop vibe) and a background music track sourced from Mixkit or Pixabay Music. Keep the existing mute toggle behavior and the `createAudio()` API shape.

## Approach

- **SFX**: one-time Node script `tools/gen-sfx.mjs` uses the `jsfxr` npm package (verified working headless in Node — `new SoundEffect(params).generate().dataURI` produces valid RIFF WAV) to generate 7 tuned WAV files committed to `assets/sfx/`.
- **Music**: the user downloads a free loop from Mixkit or Pixabay Music (both license-free for games, no attribution required) and saves it as `assets/audio/music.mp3`.
- **Player**: rewrite `js/audio.js` to decode assets with `decodeAudioData` and play via `AudioBufferSourceNode`. No oscillator synthesis.
- **Events**: `game.js` gains `onInvalid` and `onNewTray` callbacks so main.js can trigger the two new sounds.

## SFX Manifest (7 files, `assets/sfx/`)

Generated at 22050 Hz, mono, 16-bit, `sound_vol` 0.25–0.4, tuned for a modern juicy pop feel (soft sine/triangle bodies, short attack, quick decay, subtle pitch drop for weight):

| File | Event | Tuning direction |
|---|---|---|
| `place.wav` | piece lands | short sine pop, pitch 500→300Hz drop, ~0.12s |
| `clear.wav` | 1+ lines cleared | bright triangle chime, punchy, ~0.3s |
| `combo.wav` | 2+ lines in one move | rising square arpeggio feel, ~0.5s |
| `invalid.wav` | rejected drop | low square buzz, ~0.15s |
| `newtray.wav` | new set dealt | light rising two-note sweep, ~0.2s |
| `boardfull.wav` | game over reached | low noise thud, ~0.3s |
| `gameover.wav` | game over | longer descending tone, ~0.8s |

Exact presets are tuned inside `tools/gen-sfx.mjs` (Params fields: `wave_type`, `p_env_attack/sustain/punch/decay`, `p_base_freq`, `p_freq_ramp`, `p_freq_limit`). Re-running the script regenerates the WAVs — committed outputs mean the game never runs the generator.

## Audio API (`js/audio.js` rewrite)

`createAudio()` returns `{ unlock, place, clear, gameOver, toggle, isMuted }` (unchanged) plus `{ invalid, newTray, combo, boardFull }` (new).

- **unlock()** (first pointer/key gesture, unchanged call site in main.js): ensure AudioContext, then async-load all 7 SFX + music:
  - fetch each asset → `ctx.decodeAudioData` → cache in a map
  - music: fetch → decode → `source.loop = true` → musicGain (0.5) → start
  - SFX: `AudioBufferSourceNode` → sfxGain (1.0)
  - If any asset fails to load/decode, log once and continue (game stays fully playable)
- **clear(lines)**: play `clear.wav`; if `lines >= 2` also play `combo.wav` (slight 0.05s offset)
- **gameOver()**: play `boardfull.wav`, then `gameover.wav` after 0.3s
- **toggle()/isMuted()**: master gain 0/1 + `localStorage` (`MUTE_KEY`), unchanged
- Music only starts when the tab is active after unlock; no separate music toggle (YAGNI)

## Game Event Wiring

- `js/game.js` `createGame(canvas, options)` gains two optional callbacks:
  - `onInvalid` — fired in `onDragEnd` when `canPlace` returns false (before the early return)
  - `onNewTray` — fired in `maybeNewTray` when a new tray is dealt
  - Debug API (`getState`/`setTray`/`setBoard`) untouched
- `js/main.js`: wire `onInvalid → audio.invalid()`, `onNewTray → audio.newTray()`; test mode stays `audio = null` (silent)
- Board-full and combo events need no game.js changes — main.js derives them from existing `onGameOver` / `onPlacement(lines)`

## Files

- Add: `tools/gen-sfx.mjs` (jsfxr presets → `assets/sfx/*.wav`)
- Add: `assets/sfx/*.wav` (7 generated files), `assets/audio/music.mp3` (user-provided)
- Rewrite: `js/audio.js`
- Modify: `js/game.js` (~6 lines), `js/main.js` (~3 lines), `js/audio.test.js`
- Dependency: `jsfxr` as devDependency (build-time only)

## Error Handling

- Music file missing → skip music silently, log once in console
- SFX decode failure → skip that sound, log once
- Mute works regardless of load state

## Testing

- `npm test`: `audio.test.js` updated — remove `CHORDS`/`midiToFreq` tests, add tests for new pure exports (e.g., the SFX manifest file list matches presets in `tools/gen-sfx.mjs`; asset filenames referenced in audio.js exist on disk)
- `npx playwright test`: all e2e green (audio is null in test mode — no behavior change)
- Manual: place pieces, clear lines, force invalid drop, new tray, game over — each sound distinct; music loops continuously; mute silences everything; no console errors
