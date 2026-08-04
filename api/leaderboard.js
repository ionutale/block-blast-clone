import { dbConfigured, leaderboardModes, submitLeaderboardScore, getLeaderboard, ensureIndexes, consumeSession, dbRateLimit } from './_db.js';
import { verifyToken } from './_sessions.js';
import { clientIp } from './_util.js';

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

const ENDLESS_MAX = 10000000;
const CHALLENGE_MAX = 1000000;

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
      const secret = process.env.SCORE_SECRET;
      if (!secret) {
        res.status(503).json({ error: 'storage not configured' });
        return;
      }
      const mode = req.body && req.body.mode;
      const name = parseName(req.body && req.body.name);
      const score = parseScore(req.body && req.body.score);
      if (!leaderboardModes().includes(mode) || name === null || score === null) {
        res.status(400).json({ error: 'invalid payload' });
        return;
      }
      const cap = mode === 'endless' ? ENDLESS_MAX : CHALLENGE_MAX;
      if (score > cap) {
        res.status(400).json({ error: 'score out of range' });
        return;
      }
      await ensureIndexes();
      const session = verifyToken(secret, req.body && req.body.token);
      if (!session) {
        res.status(401).json({ error: 'invalid or expired session' });
        return;
      }
      const limited = await dbRateLimit('submit', clientIp(req), 10, 60 * 60 * 1000);
      if (limited) {
        res.status(429).json({ error: 'rate limited' });
        return;
      }
      const consumed = await consumeSession(session.sid);
      if (!consumed) {
        res.status(401).json({ error: 'invalid or expired session' });
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
