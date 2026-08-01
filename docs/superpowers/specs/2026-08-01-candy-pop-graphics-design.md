# Candy Pop Graphics Overhaul — Design

Date: 2026-08-01
Status: Approved

## Goal

Make the Block Blast clone's graphics spectacular in the style of the real Block Blast: bright, glossy, candy-colored blocks with juicy feedback. Full juice: animated background, glow, confetti, screen shake, combo popups, drag trails. Must stay 60fps on mobile.

## Approach

Pure canvas upgrade in `js/renderer.js` + CSS tweaks (`css/style.css`, `index.html`). No new dependencies. Existing game logic, board/tray/scoring modules, and e2e tests are untouched. `renderer.render(state)` signature stays identical; the game already passes `{ board, tray, score, drag, clearing, gameOver }` and the renderer derives effects by diffing frames.

## Visual Design

### Palette & background
- Bright candy theme: soft animated vertical gradient (sky blue → lavender → peach) that slowly drifts over time.
- ~6 large blurred bokeh orbs floating slowly behind the board panel.
- Replace the current dark navy (`#12263f` → `#0b1830`) everywhere.

### Blocks (glossy 3D candy)
- Rounded cells with:
  - top specular highlight bar
  - darker bottom bevel edge (inner shadow)
  - soft drop shadow underneath
  - subtle glow rim on filled cells
- Vivid jewel palette: hot pink, cyan, amber, mint, violet, orange (reuse `COLORS` from `shapes.js`, adjusted to a brighter candy set).
- Empty cells: faint rounded rect + subtle dot grid pattern.

### Board panel
- Frosted glass light panel: translucent white with soft shadow, replacing the dark panel.

### Juice effects
- **Landing**: squash-and-stretch pop + sparkle burst at each newly placed cell (already partial — upgrade).
- **Line clear**: white flash (existing), confetti burst per cleared line, screen shake scaled by number of lines cleared, floating "+N" score popup.
- **Combo**: 2+ lines cleared → bigger shake + "COMBO xN" popup text.
- **Drag**: soft glow trail behind dragged piece; valid placement → green glow tint; invalid → red tint (existing, restyled).
- **Twinkles**: keep, restyled for bright theme.

### HUD / overlay
- Score: gradient text + glow, pop animation kept.
- Game-over card: candy-styled (bright card, vivid title, gradient play button), matching the new theme.
- Mute button and footer restyled to fit.

## Architecture

- All changes confined to:
  - `js/renderer.js` — new draw styles, background animation, shake, popups, confetti
  - `css/style.css` — theme colors, HUD/overlay restyle
  - `index.html` — overlay markup if needed (score popup lives in canvas, so likely no markup change)
- Renderer internal state additions:
  - `shake` (magnitude, decay) — applied as `ctx.translate` offset in render
  - `popups` — floating text list `{ x, y, text, color, born, life }`
  - background time accumulator for animated gradient / bokeh
- Particle system: reuse existing; upgrade `spawnParticles` to confetti-style (rects with rotation, gravity) — already rects with rotation, bump counts and colors for candy feel.
- Effects triggered by existing frame diffing in `updateEffects`/`updateClearing`, plus score delta tracking in `render` to spawn "+N" popups.

## Performance

- Cap particles at existing `MAX_PARTICLES` (500).
- Screen shake via ctx transform only (no layout thrash).
- Animated background is a single gradient + ~6 circles per frame — negligible.
- No DOM work per frame; popups drawn on canvas.

## Testing

- `npm test` (unit tests) must stay green.
- `npx playwright test` (e2e) must stay green — they assert on canvas element and game state via `window.__blockBlast`, not on pixel output.
- Visual smoke test in browser: place pieces, clear lines, verify shake/confetti/popups render without console errors.
