import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTopFacilities } from '../src/components/report/selectTopFacilities.js';

const make = (os, extra = {}) => ({ outstanding: os, status: 'live', nature: 'funded', ...extra });

test('returns all facilities when count <= limit', () => {
  const input = [make(100), make(50), make(200)];
  const out = selectTopFacilities(input, 10);
  assert.equal(out.length, 3);
});

test('returns top 10 by outstanding descending when count > limit', () => {
  const input = Array.from({ length: 15 }, (_, i) => make((i + 1) * 10));
  const out = selectTopFacilities(input, 10);
  assert.equal(out.length, 10);
  assert.equal(out[0].outstanding, 150);
  assert.equal(out[9].outstanding, 60);
});

test('ties on outstanding: live status ranks above historical', () => {
  const input = [
    make(100, { status: 'historical', id: 'h' }),
    make(100, { status: 'live', id: 'l' }),
  ];
  const out = selectTopFacilities(input, 10);
  assert.equal(out[0].id, 'l');
  assert.equal(out[1].id, 'h');
});

test('ties on outstanding and status: funded ranks above non-funded', () => {
  const input = [
    make(100, { nature: 'non-funded', id: 'nf' }),
    make(100, { nature: 'funded', id: 'f' }),
  ];
  const out = selectTopFacilities(input, 10);
  assert.equal(out[0].id, 'f');
  assert.equal(out[1].id, 'nf');
});

test('empty input returns empty output', () => {
  assert.deepEqual(selectTopFacilities([], 10), []);
});
