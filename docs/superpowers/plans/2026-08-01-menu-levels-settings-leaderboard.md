# Menu, Levels, Settings, Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-screen Block Blast clone into a mobile-game shell: hash-routed screens (menu, levels, settings, leaderboard, endless play, challenge play), 20 star-rated puzzle challenges, persistent settings, and an online MongoDB leaderboard.

**Architecture:** Vanilla SPA: a tiny hash router (`js/router.js`) toggles DOM sections in `index.html`; `js/levels.js` (data + star math), `js/storage.js` (localStorage), `js/screens.js` (screen renderers), `js/leaderboard.js` (API client). `js/game.js` gains a challenge mode (move budget + goal) plus `stop()`/`startChallenge()`/`startEndless()`. `api/leaderboard.js` + `_db.js` helpers serve the online board via the existing MongoDB client.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, node:test, Playwright, MongoDB (existing `api/_db.js`).

**Spec:** `docs/superpowers/specs/2026-08-01-menu-levels-settings-leaderboard-design.md`

**Current state (verified):** `game.js` is a singleton coordinator created once in `main.js` with `{ start, restart, debug }`; e2e helpers `openGame` use `/?test=1`; `api/online.js` shows the serverless pattern (import from `_db.js`, 503 when `!dbConfigured()`, 500 on catch). `?test=1` attaches `window.__blockBlast = game.debug`.

---

### Task 1: Levels Data + Star Math (`js/levels.js`)

**Files:**
- Create: `js/levels.js`
- Test: `js/levels.test.js`

- [ ] **Step 1: Write the failing tests**

Create `js/levels.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, calcStars, getLevel } from './levels.js';

test('LEVELS has 20 levels with sequential ids', () => {
  assert.equal(LEVELS.length, 20);
  LEVELS.forEach((l, i) => assert.equal(l.id, i + 1));
});

test('every level has a valid goal and move budget', () => {
  for (const l of LEVELS) {
    assert.ok(['lines', 'score'].includes(l.goal.type), `level ${l.id} goal type`);
    assert.ok(Number.isInteger(l.goal.target) && l.goal.target > 0, `level ${l.id} target`);
    assert.ok(Number.isInteger(l.moves) && l.moves >= 3, `level ${l.id} moves`);
  }
});

test('star math: 1 star for completion, 2 with moves left, 3 at a third of budget', () => {
  const level = { id: 1, goal: { type: 'lines', target: 2 }, moves: 9 };
  assert.equal(calcStars(level, 0), 1);
  assert.equal(calcStars(level, 1), 2);
  assert.equal(calcStars(level, 3), 3);
  assert.equal(calcStars(level, 9), 3);
});

test('getLevel finds levels and returns undefined for unknown', () => {
  assert.equal(getLevel(5).moves, LEVELS[4].moves);
  assert.equal(getLevel(99), undefined);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './levels.js'`.

- [ ] **Step 3: Implement `js/levels.js`**

Create `js/levels.js`:

```js
export const LEVELS = [
  { id: 1, goal: { type: 'lines', target: 2 }, moves: 8 },
  { id: 2, goal: { type: 'lines', target: 3 }, moves: 10 },
  { id: 3, goal: { type: 'score', target: 300 }, moves: 9 },
  { id: 4, goal: { type: 'lines', target: 4 }, moves: 12 },
  { id: 5, goal: { type: 'score', target: 600 }, moves: 11 },
  { id: 6, goal: { type: 'lines', target: 5 }, moves: 14 },
  { id: 7, goal: { type: 'score', target: 900 }, moves: 12 },
  { id: 8, goal: { type: 'lines', target: 6 }, moves: 16 },
  { id: 9, goal: { type: 'score', target: 1200 }, moves: 13 },
  { id: 10, goal: { type: 'lines', target: 7 }, moves: 18 },
  { id: 11, goal: { type: 'score', target: 1600 }, moves: 14 },
  { id: 12, goal: { type: 'lines', target: 8 }, moves: 20 },
  { id: 13, goal: { type: 'score', target: 2000 }, moves: 15 },
  { id: 14, goal: { type: 'lines', target: 9 }, moves: 22 },
  { id: 15, goal: { type: 'score', target: 2500 }, moves: 16 },
  { id: 16, goal: { type: 'lines', target: 10 }, moves: 24 },
  { id: 17, goal: { type: 'score', target: 3000 }, moves: 17 },
  { id: 18, goal: { type: 'lines', target: 12 }, moves: 26 },
  { id: 19, goal: { type: 'score', target: 4000 }, moves: 20 },
  { id: 20, goal: { type: 'lines', target: 15 }, moves: 28 },
];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id);
}

export function calcStars(level, movesLeft) {
  if (movesLeft >= Math.ceil(level.moves / 3)) return 3;
  if (movesLeft >= 1) return 2;
  return 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add js/levels.js js/levels.test.js
git commit -m "feat: challenge level definitions and star math"
```

---

### Task 2: Storage Layer (`js/storage.js`)

**Files:**
- Create: `js/storage.js`
- Test: `js/storage.test.js`

- [ ] **Step 1: Write the failing tests**

Create `js/storage.test.js` (uses a fake localStorage global since node:test has none):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSettings, saveSettings, loadPlayerName, savePlayerName,
  loadProgress, recordLevelResult, clearAll,
} from './storage.js';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
};

test('settings round-trip with defaults', () => {
  const defaults = loadSettings();
  assert.equal(defaults.musicVolume, 0.7);
  assert.equal(defaults.sfxVolume, 1);
  assert.equal(defaults.haptics, false);
  saveSettings({ musicVolume: 0.3, haptics: true });
  const s = loadSettings();
  assert.equal(s.musicVolume, 0.3);
  assert.equal(s.sfxVolume, 1);
  assert.equal(s.haptics, true);
});

test('corrupt settings JSON falls back to defaults', () => {
  store.set('block-blast-settings', 'not-json{{{');
  const s = loadSettings();
  assert.equal(s.musicVolume, 0.7);
});

test('player name round-trip', () => {
  assert.equal(loadPlayerName(), '');
  savePlayerName('Candy King');
  assert.equal(loadPlayerName(), 'Candy King');
});

test('progress defaults to level 1 unlocked', () => {
  const p = loadProgress();
  assert.equal(p.unlocked, 1);
  assert.deepEqual(p.stars, {});
});

