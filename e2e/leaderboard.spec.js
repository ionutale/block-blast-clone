import { test, expect } from '@playwright/test';
import { setBoard, setTray, pointForCell, dragPiece } from './helpers.js';

test('leaderboard renders entries from the API', async ({ page }) => {
  await page.route('**/api/leaderboard?mode=endless', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [{ name: 'Abi', score: 1000 }, { name: 'Ion', score: 500 }] }),
    })
  );
  await page.goto('/?test=1#/leaderboard');
  await expect(page.locator('.lb-list li')).toHaveCount(2);
  await expect(page.locator('.lb-list li').first()).toContainText('Abi');
  await expect(page.locator('.lb-list li').first()).toContainText('1000');
});

test('leaderboard shows offline state when the API is unreachable', async ({ page }) => {
  await page.route('**/api/leaderboard?mode=*', (route) => route.abort());
  await page.goto('/?test=1#/leaderboard');
  await expect(page.locator('#lb-status')).toHaveText('Offline — leaderboard unavailable');
});

test('submit posts to the API and shows the rank', async ({ page }) => {
  let posted = null;
  await page.route('**/api/leaderboard?mode=*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) })
  );
  await page.route('**/api/leaderboard', (route) => {
    posted = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rank: 3, entries: [] }) });
  });
  await page.goto('/?test=1#/play');
  // Force a deterministic game over via the debug bridge: rows 1-7 have a max
  // empty run of 4 (no 5-wide piece fits), with holes in cols 0-4 so no line
  // completes. After the single placement, the two remaining 5-wide pieces
  // cannot fit anywhere -> game over fires.
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
  await page.fill('#lb-name', 'Abi');
  await page.click('#lb-submit');
  await expect(page.locator('#lb-result')).toContainText('Rank #3');
  expect(posted).toEqual({ name: 'Abi', score: expect.any(Number), mode: 'endless' });
});
