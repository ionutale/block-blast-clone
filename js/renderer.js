import { SIZE } from './board.js';
import { canPlace } from './board.js';

const PAD = 14;
const GREEN = 'rgba(110, 231, 183, 0.4)';
const RED = 'rgba(248, 113, 113, 0.45)';
export const CLEAR_MS = 260;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * f);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let layout = { dpr: 1, w: 0, h: 0, cell: 0, boardX: 0, boardY: 0, trayY: 0 };

  function computeLayout(w, h) {
    const cell = Math.max(1, Math.min(
      Math.floor((h - PAD * 2 - 12) / (SIZE + 2.4)),
      Math.floor((w - PAD * 2) / SIZE)
    ));
    const slot = Math.floor(cell * 2.4);
    const boardPx = cell * SIZE;
    const totalH = boardPx + 12 + slot;
    const boardY = Math.max(PAD, Math.floor((h - totalH) / 2));
    const boardX = Math.floor((w - boardPx) / 2);
    return { dpr: window.devicePixelRatio || 1, w, h, cell, boardX, boardY, trayY: boardY + boardPx + 12 };
  }

  function handleResize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layout = computeLayout(w, h);
  }

  handleResize();
  new ResizeObserver(handleResize).observe(canvas);

  function getCellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - layout.boardX;
    const y = clientY - rect.top - layout.boardY;
    const col = Math.floor(x / layout.cell);
    const row = Math.floor(y / layout.cell);
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
    return { row, col };
  }

  function trayMetrics(cell) {
    const slot = Math.floor(cell * 2.4);
    const gap = Math.floor(cell * 0.4);
    const total = slot * 3 + gap * 2;
    const x0 = layout.boardX + Math.floor((layout.cell * SIZE - total) / 2);
    return { slot, gap, total, x0 };
  }

  function hitTestTray(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { slot, gap, total, x0 } = trayMetrics(layout.cell);
    if (y < layout.trayY || y > layout.trayY + slot) return -1;
    const rel = x - x0;
    if (rel < 0 || rel > total) return -1;
    const i = Math.floor(rel / (slot + gap));
    if (i > 2 || rel % (slot + gap) >= slot) return -1;
    return i;
  }

  function drawPieceCell(x, y, size, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = Math.max(3, size * 0.18);
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, r);
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, lighten(color, 0.28));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + size * 0.16, y + size * 0.14, size * 0.68, Math.max(2, size * 0.1));
    ctx.restore();
  }

  function drawEmptyCell(px, py) {
    ctx.beginPath();
    ctx.roundRect(px, py, layout.cell, layout.cell, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
  }

  function drawBoardPanel() {
    const p = 4;
    ctx.beginPath();
    ctx.roundRect(layout.boardX - p, layout.boardY - p, layout.cell * SIZE + p * 2, layout.cell * SIZE + p * 2, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fill();
  }

  function drawBoard(board) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const px = layout.boardX + c * layout.cell;
        const py = layout.boardY + r * layout.cell;
        const color = board[r][c];
        if (color === null) {
          drawEmptyCell(px, py);
        } else {
          drawPieceCell(px, py, layout.cell, color);
        }
      }
    }
  }

  function drawClearing(clearing) {
    if (!clearing) return;
    const t = clamp((performance.now() - clearing.start) / CLEAR_MS, 0, 1);
    const alpha = 1 - t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffffff';
    for (const { row, col } of clearing.cells) {
      const px = layout.boardX + col * layout.cell;
      const py = layout.boardY + row * layout.cell;
      ctx.beginPath();
      ctx.roundRect(px, py, layout.cell, layout.cell, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDrag(drag, board, tray) {
    const piece = tray.pieces[drag.pieceIndex];
    if (!piece) return;
    const target = getCellAt(drag.x, drag.y);
    const { cell } = layout;
    if (!target) {
      const rect = canvas.getBoundingClientRect();
      const cols = piece.shape[0].length;
      const rows = piece.shape.length;
      const px = drag.x - rect.left - layout.boardX - (cols * cell) / 2;
      const py = drag.y - rect.top - layout.boardY - (rows * cell) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!piece.shape[r][c]) continue;
          drawPieceCell(layout.boardX + px + c * cell, layout.boardY + py + r * cell, cell, piece.color, 0.8);
        }
      }
      return;
    }
    const ar = clamp(target.row, 0, SIZE - piece.shape.length);
    const ac = clamp(target.col, 0, SIZE - piece.shape[0].length);
    const valid = canPlace(board, piece.shape, ar, ac);
    const tint = valid ? GREEN : RED;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const br = ar + r;
        const bc = ac + c;
        const px = layout.boardX + bc * cell;
        const py = layout.boardY + br * cell;
        if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE) {
          ctx.beginPath();
          ctx.roundRect(px, py, cell, cell, 3);
          ctx.fillStyle = tint;
          ctx.fill();
          drawPieceCell(px, py, cell, piece.color, valid ? 0.75 : 0.85);
        } else {
          drawPieceCell(px, py, cell, piece.color, 0.7);
        }
      }
    }
  }

  function drawTray(tray, drag) {
    const { slot, gap, total, x0 } = trayMetrics(layout.cell);
    for (let i = 0; i < tray.pieces.length; i++) {
      const p = tray.pieces[i];
      const sx = x0 + i * (slot + gap);
      ctx.beginPath();
      ctx.roundRect(sx, layout.trayY, slot, slot, 12);
      ctx.fillStyle = p.used ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)';
      ctx.fill();
      if (p.used || (drag && i === drag.pieceIndex)) continue;
      const cols = p.shape[0].length;
      const rows = p.shape.length;
      const pc = Math.floor(Math.min((slot * 0.8) / cols, (slot * 0.8) / rows));
      const ox = sx + Math.floor((slot - pc * cols) / 2);
      const oy = layout.trayY + Math.floor((slot - pc * rows) / 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (p.shape[r][c]) drawPieceCell(ox + c * pc, oy + r * pc, pc, p.color);
        }
      }
    }
  }

  function render(state) {
    const { dpr, w, h } = layout;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#12263f');
    bg.addColorStop(1, '#0b1830');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawBoardPanel();
    drawBoard(state.board);
    drawClearing(state.clearing);
    if (state.drag) drawDrag(state.drag, state.board, state.tray);
    drawTray(state.tray, state.drag);
    if (state.gameOver) {
      ctx.fillStyle = 'rgba(5,10,20,0.55)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  return { render, getCellAt, hitTestTray };
}