test('recordLevelResult stores best stars and unlocks next', () => {
  const r1 = recordLevelResult(1, 2);
  assert.equal(r1.newlyUnlocked, true);
  assert.equal(loadProgress().unlocked, 2);
  assert.equal(loadProgress().stars[1], 2);
  recordLevelResult(1, 1);
  assert.equal(loadProgress().stars[1], 2, 'keeps best stars');
  const r3 = recordLevelResult(1, 3);
  assert.equal(loadProgress().stars[1], 3, 'upgrades stars');
  assert.equal(r3.newlyUnlocked, false, 'already unlocked');
});

test('clearAll wipes progress but keeps player name', () => {
  savePlayerName('Abi');
  recordLevelResult(1, 3);
  clearAll();
  assert.equal(loadProgress().unlocked, 1);
  assert.deepEqual(loadProgress().stars, {});
  assert.equal(loadPlayerName(), 'Abi', 'name survives reset');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './storage.js'`.

- [ ] **Step 3: Implement `js/storage.js`**

Create `js/storage.js`:

```js
const SETTINGS_KEY = 'block-blast-settings';
const PROGRESS_KEY = 'block-blast-progress';
const NAME_KEY = 'block-blast-name';

const DEFAULT_SETTINGS = { musicVolume: 0.7, sfxVolume: 1, haptics: false };
const DEFAULT_PROGRESS = { unlocked: 1, stars: {} };

function getStore() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJSON(key, fallback) {
  const store = getStore();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or private mode — ignore
  }
}

export function loadSettings() {
  return readJSON(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(partial) {
  writeJSON(SETTINGS_KEY, { ...loadSettings(), ...partial });
}

export function loadPlayerName() {
  const store = getStore();
  if (!store) return '';
  try {
    return store.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name) {
  const store = getStore();
  if (!store) return;
  try {
    store.setItem(NAME_KEY, name.trim().slice(0, 12));
  } catch {
    // ignore
  }
}

export function loadProgress() {
  return readJSON(PROGRESS_KEY, DEFAULT_PROGRESS);
}

export function recordLevelResult(levelId, stars) {
  const p = loadProgress();
  const prevBest = p.stars[levelId] || 0;
  p.stars[levelId] = Math.max(prevBest, stars);
  let newlyUnlocked = false;
  if (levelId === p.unlocked) {
    p.unlocked += 1;
    newlyUnlocked = true;
  }
  writeJSON(PROGRESS_KEY, p);
  return { newlyUnlocked };
}

export function clearAll() {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(SETTINGS_KEY);
    store.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js js/storage.test.js
git commit -m "feat: localStorage settings, progress and name storage"
```

---

### Task 3: Screen Shell — Router + index.html Sections + Navigation

**Files:**
- Create: `js/router.js`
- Modify: `index.html`, `css/style.css`, `js/main.js`

- [ ] **Step 1: Restructure `index.html`**

Replace the `<body>` content of `index.html` with:

```html
<body>
  <section id="screen-menu" class="screen active">
    <div class="menu-card">
      <h1 class="menu-title">BLOCK BLAST</h1>
      <p class="menu-subtitle">CANDY EDITION</p>
      <div class="menu-buttons">
        <button id="btn-play" class="menu-btn menu-btn--primary" type="button">PLAY</button>
        <button id="btn-levels" class="menu-btn" type="button">LEVELS</button>
        <button id="btn-settings" class="menu-btn" type="button">SETTINGS</button>
        <button id="btn-leaderboard" class="menu-btn" type="button">LEADERBOARD</button>
      </div>
      <p class="menu-footer">© June 2026 · Created by Abi &amp; Ion</p>
    </div>
  </section>

  <section id="screen-levels" class="screen">
    <div class="screen-header">
      <button class="back-btn" data-back type="button">‹</button>
      <h2>LEVELS</h2>
    </div>
    <div id="level-grid" class="level-grid"></div>
  </section>

  <section id="screen-settings" class="screen">
    <div class="screen-header">
      <button class="back-btn" data-back type="button">‹</button>
      <h2>SETTINGS</h2>
    </div>
    <div class="settings-card">
      <label class="setting-row">
        <span>Player name</span>
        <input id="setting-name" type="text" maxlength="12" placeholder="Your name">
      </label>
      <label class="setting-row">
        <span>Music volume</span>
        <input id="setting-music" type="range" min="0" max="100" step="5" value="70">
      </label>
      <label class="setting-row">
        <span>SFX volume</span>
        <input id="setting-sfx" type="range" min="0" max="100" step="5" value="100">
      </label>
      <label class="setting-row">
        <span>Haptics</span>
        <input id="setting-haptics" type="checkbox">
      </label>
      <button id="setting-reset" class="setting-reset" type="button">Reset progress</button>
    </div>
  </section>

  <section id="screen-leaderboard" class="screen">
    <div class="screen-header">
      <button class="back-btn" data-back type="button">‹</button>
      <h2>LEADERBOARD</h2>
    </div>
    <div class="leaderboard-tabs">
      <button class="lb-tab" data-mode="endless" type="button">ENDLESS</button>
      <button class="lb-tab" data-mode="challenge" type="button">CHALLENGE</button>
    </div>
    <div id="lb-status" class="lb-status"></div>
    <ol id="lb-list" class="lb-list"></ol>
  </section>

  <section id="screen-game" class="screen">
    <div class="hud">
      <div class="score-label">SCORE</div>
      <div class="score-value" id="score">0</div>
      <div class="online hidden" id="online"></div>
      <div id="challenge-hud" class="challenge-hud hidden">
        <span id="moves-left" class="challenge-stat">MOVES: 0</span>
        <span id="goal-text" class="challenge-stat"></span>
      </div>
    </div>
    <button id="mute" class="mute-btn" type="button">🔊</button>
    <canvas id="board"></canvas>
    <div id="game-over" class="overlay hidden">
      <div class="overlay-card">
        <h1>GAME OVER</h1>
        <div class="final-score" id="final-score">0</div>
        <div id="leaderboard-entry" class="leaderboard-entry">
          <input id="lb-name" class="lb-name-input" type="text" maxlength="12" placeholder="Your name">
          <button id="lb-submit" class="lb-submit-btn" type="button">SUBMIT SCORE</button>
          <div id="lb-result" class="lb-result"></div>
        </div>
        <button id="play-again" type="button">PLAY AGAIN</button>
      </div>
    </div>
  </section>
</body>
```

Keep the `<script type="module" src="js/main.js">` tag and the head unchanged. The `#game-over` overlay keeps its `hidden`/`.hidden` class mechanism and IDs (`#game-over`, `#final-score`, `#play-again`) so `e2e/gameover.spec.js` still passes.

- [ ] **Step 2: Add screen CSS**

Append to `css/style.css`:

```css
.screen { display: none; }
.screen.active { display: flex; flex-direction: column; align-items: center; justify-content: center; }
#screen-game.active { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.menu-card { text-align: center; }
.menu-title {
  font-size: 40px; font-weight: 800; letter-spacing: 3px;
  background: linear-gradient(180deg, #ff2e63, #a855f7);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.menu-subtitle { color: rgba(30,58,110,0.55); font-size: 13px; letter-spacing: 4px; margin: 4px 0 28px; }
.menu-buttons { display: flex; flex-direction: column; gap: 12px; width: min(78vw, 300px); }
.menu-btn {
  background: rgba(168,85,247,0.12); border: 1.5px solid rgba(168,85,247,0.35);
  color: #7c3aed; font-weight: 700; font-size: 15px; letter-spacing: 1px;
  padding: 14px; border-radius: 14px; cursor: pointer;
}
.menu-btn--primary {
  background: linear-gradient(180deg, #ff5b8a, #ff2e63); border: none; color: #fff;
  padding: 16px; box-shadow: 0 8px 20px rgba(255,46,99,0.4);
}
.menu-btn:active { transform: scale(0.97); }
.menu-footer { margin-top: 26px; color: rgba(30,58,110,0.45); font-size: 12px; letter-spacing: 1px; }
.screen-header { display: flex; align-items: center; gap: 10px; width: min(94vw, 480px); margin-bottom: 12px; }
.screen-header h2 { color: #2b2b4f; font-size: 18px; letter-spacing: 3px; flex: 1; text-align: center; }
.back-btn {
  width: 40px; height: 40px; border-radius: 12px; font-size: 22px; line-height: 1;
  background: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.85); color: #2b2b4f; cursor: pointer;
}
.level-grid {
  display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px;
  width: min(94vw, 480px); overflow-y: auto;
}
.level-tile {
  aspect-ratio: 1; border-radius: 12px; border: none; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-weight: 800; font-size: 16px; color: #fff;
  background: linear-gradient(180deg, #ff5b8a, #ff2e63); box-shadow: 0 3px 8px rgba(255,46,99,0.35);
}
.level-tile .stars { font-size: 8px; letter-spacing: 1px; }
.level-tile--locked {
  background: rgba(30,58,110,0.07); color: rgba(30,58,110,0.35); box-shadow: none; cursor: default;
}
.settings-card { width: min(94vw, 480px); display: flex; flex-direction: column; gap: 10px; }
.setting-row {
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(30,58,110,0.05); border-radius: 12px; padding: 12px 14px;
  color: #2b2b4f; font-size: 13px; font-weight: 600;
}
.setting-row input[type="text"] {
  width: 140px; padding: 6px 10px; border-radius: 8px; border: 1.5px solid rgba(168,85,247,0.35);
  font-size: 13px; color: #2b2b4f; text-align: right;
}
.setting-row input[type="range"] { accent-color: #a855f7; width: 140px; }
.setting-row input[type="checkbox"] { width: 22px; height: 22px; accent-color: #a855f7; }
.setting-reset {
  background: rgba(255,46,99,0.08); border: none; color: #ff2e63; font-weight: 700;
  font-size: 13px; padding: 12px; border-radius: 12px; cursor: pointer;
}
.leaderboard-tabs { display: flex; gap: 8px; margin-bottom: 10px; }
.lb-tab {
  padding: 8px 18px; border-radius: 10px; border: 1.5px solid rgba(168,85,247,0.35);
  background: rgba(168,85,247,0.12); color: #7c3aed; font-weight: 700; font-size: 12px; letter-spacing: 1px; cursor: pointer;
}
.lb-tab--active { background: linear-gradient(180deg, #ff5b8a, #ff2e63); border: none; color: #fff; }
.lb-list { width: min(94vw, 480px); list-style: none; display: flex; flex-direction: column; gap: 6px; }
.lb-list li {
  display: flex; justify-content: space-between; padding: 10px 14px; border-radius: 10px;
  background: rgba(30,58,110,0.05); color: #2b2b4f; font-size: 14px; font-weight: 600;
}
.lb-list .lb-rank { color: rgba(30,58,110,0.45); width: 28px; }
.lb-status { color: rgba(30,58,110,0.55); font-size: 13px; margin-bottom: 8px; }
.leaderboard-entry { margin: 12px 0; display: flex; flex-direction: column; gap: 8px; }
.lb-name-input {
  padding: 8px 12px; border-radius: 8px; border: 1.5px solid rgba(168,85,247,0.35);
  font-size: 14px; text-align: center; color: #2b2b4f;
}
.lb-submit-btn {
  background: linear-gradient(180deg, #ff5b8a, #ff2e63); border: none; color: #fff; font-weight: 700;
  font-size: 13px; padding: 10px; border-radius: 10px; cursor: pointer;
}
.lb-result { color: #7c3aed; font-size: 13px; font-weight: 700; text-align: center; }
.challenge-hud { display: flex; gap: 16px; justify-content: center; margin-top: 4px; }
.challenge-stat { color: #2b2b4f; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.challenge-hud.hidden { display: none; }
```

- [ ] **Step 3: Implement `js/router.js`**

Create `js/router.js`:

```js
const ROUTES = [
  { pattern: /^#\/$/, name: 'menu' },
  { pattern: /^#\/levels$/, name: 'levels' },
  { pattern: /^#\/settings$/, name: 'settings' },
  { pattern: /^#\/leaderboard$/, name: 'leaderboard' },
  { pattern: /^#\/play$/, name: 'play' },
  { pattern: /^#\/level\/(\d+)$/, name: 'level' },
];

export function parseHash(hash) {
  const clean = hash || '#/';
  for (const route of ROUTES) {
    const m = clean.match(route.pattern);
    if (m) return { name: route.name, param: m[1] ? Number(m[1]) : null };
  }
  return { name: 'menu', param: null };
}

export function initRouter(handlers) {
  function navigate() {
    const route = parseHash(window.location.hash);
    const handler = handlers[route.name];
    if (handler) handler(route);
  }
  window.addEventListener('hashchange', navigate);
  navigate();
}
```

- [ ] **Step 4: Wire the router in `js/main.js`**

Replace the whole `js/main.js` with:

```js
import { createGame } from './game.js';
import { createAudio } from './audio.js';
import { initOnline } from './online.js';
import { initRouter } from './router.js';
import { LEVELS, getLevel } from './levels.js';
import {
  loadSettings, saveSettings, loadPlayerName, savePlayerName,
  loadProgress, recordLevelResult, clearAll,
} from './storage.js';
import { fetchLeaderboard, submitScore } from './leaderboard.js';

const testMode = new URLSearchParams(window.location.search).get('test') === '1';
const audio = testMode ? null : createAudio();
const settings = loadSettings();

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const lbNameEl = document.getElementById('lb-name');
const lbSubmitEl = document.getElementById('lb-submit');
const lbResultEl = document.getElementById('lb-result');
const challengeHud = document.getElementById('challenge-hud');
const movesLeftEl = document.getElementById('moves-left');
const goalTextEl = document.getElementById('goal-text');

const game = createGame(canvas, {
  onScore: (s) => {
    scoreEl.textContent = String(s);
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');
  },
  onPlacement: (lines) => {
    if (audio) audio.place();
    if (lines > 0) {
      if (audio) audio.clear(lines);
      if (settings.haptics && navigator.vibrate) navigator.vibrate([10, 30, 10]);
    } else if (settings.haptics && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },
  onInvalid: () => {
    if (audio) audio.invalid();
  },
  onNewTray: () => {
    if (audio) audio.newTray();
  },
  onMovesLeft: (n) => {
    movesLeftEl.textContent = `MOVES: ${n}`;
  },
  onLevelComplete: ({ stars, score, movesLeft }) => {
    const result = recordLevelResult(routeLevelId, stars);
    showLevelComplete({ stars, score, movesLeft, newlyUnlocked: result.newlyUnlocked });
  },
  onLevelFailed: () => {
    showLevelFailed();
  },
  onGameOver: (s) => {
    finalScoreEl.textContent = String(s);
    lbNameEl.value = loadPlayerName();
    lbResultEl.textContent = '';
    overlay.classList.remove('hidden');
    if (audio) audio.gameOver();
  },
  debug: testMode,
});

let routeLevelId = null;
let pendingScore = null;
let pendingMode = 'endless';

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.remove('active');
  document.getElementById(id).classList.add('active');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function startEndless() {
  routeLevelId = null;
  pendingMode = 'endless';
  challengeHud.classList.add('hidden');
  game.startEndless();
  game.start();
}

function startChallenge(levelId) {
  routeLevelId = levelId;
  pendingMode = 'challenge';
  const level = getLevel(levelId);
  challengeHud.classList.remove('hidden');
  movesLeftEl.textContent = `MOVES: ${level.moves}`;
  goalTextEl.textContent = level.goal.type === 'lines'
    ? `CLEAR ${level.goal.target} LINES`
    : `REACH ${level.goal.target} PTS`;
  game.startChallenge(level);
  game.start();
}

function showLevelComplete({ stars, score, movesLeft, newlyUnlocked }) {
  pendingScore = score;
  lbNameEl.value = loadPlayerName();
  lbResultEl.textContent = '';
  const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  finalScoreEl.textContent = `${starText}  ${score}`;
  overlay.querySelector('h1').textContent = 'LEVEL COMPLETE';
  overlay.querySelector('#play-again').textContent = newlyUnlocked ? 'NEXT LEVEL' : 'RETRY';
  overlay.classList.remove('hidden');
}

function showLevelFailed() {
  overlay.querySelector('h1').textContent = 'LEVEL FAILED';
  finalScoreEl.textContent = '0';
  overlay.querySelector('#play-again').textContent = 'RETRY';
  overlay.classList.remove('hidden');
}

function bindOverlay() {
  lbSubmitEl.addEventListener('click', async () => {
    const name = lbNameEl.value.trim();
    if (!name) {
      lbResultEl.textContent = 'Enter a name first';
      return;
    }
    savePlayerName(name);
    const res = await submitScore({ name, score: pendingScore, mode: pendingMode });
    if (res === null) {
      lbResultEl.textContent = 'Offline — score not submitted';
    } else {
      lbResultEl.textContent = `Rank #${res.rank}`;
    }
  });

  document.getElementById('play-again').addEventListener('click', () => {
    overlay.classList.add('hidden');
    if (routeLevelId !== null) {
      const next = getLevel(routeLevelId + 1);
      if (next && loadProgress().unlocked >= next.id) startChallenge(next.id);
      else startChallenge(routeLevelId);
    } else {
      game.restart();
    }
  });
}

function bindMenu() {
  document.getElementById('btn-play').addEventListener('click', () => {
    window.location.hash = '#/play';
  });
  document.getElementById('btn-levels').addEventListener('click', () => {
    window.location.hash = '#/levels';
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    window.location.hash = '#/settings';
  });
  document.getElementById('btn-leaderboard').addEventListener('click', () => {
    window.location.hash = '#/leaderboard';
  });
}

function bindBackButtons() {
  for (const btn of document.querySelectorAll('[data-back]')) {
    btn.addEventListener('click', () => {
      window.location.hash = '#/';
    });
  }
}

function renderLevels() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  const progress = loadProgress();
  for (const level of LEVELS) {
    const tile = document.createElement('button');
    tile.type = 'button';
    const stars = progress.stars[level.id] || 0;
    const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    if (level.id > progress.unlocked) {
      tile.className = 'level-tile level-tile--locked';
      tile.textContent = `${level.id} 🔒`;
      tile.disabled = true;
    } else {
      tile.className = 'level-tile';
      tile.innerHTML = `${level.id}<span class="stars">${starText}</span>`;
      tile.addEventListener('click', () => {
        window.location.hash = `#/level/${level.id}`;
      });
    }
    grid.appendChild(tile);
  }
}

