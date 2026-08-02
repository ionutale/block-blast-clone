import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function createSid() {
  return randomBytes(16).toString('base64url');
}

export function createToken(secret, sid, expMs) {
  const payload = `${sid}.${expMs}`;
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sid, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!sid || !sig || !Number.isFinite(exp)) return null;
  return { sid, exp, sig };
}

export function verifyToken(secret, token) {
  const parsed = parseToken(token);
  if (!parsed) return null;
  const expected = createHmac('sha256', secret).update(`${parsed.sid}.${parsed.exp}`).digest('base64url');
  const a = Buffer.from(parsed.sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (parsed.exp <= Date.now()) return null;
  return { sid: parsed.sid, exp: parsed.exp };
}
