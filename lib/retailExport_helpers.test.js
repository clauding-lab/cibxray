/**
 * DevReq-2 Phase 3 — Retail Exporter shared helpers tests.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMillions,
  yesNo,
  worstOf,
  parseInquiryDate,
  daysBetween,
} from '../src/export/retailExport/helpers.js';

test('toMillions divides by 1,000,000 and rounds to 2 decimals', () => {
  assert.equal(toMillions(1_000_000), 1);
  assert.equal(toMillions(1_234_567), 1.23);
  assert.equal(toMillions(999_999), 1); // rounded
  assert.equal(toMillions(500_000), 0.5);
});

test('toMillions handles null, undefined and non-finite', () => {
  assert.equal(toMillions(null), 0);
  assert.equal(toMillions(undefined), 0);
  assert.equal(toMillions(NaN), 0);
  assert.equal(toMillions(Infinity), 0);
});

test('toMillions handles zero and negative numbers', () => {
  assert.equal(toMillions(0), 0);
  assert.equal(toMillions(-1_500_000), -1.5);
});

test('yesNo returns "Yes" for truthy, "No" for falsy', () => {
  assert.equal(yesNo(true), 'Yes');
  assert.equal(yesNo(1), 'Yes');
  assert.equal(yesNo(false), 'No');
  assert.equal(yesNo(0), 'No');
  assert.equal(yesNo(null), 'No');
});

test('worstOf orders BLW > BL > DF > SS > SMA > STD', () => {
  assert.equal(worstOf('STD', 'SMA'), 'SMA');
  assert.equal(worstOf('SMA', 'SS'), 'SS');
  assert.equal(worstOf('SS', 'DF'), 'DF');
  assert.equal(worstOf('DF', 'BL'), 'BL');
  assert.equal(worstOf('BL', 'BLW'), 'BLW');
  assert.equal(worstOf('BLW', 'STD'), 'BLW');
});

test('worstOf treats unknown classifications as STD', () => {
  assert.equal(worstOf('UNKNOWN', 'SMA'), 'SMA');
  assert.equal(worstOf('UNKNOWN', 'STD'), 'UNKNOWN'); // fallback rank ties
});

test('parseInquiryDate parses "DD-Mon-YYYY" prefix', () => {
  const d = parseInquiryDate('15-Mar-2026');
  assert.ok(d instanceof Date);
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 2); // Mar = 2
  assert.equal(d.getUTCDate(), 15);
});

test('parseInquiryDate handles trailing time', () => {
  const d = parseInquiryDate('15-Mar-2026 11:23:45 AM');
  assert.ok(d instanceof Date);
  assert.equal(d.getUTCDate(), 15);
});

test('parseInquiryDate returns null for invalid input', () => {
  assert.equal(parseInquiryDate(''), null);
  assert.equal(parseInquiryDate(null), null);
  assert.equal(parseInquiryDate('garbage'), null);
  assert.equal(parseInquiryDate('15-ZZZ-2026'), null);
});

test('daysBetween returns whole UTC-day difference', () => {
  const start = new Date('2026-03-20T00:00:00Z');
  const end = new Date('2026-04-24T00:00:00Z');
  assert.equal(daysBetween(start, end), 35);
});

test('daysBetween returns 0 for same day', () => {
  const d = new Date('2026-03-20T00:00:00Z');
  assert.equal(daysBetween(d, d), 0);
});
