import { dbConfigured, ensureIndexes, mintSession, dbRateLimit } from './_db.js';
import { createToken, createSid } from './_sessions.js';
import { clientIp } from './_util.js';

const SESSION_TTL_MS = 30 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.SCORE_SECRET;
  if (!dbConfigured() || !secret) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  try {
    await ensureIndexes();
    const limited = await dbRateLimit('session', clientIp(req), 60, 60 * 60 * 1000);
    if (limited) {
      res.status(429).json({ error: 'rate limited' });
      return;
    }
    const sid = createSid();
    const exp = Date.now() + SESSION_TTL_MS;
    await mintSession({ sid, exp });
    res.status(200).json({ token: createToken(secret, sid, exp) });
  } catch {
    res.status(500).json({ error: 'storage error' });
  }
}
