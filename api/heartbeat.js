import { dbConfigured, setPresence } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }
  if (!dbConfigured()) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
  const id = req.body && typeof req.body.id === 'string' ? req.body.id : null;
  if (!id || id.length < 8 || id.length > 64) {
    res.status(400).json({ error: 'invalid id' });
    return;
  }
  try {
    await setPresence(id);
    res.status(204).end();
  } catch {
    res.status(500).json({ error: 'storage error' });
  }
}
