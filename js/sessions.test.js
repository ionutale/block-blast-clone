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
