import { createGame } from './game.js';

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const overlay = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');

const game = createGame(canvas, {
  onScore: (s) => {
    scoreEl.textContent = String(s);
  },
  onGameOver: (s) => {
    finalScoreEl.textContent = String(s);
    overlay.classList.remove('hidden');
  },
});

document.getElementById('play-again').addEventListener('click', () => {
  overlay.classList.add('hidden');
  game.restart();
});

game.start();
