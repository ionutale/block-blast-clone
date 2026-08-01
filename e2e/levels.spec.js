import { test, expect } from '@playwright/test';
import { openGame, state, setTray, setBoard, pointForCell, dragPiece } from './helpers.js';

test('level grid shows level 1 unlocked and 19 locked', async ({ page }) => {
  await page.goto('/?test=1#/levels');
  await expect(page.locator('.level-tile')).toHaveCount(20);
  await expect(page.locator('.level-tile--locked')).toHaveCount(19);
  const first = page.locator('.level-tile').first();
  await expect(first).toContainText('1');
  await expect(first).toContainText('☆');
});

test('completing level 1 unlocks level 2 and persists stars', async ({ page }) => {
  await openGame(page);
  await page.goto('/?test=1#/level/1');
  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#moves-left')).toHaveText('MOVES: 8');

  await setBoard(page, Array.from({ length: 8 }, () => Array(8).fill(null)));
  await setTray(page, [
    { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
    { shape: [[1, 1, 1]], color: '#00b8ff' },
    { shape: [[1, 1, 1]], color: '#ffc800' },
  ]);
  // Fill row 7: 5-piece at cols 0-4, 3-piece at cols 5-7 -> one line
  await dragPiece(page, 0, await pointForCell(page, { row: 7, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 7, col: 5 }));
  await expect.poll(async () => (await state(page)).board[7].every((c) => c === null)).toBe(true);

  // Fill row 6 the same way -> second line -> level complete
  await setTray(page, [
    { shape: [[1, 1, 1, 1, 1]], color: '#ff2e63' },
    { shape: [[1, 1, 1]], color: '#00b8ff' },
    { shape: [[1, 1, 1]], color: '#ffc800' },
  ]);
  await dragPiece(page, 0, await pointForCell(page, { row: 6, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 6, col: 5 }));

  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#game-over h1')).toHaveText('LEVEL COMPLETE');
  await expect(page.locator('#final-score')).toContainText('★');

  await page.goto('/?test=1#/levels');
  await expect(page.locator('.level-tile--locked')).toHaveCount(18);
  await expect(page.locator('.level-tile').nth(1)).not.toHaveClass(/locked/);
});
