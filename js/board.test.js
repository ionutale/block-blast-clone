import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIZE, createBoard, canPlace, placePiece, getFullLines, clearLines, anyPlacementPossible } from './board.js';

const L3 = [[1, 1, 1]];
const V3 = [[1], [1], [1]];

test('createBoard returns empty 8x8 board', () => {
  const b = createBoard();
  assert.equal(b.length, SIZE);
  for (const row of b) {
    assert.equal(row.length, SIZE);
    assert.ok(row.every((c) => c === null));
  }
});

test('canPlace accepts empty cells and rejects occupied and out-of-bounds', () => {
  const b = createBoard();
  assert.ok(canPlace(b, L3, 0, 0));
  assert.ok(!canPlace(b, L3, 0, 6), 'row out of bounds');
  assert.ok(!canPlace(b, V3, 6, 0), 'col out of bounds');
  b[0][1] = '#fff';
  assert.ok(!canPlace(b, L3, 0, 0), 'overlap');
  assert.ok(canPlace(b, L3, 0, 3));
});

test('placePiece returns a new board and leaves the original unchanged', () => {
  const b = createBoard();
  const nb = placePiece(b, L3, 1, 1, '#f00');
  assert.notEqual(nb, b);
  assert.equal(b[1][1], null);
  assert.equal(nb[1][1], '#f00');
  assert.equal(nb[1][2], '#f00');
  assert.equal(nb[1][3], '#f00');
  assert.equal(nb[2][2], null);
});

test('getFullLines detects full rows and columns', () => {
  const b = createBoard();
  for (let c = 0; c < SIZE; c++) b[2][c] = '#f00';
  for (let r = 0; r < SIZE; r++) b[r][4] = '#0f0';
  const { rows, cols } = getFullLines(b);
  assert.deepEqual(rows, [2]);
  assert.deepEqual(cols, [4]);
});

test('getFullLines returns empty when nothing is full', () => {
  const b = createBoard();
  const { rows, cols } = getFullLines(b);
  assert.deepEqual(rows, []);
  assert.deepEqual(cols, []);
});

test('clearLines empties the given rows and columns only', () => {
  const b = createBoard();
  for (let c = 0; c < SIZE; c++) b[2][c] = '#f00';
  b[3][0] = '#00f';
  const nb = clearLines(b, { rows: [2], cols: [] });
  assert.ok(nb[2].every((c) => c === null));
  assert.equal(nb[3][0], '#00f');
  assert.equal(b[2][0], '#f00', 'original unchanged');
});

test('anyPlacementPossible works on empty and full boards', () => {
  assert.ok(anyPlacementPossible(createBoard(), [L3]));
  const full = createBoard().map((row) => row.map(() => '#f00'));
  assert.ok(!anyPlacementPossible(full, [L3]));
});

test('anyPlacementPossible detects the last fitting spot', () => {
  const b = createBoard().map((row) => row.map(() => '#f00'));
  b[0][0] = null; b[0][1] = null; b[0][2] = null;
  assert.ok(anyPlacementPossible(b, [L3]), '3 cells in a row should fit L3');
  const b2 = createBoard().map((row) => row.map(() => '#f00'));
  b2[0][0] = null; b2[0][1] = null;
  assert.ok(!anyPlacementPossible(b2, [L3]), 'only 2 cells free');
  assert.ok(anyPlacementPossible(b2, [[[1, 1]]]), '2-cell piece fits');
});
