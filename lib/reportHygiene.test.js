import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripRawText, clearPrintPayload } from './reportHygiene.js';

test('stripRawText removes rawText from every facility', () => {
  const input = {
    subject: { name: 'X' },
    facilities: [
      { contractCode: 'A', rawText: 'lots of pdf text' },
      { contractCode: 'B', rawText: 'more pdf text' },
    ],
  };
  const out = stripRawText(input);
  assert.equal(out.facilities[0].rawText, undefined);
  assert.equal(out.facilities[1].rawText, undefined);
  assert.equal(out.facilities[0].contractCode, 'A');
});

test('stripRawText does not mutate the input', () => {
  const input = { facilities: [{ contractCode: 'A', rawText: 'keep' }] };
  stripRawText(input);
  assert.equal(input.facilities[0].rawText, 'keep');
});

test('stripRawText preserves all non-rawText fields', () => {
  const input = {
    subject: { name: 'X', nid: '123' },
    reportNo: 'R1',
    facilities: [{ contractCode: 'A', rawText: 'x', outstanding: 100 }],
  };
  const out = stripRawText(input);
  assert.equal(out.subject.nid, '123');
  assert.equal(out.reportNo, 'R1');
  assert.equal(out.facilities[0].outstanding, 100);
});

test('stripRawText handles arrays of reports', () => {
  const input = [
    { facilities: [{ rawText: 'x', c: 1 }] },
    { facilities: [{ rawText: 'y', c: 2 }] },
  ];
  const out = stripRawText(input);
  assert.equal(out[0].facilities[0].rawText, undefined);
  assert.equal(out[1].facilities[0].rawText, undefined);
  assert.equal(out[0].facilities[0].c, 1);
});

test('stripRawText handles missing facilities array gracefully', () => {
  const input = { subject: { name: 'X' } };
  const out = stripRawText(input);
  assert.equal(out.subject.name, 'X');
});

test('clearPrintPayload removes cibxray.printPayload from a storage-like object', () => {
  const storage = {
    'cibxray.printPayload': 'data',
    other_key: 'keep',
    removeItem(k) { delete this[k]; },
  };
  clearPrintPayload(storage);
  assert.equal(storage['cibxray.printPayload'], undefined);
  assert.equal(storage.other_key, 'keep');
});

test('clearPrintPayload no-ops when the key is absent', () => {
  const storage = { other: 'x', removeItem(k) { delete this[k]; } };
  assert.doesNotThrow(() => clearPrintPayload(storage));
});