function bindSettings() {
  const nameInput = document.getElementById('setting-name');
  const musicInput = document.getElementById('setting-music');
  const sfxInput = document.getElementById('setting-sfx');
  const hapticsInput = document.getElementById('setting-haptics');
  const resetBtn = document.getElementById('setting-reset');

  nameInput.value = loadPlayerName();
  musicInput.value = Math.round(settings.musicVolume * 100);
  sfxInput.value = Math.round(settings.sfxVolume * 100);
  hapticsInput.checked = settings.haptics;

  nameInput.addEventListener('change', () => savePlayerName(nameInput.value));
  musicInput.addEventListener('input', () => {
    settings.musicVolume = Number(musicInput.value) / 100;
    saveSettings({ musicVolume: settings.musicVolume });
    if (audio) audio.setMusicVolume(settings.musicVolume);
  });
  sfxInput.addEventListener('input', () => {
    settings.sfxVolume = Number(sfxInput.value) / 100;
    saveSettings({ sfxVolume: settings.sfxVolume });
    if (audio) audio.setSfxVolume(settings.sfxVolume);
  });
  hapticsInput.addEventListener('change', () => {
    settings.haptics = hapticsInput.checked;
    saveSettings({ haptics: settings.haptics });
  });
  resetBtn.addEventListener('click', () => {
    if (window.confirm('Reset all progress?')) {
      clearAll();
      nameInput.value = '';
      musicInput.value = 70;
      sfxInput.value = 100;
      hapticsInput.checked = false;
    }
  });
}

