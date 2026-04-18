import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStamp } from '../src/stamp/computeStamp.js';

function bytes(str) {
  return new TextEncoder().encode(str).buffer;
}

test('returns the four-field stamp shape', async () => {
  const stamp = await computeStamp(bytes('hello'));
  assert.ok(typeof stamp.analyzedAt === 'string');
  assert.ok(typeof stamp.methodologyVersion === 'string');
  assert.ok(typeof stamp.appBuild === 'string');
  assert.ok(typeof stamp.pdfFingerprint === 'string');
});

test('pdfFingerprint is exactly 16 hex chars', async () => {
  const stamp = await computeStamp(bytes('anything'));
  assert.equal(stamp.pdfFingerprint.length, 16);
  assert.match(stamp.pdfFingerprint, /^[0-9a-f]{16}$/);
});

test('deterministic: same bytes produce identical fingerprints', async () => {
  const a = await computeStamp(bytes('same content'));
  const b = await computeStamp(bytes('same content'));
  assert.equal(a.pdfFingerprint, b.pdfFingerprint);
});

test('different bytes produce different fingerprints', async () => {
  const a = await computeStamp(bytes('content one'));
  const b = await computeStamp(bytes('content two'));
  assert.notEqual(a.pdfFingerprint, b.pdfFingerprint);
});

test('analyzedAt is a valid ISO string near current time', async () => {
  const before = Date.now();
  const stamp = await computeStamp(bytes('x'));
  const after = Date.now();
  const parsed = Date.parse(stamp.analyzedAt);
  assert.ok(!Number.isNaN(parsed), 'analyzedAt must be ISO-parseable');
  assert.ok(parsed >= before && parsed <= after, 'analyzedAt must be within call window');
});
