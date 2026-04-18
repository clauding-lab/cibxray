import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessParseQuality } from '../src/parser/parseQuality.js';

test('returns ok when sums match summary exactly', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('returns unavailable when summary section is missing', () => {
  const report = { summary: {}, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});

test('returns unavailable when summary.totalOutstanding is null', () => {
  const report = { summary: { totalOutstanding: null, totalOverdue: null }, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});
