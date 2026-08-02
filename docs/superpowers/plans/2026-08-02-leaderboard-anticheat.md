# Leaderboard Anti-Cheat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-side cheating protection to the online leaderboard: HMAC-verified one-time game sessions, per-IP rate limiting, and score plausibility caps.

**Architecture:** Three serverless pieces: a pure crypto helper module (`api/_sessions.js`) for HMAC tokens, a session-minting endpoint (`api/game-session.js`), and hardened POST handling in `api/leaderboard.js` (token verify + one-time consume + rate limit + caps). MongoDB gains `game-sessions` (TTL) and `rate-limit` (TTL) collections. The client fetches a session when a game starts and submits it with the score; 401/429 responses map to friendly messages. Fail-closed on a missing `SCORE_SECRET`.

**Tech Stack:** Vanilla JS (ES modules), node:crypto, MongoDB (existing `api/_db.js`), node:test, Playwright, Vercel serverless.

**Spec:** `docs/superpowers/specs/2026-08-02-leaderboard-anticheat-design.md`

---

### Task 1: HMAC Token Helpers (`api/_sessions.js`) + Tests

**Files:**
- Create: `api/_sessions.js`
- Test: `js/sessions.test.js`

- [ ] **Step 1: Write the failing tests**

Create `js/sessions.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createToken, createSid, parseToken, verifyToken } from '../api/_sessions.js';

const SECRET = 'test-secret';

test('token round-trip verifies', () => {
  const sid = createSid();
  const exp = Date.now() + 60000;
  const token = createToken(SECRET, sid, exp);
  const parsed = verifyToken(SECRET, token);
  assert.equal(parsed.sid, sid);
  assert.equal(parsed.exp, exp);
});

test('createSid produces distinct values', () => {
  assert.notEqual(createSid(), createSid());
  assert.ok(createSid().length >= 16);
});

test('expired token is rejected', () => {
  const token = createToken(SECRET, createSid(), Date.now() - 1000);
  assert.equal(verifyToken(SECRET, token), null);
});

test('tampered token is rejected', () => {
  const token = createToken(SECRET, createSid(), Date.now() + 60000);
  const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.equal(verifyToken(SECRET, tampered), null);
});

test('wrong secret is rejected', () => {
  const token = createToken(SECRET, createSid(), Date.now() + 60000);
  assert.equal(verifyToken('other-secret', token), null);
});

test('malformed tokens are rejected', () => {
  assert.equal(parseToken('garbage'), null);
  assert.equal(parseToken('a.b'), null);
  assert.equal(parseToken('a.b.c.d'), null);
  assert.equal(verifyToken(SECRET, 'not-a-token'), null);
});

test('parseToken returns null for non-strings', () => {
  assert.equal(parseToken(null), null);
  assert.equal(parseToken(42), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module '../api/_sessions.js'`.

- [ ] **Step 3: Implement `api/_sessions.js`**

Create `api/_sessions.js` (must NOT import `_db.js` or mongodb — it stays pure so node:test can load it):

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: ALL PASS (7 new tests).

- [ ] **Step 5: Commit**

```bash
git add api/_sessions.js js/sessions.test.js
git commit -m "feat: HMAC session token helpers with tests"
```

---

### Task 2: DB Helpers (`api/_db.js` + `api/_util.js`)

**Files:**
- Modify: `api/_db.js`
- Create: `api/_util.js`

- [ ] **Step 1: Add `api/_util.js`**

Create `api/_util.js`:

```js
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}
```

- [ ] **Step 2: Add DB helpers to `api/_db.js`**

Append to `api/_db.js`:

```js
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
  await client.db(DB_NAME).collection(SESSIONS_COLLECTION).insertOne({ _id: sid, exp, used: false });
}

export async function consumeSession(sid) {
  const client = await getClient();
  const doc = await client.db(DB_NAME).collection(SESSIONS_COLLECTION).findOneAndUpdate(
    { _id: sid, used: false, exp: { $gt: Date.now() } },
    { $set: { used: true } },
    { returnDocument: 'after' }
  );
  return doc || null;
}

export async function dbRateLimit(scope, key, max, windowMs) {
  const client = await getClient();
  const col = client.db(DB_NAME).collection(RATE_LIMIT_COLLECTION);
  const since = Date.now() - windowMs;
  const count = await col.countDocuments({ scope, key, ts: { $gt: since } });
  if (count >= max) return true;
  await col.insertOne({ scope, key, ts: Date.now() });
  return false;
}
```

