import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SFX_MANIFEST, MUSIC_URL, MUTE_KEY } from './audio.js';

test('SFX_MANIFEST has 7 named effects with .wav files', () => {
  assert.equal(SFX_MANIFEST.length, 7);
  for (const s of SFX_MANIFEST) {
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.match(s.file, /\.wav$/);
  }
});

test('every SFX manifest file exists and is a RIFF WAV', () => {
  for (const s of SFX_MANIFEST) {
    const buf = readFileSync(new URL(`../${s.file}`, import.meta.url));
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${s.file} missing RIFF header`);
    assert.equal(buf.toString('ascii', 8, 12), 'WAVE', `${s.file} missing WAVE chunk`);
  }
});

test('manifest names match the generated assets on disk', () => {
  const names = new Set(SFX_MANIFEST.map((s) => s.name));
  assert.deepEqual([...names].sort(), ['boardfull', 'clear', 'combo', 'gameover', 'invalid', 'newtray', 'place']);
});

test('MUSIC_URL points at the audio dir and MUTE_KEY is stable', () => {
  assert.equal(MUSIC_URL, 'assets/audio/music.mp3');
  assert.equal(MUTE_KEY, 'block-blast-muted');
});
