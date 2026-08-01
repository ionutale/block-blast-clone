import { expect } from '@playwright/test';

export async function openGame(page) {
  await page.goto('/?test=1#/play');
  await expect(page.locator('#score')).toHaveText('0');
}

export async function state(page) {
  return page.evaluate(() => window.__blockBlast.getState());
}

export async function setTray(page, pieces) {
  await page.evaluate((ps) => window.__blockBlast.setTray(ps), pieces);
}

export async function setBoard(page, board) {
  await page.evaluate((b) => window.__blockBlast.setBoard(b), board);
}

export async function pointForCell(page, { row, col }) {
  return page.evaluate(({ row, col }) => {
    const canvas = document.getElementById('board');
    const rect = canvas.getBoundingClientRect();
    const { cell, boardX, boardY } = window.__blockBlast.getState().layout;
    return {
      x: rect.left + boardX + (col + 0.5) * cell,
      y: rect.top + boardY + (row + 0.5) * cell,
    };
  }, { row, col });
}

export async function traySlotPoint(page, index) {
  return page.evaluate((index) => {
    const canvas = document.getElementById('board');
    const rect = canvas.getBoundingClientRect();
    const { cell, boardX, trayY } = window.__blockBlast.getState().layout;
    const slot = Math.floor(cell * 2.4);
    const gap = Math.floor(cell * 0.4);
    const total = slot * 3 + gap * 2;
    const x0 = boardX + Math.floor((cell * 8 - total) / 2);
    return {
      x: rect.left + x0 + index * (slot + gap) + slot / 2,
      y: rect.top + trayY + slot / 2,
    };
  }, index);
}

export async function dragPiece(page, slotIndex, target) {
  const from = await traySlotPoint(page, slotIndex);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
}
