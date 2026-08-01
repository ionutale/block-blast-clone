const SETTINGS_KEY = 'block-blast-settings'
const PROGRESS_KEY = 'block-blast-progress'
const NAME_KEY = 'block-blast-name'

const DEFAULT_SETTINGS = { musicVolume: 0.7, sfxVolume: 1, haptics: false }
const DEFAULT_PROGRESS = { unlocked: 1, stars: {} }

function getStore() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function freshCopy(fallback) {
  return { ...fallback, stars: { ...fallback.stars } }
}

function readJSON(key, fallback) {
  const store = getStore()
  if (!store) return freshCopy(fallback)
  try {
    const raw = store.getItem(key)
    return raw === null ? freshCopy(fallback) : { ...freshCopy(fallback), ...JSON.parse(raw) }
  } catch {
    return freshCopy(fallback)
  }
}

function writeJSON(key, value) {
  const store = getStore()
  if (!store) return
  try {
    store.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or private mode — ignore
  }
}

export function loadSettings() {
  return readJSON(SETTINGS_KEY, DEFAULT_SETTINGS)
}

export function saveSettings(partial) {
  writeJSON(SETTINGS_KEY, { ...loadSettings(), ...partial })
}

export function loadPlayerName() {
  const store = getStore()
  if (!store) return ''
  try {
    return store.getItem(NAME_KEY) || ''
  } catch {
    return ''
  }
}

export function savePlayerName(name) {
  const store = getStore()
  if (!store) return
  try {
    store.setItem(NAME_KEY, name.trim().slice(0, 12))
  } catch {
    // ignore
  }
}

export function loadProgress() {
  return readJSON(PROGRESS_KEY, DEFAULT_PROGRESS)
}

export function recordLevelResult(levelId, stars) {
  const p = loadProgress()
  const starMap = p.stars && typeof p.stars === 'object' ? p.stars : {}
  const prevBest = starMap[levelId] || 0
  starMap[levelId] = Math.max(prevBest, stars)
  p.stars = starMap
  p.unlocked = typeof p.unlocked === 'number' ? p.unlocked : 1
  let newlyUnlocked = false
  if (levelId === p.unlocked) {
    p.unlocked += 1
    newlyUnlocked = true
  }
  writeJSON(PROGRESS_KEY, p)
  return { newlyUnlocked }
}

export function clearAll() {
  const store = getStore()
  if (!store) return
  try {
    store.removeItem(SETTINGS_KEY)
    store.removeItem(PROGRESS_KEY)
  } catch {
    // ignore
  }
}
