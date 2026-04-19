import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRateLimited, recordFailure, clientIp } from './rateLimit.js';

const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

test('isRateLimited: fresh key is not limited', () => {
  const store = new Map();
  assert.deepEqual(
    isRateLimited(store, '1.1.1.1', 1000, LIMIT),
    { limited: false, retryAfterMs: 0 },
  );
});

test('recordFailure + isRateLimited: under limit still not limited', () => {
  const store = new Map();
  for (let i = 0; i < LIMIT - 1; i += 1) {
    recordFailure(store, '1.1.1.1', 1000, WINDOW_MS);
  }
  assert.equal(isRateLimited(store, '1.1.1.1', 1000, LIMIT).limited, false);
});

test('recordFailure + isRateLimited: at limit is blocked with positive retryAfter', () => {
  const store = new Map();
  for (let i = 0; i < LIMIT; i += 1) {
    recordFailure(store, '1.1.1.1', 1000, WINDOW_MS);
  }
  const result = isRateLimited(store, '1.1.1.1', 1001, LIMIT);
  assert.equal(result.limited, true);
  assert.ok(result.retryAfterMs > 0);
});

test('window reset: after windowMs elapses, counter starts over', () => {
  const store = new Map();
  for (let i = 0; i < LIMIT; i += 1) {
    recordFailure(store, '1.1.1.1', 1000, WINDOW_MS);
  }
  assert.equal(isRateLimited(store, '1.1.1.1', 1000, LIMIT).limited, true);

  const afterWindow = 1000 + WINDOW_MS + 1;
  assert.equal(isRateLimited(store, '1.1.1.1', afterWindow, LIMIT).limited, false);

  recordFailure(store, '1.1.1.1', afterWindow, WINDOW_MS);
  assert.equal(store.get('1.1.1.1').count, 1);
});

test('distinct keys are tracked independently', () => {
  const store = new Map();
  for (let i = 0; i < LIMIT; i += 1) {
    recordFailure(store, '1.1.1.1', 1000, WINDOW_MS);
  }
  assert.equal(isRateLimited(store, '1.1.1.1', 1000, LIMIT).limited, true);
  assert.equal(isRateLimited(store, '2.2.2.2', 1000, LIMIT).limited, false);
});

test('retryAfterMs counts down as time advances', () => {
  const store = new Map();
  for (let i = 0; i < LIMIT; i += 1) {
    recordFailure(store, '1.1.1.1', 1000, WINDOW_MS);
  }
  const early = isRateLimited(store, '1.1.1.1', 1000, LIMIT).retryAfterMs;
  const later = isRateLimited(store, '1.1.1.1', 60_000, LIMIT).retryAfterMs;
  assert.ok(later < early);
});

test('clientIp prefers x-forwarded-for first entry', () => {
  const req = { headers: { 'x-forwarded-for': '3.3.3.3, 10.0.0.1' }, socket: {} };
  assert.equal(clientIp(req), '3.3.3.3');
});

test('clientIp falls back to x-real-ip', () => {
  const req = { headers: { 'x-real-ip': '4.4.4.4' }, socket: {} };
  assert.equal(clientIp(req), '4.4.4.4');
});

test('clientIp falls back to socket.remoteAddress', () => {
  const req = { headers: {}, socket: { remoteAddress: '5.5.5.5' } };
  assert.equal(clientIp(req), '5.5.5.5');
});

test('clientIp returns "unknown" when nothing is available', () => {
  const req = { headers: {}, socket: {} };
  assert.equal(clientIp(req), 'unknown');
});
