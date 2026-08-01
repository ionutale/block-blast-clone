import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, COLORS } from './shapes.js';
import { TRAY_SIZE, generatePieces, createTray, markUsed, allUsed, unusedPieces } from './tray.js';

test('generatePieces returns pieces with unique shapes in the set', () => {
  const pieces = generatePieces(TRAY_SIZE);
  assert.equal(pieces.length, TRAY_SIZE);
  const shapes = new Set(pieces.map((p) => p.shape));
  assert.equal(shapes.size, TRAY_SIZE, 'duplicate shapes in one set');
  for (const p of pieces) {
    assert.ok(SHAPES.includes(p.shape));
    assert.ok(COLORS.includes(p.color));
    assert.equal(p.used, false);
    assert.ok(p.id.length > 0);
  }
});

test('createTray has TRAY_SIZE unused pieces', () => {
  const tray = createTray();
  assert.equal(tray.pieces.length, TRAY_SIZE);
  assert.equal(unusedPieces(tray).length, TRAY_SIZE);
});

test('markUsed and allUsed track usage', () => {
  const tray = createTray();
  markUsed(tray, tray.pieces[0].id);
  assert.ok(!allUsed(tray));
  assert.equal(unusedPieces(tray).length, TRAY_SIZE - 1);
  for (const p of tray.pieces) markUsed(tray, p.id);
  assert.ok(allUsed(tray));
  assert.deepEqual(unusedPieces(tray), []);
});
