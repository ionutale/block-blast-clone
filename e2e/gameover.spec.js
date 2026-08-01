import { test, expect } from '@playwright/test';
import { openGame, state, setBoard, setTray, pointForCell, dragPiece } from './helpers.js';

test('game over overlay appears when no piece fits and play again resets', async ({ page }) => {
  await openGame(page);
  // Rows 1-7 are nearly full (max empty run of 4, so no 5-wide piece fits), with
  // at least one hole in every of cols 0-4. This keeps the placement from
  // completing any line (full pre-filled rows would otherwise complete columns
  // and award a huge line bonus), while still making the 5-wide pieces unplaceable.
  const holes = [
    [0, 3], [1, 3], [2, 3], [0, 4], [1, 4], [2, 4], [3],
  ];
  const board = Array.from({ length: 8 }, () => Array(8).fill('#888888'));
  board[0] = Array(8).fill(null);
  for (let r = 1; r <= 7; r++) {
    for (const c of holes[r - 1]) board[r][c] = null;
  }
  await setBoard(page, board);
  await setTray(page, [
    { shape: [[1, 1, 1, 1, 1]] },
    { shape: [[1, 1, 1, 1, 1]] },
    { shape: [[1, 1, 1, 1, 1]] },
  ]);
  await dragPiece(page, 0, await pointForCell(page, { row: 0, col: 0 }));
  await expect(page.locator('#game-over')).toBeVisible();
  await expect(page.locator('#final-score')).toHaveText('5');
  await page.getByRole('button', { name: 'PLAY AGAIN' }).click();
  await expect(page.locator('#game-over')).toBeHidden();
  await expect(page.locator('#score')).toHaveText('0');
  const s = await state(page);
  expect(s.board.every((r) => r.every((c) => c === null))).toBe(true);
  expect(s.gameOver).toBe(false);
});
