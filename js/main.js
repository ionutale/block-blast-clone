import { createGame } from './game.js';
import { createAudio } from './audio.js';
import { initOnline } from './online.js';
import { initRouter } from './router.js';
import { LEVELS, getLevel } from './levels.js';
import {
  loadSettings, saveSettings, loadPlayerName, savePlayerName,
  loadProgress, recordLevelResult, clearAll,
} from './storage.js';
import { fetchLeaderboard, submitScore, requestSession } from './leaderboard.js';

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
    if (lines > 0) {
      if (audio) audio.clear(lines);
      if (settings.haptics && navigator.vibrate) navigator.vibrate([10, 30, 10]);
    } else {
      if (audio) audio.place();
      if (settings.haptics && navigator.vibrate) navigator.vibrate(10);
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
  onLevelComplete: ({ stars, score, newlyUnlocked }) => {
    const result = recordLevelResult(routeLevelId, stars);
    showLevelComplete({ stars, score, newlyUnlocked: result.newlyUnlocked });
  },
  onLevelFailed: () => {
    showLevelFailed();
  },
  onGameOver: (s) => {
    pendingScore = s;
    finalScoreEl.textContent = String(s);
    lbNameEl.value = loadPlayerName();
    lbResultEl.textContent = '';
    document.getElementById('leaderboard-entry').classList.remove('hidden');
    overlay.classList.remove('hidden');
    if (audio) audio.gameOver();
  },
  debug: testMode,
});

let routeLevelId = null;
let pendingScore = null;
let pendingToken = null;
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
  pendingScore = null;
  pendingToken = null;
  requestSession().then((t) => {
    pendingToken = t;
  });
  challengeHud.classList.add('hidden');
  overlay.querySelector('h1').textContent = 'GAME OVER';
  overlay.querySelector('#play-again').textContent = 'PLAY AGAIN';
  game.startEndless();
  game.start();
}

function startChallenge(levelId) {
  const level = getLevel(levelId);
  if (!level || loadProgress().unlocked < levelId) {
    window.location.hash = '#/levels';
    return;
  }
  routeLevelId = levelId;
  pendingMode = 'challenge';
  pendingScore = null;
  pendingToken = null;
  requestSession().then((t) => {
    pendingToken = t;
  });
  challengeHud.classList.remove('hidden');
  movesLeftEl.textContent = `MOVES: ${level.moves}`;
  goalTextEl.textContent = level.goal.type === 'lines'
    ? `CLEAR ${level.goal.target} LINES`
    : `REACH ${level.goal.target} PTS`;
  game.startChallenge(level);
  game.start();
}

function showLevelComplete({ stars, score, newlyUnlocked }) {
  pendingScore = score;
  lbNameEl.value = loadPlayerName();
  lbResultEl.textContent = '';
  document.getElementById('leaderboard-entry').classList.remove('hidden');
  const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  finalScoreEl.textContent = `${starText}  ${score}`;
  overlay.querySelector('h1').textContent = 'LEVEL COMPLETE';
  overlay.querySelector('#play-again').textContent = newlyUnlocked ? 'NEXT LEVEL' : 'RETRY';
  overlay.classList.remove('hidden');
}

function showLevelFailed() {
  pendingScore = null;
  document.getElementById('leaderboard-entry').classList.add('hidden');
  lbResultEl.textContent = '';
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
    const res = await submitScore({ name, score: pendingScore, mode: pendingMode, token: pendingToken });
    if (res === null) {
      lbResultEl.textContent = 'Offline — score not submitted';
    } else if (res.error === 'rate-limited') {
      lbResultEl.textContent = 'Rate limited — try again later';
    } else if (res.error) {
      lbResultEl.textContent = 'Score rejected — start a new game';
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
  for (const btn of document.querySelectorAll('[data-back], #menu-btn')) {
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
      settings.musicVolume = 0.7;
      settings.sfxVolume = 1;
      settings.haptics = false;
      nameInput.value = '';
      musicInput.value = 70;
      sfxInput.value = 100;
      hapticsInput.checked = false;
      if (audio) audio.setMusicVolume(0.7);
      if (audio) audio.setSfxVolume(1);
    }
  });
}

function bindLeaderboard() {
  const tabs = document.querySelectorAll('.lb-tab');
  let activeMode = 'endless';
  let loadId = 0;
  async function load(mode) {
    const id = ++loadId;
    activeMode = mode;
    for (const t of tabs) t.classList.toggle('lb-tab--active', t.dataset.mode === mode);
    const status = document.getElementById('lb-status');
    const list = document.getElementById('lb-list');
    status.textContent = 'Loading…';
    list.innerHTML = '';
    const res = await fetchLeaderboard(mode);
    if (id !== loadId) return; // stale response
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
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = String(i + 1);
      const name = document.createElement('span');
      name.textContent = e.name;
      const score = document.createElement('span');
      score.textContent = String(e.score);
      li.append(rank, name, score);
      list.appendChild(li);
    }
  }
  for (const t of tabs) t.addEventListener('click', () => load(t.dataset.mode));
  return { refresh: () => load(activeMode) };
}

const leaderboardScreen = bindLeaderboard();

initRouter({
  menu: () => {
    game.stop();
    showScreen('screen-menu');
  },
  levels: () => {
    game.stop();
    showScreen('screen-levels');
    renderLevels();
  },
  settings: () => {
    game.stop();
    showScreen('screen-settings');
  },
  leaderboard: () => {
    game.stop();
    showScreen('screen-leaderboard');
    leaderboardScreen.refresh();
  },
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
