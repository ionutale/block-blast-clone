# Block Blast Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web clone of Block Blast — 8×8 board, polyomino pieces with drag & drop, line clearing, score, game over — in vanilla JS + Canvas with no dependencies.

**Architecture:** Modular ES modules (no build step): pure-logic modules (`shapes.js`, `board.js`, `tray.js`, `scoring.js`) testable with `node --test`, and rendering/input modules (`renderer.js`, `input.js`) orchestrated by `game.js`. Single canvas, pointer events for mouse + touch, rAF render loop.

**Tech Stack:** Vanilla JavaScript (ES modules), HTML5 Canvas, CSS, Node.js built-in test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-01-block-blast-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | `"type": "module"` so Node runs ES modules; `test` script |
| `index.html` | Canvas, score HUD, game-over overlay; loads `js/main.js` |
| `css/style.css` | Style A (dark navy background, centered layout, responsive canvas) |
| `js/main.js` | Bootstraps `createGame`, wires DOM (score text, overlay, play-again) |
| `js/shapes.js` | `SHAPES` (polyomino matrices, fixed orientation), `COLORS` palette, `countCells` |
| `js/board.js` | Pure board logic: `SIZE`, `createBoard`, `canPlace`, `placePiece`, `getFullLines`, `clearLines`, `anyPlacementPossible` |
| `js/tray.js` | `TRAY_SIZE`, `generatePieces`, `createTray`, `markUsed`, `allUsed`, `unusedPieces` |
| `js/scoring.js` | `lineBonus`, `scorePlacement` |
| `js/renderer.js` | Canvas drawing: board, pieces, drag preview (green/red), clearing animation, tray; layout + coordinate mapping (`getCellAt`, `hitTestTray`) |
| `js/input.js` | `setupInput(canvas, handlers)` — unified pointer events |
| `js/game.js` | `createGame(canvas, { onScore, onGameOver })` — state machine + rAF loop |
| `js/board.test.js`, `js/scoring.test.js`, `js/tray.test.js`, `js/shapes.test.js` | Node tests for pure logic |

## Shared Interfaces (consistency contract)

- Board cell value: `null` = empty, otherwise a color string (e.g. `'#ff5b6a'`).
- Shape: `number[][]` matrix of 0/1, fixed orientation.
- `state` object passed to `renderer.render(state)`: `{ board, tray, score, drag, clearing, gameOver }`.
  - `drag`: `{ pieceIndex, x, y } | null` (x/y = pointer client coords).
  - `clearing`: `{ board, lines: { rows, cols }, cells: [{row, col}], start } | null` (start = `performance.now()`).
- `tray`: `{ pieces: [{ id, shape, color, used }] }`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/style.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "block-blast-clone",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test js/"
  }
}
```

- [ ] **Step 2: Create `index.html`** (no script tag yet — added in Task 9)

```html
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>Block Blast</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="hud">
    <div class="score-label">SCORE</div>
    <div class="score-value" id="score">0</div>
  </div>
  <canvas id="board"></canvas>
  <div id="game-over" class="overlay hidden">
    <div class="overlay-card">
      <h1>GAME OVER</h1>
      <div class="final-score" id="final-score">0</div>
      <button id="play-again">PLAY AGAIN</button>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: Create `css/style.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: linear-gradient(160deg, #12263f, #0b1830);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.hud { text-align: center; margin-bottom: 10px; }
.score-label { color: rgba(255,255,255,0.55); font-size: 12px; letter-spacing: 3px; }
.score-value { color: #fff; font-size: 34px; font-weight: 700; line-height: 1.1; }
#board {
  width: min(94vw, 480px);
  aspect-ratio: 5 / 7;
  touch-action: none;
  border-radius: 16px;
}
.overlay {
  position: fixed; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: rgba(5, 10, 20, 0.72);
}
.overlay.hidden { display: none; }
.overlay-card {
  background: #16293f;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px;
  padding: 28px 44px;
  text-align: center;
  color: #fff;
  box-shadow: 0 12px 40px rgba(0,0,0,0.5);
}
.overlay-card h1 { font-size: 26px; letter-spacing: 4px; color: #ffd23f; }
.final-score { font-size: 42px; font-weight: 700; margin: 10px 0 20px; }
#play-again {
  background: #ff5b6a;
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1px;
  padding: 12px 30px;
  border-radius: 10px;
  cursor: pointer;
}
#play-again:active { transform: scale(0.97); }
```