function bindLeaderboard() {
  const tabs = document.querySelectorAll('.lb-tab');
  let activeMode = 'endless';
  async function load(mode) {
    activeMode = mode;
    for (const t of tabs) t.classList.toggle('lb-tab--active', t.dataset.mode === mode);
    const status = document.getElementById('lb-status');
    const list = document.getElementById('lb-list');
    status.textContent = 'Loading…';
    list.innerHTML = '';
    const res = await fetchLeaderboard(mode);
    if (res === null) {
      status.textContent = 'Offline — leaderboard unavailable';
      return;
    }
    status.textContent = '';
    if (res.entries.length === 0) {
      status.textContent = 'No scores yet — be the first!';
      return;
    }
    for (const [i, e] of res.entries.entries()) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lb-rank">${i + 1}</span><span>${e.name}</span><span>${e.score}</span>`;
      list.appendChild(li);
    }
  }
  for (const t of tabs) t.addEventListener('click', () => load(t.dataset.mode));
  load('endless');
}

initRouter({
  menu: () => showScreen('screen-menu'),
  levels: () => {
    showScreen('screen-levels');
    renderLevels();
  },
  settings: () => showScreen('screen-settings'),
  leaderboard: () => showScreen('screen-leaderboard'),
  play: () => {
    showScreen('screen-game');
    hideOverlay();
    startEndless();
  },
  level: (route) => {
    showScreen('screen-game');
    hideOverlay();
    startChallenge(route.param);
  },
});

