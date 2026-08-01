import { createRenderer, CLEAR_MS } from './renderer.js';
import { setupInput } from './input.js';
import {
  SIZE, createBoard, canPlace, placePiece, getFullLines, clearLines, anyPlacementPossible,
} from './board.js';
import { createTray, markUsed, allUsed, unusedPieces } from './tray.js';
import { scorePlacement } from './scoring.js';
import { countCells } from './shapes.js';
import { calcStars } from './levels.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createGame(canvas, { onScore, onGameOver, onPlacement, onInvalid, onNewTray, onMovesLeft, onLevelComplete, onLevelFailed, debug } = {}) {
  const renderer = createRenderer(canvas);
  let board = createBoard();
  let tray = createTray();
  let score = 0;
  let drag = null;
  let clearing = null;
  let gameOver = false;
  let rafId = null;
  let mode = 'endless';
  let levelConfig = null;
  let movesLeft = 0;
  let linesCleared = 0;
  let levelDone = false;

  function collectCells(lines) {
    const cells = [];
    for (const r of lines.rows) {
      for (let c = 0; c < SIZE; c++) cells.push({ row: r, col: c });
    }
    for (const c of lines.cols) {
      for (let r = 0; r < SIZE; r++) cells.push({ row: r, col: c });
    }
    return cells;
  }

  function maybeNewTray() {
    if (allUsed(tray)) {
      tray = createTray();
      if (onNewTray) onNewTray();
    }
  }

  function remainingShapes() {
    return unusedPieces(tray).map((p) => p.shape);
  }

  function checkGameOver() {
    if (mode !== 'endless') return;
    if (anyPlacementPossible(board, remainingShapes())) return;
    gameOver = true;
    if (onGameOver) onGameOver(score);
  }

  function afterPlacement() {
    maybeNewTray();
    checkGameOver();
  }

  function finishPlacement(pieceId, lines) {
    markUsed(tray, pieceId);
    if (lines.rows.length + lines.cols.length === 0) {
      afterPlacement();
    } else {
      clearing = { board, lines, cells: collectCells(lines), start: performance.now() };
    }
  }

  setupInput(canvas, {
    hitTestTray: (x, y) => renderer.hitTestTray(x, y),
    onDragStart: (x, y) => {
      if (gameOver || clearing || levelDone) return;
      const pieceIndex = renderer.hitTestTray(x, y);
      const piece = tray.pieces[pieceIndex];
      if (!piece || piece.used) return;
      drag = { pieceIndex, x, y };
    },
    onDragMove: (x, y) => {
      if (drag) {
        drag.x = x;
        drag.y = y;
      }
    },
    onDragEnd: (x, y) => {
      if (!drag) return;
      const { pieceIndex } = drag;
      drag = null;
      const piece = tray.pieces[pieceIndex];
      const target = renderer.getCellAt(x, y);
      if (!target) return;
      const row = clamp(target.row, 0, SIZE - piece.shape.length);
      const col = clamp(target.col, 0, SIZE - piece.shape[0].length);
      if (!canPlace(board, piece.shape, row, col)) {
        if (onInvalid) onInvalid();
        return;
      }
      const placed = placePiece(board, piece.shape, row, col, piece.color);
      const lines = getFullLines(placed);
      score += scorePlacement(countCells(piece.shape), lines.rows.length + lines.cols.length);
      if (onScore) onScore(score);
      if (onPlacement) onPlacement(lines.rows.length + lines.cols.length);
      if (mode === 'challenge') {
        movesLeft -= 1;
        linesCleared += lines.rows.length + lines.cols.length;
        if (onMovesLeft) onMovesLeft(movesLeft);
        const met = levelConfig.goal.type === 'lines'
          ? linesCleared >= levelConfig.goal.target
          : score >= levelConfig.goal.target;
        if (met) {
          levelDone = true;
          if (onLevelComplete) onLevelComplete({ stars: calcStars(levelConfig, movesLeft), score, movesLeft });
        } else if (movesLeft <= 0) {
          levelDone = true;
          if (onLevelFailed) onLevelFailed();
        }
      }
      board = placed;
      finishPlacement(piece.id, lines);
    },
  });

  function frame(now) {
    if (clearing && now - clearing.start >= CLEAR_MS) {
      board = clearLines(clearing.board, clearing.lines);
      clearing = null;
      afterPlacement();
    }
    renderer.render({ board, tray, score, drag, clearing, gameOver });
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(frame);
  }

  function restart() {
    board = createBoard();
    tray = createTray();
    score = 0;
    drag = null;
    clearing = null;
    gameOver = false;
    levelDone = false;
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
    levelDone = false;
    restart();
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

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

  function setTray(pieces) {
    tray = {
      pieces: pieces.map((p, i) => ({
        id: `test-${i}`,
        shape: p.shape,
        color: p.color || '#ff5b6a',
        used: false,
      })),
    };
  }

  function setBoard(matrix) {
    board = matrix.map((r) => [...r]);
  }

  const api = { start, restart, startEndless, startChallenge, stop };
  if (debug) {
    api.debug = { getState, setTray, setBoard };
  }
  return api;
}