- [ ] **Step 4: Verify page loads**

Run: `python3 -m http.server 8000` in the project root, then open `http://localhost:8000` in a browser. Expected: dark navy page with "SCORE 0" and an empty canvas area. Kill the server afterwards.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html css/style.css
git commit -m "feat: scaffold project (html, css, package.json)"
```

---

### Task 2: Piece shapes and colors (`shapes.js`)

**Files:**
- Create: `js/shapes.js`
- Test: `js/shapes.test.js`

- [ ] **Step 1: Write the failing tests**

`js/shapes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, COLORS, countCells } from './shapes.js';

test('SHAPES are non-empty 0/1 matrices with max dimension 5', () => {
  for (const shape of SHAPES) {
    assert.ok(shape.length > 0 && shape[0].length > 0, 'empty shape');
    assert.ok(shape.length <= 5 && shape[0].length <= 5, 'shape too big');
    for (const row of shape) {
      assert.equal(row.length, shape[0].length, 'ragged row');
      for (const v of row) assert.ok(v === 0 || v === 1, 'cell not 0/1');
    }
  }
});

test('countCells counts filled cells', () => {
  assert.equal(countCells([[1]]), 1);
  assert.equal(countCells([[1, 1], [1, 0]]), 3);
  assert.equal(countCells([[1, 1, 1, 1, 1]]), 5);
});

