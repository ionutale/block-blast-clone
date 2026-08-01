import { test, expect } from '@playwright/test';
import { openGame, state, setTray, pointForCell, dragPiece } from './helpers.js';

test('page loads with an empty board, score 0 and hidden overlay', async ({ page }) => {
  await openGame(page);
  await expect(page.locator('#game-over')).toBeHidden();
  const s = await state(page);
  expect(s.board.every((r) => r.every((c) => c === null))).toBe(true);
  expect(s.gameOver).toBe(false);
  expect(s.tray.pieces).toHaveLength(3);
  expect(s.tray.pieces.every((p) => !p.used)).toBe(true);
});

test('valid placement increases score and fills cells', async ({ page }) => {
  await openGame(page);
  const before = await state(page);
  await dragPiece(page, 0, await pointForCell(page, { row: 0, col: 0 }));
  const after = await state(page);
  expect(after.score).toBeGreaterThan(before.score);
  expect(after.board.flat().filter((c) => c !== null).length).toBeGreaterThan(0);
});

test('drop outside the board returns the piece', async ({ page }) => {
  await openGame(page);
  const before = await state(page);
  const box = await page.locator('#board').boundingBox();
  await dragPiece(page, 0, { x: box.x + box.width / 2, y: box.y + box.height + 100 });
  const after = await state(page);
  expect(after.score).toBe(before.score);
  expect(after.tray.pieces[0].used).toBe(false);
});

test('drop on occupied cells returns the piece', async ({ page }) => {
  await openGame(page);
  await setTray(page, [
    { shape: [[1], [1]] },
    { shape: [[1], [1]] },
    { shape: [[1]] },
  ]);
  const target = await pointForCell(page, { row: 0, col: 0 });
  await dragPiece(page, 0, target);
  const mid = await state(page);
  await dragPiece(page, 1, target);
  const after = await state(page);
  expect(after.score).toBe(mid.score);
  expect(after.tray.pieces[1].used).toBe(false);
});

test('no debug bridge without ?test=1', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => '__blockBlast' in window)).toBe(false);
});
