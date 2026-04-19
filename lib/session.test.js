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

import { verifyPassword } from './session.js';

test('verifyPassword accepts matching password', () => {
  assert.equal(verifyPassword('hunter2', 'hunter2'), true);
});

test('verifyPassword rejects wrong password', () => {
  assert.equal(verifyPassword('hunter2', 'hunter3'), false);
});

test('verifyPassword rejects different lengths without crash', () => {
  assert.equal(verifyPassword('short', 'muchlongerstring'), false);
});

test('verifyPassword rejects empty inputs', () => {
  assert.equal(verifyPassword('', 'something'), false);
  assert.equal(verifyPassword('something', ''), false);
  assert.equal(verifyPassword('', ''), false);
});

import { renderLoginHtml } from './session.js';

test('renderLoginHtml returns a complete HTML document', () => {
  const html = renderLoginHtml();
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<form method="POST" action="/api/login"'));
  assert.ok(html.includes('CIBxRay'));
  assert.ok(!html.includes('<script'));
});

test('renderLoginHtml renders error banner when message provided', () => {
  const html = renderLoginHtml('Incorrect access code.');
  assert.ok(html.includes('Incorrect access code.'));
  assert.ok(html.includes('role="alert"'));
});

test('renderLoginHtml escapes HTML in error message', () => {
  const html = renderLoginHtml('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('verifyPassword returns false on length mismatch (short input)', () => {
  assert.equal(verifyPassword('a', 'longerpassword'), false);
});

test('verifyPassword returns false on length mismatch (long input)', () => {
  assert.equal(verifyPassword('a'.repeat(100), 'short'), false);
});

test('verifyPassword returns true on exact match', () => {
  assert.equal(verifyPassword('test-password-fixture', 'test-password-fixture'), true);
});

test('verifyPassword returns false on same-length-wrong-content', () => {
  assert.equal(verifyPassword('wrongwrongwrong', 'rightrightright'), false);
});

test('verifyPassword returns false on empty inputs', () => {
  assert.equal(verifyPassword('', ''), false);
  assert.equal(verifyPassword('pwd', ''), false);
  assert.equal(verifyPassword('', 'pwd'), false);
});

test('verifyPassword handles multi-byte UTF-8 correctly', () => {
  // 'é' is 2 bytes in UTF-8 but 1 char in string.length. The compare
  // happens on byte buffers, so same-character / same-bytes passes;
  // different byte content at the same char length fails.
  assert.equal(verifyPassword('café', 'café'), true);
  assert.equal(verifyPassword('cafe', 'café'), false);
});

test('verifyPassword rejects input larger than VERIFY_PAD_LEN (256 bytes)', () => {
  const tooLong = 'a'.repeat(257);
  assert.equal(verifyPassword(tooLong, 'short'), false);
  assert.equal(verifyPassword('short', tooLong), false);
});
