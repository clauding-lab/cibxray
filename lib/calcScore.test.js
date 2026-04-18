import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcScore } from '../src/scoring/calcScore.js';

test('clamps negative outstanding to 0', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 1_000_000, outstanding: -500_000, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tOut, 0);
});

test('clamps NaN outstanding to 0', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 1_000_000, outstanding: NaN, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tOut, 0);
});

test('clamps negative limit and overdue', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: -1_000_000, outstanding: 500_000, overdue: -10 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tLim, 0);
  assert.equal(result.agg.tOver, 0);
});

test('returns first-timer tier at fixed 65 when no funded facilities of any kind', () => {
  const facs = [
    { status: 'Live', nature: 'Non-Funded', classification: 'STD', limit: 1_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'first-timer');
  assert.equal(result.total, 65);
  assert.ok(result.dataTierNote.includes('First-time'));
});

test('returns first-timer tier at fixed 65 when facilities array is empty', () => {
  const result = calcScore([]);
  assert.equal(result.dataTier, 'first-timer');
  assert.equal(result.total, 65);
});
