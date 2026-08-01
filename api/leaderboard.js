import { dbConfigured, leaderboardModes, submitLeaderboardScore, getLeaderboard } from './_db.js';

function parseScore(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 1e9) return null;
  return n;
}

function parseName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > 12) return null;
  return name;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!dbConfigured()) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const mode = req.query.mode;
      if (!leaderboardModes().includes(mode)) {
        res.status(400).json({ error: 'invalid mode' });
        return;
      }
      const data = await getLeaderboard(mode, 10);
      res.status(200).json(data);
      return;
    }
    if (req.method === 'POST') {
      const mode = req.body && req.body.mode;
      const name = parseName(req.body && req.body.name);
      const score = parseScore(req.body && req.body.score);
      if (!leaderboardModes().includes(mode) || name === null || score === null) {
        res.status(400).json({ error: 'invalid payload' });
        return;
      }
      const data = await submitLeaderboardScore({ name, score, mode });
      res.status(200).json(data);
      return;
    }
    res.status(405).json({ error: 'method not allowed' });
  } catch {
    res.status(500).json({ error: 'storage error' });
  }
}
