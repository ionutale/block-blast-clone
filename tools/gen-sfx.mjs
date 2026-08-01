import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsfxr from 'jsfxr';
const { Params, SoundEffect } = jsfxr;

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx');
mkdirSync(OUT, { recursive: true });

function tune(overrides) {
  const ps = new Params();
  ps.sound_vol = 0.3;
  ps.sample_rate = 22050;
  ps.sample_size = 16;
  Object.assign(ps, overrides);
  return ps;
}

const PRESETS = {
  place: tune({
    wave_type: 2,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.3, p_env_decay: 0.2,
    p_base_freq: 0.4, p_freq_ramp: -0.35,
  }),
  clear: tune({
    wave_type: 2,
    p_env_attack: 0.005, p_env_sustain: 0.15, p_env_punch: 0.5, p_env_decay: 0.25,
    p_base_freq: 0.62, p_freq_ramp: 0.1,
  }),
  combo: tune({
    wave_type: 0,
    p_env_attack: 0.01, p_env_sustain: 0.2, p_env_punch: 0.5, p_env_decay: 0.3,
    p_base_freq: 0.5, p_repeat_speed: 0.35,
  }),
  invalid: tune({
    wave_type: 0,
    p_env_attack: 0, p_env_sustain: 0.05, p_env_punch: 0.2, p_env_decay: 0.15,
    p_base_freq: 0.15, p_freq_ramp: -0.1,
  }),
  newtray: tune({
    wave_type: 2,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.4, p_env_decay: 0.2,
    p_base_freq: 0.3, p_freq_ramp: 0.4,
  }),
  boardfull: tune({
    wave_type: 3,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.5, p_env_decay: 0.3,
    p_base_freq: 0.3, p_freq_ramp: -0.5,
  }),
  gameover: tune({
    wave_type: 1,
    p_env_attack: 0.01, p_env_sustain: 0.1, p_env_punch: 0.3, p_env_decay: 0.6,
    p_base_freq: 0.35, p_freq_ramp: -0.6,
  }),
};
let failed = false;
for (const [name, params] of Object.entries(PRESETS)) {
  const wav = new SoundEffect(params).generate().dataURI;
  const buf = Buffer.from(wav.split(',')[1], 'base64');
  const ok =
    buf.length > 44 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE';
  writeFileSync(join(OUT, `${name}.wav`), buf);
  console.log(`${name}.wav  ${buf.length} bytes  ${ok ? 'OK' : 'INVALID'}`);
  if (!ok) failed = true;
}
if (failed) {
  console.error('One or more WAVs are invalid.');
  process.exit(1);
}
console.log('Done. 7 SFX files written to assets/sfx/.');
