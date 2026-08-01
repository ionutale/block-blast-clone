# Candy Pop Graphics Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Block Blast clone from dark navy flat graphics to a bright, glossy, candy-pop look with animated background, confetti, screen shake, combo popups and drag trails — full juice at 60fps.

**Architecture:** All game logic is untouched. Visual changes live in `js/renderer.js` (canvas drawing, effects) and `css/style.css` + `index.html` (theme). Renderer gets new internal state: `shake`, `popups`, `orbs`, background time accumulator. Effects are triggered by the existing frame-diffing in `updateEffects`/`updateClearing`, plus score-delta tracking. The `render(state)` signature is unchanged.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, CSS. Tests: `node --test` (unit), Playwright (e2e). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-01-candy-pop-graphics-design.md`

---

### Task 1: Candy Palette + Animated Background + Bokeh Orbs

**Files:**
- Modify: `js/shapes.js:1` (COLORS)
- Modify: `js/renderer.js:35-44` (orbs setup), `js/renderer.js:404-410` (background in render)

- [ ] **Step 1: Brighten the palette**

In `js/shapes.js`, replace line 1:

```js
export const COLORS = ['#ff2e63', '#00b8ff', '#ffc800', '#00e08c', '#a855f7', '#ff7a00'];
```

Unit test `js/shapes.test.js:22` only asserts 6-digit hex + >= 5 colors, so this stays green.

- [ ] **Step 2: Add orbs setup inside `createRenderer`**

In `js/renderer.js`, after the `twinkles` setup (after line 44), add:

```js
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
```

- [ ] **Step 3: Add `drawBackground` function**

In `js/renderer.js`, add this function just before `render`:

```js
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
```

(`${o.color}59` = hex with ~35% alpha, works because ORB_COLORS are 6-digit hex.)

- [ ] **Step 4: Replace the static background in `render`**

In `js/renderer.js` inside `render`, replace the old gradient block:

```js
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#12263f');
    bg.addColorStop(1, '#0b1830');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawTwinkles();
```

with:

```js
    drawBackground(now);
    drawTwinkles();
```

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: all unit tests PASS.

Run: `npx playwright test`
Expected: all e2e tests PASS (they assert game state, not pixels).

Visual smoke: in a second terminal run `python3 -m http.server 4173 --bind 127.0.0.1`, open `http://127.0.0.1:4173` in a browser. Expected: bright animated gradient background, drifting pastel orbs, old dark navy gone.

- [ ] **Step 6: Commit**

```bash
git add js/shapes.js js/renderer.js
git commit -m "feat: candy palette and animated background with bokeh orbs"
```

---

### Task 2: Glossy 3D Candy Blocks

**Files:**
- Modify: `js/renderer.js:19-23` (add `shade` helper), `js/renderer.js:103-141` (drawPieceCell)

- [ ] **Step 1: Add `shade` helper**

After the `lighten` function (line 23), add:

```js
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v * (1 - f));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}
```

- [ ] **Step 2: Replace `drawPieceCell`**

Replace the whole `drawPieceCell` function (lines 103-141) with:

```js
  function drawPieceCell(x, y, size, color, alpha = 1, style = 'flat') {
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = Math.max(3, size * 0.18);
    const shadowY = style === 'drag' ? Math.max(2, size * 0.14) : Math.max(1, size * 0.09);
    const shadowA = style === 'drag' ? 0.35 : 0.22;
    if (style !== 'flat') {
      ctx.globalAlpha = alpha * shadowA;
      ctx.beginPath();
      ctx.roundRect(x, y + shadowY, size, size, r);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    if (style === 'raised') {
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.roundRect(x - 1.5, y - 1.5, size + 3, size + 3, r + 1.5);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, r);
    const grad = ctx.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, lighten(color, 0.45));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, 0.22));
    ctx.fillStyle = grad;
    ctx.fill();
    const side = ctx.createLinearGradient(x, y, x + size * 0.35, y);
    side.addColorStop(0, 'rgba(255,255,255,0.35)');
    side.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, size * 0.35, size - 2, r);
    ctx.fillStyle = side;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.roundRect(x + size * 0.15, y + size * 0.1, size * 0.7, Math.max(2, size * 0.1), 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.roundRect(x + size * 0.06, y + size * 0.72, size * 0.88, size * 0.26, 2);
    ctx.fill();
    ctx.restore();
  }
```

