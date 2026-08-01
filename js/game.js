import { createRenderer, CLEAR_MS } from './renderer.js';
import { setupInput } from './input.js';
import {
  SIZE, createBoard, canPlace, placePiece, getFullLines, clearLines, anyPlacementPossible,
} from './board.js';
import { createTray, markUsed, allUsed, unusedPieces } from './tray.js';
import { scorePlacement } from './scoring.js';
import { countCells } from './shapes.js';

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createGame(canvas, { onScore, onGameOver } = {}) {
  const renderer = createRenderer(canvas);
  let board = createBoard();
  let tray = createTray();
  let score = 0;
  let drag = null;
  let clearing = null;
  let gameOver = false;
  let rafId = null;

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
    if (allUsed(tray)) tray = createTray();
  }

  function remainingShapes() {
    return unusedPieces(tray).map((p) => p.shape);
  }

  function checkGameOver() {
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
      if (gameOver) return;
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
      if (!canPlace(board, piece.shape, row, col)) return;
      const placed = placePiece(board, piece.shape, row, col, piece.color);
      const lines = getFullLines(placed);
      score += scorePlacement(countCells(piece.shape), lines.rows.length + lines.cols.length);
      if (onScore) onScore(score);
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
    rafId = requestAnimationFrame(frame);
  }

  function restart() {
    board = createBoard();
    tray = createTray();
    score = 0;
    drag = null;
    clearing = null;
    gameOver = false;
    if (onScore) onScore(0);
  }

  return { start, restart };
}
