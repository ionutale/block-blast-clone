const HEARTBEAT_MS = 20000;
const POLL_MS = 10000;
const ID_KEY = 'block-blast-player-id';

function playerId() {
  try {
    const existing = localStorage.getItem(ID_KEY);
    if (existing) return existing;
  } catch {
    // storage unavailable — new id each load
  }
  let id = '';
  try {
    id = crypto.randomUUID();
  } catch {
    id = `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  try {
    localStorage.setItem(ID_KEY, id);
  } catch {
    // ignore
  }
  return id;
}

export function initOnline(el) {
  const id = playerId();

  async function heartbeat() {
    try {
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      // offline or api down — presence expires on its own
    }
  }

  async function refresh() {
    try {
      const res = await fetch('/api/online');
      if (!res.ok) return;
      const { count } = await res.json();
      el.textContent = String(count);
      el.classList.remove('hidden');
    } catch {
      // keep last known count
    }
  }

  heartbeat();
  refresh();
  const heartTimer = setInterval(heartbeat, HEARTBEAT_MS);
  const pollTimer = setInterval(refresh, POLL_MS);
  window.addEventListener('beforeunload', () => {
    clearInterval(heartTimer);
    clearInterval(pollTimer);
  });

  return { refresh };
}
