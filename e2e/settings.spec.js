import { test, expect } from '@playwright/test';

test('player name persists across reloads', async ({ page }) => {
  await page.goto('/?test=1#/settings');
  await page.fill('#setting-name', 'Candy King');
  await page.locator('#setting-name').dispatchEvent('change');
  await page.reload();
  await page.goto('/?test=1#/settings');
  await expect(page.locator('#setting-name')).toHaveValue('Candy King');
});

test('reset progress wipes stored values', async ({ page }) => {
  await page.goto('/?test=1#/settings');
  await page.fill('#setting-name', 'Abi');
  await page.locator('#setting-name').dispatchEvent('change');
  page.on('dialog', (d) => d.accept());
  await page.click('#setting-reset');
  await expect(page.locator('#setting-name')).toHaveValue('');
});
