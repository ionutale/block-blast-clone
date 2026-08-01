import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineBonus, scorePlacement } from './scoring.js';

test('lineBonus follows the triangular formula 10 * n(n+1)/2', () => {
  assert.equal(lineBonus(0), 0);
  assert.equal(lineBonus(1), 10);
  assert.equal(lineBonus(2), 30);
  assert.equal(lineBonus(3), 60);
  assert.equal(lineBonus(4), 100);
});

test('scorePlacement adds placed cells plus line bonus', () => {
  assert.equal(scorePlacement(4, 0), 4);
  assert.equal(scorePlacement(4, 1), 14);
  assert.equal(scorePlacement(5, 2), 35);
});