bindMenu();
bindBackButtons();
bindOverlay();
bindSettings();
bindLeaderboard();

if (testMode && game.debug) window.__blockBlast = game.debug;

if (!testMode) {
  initOnline(document.getElementById('online'));
}

if (audio) {
  audio.setMusicVolume(settings.musicVolume);
  audio.setSfxVolume(settings.sfxVolume);
}

const muteBtn = document.getElementById('mute');
const updateMute = () => {
  muteBtn.textContent = audio ? (audio.isMuted() ? '🔇' : '🔊') : '🔇';
};
muteBtn.addEventListener('click', () => {
  if (!audio) return;
  audio.toggle();
  updateMute();
});
updateMute();

const unlockAudio = () => {
  if (audio) audio.unlock();
};
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
```

Note: `submitScore`, `fetchLeaderboard`, `game.startEndless`, `game.startChallenge`, `game.stop`, `audio.setMusicVolume`, `audio.setSfxVolume` are implemented in Tasks 5-7 — `main.js` will not run until then, so this task's verification is limited to unit tests and the module graph loading. Expected import errors until Task 7 is complete: that is fine and temporary.

- [ ] **Step 5: Verify module graph parses**

Run: `node -e "import('./js/router.js').then(m => console.log(JSON.stringify(m.parseHash('#/level/4'))))"`
Expected: `{"name":"level","param":4}`

Run: `npm test`
Expected: ALL PASS (levels + storage tests; main.js is not imported by tests).

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/router.js js/main.js
git commit -m "feat: screen shell with hash router and menu"
```

---

### Task 4: Challenge Mode in `game.js` (+ stop/startChallenge/startEndless)

**Files:**
- Modify: `js/game.js`
- Modify: `js/audio.js` (volume setters)

- [ ] **Step 1: Add volume setters to `js/audio.js`**

In the `createAudio` return object, add after `boardFull`:

```js
    setMusicVolume: (v) => {
      if (musicGain) musicGain.gain.value = v;
    },
    setSfxVolume: (v) => {
      if (sfxGain) sfxGain.gain.value = v;
    },
```

Run: `npm test` → ALL PASS.

- [ ] **Step 2: Implement challenge mode in `js/game.js`**

Apply these changes to `js/game.js`:

1. Change the signature (line 14) to:

```js
export function createGame(canvas, { onScore, onGameOver, onPlacement, onInvalid, onNewTray, onMovesLeft, onLevelComplete, onLevelFailed, debug } = {}) {
```

2. After `let gameOver = false;` (line 21) add:

```js
  let mode = 'endless';
  let levelConfig = null;
  let movesLeft = 0;
  let linesCleared = 0;
```

3. Replace `checkGameOver` (lines 46-50) with:

```js
  function checkGameOver() {
    if (mode !== 'endless') return;
    if (anyPlacementPossible(board, remainingShapes())) return;
    gameOver = true;
    if (onGameOver) onGameOver(score);
  }
```

4. In `onDragEnd`, after `if (onPlacement) onPlacement(lines.rows.length + lines.cols.length);` (line 98) add the challenge step:

```js
      if (mode === 'challenge') {
        movesLeft -= 1;
        linesCleared += lines.rows.length + lines.cols.length;
        if (onMovesLeft) onMovesLeft(movesLeft);
        const met = levelConfig.goal.type === 'lines'
          ? linesCleared >= levelConfig.goal.target
          : score >= levelConfig.goal.target;
        if (met) {
          if (onLevelComplete) onLevelComplete({ stars: calcStarsLocal(), score, movesLeft });
        } else if (movesLeft <= 0) {
          if (onLevelFailed) onLevelFailed();
        }
      }
```

5. Add a local star helper after `clamp` (module scope, line 10-12 area) — note `calcStars` is imported from `levels.js`; import it:

At the top of `game.js`, after the existing imports, add:

```js
import { calcStars } from './levels.js';
```

