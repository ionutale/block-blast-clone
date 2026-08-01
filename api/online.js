import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  let count = 0;
  for await (const key of kv.scanIterator({ match: 'online:*', count: 1000 })) {
    count++;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ count });
}
