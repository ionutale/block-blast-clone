import { createGame } from './game.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');

const testMode = new URLSearchParams(window.location.search).get('test') === '1';
const audio = testMode ? null : createAudio();

const game = createGame(canvas, {
  onScore: (s) => {
    scoreEl.textContent = String(s);
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');
  },
  onPlacement: (lines) => {
    if (!audio) return;
    if (lines > 0) audio.clear(lines);
    else audio.place();
  },
  onGameOver: (s) => {
    finalScoreEl.textContent = String(s);
    overlay.classList.remove('hidden');
    if (audio) audio.gameOver();
  },
  debug: testMode,
});

if (testMode && game.debug) window.__blockBlast = game.debug;

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

document.getElementById('play-again').addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.restart();
});

game.start();
