import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePlacement } from './scoring.js';
import { LEVELS, calcStars, getLevel } from './levels.js';

test('LEVELS has 20 levels with sequential ids', () => {
  assert.equal(LEVELS.length, 20);
  LEVELS.forEach((l, i) => assert.equal(l.id, i + 1));
});

test('every level has a valid goal and move budget', () => {
  for (const l of LEVELS) {
    assert.ok(['lines', 'score'].includes(l.goal.type), `level ${l.id} goal type`);
    assert.ok(Number.isInteger(l.goal.target) && l.goal.target > 0, `level ${l.id} target`);
    assert.ok(Number.isInteger(l.moves) && l.moves >= 3, `level ${l.id} moves`);
  }
});

test('star math: 1 star for completion, 2 with moves left, 3 at a third of budget', () => {
  const level = { id: 1, goal: { type: 'lines', target: 2 }, moves: 9 };
  assert.equal(calcStars(level, 0), 1);
  assert.equal(calcStars(level, 1), 2);
  assert.equal(calcStars(level, 3), 3);
  assert.equal(calcStars(level, 9), 3);
});

test('getLevel finds levels and returns undefined for unknown', () => {
  assert.equal(getLevel(5).moves, LEVELS[4].moves);
  assert.equal(getLevel(99), undefined);
});

test('score goals are reachable given move budgets', () => {
  // one strong move (9 cells + 2 lines) discounted by measured near-optimal
  // efficiency (~60%) gives the practical pts/move ceiling; targets must stay under it
  const practicalMaxPerMove = Math.floor(scorePlacement(9, 2) * 0.6);
  for (const l of LEVELS) {
    if (l.goal.type !== 'score') continue;
    assert.ok(l.goal.target <= practicalMaxPerMove * l.moves,
      `level ${l.id}: ${l.goal.target} pts in ${l.moves} moves is unreachable`);
  }
});

test('key level values are pinned', () => {
  assert.equal(getLevel(1).moves, 8);
  assert.equal(getLevel(1).goal.target, 2);
  assert.deepEqual(getLevel(3).goal, { type: 'score', target: 100 });
  assert.equal(getLevel(20).goal.target, 15);
  assert.equal(getLevel(20).moves, 28);
});
