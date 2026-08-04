import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { setBoard, setTray, pointForCell, traySlotPoint, dragPiece } from './e2e/helpers.js';

mkdirSync('screenshots', { recursive: true });
const SHOT = 'screenshots';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.route('**/api/leaderboard?mode=*', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      entries: [
        { name: 'ion', score: 378 },
        { name: 'CandyKing', score: 305 },
        { name: 'Abi', score: 284 },
        { name: 'BlockMaster', score: 210 },
        { name: 'PuzzlerX', score: 156 },
      ],
    }),
  })
);

await page.goto('http://127.0.0.1:4173/?test=1');
await page.waitForTimeout(600);

// 1. Main menu
await page.screenshot({ path: `${SHOT}/01-menu.png` });
console.log('01-menu');

// Complete level 1 first so the levels grid shows stars + an unlock
await page.goto('http://127.0.0.1:4173/?test=1#/level/1');
await page.waitForTimeout(500);
await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
await page.waitForTimeout(500);
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 6, col: 0 }));
await dragPiece(page, 1, await pointForCell(page, { row: 6, col: 5 }));
await page.waitForTimeout(500);

// 2. Level select (with stars + unlock)
await page.goto('http://127.0.0.1:4173/?test=1#/levels');
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/02-levels.png` });
console.log('02-levels');

// 3. Settings
await page.goto('http://127.0.0.1:4173/?test=1#/settings');
await page.waitForTimeout(400);
await page.fill('#setting-name', 'CandyKing');
await page.locator('#setting-name').dispatchEvent('change');
await page.screenshot({ path: `${SHOT}/03-settings.png` });
console.log('03-settings');

// 4. Leaderboard (mocked entries)
await page.goto('http://127.0.0.1:4173/?test=1#/leaderboard');
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOT}/04-leaderboard.png` });
console.log('04-leaderboard');

// 5. Endless gameplay with placed pieces
await page.goto('http://127.0.0.1:4173/?test=1#/play');
await page.waitForTimeout(400);
await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
await setBoard(page, (() => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 6; r <= 7; r++) for (let c = 0; c < 8; c++) b[r][c] = '#ff2e63';
  b[0][0] = '#00b8ff'; b[0][1] = '#ffc800'; b[0][2] = '#00e08c';
  b[1][0] = '#a855f7'; b[1][1] = '#ff7a00';
  b[3][3] = '#ff2e63'; b[3][4] = '#00b8ff';
  return b;
})());
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOT}/05-endless.png` });
console.log('05-endless');

// 6. Mid-drag with ghost preview
const from = await traySlotPoint(page, 2);
const to = await pointForCell(page, { row: 5, col: 0 });
await page.mouse.move(from.x, from.y);
await page.mouse.down();
await page.mouse.move(to.x, to.y, { steps: 15 });
await page.waitForTimeout(200);
await page.screenshot({ path: `${SHOT}/06-drag.png` });
console.log('06-drag');
await page.mouse.up();

// 7. Challenge mode with HUD
await page.goto('http://127.0.0.1:4173/?test=1#/level/1');
await page.waitForTimeout(500);
await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/07-challenge.png` });
console.log('07-challenge');

// 8. Mid line-clear flash
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
await page.waitForTimeout(120);
await page.screenshot({ path: `${SHOT}/08-clear.png` });
console.log('08-clear');
await page.waitForTimeout(600);

// 9. Game over overlay
await page.goto('http://127.0.0.1:4173/?test=1#/play');
await page.waitForTimeout(400);
await setBoard(page, [
  ['#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63'],
  ['#00b8ff', '#00b8ff', '#ffc800', '#ffc800', '#a855f7', '#a855f7', '#00e08c', '#00e08c'],
  ['#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63'],
  ['#00b8ff', '#00b8ff', '#ffc800', '#ffc800', '#a855f7', '#a855f7', '#00e08c', '#00e08c'],
  ['#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63'],
  ['#00b8ff', '#00b8ff', '#ffc800', '#ffc800', '#a855f7', '#a855f7', '#00e08c', '#00e08c'],
  ['#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63', '#ff2e63'],
  ['#00b8ff', '#00b8ff', '#ffc800', '#ffc800', '#a855f7', '#a855f7', '#00e08c', '#00e08c'],
]);
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1, 1, 1]], color: '#ffc800' },
]);
const p0 = await pointForCell(page, { row: 1, col: 3 });
await dragPiece(page, 0, p0);
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/09-gameover.png` });
console.log('09-gameover');

// 10. Level complete overlay with stars (replay level 1 fully)
await page.goto('http://127.0.0.1:4173/?test=1#/level/1');
await page.waitForTimeout(500);
await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
await page.waitForTimeout(500);
await setTray(page, [
  { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
  { shape: [[1, 1, 1]], color: '#00b8ff' },
  { shape: [[1, 1, 1]], color: '#ffc800' },
]);
await dragPiece(page, 0, await pointForCell(page, { row: 6, col: 0 }));
await dragPiece(page, 1, await pointForCell(page, { row: 6, col: 5 }));
await page.waitForTimeout(400);
await page.screenshot({ path: `${SHOT}/10-level-complete.png` });
console.log('10-level-complete');

console.log('page errors:', errors.length ? errors : 'none');
await browser.close();
