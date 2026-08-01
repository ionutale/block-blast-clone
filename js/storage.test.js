import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadSettings, saveSettings, loadPlayerName, savePlayerName,
  loadProgress, recordLevelResult, clearAll,
} from './storage.js'

const store = new Map()
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
}

test('settings round-trip with defaults', () => {
  const defaults = loadSettings()
  assert.equal(defaults.musicVolume, 0.7)
  assert.equal(defaults.sfxVolume, 1)
  assert.equal(defaults.haptics, false)
  saveSettings({ musicVolume: 0.3, haptics: true })
  const s = loadSettings()
  assert.equal(s.musicVolume, 0.3)
  assert.equal(s.sfxVolume, 1)
  assert.equal(s.haptics, true)
})

test('corrupt settings JSON falls back to defaults', () => {
  store.set('block-blast-settings', 'not-json{{{')
  const s = loadSettings()
  assert.equal(s.musicVolume, 0.7)
})

test('player name round-trip', () => {
  assert.equal(loadPlayerName(), '')
  savePlayerName('Candy King')
  assert.equal(loadPlayerName(), 'Candy King')
})

test('progress defaults to level 1 unlocked', () => {
  const p = loadProgress()
  assert.equal(p.unlocked, 1)
  assert.deepEqual(p.stars, {})
})

test('recordLevelResult stores best stars and unlocks next', () => {
  const r1 = recordLevelResult(1, 2)
  assert.equal(r1.newlyUnlocked, true)
  assert.equal(loadProgress().unlocked, 2)
  assert.equal(loadProgress().stars[1], 2)
  recordLevelResult(1, 1)
  assert.equal(loadProgress().stars[1], 2, 'keeps best stars')
  const r3 = recordLevelResult(1, 3)
  assert.equal(loadProgress().stars[1], 3, 'upgrades stars')
  assert.equal(r3.newlyUnlocked, false, 'already unlocked')
})

test('clearAll wipes progress but keeps player name', () => {
  savePlayerName('Abi')
  recordLevelResult(1, 3)
  clearAll()
  assert.equal(loadProgress().unlocked, 1)
  assert.deepEqual(loadProgress().stars, {})
  assert.equal(loadPlayerName(), 'Abi', 'name survives reset')
})