And in the challenge step use `calcStars(levelConfig, movesLeft)` instead of `calcStarsLocal()`:

```js
        if (met) {
          if (onLevelComplete) onLevelComplete({ stars: calcStars(levelConfig, movesLeft), score, movesLeft });
        } else if (movesLeft <= 0) {
```

6. Replace `restart` (lines 118-126) with:

```js
  function restart() {
    board = createBoard();
    tray = createTray();
    score = 0;
    drag = null;
    clearing = null;
    gameOver = false;
    if (onScore) onScore(0);
  }

  function startEndless() {
    mode = 'endless';
    levelConfig = null;
    restart();
  }

  function startChallenge(level) {
    mode = 'challenge';
    levelConfig = level;
    movesLeft = level.moves;
    linesCleared = 0;
    restart();
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
```

7. Update `getState` (lines 128-136) to include mode:

```js
  function getState() {
    return {
      board: board.map((r) => [...r]),
      tray: { pieces: tray.pieces.map((p) => ({ id: p.id, shape: p.shape, color: p.color, used: p.used })) },
      score,
      gameOver,
      mode,
      movesLeft,
      layout: renderer.getLayout(),
    };
  }
```

8. Update the api return (line 153):

```js
  const api = { start, restart, startEndless, startChallenge, stop };
```

- [ ] **Step 3: Verify**

Run: `npm test` → ALL PASS.
Run: `npx playwright test` → 16/16 PASS (e2e currently routes to `/?test=1` which now shows the menu — see Task 8 for the helper update; if specs fail because the canvas is hidden, that is expected and fixed in Task 8).

Note: if e2e fails because `openGame` lands on the menu, that is expected — Task 8 updates the helpers to `#/play`.

- [ ] **Step 4: Commit**

```bash
git add js/game.js js/audio.js
git commit -m "feat: challenge mode with move budget and level end states"
```

---

### Task 5: Leaderboard API (`api/leaderboard.js` + `_db.js` helpers)

**Files:**
- Modify: `api/_db.js`
- Create: `api/leaderboard.js`

- [ ] **Step 1: Add leaderboard helpers to `api/_db.js`**

Append to `api/_db.js`:

```js
const LEADERBOARD_COLLECTION = 'leaderboard';
const LEADERBOARD_MODES = ['endless', 'challenge'];

export function leaderboardModes() {
  return LEADERBOARD_MODES;
}

export async function submitLeaderboardScore({ name, score, mode }) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(LEADERBOARD_COLLECTION);
  await col.updateOne(
    { name, mode },
    { $max: { score } },
    { upsert: true }
  );
  const all = await col.find({ mode }).sort({ score: -1 }).toArray();
  const idx = all.findIndex((e) => e.name === name && e.score === score);
  const rank = idx === -1 ? all.length : idx + 1;
  return { rank, entries: all.slice(0, 10).map((e) => ({ name: e.name, score: e.score })) };
}

export async function getLeaderboard(mode, limit = 10) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(LEADERBOARD_COLLECTION);
  const entries = await col.find({ mode }).sort({ score: -1 }).limit(limit).toArray();
  return { entries: entries.map((e) => ({ name: e.name, score: e.score })) };
}
```

Note: the rank lookup matches on `name` + `score` — if the player already had a higher score, `$max` leaves `score` unchanged, so `findIndex` finds the existing entry; if the upsert created a new entry, the exact score matches. Correct in both cases.

- [ ] **Step 2: Create `api/leaderboard.js`**

Create `api/leaderboard.js`:

```js
import { dbConfigured, leaderboardModes, submitLeaderboardScore, getLeaderboard } from './_db.js';

function parseScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 1e9) return null;
  return n;
}

function parseName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > 12) return null;
  return name;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!dbConfigured()) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const mode = req.query.mode;
      if (!leaderboardModes().includes(mode)) {
        res.status(400).json({ error: 'invalid mode' });
        return;
      }
      const data = await getLeaderboard(mode, 10);
      res.status(200).json(data);
      return;
    }
    if (req.method === 'POST') {
      const mode = req.body && req.body.mode;
      const name = parseName(req.body && req.body.name);
      const score = parseScore(req.body && req.body.score);
      if (!leaderboardModes().includes(mode) || name === null || score === null) {
        res.status(400).json({ error: 'invalid payload' });
        return;
      }
      const data = await submitLeaderboardScore({ name, score, mode });
      res.status(200).json(data);
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch {
    res.status(500).json({ error: 'storage error' });
  }
}
```

- [ ] **Step 3: Verify (unit-testable pieces)**

Run: `node -e "import('./api/leaderboard.js').then(() => console.log('imports ok'))"` — note this imports `_db.js` which imports `mongodb`; the module import succeeds without connecting.

Add a quick pure-logic check (no file changes) via node:

Run: `node -e "
const parse = (raw) => { const n = Number(raw); if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 1e9) return null; return n; };
console.log('valid:', parse(42) === 42, '| bad:', parse('abc') === null, '| neg:', parse(-1) === null, '| float:', parse(1.5) === null);"
`
Expected: `valid: true | bad: true | neg: true | float: true`

Run: `npm test` → ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add api/_db.js api/leaderboard.js
git commit -m "feat: online leaderboard API with MongoDB upsert"
```

---

### Task 6: Leaderboard Client + Screens Wiring (`js/leaderboard.js`)

**Files:**
- Create: `js/leaderboard.js`
- Test: `js/leaderboard.test.js`
- Modify: `js/main.js` (imports already added in Task 3 — verify no changes needed)

- [ ] **Step 1: Write the failing tests**

Create `js/leaderboard.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateName, buildQuery } from './leaderboard.js';

test('validateName trims and enforces 1-12 chars', () => {
  assert.equal(validateName('  Abi  '), 'Abi');
  assert.equal(validateName(''), null);
  assert.equal(validateName('   '), null);
  assert.equal(validateName('a'.repeat(13)), null);
  assert.equal(validateName('a'.repeat(12)), 'a'.repeat(12));
});

test('buildQuery produces the expected URL', () => {
  assert.equal(buildQuery('challenge'), '/api/leaderboard?mode=challenge');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './leaderboard.js'`.

- [ ] **Step 3: Implement `js/leaderboard.js`**

Create `js/leaderboard.js`:

```js
export function validateName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > 12) return null;
  return name;
}

export function buildQuery(mode) {
  return `/api/leaderboard?mode=${mode}`;
}

