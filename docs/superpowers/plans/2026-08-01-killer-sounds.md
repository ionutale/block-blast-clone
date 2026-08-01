# Killer Sounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace synthesized Web Audio bleeps with license-free killer sounds: 7 jsfxr-generated WAV effects (modern juicy pop vibe) + a user-provided Mixkit/Pixabay music loop, keeping the existing mute toggle and API shape.

**Architecture:** A one-time Node script (`tools/gen-sfx.mjs`) uses the `jsfxr` npm package (devDependency) to generate `assets/sfx/*.wav`, committed as static assets. `js/audio.js` is rewritten to fetch + `decodeAudioData` everything on unlock, playing SFX via `AudioBufferSourceNode` and looping music through a dedicated gain. `game.js` gains `onInvalid`/`onNewTray` callbacks wired in `main.js`.

**Tech Stack:** Vanilla JS (ES modules), Web Audio API, `jsfxr` (devDependency), node:test, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-01-killer-sounds-design.md`

**Verified API facts (jsfxr 1.4.1):** `import { Params, SoundEffect } from 'jsfxr'` — set Params fields (`wave_type` 0=SQUARE/1=SAWTOOTH/2=SINE/3=NOISE, `p_env_attack/sustain/punch/decay`, `p_base_freq`, `p_freq_ramp`, `p_freq_limit`, `sound_vol`, `sample_rate`, `sample_size`), then `new SoundEffect(ps).generate().dataURI` returns a base64 WAV data URI. Do NOT call `sfxr.toWave()` after `generate()` — it re-generates and throws "Bad wave type: NaN"; use `.dataURI` directly.

---

### Task 1: SFX Generator Script + Generated Assets

**Files:**
- Create: `tools/gen-sfx.mjs`
- Modify: `package.json` (jsfxr devDependency via npm install)
- Add: `assets/sfx/*.wav` (7 generated files, committed)

- [ ] **Step 1: Install jsfxr as a devDependency**

Run: `npm install --save-dev jsfxr@1.4.1`
Expected: package.json gains `"jsfxr": "^1.4.1"` under devDependencies; package-lock.json updates.

- [ ] **Step 2: Write the generator script**

Create `tools/gen-sfx.mjs`:

```js
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Params, SoundEffect } from 'jsfxr';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
mkdirSync(OUT, { recursive: true });

function tune(overrides) {
  const ps = new Params();
  ps.sound_vol = 0.3;
  ps.sample_rate = 22050;
  ps.sample_size = 16;
  Object.assign(ps, overrides);
  return ps;
}

const PRESETS = {
  place: tune({
    wave_type: 2,
    p_env_attack: 0.01, p_env_sustain: 0.06, p_env_punch: 0.3, p_env_decay: 0.12,
    p_base_freq: 0.4, p_freq_limit: 0.45, p_freq_ramp: -0.35,
  }),
  clear: tune({
    wave_type: 2,
    p_env_attack: 0.005, p_env_sustain: 0.15, p_env_punch: 0.5, p_env_decay: 0.25,
    p_base_freq: 0.62, p_freq_ramp: 0.1,
  }),
  combo: tune({
    wave_type: 0,
    p_env_attack: 0.01, p_env_sustain: 0.2, p_env_punch: 0.5, p_env_decay: 0.3,
    p_base_freq: 0.5, p_repeat_speed: 0.35,
  }),
  invalid: tune({
    wave_type: 0,
    p_env_attack: 0, p_env_sustain: 0.05, p_env_punch: 0.2, p_env_decay: 0.15,
    p_base_freq: 0.15, p_freq_ramp: -0.1,
  }),
  newtray: tune({
    wave_type: 2,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.4, p_env_decay: 0.2,
    p_base_freq: 0.3, p_freq_ramp: 0.4,
  }),
  boardfull: tune({
    wave_type: 3,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.5, p_env_decay: 0.3,
    p_base_freq: 0.3, p_freq_ramp: -0.5,
  }),
  gameover: tune({
    wave_type: 1,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.3, p_env_decay: 0.8,
    p_base_freq: 0.35, p_freq_ramp: -0.6,
  }),
};

let failed = false;
for (const [name, params] of Object.entries(PRESETS)) {
  const wav = new SoundEffect(params).generate().dataURI;
  const buf = Buffer.from(wav.split(',')[1], 'base64');
  const ok =
    buf.length > 44 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE';
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${buf.length} bytes  ${ok ? 'OK' : 'INVALID'}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('One or more WAVs are invalid.');
  process.exit(1);
}
console.log('Done. 7 SFX files written to assets/sfx/.');
```

- [ ] **Step 3: Run the generator**

Run: `node tools/gen-sfx.mjs`
Expected: 7 lines of `*.wav  NNNN bytes  OK` and `Done. 7 SFX files written to assets/sfx/.`

Run: `file assets/sfx/place.wav`
Expected: `... RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 22050 Hz`

- [ ] **Step 4: Verify tests still green**

Run: `npm test`
Expected: all existing tests PASS (audio.test.js still tests CHORDS/midiToFreq — they still exist until Task 2).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tools/gen-sfx.mjs assets/sfx
git commit -m "feat: jsfxr SFX generator and 7 generated sound effects"
```

---

### Task 2: Rewrite `js/audio.js` + Update `js/audio.test.js`

**Files:**
- Modify: `js/audio.js` (full rewrite)
- Modify: `js/audio.test.js` (full rewrite)

- [ ] **Step 1: Write the failing tests first**

Replace the entire `js/audio.test.js` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SFX_MANIFEST, MUSIC_URL, MUTE_KEY } from './audio.js';

test('SFX_MANIFEST has 7 named effects with .wav files', () => {
  assert.equal(SFX_MANIFEST.length, 7);
  for (const s of SFX_MANIFEST) {
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.match(s.file, /\.wav$/);
  }
});

test('every SFX manifest file exists and is a RIFF WAV', () => {
  for (const s of SFX_MANIFEST) {
    const buf = readFileSync(new URL(`../${s.file}`, import.meta.url));
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${s.file} missing RIFF header`);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', `${s.file} missing WAVE chunk`);
  }
});

test('manifest names match the generated assets on disk', () => {
  const names = new Set(SFX_MANIFEST.map((s) => s.name));
  assert.deepEqual([...names].sort(), ['boardfull', 'clear', 'combo', 'gameover', 'invalid', 'newtray', 'place']);
});

test('MUSIC_URL points at the audio dir and MUTE_KEY is stable', () => {
  assert.equal(MUSIC_URL, 'assets/audio/music.mp3');
  assert.equal(MUTE_KEY, 'block-blast-muted');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `audio.js` does not export `SFX_MANIFEST`, `MUSIC_URL` (import error).

- [ ] **Step 3: Rewrite `js/audio.js`**

Replace the entire file with:

```js
export const MUTE_KEY = 'block-blast-muted';

export const SFX_MANIFEST = [
  { name: 'place', file: 'assets/sfx/place.wav' },
  { name: 'clear', file: 'assets/sfx/clear.wav' },
  { name: 'combo', file: 'assets/sfx/combo.wav' },
  { name: 'invalid', file: 'assets/sfx/invalid.wav' },
  { name: 'newtray', file: 'assets/sfx/newtray.wav' },
  { name: 'boardfull', file: 'assets/sfx/boardfull.wav' },
  { name: 'gameover', file: 'assets/sfx/gameover.wav' },
];

export const MUSIC_URL = 'assets/audio/music.mp3';

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let loaded = false;
  const buffers = new Map();
  let musicBuffer = null;
  let musicSource = null;

  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  async function loadAudio(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    return ctx.decodeAudioData(arr);
  }

  async function loadAll() {
    if (loaded) return;
    loaded = true;
    try {
      await Promise.all(
        SFX_MANIFEST.map(async (s) => {
          try {
            buffers.set(s.name, await loadAudio(s.file));
          } catch (e) {
            console.warn(`audio: failed to load ${s.file}`, e);
          }
        })
      );
      try {
        musicBuffer = await loadAudio(MUSIC_URL);
      } catch (e) {
        console.warn(`audio: no music track at ${MUSIC_URL}`, e);
      }
    } catch (e) {
      console.warn('audio: load error', e);
    }
    startMusic();
  }

  function play(name, { delay = 0, volume = 1 } = {}) {
    if (!ctx) return;
    const buf = buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(sfxGain);
    src.start(ctx.currentTime + delay);
  }

  function startMusic() {
    if (!ctx || !musicBuffer || musicSource) return;
    musicSource = ctx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start();
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    loadAll();
  }

  function place() {
    play('place');
  }

  function clear(lines) {
    play('clear');
    if (lines >= 2) play('combo', { delay: 0.05 });
  }

  function invalid() {
    play('invalid');
  }

  function newTray() {
    play('newtray');
  }

  function boardFull() {
    play('boardfull');
  }

  function gameOver() {
    boardFull();
    play('gameover', { delay: 0.3 });
  }

  function setMuted(m) {
    muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    if (master) master.gain.value = m ? 0 : 1;
  }

  function toggle() {
    setMuted(!muted);
    return muted;
  }

  return {
    unlock, place, clear, gameOver, invalid, newTray, combo: clear, boardFull,
    toggle,
    isMuted: () => muted,
  };
}
```

Note: `combo: clear` — calling `audio.combo()` plays the clear chime + combo fanfare, consistent with main.js's `onPlacement(lines)` handling (see Task 4).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS (19 old tests minus 3 removed = 16 + 4 new = 20 tests; the exact count will print in the summary — assert 0 failures).

- [ ] **Step 5: Verify e2e still green**

Run: `npx playwright test`
Expected: 16/16 PASS (audio is `null` in test mode, so no audio path runs).

- [ ] **Step 6: Commit**

```bash
git add js/audio.js js/audio.test.js
git commit -m "feat: sample-based audio engine with jsfxr SFX and music loop"
```

---

### Task 3: Game Event Callbacks (`onInvalid`, `onNewTray`)

**Files:**
- Modify: `js/game.js`

- [ ] **Step 1: Add the callbacks to the options**

In `js/game.js` line 14, change the signature:

```js
export function createGame(canvas, { onScore, onGameOver, onPlacement, onInvalid, onNewTray, debug } = {}) {
```

- [ ] **Step 2: Fire `onNewTray` when a new set is dealt**

Replace `maybeNewTray` (currently lines 35-37):

```js
  function maybeNewTray() {
    if (allUsed(tray)) {
      tray = createTray();
      if (onNewTray) onNewTray();
    }
  }
```

- [ ] **Step 3: Fire `onInvalid` on rejected drops**

In `onDragEnd`, replace the invalid-placement branch (currently `if (!canPlace(board, piece.shape, row, col)) return;`):

```js
      if (!canPlace(board, piece.shape, row, col)) {
        if (onInvalid) onInvalid();
        return;
      }
```

- [ ] **Step 4: Verify**

Run: `npm test` → ALL PASS. Run: `npx playwright test` → ALL PASS (callbacks are optional; debug API untouched).

- [ ] **Step 5: Commit**

```bash
git add js/game.js
git commit -m "feat: onInvalid and onNewTray game callbacks"
```

---

### Task 4: Wire Audio in `js/main.js`

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Wire the new events**

In `js/main.js`, inside the `createGame(canvas, {...})` options object, after `onPlacement`, add:

```js
  onInvalid: () => {
    if (audio) audio.invalid();
  },
  onNewTray: () => {
    if (audio) audio.newTray();
  },
```

- [ ] **Step 2: Verify**

Run: `npm test` → ALL PASS. Run: `npx playwright test` → ALL PASS (test mode: audio is null, callbacks no-op).

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: wire invalid-drop and new-tray sounds"
```

---

### Task 5: Audio Smoke Test + Music File + Final Verification

**Files:**
- Add: `assets/audio/music.mp3` (user-provided — see note below)
- Create: `audio-smoke.mjs` (temporary verification script, deleted before commit)

**IMPORTANT — the music file:** the user downloads a free loop from Mixkit (https://mixkit.co/free-stock-music/) or Pixabay Music (https://pixabay.com/music/) and saves it as `assets/audio/music.mp3`. The game degrades gracefully without it (warn once, no crash). If the file is missing at verification time, skip the music assertions and note it.

- [ ] **Step 1: Audio smoke test with Playwright**

Create `audio-smoke.mjs` in the repo root (needs `@playwright/test` resolvable):

```js
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
const warnings = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') warnings.push(msg.text());
});
await page.goto('http://127.0.0.1:4173/?test=1');
await page.waitForTimeout(300);

const sfxLoaded = await page.evaluate(async () => {
  const paths = ['place', 'clear', 'combo', 'invalid', 'newtray', 'boardfull', 'gameover'];
  const results = {};
  for (const name of paths) {
    const res = await fetch(`assets/sfx/${name}.wav`);
    results[name] = res.ok;
  }
  return results;
});
console.log('SFX assets fetchable:', JSON.stringify(sfxLoaded));

const musicCheck = await page.evaluate(async () => {
  const res = await fetch('assets/audio/music.mp3');
  return { ok: res.ok, status: res.status };
});
console.log('music.mp3 present:', musicCheck.ok);

const audioApi = await page.evaluate(() => {
  const mod = window.__audioApi;
  return mod ? Object.keys(mod).sort() : null;
});
console.log('audio API (need manual check if null):', JSON.stringify(audioApi));
console.log('console warnings/errors:', warnings.length ? warnings : 'none');
await browser.close();
```

Note: `window.__audioApi` is not exported by the game — the script prints `null` for it; that's fine. The real checks are: SFX assets return HTTP 200, music.mp3 status, and zero console warnings/errors during load.

- [ ] **Step 2: Run the smoke test**

Start a server: `python3 -m http.server 4173 --bind 127.0.0.1 &` then:

Run: `node audio-smoke.mjs`
Expected: all 7 SFX `true`; music status 200 if the file exists (404 otherwise — acceptable, game still works); no console errors.

- [ ] **Step 3: Manual browser pass**

Open `http://127.0.0.1:4173` and play one full game:
1. First tap/click unlocks audio; a sound plays when a piece lands
2. Completing a row plays the clear chime (2+ lines: clear + combo)
3. Dropping a piece where it doesn't fit plays the invalid buzz
4. Using all three pieces deals a new tray with the new-tray sweep
5. Losing plays the board-full thud + game-over jingle
6. Music loops in the background (if music.mp3 present); mute button silences everything; muted state persists on reload

- [ ] **Step 4: Full test suite**

Run: `npm test` → ALL PASS. Run: `npx playwright test` → ALL PASS.

- [ ] **Step 5: Clean up and commit**

```bash
rm audio-smoke.mjs
```

If the user provided `assets/audio/music.mp3`, commit it too:

```bash
git add assets/audio/music.mp3
git commit -m "feat: add background music track"
```

(If music.mp3 is not yet present, note it in the final report — everything else ships.)

---

## Self-Review Notes

- **Spec coverage:** generator script + assets ✓ (T1), audio.js rewrite with 7-event API + music loop ✓ (T2), onInvalid/onNewTray callbacks ✓ (T3), main.js wiring ✓ (T4), music file + verification ✓ (T5).
- **Consistency:** `SFX_MANIFEST` names in audio.js match the `PRESETS` keys in gen-sfx.mjs (place/clear/combo/invalid/newtray/boardfull/gameover — test in T2 Step 1 enforces this). `createAudio()` return shape: `unlock, place, clear, gameOver, invalid, newTray, combo, boardFull, toggle, isMuted` — `combo: clear` alias keeps the spec's 10-method surface without dead code. MUSIC_URL = `assets/audio/music.mp3` matches the user's drop location.
- **Known jsfxr gotcha documented:** use `.generate().dataURI`, never `toWave()` after `generate()`.
- **No placeholders:** every step has complete code and exact commands.
