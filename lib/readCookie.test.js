import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCookie } from './readCookie.js';

test('readCookie returns decoded value for a normal cookie', () => {
  const header = 'cibxray_session=abc.def.ghi';
  assert.equal(readCookie(header, 'cibxray_session'), 'abc.def.ghi');
});

test('readCookie URI-decodes percent-encoded values', () => {
  const header = 'cibxray_session=hello%20world';
  assert.equal(readCookie(header, 'cibxray_session'), 'hello world');
});

test('readCookie returns null when the cookie is absent', () => {
  assert.equal(readCookie('other=1', 'cibxray_session'), null);
});

test('readCookie returns null for empty header', () => {
  assert.equal(readCookie('', 'cibxray_session'), null);
});

test('readCookie returns null instead of throwing on malformed percent-encoding', () => {
  // Lone `%` with non-hex follow-up would make decodeURIComponent throw
  // URIError. Previously that took the whole middleware down (C-1, Track A).
  assert.equal(readCookie('cibxray_session=%E0%A4%A', 'cibxray_session'), null);
  assert.equal(readCookie('cibxray_session=%ZZ', 'cibxray_session'), null);
  assert.equal(readCookie('cibxray_session=%', 'cibxray_session'), null);
});

test('readCookie picks the right cookie when multiple are present', () => {
  const header = 'foo=1; cibxray_session=xyz; bar=2';
  assert.equal(readCookie(header, 'cibxray_session'), 'xyz');
});
