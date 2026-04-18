import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildSession, verifySession } from './session.js';

const SECRET = 'test-secret-do-not-use-in-prod';

test('buildSession + verifySession round-trip succeeds', () => {
  const token = buildSession(SECRET);
  assert.equal(verifySession(token, SECRET), true);
});

test('verifySession rejects tampered payload', () => {
  const token = buildSession(SECRET);
  const [, sig] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ iat: 0, exp: 9999999999 }), 'utf8').toString('base64url');
  const forged = `${tamperedPayload}.${sig}`;
  assert.equal(verifySession(forged, SECRET), false);
});

test('verifySession rejects tampered signature', () => {
  const token = buildSession(SECRET);
  const [payload] = token.split('.');
  const forged = `${payload}.${'a'.repeat(43)}`;
  assert.equal(verifySession(forged, SECRET), false);
});

test('verifySession rejects wrong secret', () => {
  const token = buildSession(SECRET);
  assert.equal(verifySession(token, 'different-secret'), false);
});

test('verifySession rejects missing token', () => {
  assert.equal(verifySession(null, SECRET), false);
  assert.equal(verifySession('', SECRET), false);
  assert.equal(verifySession('not-two-parts', SECRET), false);
});

test('verifySession rejects expired token', () => {
  const pastPayload = { iat: 0, exp: 1 };
  const payloadB64 = Buffer.from(JSON.stringify(pastPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  const expired = `${payloadB64}.${sig}`;
  assert.equal(verifySession(expired, SECRET), false);
});
