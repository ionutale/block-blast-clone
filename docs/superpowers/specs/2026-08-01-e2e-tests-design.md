# Block Blast — Playwright E2E Test Suite Design

**Data:** 2026-08-01
**Status:** Aprobat de utilizator

## Scop

Suită completă de teste end-to-end cu Playwright pentru jocul Block Blast: încărcare pagină, drag & drop real, plasare validă/invalidă, ștergere linii, reîmprospătare tray, game over și restart. Testele interacționează cu UI-ul real (pointer events) și asertează pe DOM + stare.

## Decizii cheie

- **Bridge de test `?test=1`:** `main.js` expune `window.__blockBlast` DOAR când pagina e deschisă cu `?test=1` în URL. În mod normal nimic nu e expus. Bridge-ul oferă: `getState()` (board, tray, score, gameOver, layout), `setTray(pieces)`, `setBoard(matrix)` — necesare pentru determinism (piese cunoscute, game over forțat) și pentru geometrie (coordonatele drag-urilor).
- **Flow-ul e mereu real:** piesele se mută cu drag & drop simulat (mouse pointer events — aceeași cale de cod ca touch, pentru că `input.js` folosește Pointer Events unificate).
- **Aserțiuni pe DOM + stare:** scorul din `#score`, overlay-ul `#game-over`, starea din `getState()`. Fără screenshot diffing (animațiile canvas ar fi flaky).
- **Server:** `python3 -m http.server 4173` (port 8000 e ocupat pe mașina de dezvoltare), gestionat automat de Playwright (`webServer` în config).

## Modificări de cod

| Fișier | Modificare |
|---|---|
| `js/game.js` | `createGame(canvas, { onScore, onGameOver, debug })` — cu `debug: true` returnează `debug: { getState, setTray, setBoard }`; altfel `debug` rămâne `undefined` |
| `js/renderer.js` | Expune `getLayout()` (copie a layout-ului: cell, boardX, boardY, trayY) |
| `js/main.js` | Dacă URL are `?test=1` → `window.__blockBlast = game.debug` |
| `package.json` | devDependency `@playwright/test`; script `test:e2e` |
| `playwright.config.js` | testDir `e2e/`, webServer 4173, proiecte: desktop Chromium + mobil (Pixel 5, hasTouch) |
| `e2e/helpers.js` | `openGame`, `state`, `setTray`, `setBoard`, `pointForCell`, `traySlotPoint`, `dragPiece` |
| `e2e/core.spec.js`, `e2e/lineclear.spec.js`, `e2e/gameover.spec.js`, `e2e/tray.spec.js` | Testele |
| `.gitignore` | `node_modules/`, `test-results/`, `playwright-report/` |

## Teste

**core.spec.js**
1. Pagina se încarcă: `#score` = 0, overlay ascuns, board gol (toate celulele null), 3 piese în tray.
2. Plasare validă: drag din slot 0 pe celula (0,0) → scor crește, ≥1 celulă ocupată.
3. Drop în afara tablei (sub canvas) → scor neschimbat, piesa rămâne nefolosită.
4. Drop peste celule ocupate: `setTray` cu piese cunoscute (2 verticale identice), prima plasată la (0,0), a doua la (0,0) → invalidă → scor neschimbat, piesa nefolosită.

**lineclear.spec.js**
- `setTray` cu linii orizontale de lățimi 3+3+2; plasări reale la (0,0), (0,3), (0,6) → rândul 0 se șterge exact (8 celule; 3+3+2=8 — trei piese ×3 ar depăși tabla: 9>8) — poll până când `getState().board[0]` e gol (animația durează 260ms), scor = 8 celule + 10 bonus = 18.

**gameover.spec.js**
- `setBoard`: rândurile 1–7 cu un pattern de găuri (nicio secvență orizontală de 5 libere, fiecare coloană 0–4 cu ≥1 gaură — astfel încât nicio linie să se completeze la plasare). `setTray`: trei linii ×5 orizontale. Plasare reală la (0,0) → 5 celule, zero linii completate; liniile ×5 rămase nu mai încap nicăieri → overlay GAME OVER vizibil, scor final 5. Click PLAY AGAIN → overlay ascuns, scor 0, board resetat, `gameOver: false`.
  - Notă: varianta „rândurile 1–7 pline" din planul inițial e imposibilă — plasarea în rândul 0 ar completa 5 coloane și ar șterge linii, prevenind game over-ul.

**tray.spec.js**
- `setTray` cu trei pătrățele; plasări reale la (0,0), (0,1), (0,2) → după a treia, `getState().tray` are piese noi (id-uri diferite de `test-*`, toate `used: false`).

## Rulare

- `npm run test:e2e` (rulează automat serverul; require instalare: `npm i -D @playwright/test` + `npx playwright install chromium`)
- Proiectele: desktop Chromium + mobil Pixel 5 (același cod de input, verifică layout-ul responsive)

## Non-scope

- Screenshot diffing / snapshot-uri vizuale
- Rotație, sunete, combo-uri (nu există în joc)
- Teste E2E pentru logică pură (acoperită de `node --test`)
