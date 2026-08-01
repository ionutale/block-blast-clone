import { test } from 'node:test';
import assert from 'node:assert/strict';
import { midiToFreq, CHORDS } from './audio.js';

test('midiToFreq maps A4 to 440Hz and A5 to 880Hz', () => {
  assert.equal(midiToFreq(69), 440);
  assert.equal(midiToFreq(81), 880);
});

test('midiToFreq doubles frequency every 12 semitones', () => {
  assert.ok(Math.abs(midiToFreq(57) - midiToFreq(45) * 2) < 1e-9);
});

test('CHORDS: four chords of four ascending notes in piano range', () => {
  assert.equal(CHORDS.length, 4);
  for (const chord of CHORDS) {
    assert.equal(chord.length, 4);
    for (let i = 1; i < chord.length; i++) {
      assert.ok(chord[i] > chord[i - 1], 'notes must ascend within a chord');
    }
    for (const n of chord) {
      assert.ok(n >= 21 && n <= 108, 'note outside piano range');
    }
  }
});
