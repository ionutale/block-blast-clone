import { createGame } from './game.js';

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');

const testMode = new URLSearchParams(window.location.search).get('test') === '1';

const game = createGame(canvas, {
  onScore: (s) => {
    scoreEl.textContent = String(s);
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');
  },
  onGameOver: (s) => {
    finalScoreEl.textContent = String(s);
    overlay.classList.remove('hidden');
  },
  debug: testMode,
});

if (testMode && game.debug) window.__blockBlast = game.debug;

document.getElementById('play-again').addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.restart();
});

game.start();
