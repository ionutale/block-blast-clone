export const MUTE_KEY = 'block-blast-muted';

// Chords: Am, F, C, G as midi note numbers (bass + ascending arpeggio tones).
export const CHORDS = [
  [33, 60, 64, 69],
  [41, 57, 60, 65],
  [48, 55, 60, 64],
  [43, 59, 62, 67],
];

const NOTES_PER_CHORD = 4;
const NOTE_DURATION = 0.33;
const LOOKAHEAD = 0.6;

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let noteIndex = 0;

  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(master);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.5;
      musicGain.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freqStart, freqEnd, dur, type, vol, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function scheduleNote(time, midi) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToFreq(midi);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.11, time + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.55);
  }

  function tickMusic() {
    if (!ctx || muted) return;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      const chord = CHORDS[Math.floor(noteIndex / NOTES_PER_CHORD) % CHORDS.length];
      scheduleNote(nextNoteTime, chord[noteIndex % NOTES_PER_CHORD]);
      nextNoteTime += NOTE_DURATION;
      noteIndex++;
    }
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    nextNoteTime = ctx.currentTime + 0.15;
    tickMusic();
    musicTimer = setInterval(tickMusic, 120);
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    startMusic();
  }

  function place() {
    if (!ensure()) return;
    tone(440, 220, 0.12, 'sine', 0.28);
  }

  function clear(lines) {
    if (!ensure()) return;
    const scale = [523.25, 659.25, 783.99, 1046.5, 783.99, 1318.5];
    const steps = lines >= 3 ? 6 : lines * 2;
    for (let i = 0; i < steps; i++) {
      tone(scale[i % scale.length], scale[i % scale.length], 0.18, 'triangle', 0.24, i * 0.07);
    }
  }

  function gameOver() {
    if (!ensure()) return;
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((f, i) => tone(f, f * 0.97, 0.35, 'triangle', 0.3, i * 0.28));
  }

  function setMuted(m) {
    muted = m;
    try {
      window.localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      // ignore storage errors
    }
    if (master) master.gain.value = m ? 0 : 1;
  }

  function toggle() {
    setMuted(!muted);
    return muted;
  }

  return { unlock, place, clear, gameOver, toggle, isMuted: () => muted };
}
