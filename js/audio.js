export const MUTE_KEY = 'block-blast-muted';

export const SFX_MANIFEST = [
  { name: 'place', file: 'assets/sfx/place.wav' },
  { name: 'clear', file: 'assets/sfx/clear.wav' },
  { name: 'combo', file: 'assets/sfx/combo.wav' },
  { name: 'invalid', file: 'assets/sfx/invalid.wav' },
  { name: 'newtray', file: 'assets/sfx/newtray.wav' },
  { name: 'boardfull', file: 'assets/sfx/boardfull.wav' },
  { name: 'gameover', file: 'assets/sfx/gameover.wav' },
];

export const MUSIC_URL = 'assets/audio/music.mp3';

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxGain = null;
  let musicGain = null;
  let muted = false;
  let loaded = false;
  const buffers = new Map();
  let musicBuffer = null;
  let musicSource = null;

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

  async function loadAudio(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arr = await res.arrayBuffer();
    return ctx.decodeAudioData(arr);
  }

  async function loadAll() {
    if (loaded) return;
    loaded = true;
    await Promise.all(
      SFX_MANIFEST.map(async (s) => {
        try {
          buffers.set(s.name, await loadAudio(s.file));
        } catch (e) {
          console.warn(`audio: failed to load ${s.file}`, e);
        }
      })
    );
    try {
      musicBuffer = await loadAudio(MUSIC_URL);
    } catch (e) {
      console.warn(`audio: no music track at ${MUSIC_URL}`, e);
    }
    startMusic();
  }

  function play(name, { delay = 0, volume = 1 } = {}) {
    if (!ctx) return;
    const buf = buffers.get(name);
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(sfxGain);
    src.start(ctx.currentTime + delay);
  }

  function startMusic() {
    if (!ctx || !musicBuffer || musicSource) return;
    musicSource = ctx.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(musicGain);
    musicSource.start();
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    loadAll();
  }

  function place() {
    play('place');
  }

  function clear(lines) {
    play('clear');
    if (lines >= 2) play('combo', { delay: 0.05 });
  }

  function invalid() {
    play('invalid');
  }

  function newTray() {
    play('newtray');
  }

  function boardFull() {
    play('boardfull');
  }

  function gameOver() {
    boardFull();
    play('gameover', { delay: 0.3 });
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

  return {
    unlock, place, clear, gameOver, invalid, newTray, combo: () => play('combo'), boardFull,
    setMusicVolume: (v) => {
      if (musicGain) musicGain.gain.value = v;
    },
    setSfxVolume: (v) => {
      if (sfxGain) sfxGain.gain.value = v;
    },
    toggle,
    isMuted: () => muted,
  };
}
