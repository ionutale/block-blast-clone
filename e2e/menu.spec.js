import { test, expect } from '@playwright/test';

test('menu shows title and four buttons', async ({ page }) => {
  await page.goto('/?test=1');
  await expect(page.locator('.menu-title')).toHaveText('BLOCK BLAST');
  await expect(page.locator('#btn-play')).toBeVisible();
  await expect(page.locator('#btn-levels')).toBeVisible();
  await expect(page.locator('#btn-settings')).toBeVisible();
  await expect(page.locator('#btn-leaderboard')).toBeVisible();
});

test('buttons navigate to their screens', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('#btn-levels');
  await expect(page.locator('#screen-levels')).toBeVisible();
  await page.click('[data-back]');
  await expect(page.locator('#screen-menu')).toBeVisible();
  await page.click('#btn-settings');
  await expect(page.locator('#screen-settings')).toBeVisible();
  await page.click('#screen-settings [data-back]');
  await page.click('#btn-leaderboard');
  await expect(page.locator('#screen-leaderboard')).toBeVisible();
});

test('PLAY routes to the game screen', async ({ page }) => {
  await page.goto('/?test=1');
  await page.click('#btn-play');
  await expect(page.locator('#screen-game')).toBeVisible();
  await expect(page.locator('#board')).toBeVisible();
});
