import { test, expect } from '@playwright/test';
import { openGame, state, setTray, pointForCell, dragPiece } from './helpers.js';

test('a new set of pieces is dealt after all three are used', async ({ page }) => {
  await openGame(page);
  await setTray(page, [
    { shape: [[1]] },
    { shape: [[1]] },
    { shape: [[1]] },
  ]);
  await dragPiece(page, 0, await pointForCell(page, { row: 0, col: 0 }));
  await dragPiece(page, 1, await pointForCell(page, { row: 0, col: 1 }));
  await dragPiece(page, 2, await pointForCell(page, { row: 0, col: 2 }));
  const s = await state(page);
  expect(s.tray.pieces.every((p) => !p.used)).toBe(true);
  expect(s.tray.pieces.map((p) => p.id).some((id) => id.startsWith('test-'))).toBe(false);
});
