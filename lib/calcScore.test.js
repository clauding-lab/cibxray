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

test('returns historical-clean tier at fixed 80 when only historical clean funded', () => {
  const facs = [
    { status: 'Terminated', nature: 'Funded', classification: 'STD', limit: 10_000_000, outstanding: 0, overdue: 0 },
    { status: 'Closed', nature: 'Funded', classification: 'UC', limit: 5_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'historical-clean');
  assert.equal(result.total, 80);
  assert.ok(result.dataTierNote.includes('historical'));
});

test('historical with adverse classification falls through to live math with override', () => {
  const facs = [
    { status: 'Terminated', nature: 'Funded', classification: 'DF', limit: 10_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'live');
  assert.ok(result.total <= 59);
});

test('live funded takes precedence over historical-clean', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 10_000_000, outstanding: 5_000_000, overdue: 0 },
    { status: 'Terminated', nature: 'Funded', classification: 'STD', limit: 5_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'live');
});
