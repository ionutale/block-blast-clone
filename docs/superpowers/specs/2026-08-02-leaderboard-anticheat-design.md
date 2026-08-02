# Leaderboard Anti-Cheat — Design

Date: 2026-08-02
Status: Approved

## Goal

Raise the bar for fake leaderboard submissions: HMAC-verified one-time game sessions, per-IP rate limiting, and score plausibility caps. Accepted trade-off (per design discussion): this blocks casual curl-spam and protocol-ignorant cheaters; a determined attacker playing the real protocol can still cheat — that is out of scope.

## Architecture

Three layers enforced server-side in the existing serverless functions, plus a client session handshake:

1. **Game sessions (HMAC + one-time use)** — `POST /api/game-session` mints a signed token; the client fetches one when a game starts and submits it with the score; the server verifies signature, 30-min expiry, and marks it used on first submission.
2. **Rate limiting (per IP)** — max 10 score submissions/hour/IP and 60 session mints/hour/IP, backed by MongoDB collections with TTL indexes.
3. **Score caps** — endless ≤ 10,000,000, challenge ≤ 1,000,000.

Fail-closed: if `SCORE_SECRET` is not configured, session minting and score submission return 503.

## Server

### `api/_sessions.js` (pure helpers, unit-testable — no env access)

```js
export function createToken(secret, sid, expMs) { ... }   // `${sid}.${exp}.${sig}` (base64url)
export function parseToken(token) { ... }                 // { sid, exp, sig } | null (shape check)
export function verifyToken(secret, token) { ... }        // sig match + exp > now → { sid, exp } | null
```

- `sig = HMAC-SHA256(secret, `${sid}.${exp}`)` → base64url
- `sid` = 16 random bytes base64url (crypto.randomBytes)

### `api/_db.js` additions

- `SCORE_SECRET` read in the handlers (not _db) — actually keep secret access in the endpoint files; _db gets collections + TTL setup:
  - `ensureIndexes()` — idempotent: TTL indexes on `game-sessions.exp` (expireAfterSeconds: 0) and `submissions.ts` (expireAfterSeconds: 3600)
  - `mintSession({ sid, exp })` — insert `{ _id: sid, exp, used: false }`
  - `consumeSession(sid)` — `findOneAndUpdate({ _id: sid, used: false, exp: { $gt: now } }, { $set: { used: true } })` → returns the doc or null
  - `countRecent(key, field, since)` + `recordEvent(key, field)` for rate limiting (shared by both endpoints)

### `api/game-session.js`

- `POST` → 503 if no `SCORE_SECRET`; rate limit 60/hour/IP (429); create sid + exp = now + 30 min; `mintSession`; respond `{ token }`
- No GET; 405 otherwise; 500 on errors

### `api/leaderboard.js` (POST changes)

- 503 if no `SCORE_SECRET`
- Body: `{ name, score, mode, token }` — existing validation stays
- Token: `parseToken` + `verifyToken` → 401 on invalid/expired; `consumeSession(sid)` → 401 if already used/unknown
- Rate limit: 10/hour/IP → 429
- Caps: endless > 10,000,000 or challenge > 1,000,000 → 400
- Then the existing `$max` upsert + rank response
- GET unchanged (public board)

## Client

- `js/leaderboard.js`:
  - `requestSession()` → POST `/api/game-session` → `{ token }` | null
  - `submitScore({ name, score, mode, token })` — token optional in the call; returns `null` (network) | `{ error: 'rate-limited' }` | `{ error: 'rejected' }` | `{ rank, entries }`
- `js/main.js`:
  - `startEndless()` / `startChallenge()` fetch a session (async, non-blocking) and stash it in `pendingToken`
  - `onGameOver` / `showLevelComplete` submit with `pendingToken`
  - Result messages: 429 → "Rate limited — try again later"; 401/403 → "Session expired — score not submitted"; network → "Offline — score not submitted"

## Env

- `SCORE_SECRET` — generated (32+ random bytes, base64url) and added to Vercel production env via the REST API (non-interactive). Fail-closed without it.
- `.env.local` already gitignored; no secrets in the repo.

## Testing

- Unit: `js/_sessions`-equivalent pure module tests — token round-trip, expiry, tamper detection, malformed tokens. The helpers live in `api/` but are importable by node:test (mongodb import is lazy — `api/_sessions.js` must not import `_db.js`).
- Caps/validation: existing tests updated for the new cap constants.
- E2E: leaderboard submit spec updated — mock `**/api/game-session` and include token in the mocked POST assertion.
- Live verification after deploy: mint → submit → rank; tampered token → 401; second use of token → 401; rate limit → 429 (temporarily raising the limit for the test is not needed — 11 rapid submits from one IP hit it; cleanup the test rows afterwards via the same temporary-function technique).
