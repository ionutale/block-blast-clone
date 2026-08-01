import { kvConfigured, countPresence } from './_kv.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!kvConfigured()) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
  try {
    const count = await countPresence();
    res.status(200).json({ count });
  } catch {
    res.status(500).json({ error: 'storage error' });
  }
}
