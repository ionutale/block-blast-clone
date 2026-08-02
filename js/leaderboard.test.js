import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateName, buildQuery, submitScore } from './leaderboard.js'

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

test('submitScore includes the token in the request body', async () => {
  let captured = null
  globalThis.fetch = async (url, opts) => {
    captured = JSON.parse(opts.body)
    return { ok: true, status: 200, json: async () => ({ rank: 1, entries: [] }) }
  }
  const res = await submitScore({ name: 'Abi', score: 100, mode: 'endless', token: 'tok-123' })
  assert.equal(res.rank, 1)
  assert.deepEqual(captured, { name: 'Abi', score: 100, mode: 'endless', token: 'tok-123' })
  delete globalThis.fetch
})
