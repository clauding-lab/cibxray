import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/crash-log.js';

function makeReq(method, body, headers = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body,
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    send(b) { this.body = b; return this; },
    end(b) { this.body = b; return this; },
  };
  return res;
}

test('crash-log: rejects GET with 405', async () => {
  const res = makeRes();
  await handler(makeReq('GET'), res);
  assert.equal(res.statusCode, 405);
});

test('crash-log: rejects body larger than 4096 bytes', async () => {
  const big = 'x'.repeat(5000);
  const res = makeRes();
  await handler(makeReq('POST', JSON.stringify({ message: big })), res);
  assert.equal(res.statusCode, 413);
});

test('crash-log: accepts valid POST body', async () => {
  const res = makeRes();
  const payload = { message: 'boom', stack: 'at foo', timestamp: '2026-04-20T00:00:00Z' };
  await handler(makeReq('POST', JSON.stringify(payload)), res);
  assert.equal(res.statusCode, 204);
});
