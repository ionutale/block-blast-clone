import { SIZE } from './board.js';
import { canPlace } from './board.js';
import { COLORS } from './shapes.js';

const PAD = 14;
const GREEN = 'rgba(110, 231, 183, 0.4)';
const RED = 'rgba(248, 113, 113, 0.45)';
export const CLEAR_MS = 260;

const POP_DURATION = 140;
const PARTICLE_GRAVITY = 700;
const MAX_PARTICLES = 500;
const TWINKLE_COUNT = 14;

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

  let particles = [];
  let pops = [];
  let lastBoard = null;
  let lastClearing = false;
  let lastNow = performance.now();

  const twinkles = [];
  for (let i = 0; i < TWINKLE_COUNT; i++) {
    twinkles.push({
      x: Math.random(),
      y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.2,
      size: 1 + Math.random() * 1.6,
    });
  }

  const ORB_COLORS = ['#fda4af', '#a5b4fc', '#fcd34d', '#6ee7b7', '#c4b5fd', '#7dd3fc'];
  const orbs = [];
  for (let i = 0; i < 6; i++) {
    orbs.push({
      x: Math.random(),
      y: Math.random(),
      r: 0.12 + Math.random() * 0.18,
      speed: 0.1 + Math.random() * 0.2,
      color: ORB_COLORS[i],
    });
  }

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

  function drawPieceCell(x, y, size, color, alpha = 1, style = 'flat') {
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = Math.max(3, size * 0.18);
    if (style === 'raised') {
      ctx.globalAlpha = alpha * 0.22;
      ctx.beginPath();
      ctx.roundRect(x - size * 0.04, y - size * 0.04, size * 1.08, size * 1.08, r + 1);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    const shadowY = style === 'drag' ? Math.max(2, size * 0.14) : Math.max(1, size * 0.09);
    const shadowA = style === 'drag' ? 0.4 : 0.24;
    if (style !== 'flat') {
      ctx.globalAlpha = alpha * shadowA;
      ctx.beginPath();
      ctx.roundRect(x, y + shadowY, size, size, r);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, r);
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, lighten(color, 0.3));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(x + size * 0.15, y + size * 0.12, size * 0.7, Math.max(2, size * 0.09), 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath();
    ctx.roundRect(x + size * 0.08, y + size * 0.66, size * 0.84, size * 0.26, 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEmptyCell(px, py) {
    const size = layout.cell;
    ctx.beginPath();
    ctx.roundRect(px, py, size, size, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    const inset = ctx.createLinearGradient(0, py + size * 0.5, 0, py + size);
    inset.addColorStop(0, 'rgba(0,0,0,0)');
    inset.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.beginPath();
    ctx.roundRect(px + 1, py + size * 0.5, size - 2, size * 0.48, 2);
    ctx.fillStyle = inset;
    ctx.fill();
  }

  function drawBoardPanel() {
    const p = 4;
    const bx = layout.boardX - p;
    const by = layout.boardY - p;
    const bs = layout.cell * SIZE + p * 2;
    ctx.beginPath();
    ctx.roundRect(bx, by + 6, bs, bs, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(bx, by, bs, bs, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
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
          drawPieceCell(px, py, layout.cell, color, 1, 'raised');
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
          drawPieceCell(layout.boardX + px + c * cell, layout.boardY + py + r * cell, cell, piece.color, 0.85, 'drag');
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
          drawPieceCell(px, py, cell, piece.color, valid ? 0.75 : 0.85, 'drag');
        } else {
          drawPieceCell(px, py, cell, piece.color, 0.7, 'drag');
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

  function cellCenter(row, col) {
    return {
      x: layout.boardX + col * layout.cell + layout.cell / 2,
      y: layout.boardY + row * layout.cell + layout.cell / 2,
    };
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 320;
      const life = 0.5 + Math.random() * 0.4;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 2 + Math.random() * 3,
        life,
        maxLife: life,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 10,
      });
    }
  }

  function spawnPop(x, y) {
    pops.push({ x, y, start: performance.now(), duration: POP_DURATION });
  }

  function updateEffects(board, now) {
    if (lastBoard) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (lastBoard[r][c] === null && board[r][c] !== null) {
            const { x, y } = cellCenter(r, c);
            spawnPop(x, y);
            spawnParticles(x, y, board[r][c], 3);
          }
        }
      }
      let filledBefore = 0;
      for (const row of lastBoard) {
        for (const cell of row) if (cell !== null) filledBefore++;
      }
      let filledNow = 0;
      for (const row of board) {
        for (const cell of row) if (cell !== null) filledNow++;
      }
      if (filledBefore > 0 && filledNow === 0) {
        particles = [];
        pops = [];
      }
    }
    lastBoard = board;
  }

  function updateClearing(state) {
    if (state.clearing && !lastClearing) {
      for (const { row, col } of state.clearing.cells) {
        const { x, y } = cellCenter(row, col);
        spawnParticles(x, y, null, 4);
      }
    }
    lastClearing = Boolean(state.clearing);
  }

  function stepParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
    for (let i = pops.length - 1; i >= 0; i--) {
      if (performance.now() - pops[i].start > pops[i].duration) pops.splice(i, 1);
    }
  }

  function drawTwinkles() {
    for (const t of twinkles) {
      const pulse = 0.5 + 0.5 * Math.sin(t.phase + performance.now() / 1000 * t.speed);
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.14 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(t.x * layout.w, t.y * layout.h, t.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPops() {
    for (const pop of pops) {
      const t = (performance.now() - pop.start) / pop.duration;
      const scale = 1 + 0.22 * (1 - t);
      const size = layout.cell * scale;
      ctx.save();
      ctx.globalAlpha = (1 - t * 0.6) * 0.85;
      ctx.beginPath();
      ctx.roundRect(pop.x - size / 2, pop.y - size / 2, size, size, Math.max(3, size * 0.18));
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    }
  }

  function drawBackground(now) {
    const t = now / 1000;
    const bg = ctx.createLinearGradient(0, 0, 0, layout.h);
    bg.addColorStop(0, `hsl(${205 + 18 * Math.sin(t * 0.07)}, 85%, 76%)`);
    bg.addColorStop(0.55, `hsl(${268 + 14 * Math.cos(t * 0.05)}, 80%, 82%)`);
    bg.addColorStop(1, `hsl(${332 + 14 * Math.sin(t * 0.09)}, 85%, 88%)`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, layout.w, layout.h);
    for (const o of orbs) {
      const x = (o.x + 0.08 * Math.sin(t * o.speed * 0.6 + o.y * 10)) * layout.w;
      const y = (o.y + 0.08 * Math.cos(t * o.speed * 0.5 + o.x * 10)) * layout.h;
      const r = o.r * Math.min(layout.w, layout.h);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `${o.color}59`);
      g.addColorStop(1, `${o.color}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function render(state) {
    const { dpr, w, h } = layout;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(now);
    drawTwinkles();
    drawBoardPanel();
    drawBoard(state.board);
    drawPops();
    drawClearing(state.clearing);
    if (state.drag) drawDrag(state.drag, state.board, state.tray);
    drawTray(state.tray, state.drag);
    drawParticles();
    if (state.gameOver) {
      ctx.fillStyle = 'rgba(5,10,20,0.55)';
      ctx.fillRect(0, 0, w, h);
    }

    updateEffects(state.board, now);
    updateClearing(state);
    stepParticles(dt);
    if (particles.length > MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES);
  }

  return { render, getCellAt, hitTestTray, getLayout: () => ({ ...layout }) };
}
