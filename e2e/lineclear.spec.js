import { test, expect } from '@playwright/test';
import { openGame, state, setTray, pointForCell, dragPiece } from './helpers.js';

test('completing a row clears it and awards the line bonus', async ({ page }) => {
  await openGame(page);
  await setTray(page, [
    { shape: [[1, 1, 1]] },
    { shape: [[1, 1, 1]] },
    { shape: [[1, 1]] },
  ]);
  await dragPiece(page, 0, await pointForCell(page, { row: 0, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 0, col: 3 }));
  await dragPiece(page, 2, await pointForCell(page, { row: 0, col: 6 }));
  await expect
    .poll(async () => (await state(page)).board[0].every((c) => c === null))
    .toBe(true);
  const s = await state(page);
  expect(s.score).toBe(18); // 8 cells + 10 line bonus
});
