const url =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.REST_URL ||
  (process.env.REDIS_URL && process.env.REDIS_URL.replace(/^redis:\/\//, 'https://')) ||
  null;
const token =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.REST_TOKEN ||
  null;

export function kvConfigured() {
  return Boolean(url && token);
}

export async function kvCommand(...args) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`KV error ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

export async function setPresence(id) {
  return kvCommand('set', `online:${id}`, '1', 'EX', '60');
}

export async function countPresence() {
  let cursor = '0';
  let count = 0;
  do {
    const [next, keys] = await kvCommand('scan', cursor, 'MATCH', 'online:*', 'COUNT', '1000');
    cursor = next;
    count += keys.length;
  } while (cursor !== '0');
  return count;
}