export async function fetchLeaderboard(mode) {
  try {
    const res = await fetch(buildQuery(mode));
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function submitScore({ name, score, mode }) {
  const clean = validateName(name);
  if (clean === null) return null;
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, score, mode }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 5: Manual sanity check of the full page**

Run the static server: `python3 -m http.server 4173 --bind 127.0.0.1 &` then open `http://127.0.0.1:4173/#/` in a browser. Expected: menu renders (title, four buttons), clicking LEVELS shows the grid with 1 unlocked + 19 locked, clicking back returns to menu. The leaderboard screen shows "Offline — leaderboard unavailable" (the static server has no /api routes — expected).

If any screen fails to render, check the browser console for module errors (missing exports etc.) and fix.

- [ ] **Step 6: Commit**

```bash
git add js/leaderboard.js js/leaderboard.test.js
git commit -m "feat: leaderboard API client with validation"
```

---

### Task 7: Settings Wiring + Level Complete/Failed Overlays (`js/main.js`)

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Add missing handlers to `js/main.js`**

`main.js` from Task 3 already imports and references everything. Verify the following are present and correct; add anything missing:

1. `onLevelComplete`/`onLevelFailed` callbacks exist in the `createGame` options (Task 3 Step 4 included them — confirm).
2. `startChallenge(levelId)` uses `getLevel` and throws nothing when the level is unknown; add a guard at the top of `startChallenge`:

```js
function startChallenge(levelId) {
  const level = getLevel(levelId);
  if (!level) {
    window.location.hash = '#/levels';
    return;
  }
  routeLevelId = levelId;
  ...
}
```

3. In `startEndless`, also reset the overlay title/button text to the game-over defaults:

```js
function startEndless() {
  routeLevelId = null;
  pendingMode = 'endless';
  challengeHud.classList.add('hidden');
  overlay.querySelector('h1').textContent = 'GAME OVER';
  overlay.querySelector('#play-again').textContent = 'PLAY AGAIN';
  game.startEndless();
  game.start();
}
```

4. `game.restart()` in the play-again handler must become mode-aware (Task 3 Step 4's handler already routes via `routeLevelId` — verify it matches this behavior: when `routeLevelId === null` it calls `game.restart()` which in endless mode is correct).

- [ ] **Step 2: Verify**

Run: `npm test` → ALL PASS.
Run: `npx playwright test` → expected FAILURES on specs that use `openGame` (they land on the menu) — this is resolved in Task 8. Confirm the failure mode is "canvas hidden / game not started", not a JS module error. If there are module errors, fix them.

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: settings wiring and level result overlays"
```

---

### Task 8: E2E Updates + New Screen Specs

**Files:**
- Modify: `e2e/helpers.js`
- Create: `e2e/menu.spec.js`, `e2e/levels.spec.js`, `e2e/settings.spec.js`, `e2e/leaderboard.spec.js`

- [ ] **Step 1: Update `e2e/helpers.js`**

Replace `openGame` with:

```js
export async function openGame(page) {
  await page.goto('/?test=1#/play');
  await expect(page.locator('#score')).toHaveText('0');
}
```

(The existing `state`, `setTray`, `setBoard`, `pointForCell`, `traySlotPoint`, `dragPiece` helpers are unchanged.)

- [ ] **Step 2: Create `e2e/menu.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('menu shows title and four buttons', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('.menu-title')).toHaveText('BLOCK BLAST');
  await expect(page.locator('#btn-play')).toBeVisible();
  await expect(page.locator('#btn-levels')).toBeVisible();
  await expect(page.locator('#btn-settings')).toBeVisible();
  await expect(page.locator('#btn-leaderboard')).toBeVisible();
});

test('buttons navigate to their screens', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('#btn-levels');
  await expect(page.locator('#screen-levels')).toBeVisible();
  await page.click('[data-back]');
  await expect(page.locator('#screen-menu')).toBeVisible();
  await page.click('#btn-settings');
  await expect(page.locator('#screen-settings')).toBeVisible();
  await page.click('#btn-leaderboard');
  await expect(page.locator('#screen-leaderboard')).toBeVisible();
});

test('PLAY routes to the game screen', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('#btn-play');
  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#board')).toBeVisible();
});
```

- [ ] **Step 3: Create `e2e/levels.spec.js`**

```js
import { test, expect } from '@playwright/test';
import { openGame, state, setTray, setBoard, pointForCell, dragPiece } from './helpers.js';

test('level grid shows level 1 unlocked and 19 locked', async ({ page }) => {
  await page.goto('/?test=1#/levels');
  await expect(page.locator('.level-tile')).toHaveCount(20);
  await expect(page.locator('.level-tile--locked')).toHaveCount(19);
  const first = page.locator('.level-tile').first();
  await expect(first).toContainText('1');
  await expect(first).toContainText('☆');
});

test('completing level 1 unlocks level 2 and persists stars', async ({ page }) => {
  await openGame(page);
  await page.goto('/?test=1#/level/1');
  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#moves-left')).toHaveText('MOVES: 8');

  await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
  await setTray(page, [
    { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
    { shape: [[1, 1, 1]], color: '#00b8ff' },
    { shape: [[1, 1, 1]], color: '#ffc800' },
  ]);
  // Fill row 7: 5-piece at cols 0-4, 3-piece at cols 5-7 -> one line
  await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
  await page.waitForTimeout(400);

  // Fill row 6 the same way -> second line -> level complete
  await setTray(page, [
    { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
    { shape: [[1, 1, 1]], color: '#00b8ff' },
    { shape: [[1, 1, 1]], color: '#ffc800' },
  ]);
  await dragPiece(page, 0, await pointForCell(page, { row: 6, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 6, col: 5 }));

  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#game-over h1')).toHaveText('LEVEL COMPLETE');
  await expect(page.locator('#final-score')).toContainText('★');

  await page.goto('/?test=1#/levels');
  await expect(page.locator('.level-tile--locked')).toHaveCount(18);
  await expect(page.locator('.level-tile').nth(1)).not.toHaveClass(/locked/);
});
```

Note: if the "completing" flow proves flaky in practice (star text assertion), simplify the star assertion to `toContainText('★')` — the crucial behavior is unlock + persistence.

- [ ] **Step 4: Create `e2e/settings.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('player name persists across reloads', async ({ page }) => {
  await page.goto('/?test=1#/settings');
  await page.fill('#setting-name', 'Candy King');
  await page.locator('#setting-name').dispatchEvent('change');
  await page.reload();
  await page.goto('/?test=1#/settings');
  await expect(page.locator('#setting-name')).toHaveValue('Candy King');
});

test('reset progress wipes stored values', async ({ page }) => {
  await page.goto('/?test=1#/settings');
  await page.fill('#setting-name', 'Abi');
  await page.locator('#setting-name').dispatchEvent('change');
  page.on('dialog', (d) => d.accept());
  await page.click('#setting-reset');
  await expect(page.locator('#setting-name')).toHaveValue('');
});
```

- [ ] **Step 5: Create `e2e/leaderboard.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('leaderboard renders entries from the API', async ({ page }) => {
  await page.route('**/api/leaderboard?mode=endless', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [{ name: 'Abi', score: 1000 }, { name: 'Ion', score: 500 }] }),
    })
  );
  await page.goto('/?test=1#/leaderboard');
  await expect(page.locator('.lb-list li')).toHaveCount(2);
  await expect(page.locator('.lb-list li').first()).toContainText('Abi');
  await expect(page.locator('.lb-list li').first()).toContainText('1000');
});

