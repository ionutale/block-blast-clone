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