test('COLORS are 6-digit hex strings', () => {
  assert.ok(COLORS.length >= 5);
  for (const c of COLORS) assert.match(c, /^#[0-9a-f]{6}$/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './shapes.js'`

- [ ] **Step 3: Implement `js/shapes.js`**

```js
export const COLORS = ['#ff5b6a', '#3ec1f0', '#ffd23f', '#4ade80', '#c084fc', '#fb923c'];

export const SHAPES = [
  // single dot
  [[1]],
  // lines
  [[1, 1]],
  [[1], [1]],
  [[1, 1, 1]],
  [[1], [1], [1]],
  [[1, 1, 1, 1]],
  [[1], [1], [1], [1]],
  [[1, 1, 1, 1, 1]],
  [[1], [1], [1], [1], [1]],
  // squares
  [[1, 1], [1, 1]],
  [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
  // L corners (3 cells, 2x2)
  [[1, 0], [1, 1]],
  [[0, 1], [1, 1]],
  [[1, 1], [1, 0]],
  [[1, 1], [0, 1]],
  // L shapes (4 cells, 3x2)
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 0], [1, 0], [1, 1]],
  [[0, 1], [0, 1], [1, 1]],
  [[1, 1], [0, 1], [0, 1]],
  [[1, 1], [1, 0], [1, 0]],
  // T shapes (3 and 4 cells)
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0], [1, 1], [1, 0]],
  [[1, 1, 1], [0, 1, 0]],
  [[0, 1], [1, 1], [0, 1]],
  // S/Z shapes
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
  [[1, 0], [1, 1], [0, 1]],
  [[0, 1], [1, 1], [1, 0]],
  // plus and U shapes
  [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
  [[1, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 1]],
  [[1, 1], [1, 0], [1, 1]],
];

export function countCells(shape) {
  return shape.flat().reduce((n, v) => n + v, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 3 tests, all green.

- [ ] **Step 5: Commit**

```bash
git add js/shapes.js js/shapes.test.js
git commit -m "feat: add piece shapes and color palette"
```

---

### Task 3: Board logic (`board.js`)

**Files:**
- Create: `js/board.js`
- Test: `js/board.test.js`

- [ ] **Step 1: Write the failing tests**

`js/board.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, createBoard, canPlace, placePiece, getFullLines, clearLines, anyPlacementPossible } from './board.js';

const L3 = [[1, 1, 1]];
const V3 = [[1], [1], [1]];

test('createBoard returns empty 8x8 board', () => {
  const b = createBoard();
  assert.equal(b.length, SIZE);
  for (const row of b) {
    assert.equal(row.length, SIZE);
    assert.ok(row.every((c) => c === null));
  }
});

test('canPlace accepts empty cells and rejects occupied and out-of-bounds', () => {
  const b = createBoard();
  assert.ok(canPlace(b, L3, 0, 0));
  assert.ok(!canPlace(b, L3, 0, 6), 'row out of bounds');
  assert.ok(!canPlace(b, V3, 6, 0), 'col out of bounds');
  b[0][1] = '#fff';
  assert.ok(!canPlace(b, L3, 0, 0), 'overlap');
  assert.ok(canPlace(b, L3, 0, 3));
});

test('placePiece returns a new board and leaves the original unchanged', () => {
  const b = createBoard();
  const nb = placePiece(b, L3, 1, 1, '#f00');
  assert.notEqual(nb, b);
  assert.equal(b[1][1], null);
  assert.equal(nb[1][1], '#f00');
  assert.equal(nb[1][2], '#f00');
  assert.equal(nb[1][3], '#f00');
  assert.equal(nb[2][2], null);
});

test('getFullLines detects full rows and columns', () => {
  const b = createBoard();
  for (let c = 0; c < SIZE; c++) b[2][c] = '#f00';
  for (let r = 0; r < SIZE; r++) b[r][4] = '#0f0';
  const { rows, cols } = getFullLines(b);
  assert.deepEqual(rows, [2]);
  assert.deepEqual(cols, [4]);
});

test('getFullLines returns empty when nothing is full', () => {
  const b = createBoard();
  const { rows, cols } = getFullLines(b);
  assert.deepEqual(rows, []);
  assert.deepEqual(cols, []);
});

test('clearLines empties the given rows and columns only', () => {
  const b = createBoard();
  for (let c = 0; c < SIZE; c++) b[2][c] = '#f00';
  b[3][0] = '#00f';
  const nb = clearLines(b, { rows: [2], cols: [] });
  assert.ok(nb[2].every((c) => c === null));
  assert.equal(nb[3][0], '#00f');
  assert.equal(b[2][0], '#f00', 'original unchanged');
});

test('anyPlacementPossible works on empty and full boards', () => {
  assert.ok(anyPlacementPossible(createBoard(), [L3]));
  const full = createBoard().map((row) => row.map(() => '#f00'));
  assert.ok(!anyPlacementPossible(full, [L3]));
});

test('anyPlacementPossible detects the last fitting spot', () => {
  const b = createBoard().map((row) => row.map(() => '#f00'));
  b[0][0] = null; b[0][1] = null; b[0][2] = null;
  assert.ok(anyPlacementPossible(b, [L3]), '3 cells in a row should fit L3');
  const b2 = createBoard().map((row) => row.map(() => '#f00'));
  b2[0][0] = null; b2[0][1] = null;
  assert.ok(!anyPlacementPossible(b2, [L3]), 'only 2 cells free');
  assert.ok(anyPlacementPossible(b2, [[1, 1]]), '2-cell piece fits');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './board.js'` (shapes tests still pass)

- [ ] **Step 3: Implement `js/board.js`**

```js
export const SIZE = 8;

export function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

export function cloneBoard(board) {
  return board.map((row) => [...row]);
}

export function canPlace(board, shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = row + r;
      const bc = col + c;
      if (br < 0 || br >= SIZE || bc < 0 || bc >= SIZE) return false;
      if (board[br][bc] !== null) return false;
    }
  }
  return true;
}

export function placePiece(board, shape, row, col, color) {
  const next = cloneBoard(board);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (shape[r][c]) next[row + r][col + c] = color;
    }
  }
  return next;
}