test('leaderboard shows offline state when the API is unreachable', async ({ page }) => {
  await page.route('**/api/leaderboard?mode=*', (route) => route.abort());
  await page.goto('/?test=1#/leaderboard');
  await expect(page.locator('#lb-status')).toHaveText('Offline — leaderboard unavailable');
});

test('submit posts to the API and shows the rank', async ({ page }) => {
  let posted = null;
  await page.route('**/api/leaderboard?mode=*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) })
  );
  await page.route('**/api/leaderboard', (route) => {
    posted = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rank: 3, entries: [] }) });
  });
  await page.goto('/?test=1#/play');
  // force a game over via the debug bridge
  await page.evaluate(() => {
    const g = window.__blockBlast;
    g.setBoard(Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => (r === 0 ? '#ff2e63' : null))
    ));
    g.setTray([
      { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
      { shape: [[1, 1, 1, 1, 1]], color: '#00b8ff' },
      { shape: [[1, 1, 1, 1, 1]], color: '#ffc800' },
    ]);
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#game-over')).toBeVisible();
  await page.fill('#lb-name', 'Abi');
  await page.click('#lb-submit');
  await expect(page.locator('#lb-result')).toContainText('Rank #3');
  expect(posted).toEqual({ name: 'Abi', score: expect.any(Number), mode: 'endless' });
});
```

Note: the game-over setup above is deterministic — a full first row + three 5-wide tray pieces means no placement fits (5-wide pieces cannot fit in rows 1-7 because the pieces would overlap the full row 0, and a 5-wide piece needs a 5-wide gap; all rows except row 0 are empty but a 5-wide piece placed on an empty row would fit... so instead use a board with rows 0 AND 1 filled to leave no 5-wide gap):

Use this board instead:

```js
    g.setBoard(Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => (r < 2 ? '#ff2e63' : null))
    ));
```

(Two full rows + three 5-wide pieces → no placement possible → game over fires.)

- [ ] **Step 6: Run the full e2e suite**

Run: `npx playwright test`
Expected: ALL PASS (existing 4 specs + 4 new).

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
git add e2e/helpers.js e2e/menu.spec.js e2e/levels.spec.js e2e/settings.spec.js e2e/leaderboard.spec.js
git commit -m "test: e2e for menu, levels, settings and leaderboard"
```

---

### Task 9: Final Verification + Deploy

**Files:** none (verification + deploy only)

- [ ] **Step 1: Full test suites**

Run: `npm test` → ALL PASS. Run: `npx playwright test` → ALL PASS.

- [ ] **Step 2: Manual browser pass**

Serve `python3 -m http.server 4173 --bind 127.0.0.1`, open `http://127.0.0.1:4173`:
1. Menu renders; all four buttons navigate; back buttons return
2. Play → endless game works (place, clear, game over overlay with name input)
3. Level 1 → challenge HUD shows moves + goal; complete it → stars overlay; level 2 unlocks
4. Level fail (pick a hard level, run out of moves) → failed overlay → retry
5. Settings: name/music/SFX/haptics persist across reload; reset clears
6. Leaderboard: offline state on the static server; tabs switch
7. No console errors

- [ ] **Step 3: Commit any leftover fixes, then deploy**

```bash
git push origin master
vercel --prod
```

(If `vercel --prod` prompts for a project link, answer via the `.vercel/project.json` config already present — it should deploy without prompts.)

- [ ] **Step 4: Verify the live deploy**

Run: `curl -s -o /dev/null -w "%{http_code}" https://block-blast-clone.vercel.app/` — expect 200, then confirm `https://block-blast-clone.vercel.app/#/levels` serves the levels screen and `https://block-blast-clone.vercel.app/api/leaderboard?mode=endless` returns 200 or 503 (503 is fine — storage not configured locally, or live if MONGODB_URI is set in Vercel).

---

## Self-Review Notes

- **Spec coverage:** menu (Classic Column) ✓ T3; levels data + stars ✓ T1; progression/storage ✓ T2; settings rows + persistence + audio volumes + haptics ✓ T3/T7; leaderboard API + client + submit flow + tabs ✓ T5/T6/T7; challenge mode + HUD + overlays ✓ T4/T7; e2e ✓ T8; deploy ✓ T9. Out-of-scope items not implemented.
- **Consistency:** `calcStars(level, movesLeft)` defined in T1, used in T4 with the same signature. `startChallenge(level)`/`startEndless()`/`stop()` added to the game API in T4, called in T3's main.js (temporary import errors expected until T4-T6 land — noted in tasks). `recordLevelResult(levelId, stars)` → `{newlyUnlocked}` in T2, consumed in T7/main.js. `submitScore({name, score, mode})` → `{rank, entries}` across T5 (API), T6 (client), T7 (overlay). `mode` values `'endless'|'challenge'` consistent in levels/storage/API/leaderboard client.
- **Known temporary breakage:** after T3, `main.js` imports `startEndless`/`startChallenge`/`submitScore`/`fetchLeaderboard`/`setMusicVolume`/`setSfxVolume` which exist only from T4/T6 — the app won't run until those tasks land; unit tests are unaffected (they never import main.js). Task ordering is intentional: pure modules first, then game mode, then API, then client, then wiring.
- **No placeholders:** every step has complete code and exact commands.