- [ ] **Step 3: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS.

Visual smoke: blocks on the board and in the tray now look glossy — bright top, rich base, darker bottom bevel, left-side light bevel, white specular bar, colored glow rim around placed cells.

- [ ] **Step 4: Commit**

```bash
git add js/renderer.js
git commit -m "feat: glossy 3D candy blocks with bevels and glow rim"
```

---

### Task 3: Empty-Cell Dot Grid + Frosted Glass Board Panel + Tray Polish

**Files:**
- Modify: `js/renderer.js:143-156` (drawEmptyCell), `js/renderer.js:158-171` (drawBoardPanel), `js/renderer.js:253-256` (tray slot fill)

- [ ] **Step 1: Replace `drawEmptyCell`**

Replace the whole `drawEmptyCell` function with:

```js
  function drawEmptyCell(px, py) {
    const size = layout.cell;
    ctx.beginPath();
    ctx.roundRect(px, py, size, size, Math.max(3, size * 0.14));
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    ctx.fillStyle = 'rgba(120,140,180,0.18)';
    const step = Math.max(3, Math.floor(size / 3));
    for (let dx = step / 2; dx < size; dx += step) {
      for (let dy = step / 2; dy < size; dy += step) {
        ctx.beginPath();
        ctx.arc(px + dx, py + dy, Math.max(1, size * 0.02), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
```

- [ ] **Step 2: Replace `drawBoardPanel`**

Replace the whole `drawBoardPanel` function with:

```js
  function drawBoardPanel() {
    const p = 5;
    const bx = layout.boardX - p;
    const by = layout.boardY - p;
    const bs = layout.cell * SIZE + p * 2;
    ctx.save();
    ctx.shadowColor = 'rgba(30,64,120,0.28)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    ctx.beginPath();
    ctx.roundRect(bx, by, bs, bs, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(bx, by, bs, bs, 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
```

- [ ] **Step 3: Polish tray slots for the light theme**

In `drawTray`, replace the slot fill line:

```js
      ctx.fillStyle = p.used ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)';
```

with:

```js
      ctx.fillStyle = p.used ? 'rgba(30,58,110,0.05)' : 'rgba(30,58,110,0.08)';
```

- [ ] **Step 4: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS.

Visual smoke: board sits on a frosted white glass panel with soft shadow; empty cells are faint white tiles with a subtle dot grid; tray slots are barely-tinted.

- [ ] **Step 5: Commit**

```bash
git add js/renderer.js
git commit -m "feat: frosted glass board panel, dot-grid empty cells, tray polish"
```

---

### Task 4: Colored Squash-and-Stretch Landing Pops

**Files:**
- Modify: `js/renderer.js:298-300` (spawnPop), `js/renderer.js:302-312` (updateEffects call site), `js/renderer.js:370-383` (drawPops)

- [ ] **Step 1: Give `spawnPop` a color**

Replace:

```js
  function spawnPop(x, y) {
    pops.push({ x, y, start: performance.now(), duration: POP_DURATION });
  }
```

with:

```js
  function spawnPop(x, y, color) {
    pops.push({ x, y, color: color || '#ffffff', start: performance.now(), duration: POP_DURATION });
  }
```

- [ ] **Step 2: Pass the block color at the call site**

In `updateEffects`, replace:

```js
            spawnPop(x, y);
```

with:

```js
            spawnPop(x, y, board[r][c]);
```