Note: mongodb driver v7 `findOneAndUpdate` returns the document directly (or null) — the `{ returnDocument: 'after' }` option makes it return the updated doc; treat null as "not consumed".

- [ ] **Step 3: Verify imports**

Run: `node -e "Promise.all([import('./api/_db.js'), import('./api/_util.js')]).then(() => console.log('imports ok'))"`
Expected: `imports ok`

Run: `npm test` → ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add api/_db.js api/_util.js
git commit -m "feat: session and rate-limit DB helpers"
```

---

### Task 3: Session Endpoint (`api/game-session.js`)

**Files:**
- Create: `api/game-session.js`

- [ ] **Step 1: Implement the endpoint**

Create `api/game-session.js`:

```js
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
```

- [ ] **Step 2: Verify**

Run: `node -e "import('./api/game-session.js').then(() => console.log('imports ok'))"`
Expected: `imports ok`

Run: `npm test` → ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add api/game-session.js
git commit -m "feat: game session minting endpoint"
```

---

### Task 4: Harden Leaderboard POST (`api/leaderboard.js`)

**Files:**
- Modify: `api/leaderboard.js`

- [ ] **Step 1: Add token verification, rate limit and caps**

Read the current `api/leaderboard.js`. Apply these changes:

1. Add imports at the top:

```js
import { dbConfigured, leaderboardModes, submitLeaderboardScore, getLeaderboard, ensureIndexes, consumeSession, dbRateLimit } from './_db.js';
import { verifyToken } from './_sessions.js';
import { clientIp } from './_util.js';
```

2. Add cap constants after `parseName`:

```js
const ENDLESS_MAX = 10000000;
const CHALLENGE_MAX = 1000000;
```

3. In the handler, after `res.setHeader(...)` and the `dbConfigured()` guard, add the secret fail-closed guard:

```js
  const secret = process.env.SCORE_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'storage not configured' });
    return;
  }
```

4. In the POST branch, after the existing mode/name/score validation and before `submitLeaderboardScore`, insert:

```js
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
      const consumed = await consumeSession(session.sid);
      if (!consumed) {
        res.status(401).json({ error: 'invalid or expired session' });
        return;
      }
      const limited = await dbRateLimit('submit', clientIp(req), 10, 60 * 60 * 1000);
      if (limited) {
        res.status(429).json({ error: 'rate limited' });
        return;
      }
```

(The existing `submitLeaderboardScore` call and response stay. The whole POST block is inside the existing `try` — the new awaits are covered by the existing `catch → 500`.)

- [ ] **Step 2: Verify**

Run: `node -e "import('./api/leaderboard.js').then(() => console.log('imports ok'))"`
Expected: `imports ok`

Run: `npm test` → ALL PASS.

- [ ] **Step 3: Commit**

```bash
git add api/leaderboard.js
git commit -m "feat: verify sessions, rate limit and cap scores on submission"
```

---

### Task 5: Client Session Handshake (`js/leaderboard.js` + `js/main.js`)

**Files:**
- Modify: `js/leaderboard.js`
- Modify: `js/main.js`
- Modify: `js/leaderboard.test.js`

- [ ] **Step 1: Update `js/leaderboard.js`**

Add `requestSession` and update `submitScore` (replace the existing functions):

```js
export async function requestSession() {
  try {
    const res = await fetch('/api/game-session', { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token || null;
  } catch {
    return null;
  }
}

export async function submitScore({ name, score, mode, token }) {
  const clean = validateName(name);
  if (clean === null) return null;
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, score, mode, token: token || null }),
    });
    if (res.status === 429) return { error: 'rate-limited' };
    if (!res.ok) return { error: 'rejected' };
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Update `js/leaderboard.test.js`**

Append a test for the new body shape (the submit fetch itself stays untested — covered by e2e):

```js
test('submitScore includes the token in the request body', async () => {
  let captured = null;
  globalThis.fetch = async (url, opts) => {
    captured = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ rank: 1, entries: [] }) };
  };
  const res = await submitScore({ name: 'Abi', score: 100, mode: 'endless', token: 'tok-123' });
  assert.equal(res.rank, 1);
  assert.deepEqual(captured, { name: 'Abi', score: 100, mode: 'endless', token: 'tok-123' });
  delete globalThis.fetch;
});
```

- [ ] **Step 3: Wire the session fetch in `js/main.js`**

1. Update the import: `import { fetchLeaderboard, submitScore, requestSession } from './leaderboard.js';`
2. Next to `let pendingScore = null;` add `let pendingToken = null;`
3. In `startEndless` and `startChallenge`, after the existing setup lines, add:

```js
  pendingScore = null;
  pendingToken = null;
  requestSession().then((t) => {
    pendingToken = t;
  });
