import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateName, buildQuery } from './leaderboard.js'

test('validateName trims and enforces 1-12 chars', () => {
  assert.equal(validateName('  Abi  '), 'Abi')
  assert.equal(validateName(''), null)
  assert.equal(validateName('   '), null)
  assert.equal(validateName('a'.repeat(13)), null)
  assert.equal(validateName('a'.repeat(12)), 'a'.repeat(12))
})

test('buildQuery produces the expected URL', () => {
  assert.equal(buildQuery('challenge'), '/api/leaderboard?mode=challenge')
})
