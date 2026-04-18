import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDhakaTimestamp } from '../src/stamp/formatDhaka.js';

test('renders UTC input in Asia/Dhaka (+06:00) timezone', () => {
  const out = formatDhakaTimestamp('2026-04-18T08:32:00.000Z');
  assert.equal(out, '18 Apr 2026 14:32');
});

test('output is independent of process.env.TZ', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  const out = formatDhakaTimestamp('2026-04-18T08:32:00.000Z');
  process.env.TZ = prev;
  assert.equal(out, '18 Apr 2026 14:32');
});

test('handles midnight-Dhaka boundary correctly', () => {
  const out = formatDhakaTimestamp('2026-04-17T18:00:00.000Z');
  assert.equal(out, '18 Apr 2026 00:00');
});

test('pads single-digit hour and preserves 24h format', () => {
  const out = formatDhakaTimestamp('2026-04-18T02:15:00.000Z');
  assert.equal(out, '18 Apr 2026 08:15');
});