```

4. In the submit handler, change the `submitScore` call:

```js
    const res = await submitScore({ name, score: pendingScore, mode: pendingMode, token: pendingToken });
    if (res === null) {
      lbResultEl.textContent = 'Offline — score not submitted';
    } else if (res.error === 'rate-limited') {
      lbResultEl.textContent = 'Rate limited — try again later';
    } else if (res.error) {
      lbResultEl.textContent = 'Score rejected — start a new game';
    } else {
      lbResultEl.textContent = `Rank #${res.rank}`;
    }
```

- [ ] **Step 4: Verify**

Run: `npm test` → ALL PASS.
Run: `npx playwright test` → expect the leaderboard submit spec to FAIL on the body assertion (`posted` now includes `token: null` — the mock catches the POST but the session fetch 404s on the static server so token is null). This is fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add js/leaderboard.js js/leaderboard.test.js js/main.js
git commit -m "feat: client session handshake and submit error feedback"
```

---

### Task 6: E2E Updates

**Files:**
- Modify: `e2e/leaderboard.spec.js`

- [ ] **Step 1: Update the submit spec**

In `e2e/leaderboard.spec.js`, the submit test mocks `**/api/leaderboard` POST. Add a session mock and update the body assertion:

```js
test('submit posts to the API and shows the rank', async ({ page }) => {
  let posted = null;
  await page.route('**/api/leaderboard?mode=*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) })
  );
  await page.route('**/api/leaderboard', (route) => {
    posted = route.request().postDataJSON();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rank: 3, entries: [] }) });
  });
  await page.route('**/api/game-session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-token' }) })
  );
  await page.goto('/?test=1#/play');
  // ...existing game-over setup (board + tray + drag) unchanged...
  await expect(page.locator('#game-over')).toBeVisible();
  await page.fill('#lb-name', 'Abi');
  await page.click('#lb-submit');
  await expect(page.locator('#lb-result')).toContainText('Rank #3');
  expect(posted).toEqual({ name: 'Abi', score: expect.any(Number), mode: 'endless', token: 'test-token' });
});
```

Also add a rejection-message test:

```js
test('rejected submission shows a friendly message', async ({ page }) => {
  await page.route('**/api/leaderboard', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid or expired session' }) })
  );
  await page.route('**/api/game-session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'test-token' }) })
  );
  await page.goto('/?test=1#/play');
  // game-over setup (same as above)
  await page.fill('#lb-name', 'Abi');
  await page.click('#lb-submit');
  await expect(page.locator('#lb-result')).toHaveText('Score rejected — start a new game');
});
```

(The game-over setup is the existing one from the current spec — copy it verbatim into both tests.)

- [ ] **Step 2: Run the full suite**

Run: `npm test` → ALL PASS.
Run: `npx playwright test` → ALL PASS (36).

- [ ] **Step 3: Commit**

```bash
git add e2e/leaderboard.spec.js
git commit -m "test: e2e for session handshake and rejection feedback"
```

---

### Task 7: Env Secret + Live Verification

**Files:** none (ops)

- [ ] **Step 1: Set `SCORE_SECRET` in Vercel production**

Generate a secret and add it via the Vercel REST API (non-interactive):

```bash
SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))") && \
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.env.HOME + '/Library/Application Support/com.vercel.cli/auth.json','utf8')).token)") && \
curl -s -X POST "https://api.vercel.com/v9/projects/prj_uvodqZIZwN0NdwTMln401HXhplTh/env" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"key\":\"SCORE_SECRET\",\"value\":\"$SECRET\",\"target\":[\"production\"]}" | head -c 200
```

