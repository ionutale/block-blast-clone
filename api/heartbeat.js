import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  const id = req.body && typeof req.body.id === 'string' ? req.body.id : null;
  if (!id || id.length < 8 || id.length > 64) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  await kv.set(`online:${id}`, '1', { ex: 60 });
  res.status(204).end();
}
