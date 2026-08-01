import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, COLORS, countCells } from './shapes.js';

test('SHAPES are non-empty 0/1 matrices with max dimension 5', () => {
  for (const shape of SHAPES) {
    assert.ok(shape.length > 0 && shape[0].length > 0, 'empty shape');
    assert.ok(shape.length <= 5 && shape[0].length <= 5, 'shape too big');
    for (const row of shape) {
      assert.equal(row.length, shape[0].length, 'ragged row');
      for (const v of row) assert.ok(v === 0 || v === 1, 'cell not 0/1');
    }
  }
});

test('countCells counts filled cells', () => {
  assert.equal(countCells([[1]]), 1);
  assert.equal(countCells([[1, 1], [1, 0]]), 3);
  assert.equal(countCells([[1, 1, 1, 1, 1]]), 5);
});

test('COLORS are 6-digit hex strings', () => {
  assert.ok(COLORS.length >= 5);
  for (const c of COLORS) assert.match(c, /^#[0-9a-f]{6}$/i);
});
