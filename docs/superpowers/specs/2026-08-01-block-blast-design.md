# Block Blast Clone — Design

**Data:** 2026-08-01
**Status:** Aprobat de utilizator

## Scop

Clonă web a jocului Block Blast: tablă 8×8, piese polimino cu drag & drop, ștergere de linii complete (rânduri și coloane), scor, game over. Fără sunete, fără rotație, fără salvarea scorului.

## Tehnologie

- Vanilla JavaScript + HTML5 Canvas, fără build step, fără dependențe
- Module ES (`<script type="module">`) — se deschide direct în browser (file:// sau static server)
- Suport desktop (mouse) + mobil (touch), prin Pointer Events unificate
- Testare logică pură cu `node --test` (runner built-in, fără framework)

## Reguli de gameplay

1. Tablă 8×8. În fiecare moment sunt 3 piese în tray (zona de jos).
2. Piesele au orientare fixă — nu se pot roti. Fiecare piesă are o culoare solidă din paletă.
3. Drag & drop pe tablă:
   - În timpul drag-ului, celulele țintă se evidențiază: **verde** = plasare validă, **roșu** = invalidă.
   - Eliberare în afara tablei sau pe poziție invalidă → piesa revine în tray.
   - Eliberare pe poziție validă → piesa se plasează.
4. După fiecare plasare se verifică rândurile și coloanele; liniile complete se șterg cu o animație scurtă de „pop".
5. Când toate cele 3 piese din tray sunt folosite, se generează un set nou de 3 (fără piese duplicate în același set).
6. **Game over:** când niciuna dintre piesele rămase nu poate fi plasată nicăieri → overlay cu scorul final și buton „Play again" (restart).

## Scor

- +1 punct per celulă plasată
- Ștergerea a *n* linii într-o singură plasare: **10 × triunghiular(n)** = 10n(n+1)/2
  - 1 linie = 10, 2 linii = 30, 3 linii = 60, 4 linii = 100

## Arhitectura

```
index.html          — canvas, afișaj scor, overlay game over
css/style.css       — stil vizual A (fundal albastru-închis, layout centrat, responsive)
js/shapes.js        — definiții forme polimino (orientare fixă, ca matrice) + paleta de culori
js/board.js         — model 8×8 (logică pură): plasare, validare, detectare linii, game-over
js/tray.js          — generare seturi de 3 piese aleatorii, fără duplicate în set
js/scoring.js       — calcul scor: celule + bonus linii (logică pură)
js/renderer.js      — desenare canvas: tablă, piese, preview verde/roșu, animație de ștergere
js/input.js         — pointer events (mouse + touch), gestionează drag-ul piesei
js/game.js          — orchestrator: stare (playing/game-over), flux plasare → ștergere → tray → restart
```

### Responsabilități pe modul

| Modul | Face | Nu face |
|---|---|---|
| `shapes.js` | Exportă lista de forme (matrice 0/1) și paleta de culori | Nu ține stare |
| `board.js` | Validare, plasare, detectare linii, verificare game over, deep-copy | Nu desenează |
| `tray.js` | Generează seturi de piese, urmărește care sunt folosite | Nu știe de tablă |
| `scoring.js` | Calculează puncte dintr-un rezultat de plasare | Nu ține scorul total (îl ține `game.js`) |

## Flux de date

```
input.js (drag) → board.js (validare) → renderer.js (preview)
release valid → board.js (plasare) → detectare linii → scoring.js → tray.js (mark folosit)
→ verificare game over → renderer.js (animație + redesenare) → posibil set nou de piese
```

## Randare

- Un singur `<canvas>`, scalat cu `devicePixelRatio`, responsive (tabla se potrivește pe orice ecran; ținte touch de minim 40px).
- Stil piesă: gradient vertical subtil, colțuri rotunjite, highlight intern luminos în partea de sus, umbră internă jos (stilul original).
- Celule goale: translucide, cu border discret.
- Overlay game over: semi-transparent + scor + buton „Play again".

## Testare

- `node --test js/` — teste pentru `board.js` și `scoring.js`:
  - plasare validă/invalidă (în afara tablei, peste piese existente)
  - detectare rând/coloană completă (inclusiv combinații)
  - verificare game over (piese care nu mai încap)
  - formule de scor (celule, 1/2/3/4 linii)

## Non-scope (explicit)

- Sunete, muzică
- Rotație piese
- Salvarea scorului maxim (localStorage)
- Ecran de start, niveluri, teme
- Combo-uri temporale / streak-uri (doar bonusul multi-linie de mai sus)

## Verificare finală

- Teste `node --test js/` verzi
- Testare manuală în browser: drag & drop mouse, touch (devtools), plasări invalide revin în tray, linii se șterg, game over apare corect, play again resetează totul