export function getFullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r);
  }
  for (let c = 0; c < SIZE; c++) {
    if (board.every((row) => row[c] !== null)) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(board, { rows, cols }) {
  const next = cloneBoard(board);
  for (const r of rows) next[r] = Array(SIZE).fill(null);
  for (const c of cols) {
    for (let r = 0; r < SIZE; r++) next[r][c] = null;
  }
  return next;
}

export function anyPlacementPossible(board, shapes) {
  for (const shape of shapes) {
    for (let r = 0; r <= SIZE - shape.length; r++) {
      for (let c = 0; c <= SIZE - shape[0].length; c++) {
        if (canPlace(board, shape, r, c)) return true;
      }
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all board tests green.

- [ ] **Step 5: Commit**

```bash
git add js/board.js js/board.test.js
git commit -m "feat: add board logic (placement, line detection, game over)"
```

---

### Task 4: Scoring (`scoring.js`)

**Files:**
- Create: `js/scoring.js`
- Test: `js/scoring.test.js`

- [ ] **Step 1: Write the failing tests**

`js/scoring.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineBonus, scorePlacement } from './scoring.js';

test('lineBonus follows the triangular formula 10 * n(n+1)/2', () => {
  assert.equal(lineBonus(0), 0);
  assert.equal(lineBonus(1), 10);
  assert.equal(lineBonus(2), 30);
  assert.equal(lineBonus(3), 60);
  assert.equal(lineBonus(4), 100);
});

test('scorePlacement adds placed cells plus line bonus', () => {
  assert.equal(scorePlacement(4, 0), 4);
  assert.equal(scorePlacement(4, 1), 14);
  assert.equal(scorePlacement(5, 2), 35);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './scoring.js'`

- [ ] **Step 3: Implement `js/scoring.js`**

```js
export function lineBonus(lineCount) {
  return 10 * ((lineCount * (lineCount + 1)) / 2);
}

export function scorePlacement(cellsPlaced, lineCount) {
  return cellsPlaced + lineBonus(lineCount);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all scoring tests green.

- [ ] **Step 5: Commit**

```bash
git add js/scoring.js js/scoring.test.js
git commit -m "feat: add scoring (cells + line bonus)"
```

---

### Task 5: Piece tray (`tray.js`)

**Files:**
- Create: `js/tray.js`
- Test: `js/tray.test.js`

- [ ] **Step 1: Write the failing tests**

`js/tray.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, COLORS } from './shapes.js';
import { TRAY_SIZE, generatePieces, createTray, markUsed, allUsed, unusedPieces } from './tray.js';

test('generatePieces returns pieces with unique shapes in the set', () => {
  const pieces = generatePieces(TRAY_SIZE);
  assert.equal(pieces.length, TRAY_SIZE);
  const shapes = new Set(pieces.map((p) => p.shape));
  assert.equal(shapes.size, TRAY_SIZE, 'duplicate shapes in one set');
  for (const p of pieces) {
    assert.ok(SHAPES.includes(p.shape));
    assert.ok(COLORS.includes(p.color));
    assert.equal(p.used, false);
    assert.ok(p.id.length > 0);
  }
});

test('createTray has TRAY_SIZE unused pieces', () => {
  const tray = createTray();
  assert.equal(tray.pieces.length, TRAY_SIZE);
  assert.equal(unusedPieces(tray).length, TRAY_SIZE);
});

test('markUsed and allUsed track usage', () => {
  const tray = createTray();
  markUsed(tray, tray.pieces[0].id);
  assert.ok(!allUsed(tray));
  assert.equal(unusedPieces(tray).length, TRAY_SIZE - 1);
  for (const p of tray.pieces) markUsed(tray, p.id);
  assert.ok(allUsed(tray));
  assert.deepEqual(unusedPieces(tray), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './tray.js'`

- [ ] **Step 3: Implement `js/tray.js`**

```js
import { SHAPES, COLORS } from './shapes.js';

export const TRAY_SIZE = 3;

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

export function generatePieces(count) {
  const pool = [...SHAPES];
  const pieces = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = randomInt(pool.length);
    const [shape] = pool.splice(idx, 1);
    pieces.push({
      id: `${i}-${randomInt(1e9)}`,
      shape,
      color: COLORS[randomInt(COLORS.length)],
      used: false,
    });
  }
  return pieces;
}

export function createTray() {
  return { pieces: generatePieces(TRAY_SIZE) };
}

export function markUsed(tray, pieceId) {
  const piece = tray.pieces.find((p) => p.id === pieceId);
  if (piece) piece.used = true;
}

export function allUsed(tray) {
  return tray.pieces.every((p) => p.used);
}

export function unusedPieces(tray) {
  return tray.pieces.filter((p) => !p.used);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all tray tests green.

- [ ] **Step 5: Commit**

```bash
git add js/tray.js js/tray.test.js
git commit -m "feat: add piece tray generation and usage tracking"
```

---

### Task 6: Canvas renderer (`renderer.js`)

**Files:**
- Create: `js/renderer.js`

No Node tests (DOM/canvas). Verification is manual in browser — but it needs `game.js`, so full verification happens in Task 9. Here we verify the module loads without syntax errors.

- [ ] **Step 1: Implement `js/renderer.js`**

```js
import { SIZE } from './board.js';
import { canPlace } from './board.js';

const PAD = 14;
const GREEN = 'rgba(110, 231, 183, 0.4)';
const RED = 'rgba(248, 113, 113, 0.45)';

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
    const cell = Math.min(
      Math.floor((h - PAD * 2 - 12) / (SIZE + 2.4)),
      Math.floor((w - PAD * 2) / SIZE)
    );
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

  function hitTestTray(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const slot = Math.floor(layout.cell * 2.4);
    const gap = Math.floor(layout.cell * 0.4);
    const total = slot * 3 + gap * 2;
    const x0 = layout.boardX + Math.floor((layout.cell * SIZE - total) / 2);
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
    const t = clamp((performance.now() - clearing.start) / 260, 0, 1);
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
      const cols = piece.shape[0].length;
      const rows = piece.shape.length;
      const px = drag.x - layout.boardX - (cols * cell) / 2;
      const py = drag.y - layout.boardY - (rows * cell) / 2;
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

  function drawTray(tray) {
    const slot = Math.floor(layout.cell * 2.4);
    const gap = Math.floor(layout.cell * 0.4);
    const total = slot * 3 + gap * 2;
    const x0 = layout.boardX + Math.floor((layout.cell * SIZE - total) / 2);
    for (let i = 0; i < tray.pieces.length; i++) {
      const p = tray.pieces[i];
      const sx = x0 + i * (slot + gap);
      ctx.beginPath();
      ctx.roundRect(sx, layout.trayY, slot, slot, 12);
      ctx.fillStyle = p.used ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)';
      ctx.fill();
      if (p.used) continue;
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
    drawTray(state.tray);
    if (state.gameOver) {
      ctx.fillStyle = 'rgba(5,10,20,0.55)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  return { render, getCellAt, hitTestTray };
}
```

- [ ] **Step 2: Verify the module parses**

Run: `node -e "import('./js/renderer.js').then(() => console.log('ok'))"`
Expected: `ok` (import succeeds; renderer references `window`/`document` only inside functions).

- [ ] **Step 3: Commit**

```bash
git add js/renderer.js
git commit -m "feat: add canvas renderer (board, tray, drag preview, clearing)"
```

---

### Task 7: Pointer input (`input.js`)

**Files:**
- Create: `js/input.js`

- [ ] **Step 1: Implement `js/input.js`**

```js
export function setupInput(canvas, handlers) {
  let dragging = false;
  let pointerId = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (dragging) return;
    if (handlers.hitTestTray(e.clientX, e.clientY) === -1) return;
    dragging = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    handlers.onDragStart(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    e.preventDefault();
    handlers.onDragMove(e.clientX, e.clientY);
  });

  function end(e) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    handlers.onDragEnd(e.clientX, e.clientY);
  }

  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
```

Note: `handlers.onDragStart(x, y)` receives client coords only — the piece index is resolved by `game.js` via `hitTestTray` at drag start.

- [ ] **Step 2: Verify the module parses**

Run: `node -e "import('./js/input.js').then(() => console.log('ok'))"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add js/input.js
git commit -m "feat: add unified pointer input (mouse + touch)"
```

---

### Task 8: Game orchestration (`game.js`)

**Files:**
- Create: `js/game.js`

- [ ] **Step 1: Implement `js/game.js`**

```js
import { createRenderer } from './renderer.js';
import { setupInput } from './input.js';
import {
  SIZE, createBoard, canPlace, placePiece, getFullLines, clearLines, anyPlacementPossible,
} from './board.js';
import { createTray, markUsed, allUsed, unusedPieces } from './tray.js';
import { scorePlacement } from './scoring.js';
import { countCells } from './shapes.js';

const CLEAR_MS = 260;

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
```

- [ ] **Step 2: Verify the module parses**

Run: `node -e "import('./js/game.js').then(() => console.log('ok'))"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add js/game.js
git commit -m "feat: add game orchestration (state machine, rAF loop, restart)"
```

---

### Task 9: Bootstrap wiring (`main.js`) + final verification

**Files:**
- Create: `js/main.js`
- Modify: `index.html` (add script tag)

- [ ] **Step 1: Create `js/main.js`**

```js
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
```

- [ ] **Step 2: Add the script tag to `index.html`**

Add before `</body>`:

```html
  <script type="module" src="js/main.js"></script>
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests in `shapes.test.js`, `board.test.js`, `scoring.test.js`, `tray.test.js` green.

- [ ] **Step 4: Manual browser verification**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`.

Check each item:
1. Board renders: 8×8 grid of dim cells, 3 colored pieces in the tray below.
2. Drag a tray piece with the mouse onto the board: target cells tint green; piece follows the cursor snapped to the grid.
3. Drag over occupied cells: tint turns red.
4. Release over an invalid spot: piece returns to the tray.
5. Release outside the board: piece returns to the tray.
6. Place a piece to complete a full row: the row flashes white and disappears; score increases.
7. Place to complete a full column: column clears.
8. Use all 3 pieces: a new set of 3 appears.
9. Touch emulation (DevTools device toolbar): drag works with touch; page does not scroll.
10. Fill the board so no remaining piece fits: GAME OVER overlay appears with final score.
11. Click PLAY AGAIN: overlay hides, board resets, score resets to 0.

- [ ] **Step 5: Commit**

```bash
git add js/main.js index.html
git commit -m "feat: wire up game bootstrap and play-again flow"
```

---

## Self-Review

**Spec coverage:**
- Board 8×8 ✓ (Task 3 `SIZE`, `createBoard`)
- 3 pieces in tray, no rotation ✓ (Tasks 2, 5)
- Drag & drop with green/red preview, release outside/invalid returns piece ✓ (Tasks 6, 7, 8)
- Line clearing with pop animation ✓ (Task 8 `CLEAR_MS` + Task 6 `drawClearing`)
- New set after all 3 used ✓ (Task 8 `maybeNewTray`)
- Game over when nothing fits + Play again ✓ (Task 8 `checkGameOver`/`restart`, Task 9)
- Scoring 1/cell + 10×triangular(n) ✓ (Task 4)
- Style A (dark navy, saturated gradient pieces, rounded corners) ✓ (Task 1 CSS, Task 6 `drawPieceCell`)
- Responsive + touch ✓ (Task 1 CSS `min(94vw,480px)`, Task 7 pointer events, Task 6 ResizeObserver)
- Node tests for pure logic ✓ (Tasks 2-5)

**Placeholder scan:** All steps contain full code and exact commands; no TBD/TODO.

**Type consistency:**
- `board.js` exports `SIZE`, `createBoard`, `canPlace`, `placePiece`, `getFullLines`, `clearLines`, `anyPlacementPossible` — usage matches in `renderer.js`, `game.js`, and tests.
- `shapes.js` exports `SHAPES`, `COLORS`, `countCells` — usage matches in `tray.js`, `game.js`, tests.
- `state` passed to `renderer.render`: `{ board, tray, score, drag, clearing, gameOver }` — `game.js` builds exactly this in `frame()`.
- `drag = { pieceIndex, x, y }` — `input.js` → `game.js` → `renderer.js` all agree.
- `clearing = { board, lines, cells, start }` — set in `finishPlacement`, consumed in `drawClearing` and `frame`.
