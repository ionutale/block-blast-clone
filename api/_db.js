import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || null;
const DB_NAME = 'block-blast';
const COLLECTION = 'presence';
const PRESENCE_WINDOW_MS = 60000;

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 3000,
    });
  }
  return clientPromise;
}

export function dbConfigured() {
  return Boolean(uri);
}

export async function setPresence(id) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(COLLECTION);
  await col.updateOne({ _id: id }, { $set: { lastSeen: new Date() } }, { upsert: true });
  try {
    if (Math.random() < 0.05) {
      const stale = new Date(Date.now() - 2 * PRESENCE_WINDOW_MS);
      await col.deleteMany({ lastSeen: { $lt: stale } });
    }
  } catch {
    // cleanup is best-effort
  }
}

export async function countPresence() {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(COLLECTION);
  const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
  return col.countDocuments({ lastSeen: { $gt: since } });
}

const LEADERBOARD_COLLECTION = 'leaderboard';
const LEADERBOARD_MODES = ['endless', 'challenge'];

export function leaderboardModes() {
  return LEADERBOARD_MODES;
}

export async function submitLeaderboardScore({ name, score, mode }) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(LEADERBOARD_COLLECTION);
  await col.updateOne(
    { name, mode },
    { $max: { score } },
    { upsert: true }
  );
  const all = await col.find({ mode }).sort({ score: -1 }).toArray();
  const idx = all.findIndex((e) => e.name === name);
  const rank = idx === -1 ? all.length : idx + 1;
  return { rank, entries: all.slice(0, 10).map((e) => ({ name: e.name, score: e.score })) };
}

export async function getLeaderboard(mode, limit = 10) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(LEADERBOARD_COLLECTION);
  const entries = await col.find({ mode }).sort({ score: -1 }).limit(limit).toArray();
  return { entries: entries.map((e) => ({ name: e.name, score: e.score })) };
}

const SESSIONS_COLLECTION = 'game-sessions';
const RATE_LIMIT_COLLECTION = 'rate-limit';

let indexPromise = null;

export function ensureIndexes() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const client = await getClient();
      const db = client.db(DB_NAME);
      await db.collection(SESSIONS_COLLECTION).createIndex({ exp: 1 }, { expireAfterSeconds: 0 });
      await db.collection(RATE_LIMIT_COLLECTION).createIndex({ ts: 1 }, { expireAfterSeconds: 3600 });
    })().catch((e) => {
      indexPromise = null;
      throw e;
    });
  }
  return indexPromise;
}

export async function mintSession({ sid, exp }) {
  const client = await getClient();
  await client.db(DB_NAME).collection(SESSIONS_COLLECTION).insertOne({ _id: sid, exp: new Date(exp), used: false });
}

export async function consumeSession(sid) {
  const client = await getClient();
  const doc = await client.db(DB_NAME).collection(SESSIONS_COLLECTION).findOneAndUpdate(
    { _id: sid, used: false, exp: { $gt: new Date() } },
    { $set: { used: true } },
    { returnDocument: 'after' }
  );
  return doc || null;
}

export async function dbRateLimit(scope, key, max, windowMs) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(RATE_LIMIT_COLLECTION);
  const since = new Date(Date.now() - windowMs);
  const count = await col.countDocuments({ scope, key, ts: { $gt: since } });
  if (count >= max) return true;
  await col.insertOne({ scope, key, ts: new Date() });
  return false;
}