- [ ] **Step 3: Replace `drawPops` with a squash version**

Replace the whole `drawPops` function with:

```js
  function drawPops() {
    for (const pop of pops) {
      const t = (performance.now() - pop.start) / pop.duration;
      const sx = 1 + 0.3 * (1 - t);
      const sy = 1 + 0.42 * (1 - t);
      const size = layout.cell;
      ctx.save();
      ctx.globalAlpha = (1 - t * 0.75) * 0.9;
      ctx.translate(pop.x, pop.y);
      ctx.scale(sx, sy);
      ctx.beginPath();
      ctx.roundRect(-size / 2, -size / 2, size, size, Math.max(3, size * 0.18));
      ctx.fillStyle = pop.color;
      ctx.fill();
      ctx.globalAlpha = (1 - t * 0.75) * 0.32;
      ctx.beginPath();
      ctx.roundRect(-size * 0.65, -size * 0.65, size * 1.3, size * 1.3, Math.max(3, size * 0.22));
      ctx.fill();
      ctx.restore();
    }
  }
```

- [ ] **Step 4: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS.

Visual smoke: placing a piece makes each cell pop with a colored squash-and-stretch pulse (wide then tall) and a soft halo ring.

- [ ] **Step 5: Commit**

```bash
git add js/renderer.js
git commit -m "feat: colored squash-and-stretch landing pops"
```

---

### Task 5: Screen Shake, Confetti Bursts, Score Popups, Combo Text

**Files:**
- Modify: `js/renderer.js` (state vars, spawnPopup/drawPopups, updateClearing, render)

- [ ] **Step 1: Add state variables**

In `createRenderer`, next to `let lastNow = performance.now();`, add:

```js
  let shake = 0;
  let popups = [];
  let lastScore = 0;
```

- [ ] **Step 2: Add popup helpers**

After `spawnPop`, add:

```js
  function spawnPopup(x, y, text, color, size = 22) {
    popups.push({ x, y, text, color, size, born: performance.now(), life: 900 });
  }

  function drawPopups() {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i];
      const t = (performance.now() - p.born) / p.life;
      if (t >= 1) {
        popups.splice(i, 1);
        continue;
      }
      const rise = t * 40;
      const alpha = 1 - t * t;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${p.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText(p.text, p.x, p.y - rise);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - rise);
      ctx.restore();
    }
  }
```

- [ ] **Step 3: Upgrade `updateClearing`**

Replace the whole `updateClearing` function with:

```js
  function updateClearing(state) {
    if (state.clearing && !lastClearing) {
      const lines = state.clearing.lines.rows.length + state.clearing.lines.cols.length;
      const cells = state.clearing.cells;
      for (const { row, col } of cells) {
        const { x, y } = cellCenter(row, col);
        spawnParticles(x, y, null, lines >= 2 ? 8 : 5);
      }
      const cx = cells.reduce((s, c) => s + cellCenter(c.row, c.col).x, 0) / cells.length;
      const cy = cells.reduce((s, c) => s + cellCenter(c.row, c.col).y, 0) / cells.length;
      const gained = state.score - lastScore;
      if (gained > 0) spawnPopup(cx, cy, `+${gained}`, '#ff2e63', 22);
      if (lines >= 2) {
        spawnPopup(cx, cy - layout.cell * 1.5, `COMBO ×${lines}`, '#ff7a00', 26);
        shake = Math.min(16, 6 + lines * 4);
      } else {
        shake = Math.min(10, 4 + lines * 2);
      }
    }
    lastClearing = Boolean(state.clearing);
  }
```

- [ ] **Step 4: Apply shake in `render`**

In `render`, after `ctx.setTransform(dpr, 0, 0, dpr, 0, 0);`, add:

```js
    if (shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
```

In `render`, just before `updateEffects(state.board, now);` add the draw call:

```js
    drawPopups();
```

After `stepParticles(dt);` add the decay + score tracking:

```js
    shake = Math.max(0, shake * (1 - 8 * dt));
    lastScore = state.score;
```

- [ ] **Step 5: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS.

Visual smoke: clearing a line shakes the screen, fires confetti bursts along the cleared cells, floats a pink "+N" popup at the clear centroid. Clearing 2+ lines adds a bigger shake and an orange "COMBO ×N" text above the clear. Restarting (Play Again) does not leave stray popups (popups are pruned after 900ms).

- [ ] **Step 6: Commit**

```bash
git add js/renderer.js
git commit -m "feat: screen shake, confetti bursts, score popups, combo text"
```

---

### Task 6: Drag Glow + Sparkle Trail

**Files:**
- Modify: `js/renderer.js:236-239` (tint glow in drawDrag), `js/renderer.js:302-327` (trail in updateEffects)

- [ ] **Step 1: Glow behind valid/invalid placement cells**

In `drawDrag`, replace:

```js
        if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE) {
          ctx.beginPath();
          ctx.roundRect(px, py, cell, cell, 3);
          ctx.fillStyle = tint;
          ctx.fill();
          drawPieceCell(px, py, cell, piece.color, valid ? 0.75 : 0.85, 'drag');
```

with:

```js
        if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE) {
          ctx.save();
          ctx.shadowColor = tint;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.roundRect(px, py, cell, cell, 3);
          ctx.fillStyle = tint;
          ctx.fill();
          ctx.restore();
          drawPieceCell(px, py, cell, piece.color, valid ? 0.75 : 0.85, 'drag');
```

- [ ] **Step 2: Add sparkle trail while dragging**

Replace the whole `updateEffects` function with:

```js
  function updateEffects(state, now) {
    const board = state.board;
    if (lastBoard) {
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (lastBoard[r][c] === null && board[r][c] !== null) {
            const { x, y } = cellCenter(r, c);
            spawnPop(x, y, board[r][c]);
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
    if (state.drag && now - lastTrail > 45) {
      lastTrail = now;
      const rect = canvas.getBoundingClientRect();
      spawnParticles(
        state.drag.x - rect.left + (Math.random() - 0.5) * 24,
        state.drag.y - rect.top + (Math.random() - 0.5) * 24,
        null,
        1
      );
    }
  }
```

(Note: `state.drag.x/y` are viewport client coordinates — must convert to canvas space via `canvas.getBoundingClientRect()`, same as `getCellAt`/`drawDrag` do. `canvas` is the factory parameter, in scope.)

- [ ] **Step 3: Fix the call site + add `lastTrail` var**

In `createRenderer`, add `let lastTrail = 0;` next to `lastScore`.

In `render`, replace:

```js
    updateEffects(state.board, now);
```

with:

```js
    updateEffects(state, now);
```

- [ ] **Step 4: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS.

Visual smoke: dragging a piece leaves a subtle sparkle trail at the pointer; the placement ghost cells now glow green when valid, red when invalid.

- [ ] **Step 5: Commit**

```bash
git add js/renderer.js
git commit -m "feat: drag glow tints and sparkle trail"
```

---

### Task 7: Candy Theme CSS (HUD, Overlay, Background)

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Body background**

Replace the `body` background rule (line 5) with:

```css
  background: linear-gradient(160deg, #9ec9ff, #d4c8ff 55%, #ffd6e8);
```

- [ ] **Step 2: HUD restyle**

Replace the `.score-label` and `.score-value` rules with:

```css
.score-label { color: rgba(30,58,110,0.55); font-size: 12px; letter-spacing: 3px; }
.score-value {
  display: inline-block;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  background: linear-gradient(180deg, #ff2e63, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 rgba(255,255,255,0.6));
}
```

- [ ] **Step 3: Mute button, online text, copyright**

Replace `.mute-btn`, `.online`, `.copyright` color rules:

```css
.mute-btn {
  background: rgba(255,255,255,0.55);
  border: 1px solid rgba(255,255,255,0.85);
}
.online { color: rgba(30,58,110,0.6); }
.copyright { color: rgba(30,58,110,0.45); }
```

(Keep the existing position/font-size/letter-spacing lines on those selectors — only change the listed declarations. `.mute-btn:active` and `.online::before` rules stay as-is.)

- [ ] **Step 4: Game-over overlay**

Replace `.overlay`, `.overlay-card`, `.overlay-card h1`, `.final-score`, `#play-again` rules with:

```css
.overlay {
  position: fixed; inset: 0; z-index: 10;
  display: flex; align-items: center; justify-content: center;
  background: rgba(45, 55, 95, 0.35);
  backdrop-filter: blur(6px);
}
.overlay.hidden { display: none; }
.overlay-card {
  background: linear-gradient(170deg, #ffffff, #f3ecff);
  border: 1px solid rgba(255,255,255,0.9);
  border-radius: 20px;
  padding: 28px 44px;
  text-align: center;
  color: #2b2b4f;
  box-shadow: 0 18px 50px rgba(80, 60, 160, 0.35);
}
.overlay-card h1 {
  font-size: 26px;
  letter-spacing: 4px;
  background: linear-gradient(180deg, #ff2e63, #a855f7);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.final-score { font-size: 42px; font-weight: 700; margin: 10px 0 20px; color: #2b2b4f; }
#play-again {
  background: linear-gradient(180deg, #ff5b8a, #ff2e63);
  border: none;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 1px;
  padding: 12px 30px;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(255,46,99,0.4);
}
```

- [ ] **Step 5: Verify**

Run: `npm test` → all PASS. Run: `npx playwright test` → all PASS. `e2e/gameover.spec.js` relies on `.overlay.hidden` toggling — the class name is unchanged.

Visual smoke: page background matches the canvas theme; score is gradient pink→purple with white pop animation retained; game-over card is a light candy card with gradient title and pink glow button.

- [ ] **Step 6: Commit**

```bash
git add css/style.css
git commit -m "feat: candy theme CSS for HUD, overlay, background"
```

---

### Task 8: Final Verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all unit tests PASS.

Run: `npx playwright test`
Expected: all e2e tests PASS on both desktop-chromium and mobile-chrome.

- [ ] **Step 2: Visual pass**

Serve: `python3 -m http.server 4173 --bind 127.0.0.1`, open `http://127.0.0.1:4173` (desktop + device emulation) and play one full game. Verify:

1. Animated pastel gradient background with drifting orbs — no flicker, smooth 60fps
2. Glossy candy blocks with bevels, specular bar, glow rim
3. Frosted glass board panel, dot-grid empty cells
4. Landing: colored squash pop per cell
5. Clearing: confetti + screen shake + "+N" popup; 2+ lines → COMBO text
6. Dragging: sparkle trail + green/red glowing ghost
7. Score gradient text pops on change; mute button works
8. Game over: light candy card, Play Again restarts cleanly
9. No console errors

- [ ] **Step 3: Confirm commit history**

Run: `git log --oneline -7`
Expected: 7 commits — design doc + one commit per task, all on master.

---

## Self-Review Notes

- **Spec coverage:** palette ✓ (T1), animated bg + bokeh ✓ (T1), glossy blocks ✓ (T2), panel + dot grid ✓ (T3), landing squash ✓ (T4), clear confetti + shake + popups + combo ✓ (T5), drag glow/trail ✓ (T6), HUD/overlay ✓ (T7), 60fps caps kept ✓ (particle cap untouched).
- **Consistency:** `updateEffects(state, now)` signature changed in T6 — the only cross-task signature change, and its call site is updated in the same task. `spawnPopup`/`drawPopups` defined in T5, used only there. `lastTrail` declared in T6, used in T6. No other task references later-task names.
- **No placeholders:** every step contains full code and exact verification commands.
