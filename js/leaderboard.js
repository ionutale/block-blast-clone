export function validateName(raw) {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  if (name.length < 1 || name.length > 12) return null
  return name
}

export function buildQuery(mode) {
  return `/api/leaderboard?mode=${mode}`
}

export async function fetchLeaderboard(mode) {
  try {
    const res = await fetch(buildQuery(mode))
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function submitScore({ name, score, mode }) {
  const clean = validateName(name)
  if (clean === null) return null
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, score, mode }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