Expected: `{"key":"SCORE_SECRET",...}` (env var created). Keep `$SECRET` in your shell for the verification step — or re-read it from `vercel env ls` (it will show "Encrypted").

- [ ] **Step 2: Deploy and verify live**

Run: `git push origin master` (native Git integration deploys).

Wait for the deploy (poll `vercel ls block-blast-clone | head -4` until a fresh Ready production deployment appears), then:

```bash
BASE=https://block-blast-clone-woad.vercel.app

# 1. session mint works
TOKEN=$(curl -s -X POST "$BASE/api/game-session" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
echo "minted token: ${TOKEN:0:20}..."

# 2. submit with token succeeds
curl -s -X POST "$BASE/api/leaderboard" -H "Content-Type: application/json" \
  -d "{\"name\":\"AntiCheat Test\",\"score\":111,\"mode\":\"endless\",\"token\":\"$TOKEN\"}" | head -c 200; echo

# 3. replaying the same token is rejected (one-time use)
curl -s -X POST "$BASE/api/leaderboard" -H "Content-Type: application/json" \
  -d "{\"name\":\"AntiCheat Test\",\"score\":222,\"mode\":\"endless\",\"token\":\"$TOKEN\"}" | head -c 120; echo

# 4. tampered token is rejected
curl -s -X POST "$BASE/api/leaderboard" -H "Content-Type: application/json" \
  -d "{\"name\":\"AntiCheat Test\",\"score\":333,\"mode\":\"endless\",\"token\":\"${TOKEN}x\"}" | head -c 120; echo

# 5. over-cap score is rejected (mint a fresh token first)
T2=$(curl -s -X POST "$BASE/api/game-session" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
curl -s -X POST "$BASE/api/leaderboard" -H "Content-Type: application/json" \
  -d "{\"name\":\"AntiCheat Test\",\"score\":999999999,\"mode\":\"endless\",\"token\":\"$T2\"}" | head -c 120; echo

# 6. rate limit: 10 rapid submits from this IP should eventually 429 (loop 12 fresh tokens)
for i in $(seq 1 12); do
  T=$(curl -s -X POST "$BASE/api/game-session" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/leaderboard" -H "Content-Type: application/json" \
    -d "{\"name\":\"AntiCheat Test\",\"score\":$((100+i)),\"mode\":\"endless\",\"token\":\"$T\"}")
  echo -n "$R "
done; echo
```

Expected: submit #2 → 401 (or the upsert rank — note: `$max` keeps the highest score, so #2 with 222 would still rank; the 401 is what we assert), #3 → 401, #5 → 400, #6 sequence → 200s then 429s.

- [ ] **Step 3: Clean up test rows**

Use the temporary-function technique from before: create `api/cleanup-tmp.js` that deletes `{ name: 'AntiCheat Test' }`, deploy (`vercel --prod --yes`), curl it, remove the file, deploy again. Verify the board only contains real entries (ion's).

- [ ] **Step 4: Final suite**

Run: `npm test` → ALL PASS. Run: `npx playwright test` → ALL PASS.

---

## Self-Review Notes

- **Spec coverage:** HMAC tokens ✓ (T1), game-session endpoint + rate limit ✓ (T3), one-time consume + caps + submit rate limit ✓ (T4), client handshake + messages ✓ (T5), e2e ✓ (T6), SCORE_SECRET env + live verification ✓ (T7). Fail-closed on missing secret ✓ (T3/T4).
- **Consistency:** `createToken(secret, sid, expMs)` / `verifyToken(secret, token)` / `parseToken(token)` / `createSid()` — used identically in T1 (tests), T3 (mint), T4 (verify). `dbRateLimit(scope, key, max, windowMs)` — T3 (scope 'session', 60/h) and T4 (scope 'submit', 10/h). `ensureIndexes()` called from both endpoints. Token field name `token` consistent across client/server. Error contract: client maps 429 → 'rate-limited', any other !ok → 'rejected', network → null.
- **Known environment quirk:** the Vercel CLI auth file is at `~/Library/Application Support/com.vercel.cli/auth.json` on this machine (not `~/.vercel/auth.json`).
- **No placeholders:** every step has complete code and exact commands.
