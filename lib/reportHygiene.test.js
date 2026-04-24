import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripRawText, stripForPrint, stripForPrintGroup, clearPrintPayload } from './reportHygiene.js';

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

test('stripForPrint removes rawText AND history from every facility', () => {
  const input = {
    subject: { name: 'X' },
    facilities: [
      { contractCode: 'A', rawText: 'pdf text', history: [{ m: 1 }, { m: 2 }] },
      { contractCode: 'B', rawText: 'more', history: [{ m: 1 }] },
    ],
  };
  const out = stripForPrint(input);
  assert.equal(out.facilities[0].rawText, undefined);
  assert.equal(out.facilities[0].history, undefined);
  assert.equal(out.facilities[1].rawText, undefined);
  assert.equal(out.facilities[1].history, undefined);
  assert.equal(out.facilities[0].contractCode, 'A');
});

test('stripForPrint does not mutate the input', () => {
  const input = { facilities: [{ contractCode: 'A', rawText: 'keep', history: [{ m: 1 }] }] };
  stripForPrint(input);
  assert.equal(input.facilities[0].rawText, 'keep');
  assert.equal(input.facilities[0].history.length, 1);
});

test('stripForPrint preserves non-stripped facility fields', () => {
  const input = {
    subject: { name: 'X', nid: '123' },
    reportNo: 'R1',
    facilities: [{
      contractCode: 'A', rawText: 'x', history: [{ m: 1 }],
      outstanding: 100, overdue: 5, classification: 'STD',
      role: 'Borrower', type: 'Term Loan', startDate: '01/01/2024',
    }],
  };
  const out = stripForPrint(input);
  assert.equal(out.subject.nid, '123');
  assert.equal(out.reportNo, 'R1');
  assert.equal(out.facilities[0].outstanding, 100);
  assert.equal(out.facilities[0].overdue, 5);
  assert.equal(out.facilities[0].classification, 'STD');
  assert.equal(out.facilities[0].role, 'Borrower');
  assert.equal(out.facilities[0].type, 'Term Loan');
});

test('stripForPrint handles arrays of reports', () => {
  const input = [
    { facilities: [{ rawText: 'x', history: [1, 2], c: 1 }] },
    { facilities: [{ rawText: 'y', history: [3], c: 2 }] },
  ];
  const out = stripForPrint(input);
  assert.equal(out[0].facilities[0].rawText, undefined);
  assert.equal(out[0].facilities[0].history, undefined);
  assert.equal(out[1].facilities[0].history, undefined);
  assert.equal(out[0].facilities[0].c, 1);
});

test('stripForPrint handles missing facilities array gracefully', () => {
  const input = { subject: { name: 'X' } };
  const out = stripForPrint(input);
  assert.equal(out.subject.name, 'X');
});

test('stripForPrintGroup projects reports to minimal group-table shape', () => {
  const input = [{
    reportNo: 'R1',
    fileName: '123.pdf',
    inquiryDate: '01-Jan-2026',
    subject: { subjectType: 'COMPANY', displayName: 'X', cibSubjectCode: 'A1', nid: 'N1' },
    directors: [{ name: 'D1' }],
    linkedProprietorships: [{ tradeName: 'P1' }],
    relatedConcerns: [{}],
    summary: { foo: 'bar' },
    facilities: [{
      rawText: 'pdf', history: [{ m: 1 }],
      role: 'Borrower', type: 'Term Loan', startDate: '01/01/2024',
      endDate: '01/01/2026', outstanding: 1000000, overdue: 50000,
      classification: 'STD',
      contractCode: 'C1', pageNo: 5, securityType: '80',
      installmentAmount: 25000, totalInstallments: 24,
      remainingInstallmentsCount: 12, paymentPeriodicity: 'Monthly',
    }],
  }];
  const out = stripForPrintGroup(input);
  // Kept: only subject.subjectType + minimal facility fields
  assert.equal(out[0].subject.subjectType, 'COMPANY');
  assert.equal(out[0].subject.displayName, undefined);
  assert.equal(out[0].subject.nid, undefined);
  assert.equal(out[0].reportNo, undefined);
  assert.equal(out[0].directors, undefined);
  assert.equal(out[0].linkedProprietorships, undefined);
  assert.equal(out[0].summary, undefined);
  const f = out[0].facilities[0];
  assert.equal(f.role, 'Borrower');
  assert.equal(f.type, 'Term Loan');
  assert.equal(f.startDate, '01/01/2024');
  assert.equal(f.endDate, '01/01/2026');
  assert.equal(f.outstanding, 1000000);
  assert.equal(f.overdue, 50000);
  assert.equal(f.classification, 'STD');
  // Dropped: everything else
  assert.equal(f.rawText, undefined);
  assert.equal(f.history, undefined);
  assert.equal(f.contractCode, undefined);
  assert.equal(f.pageNo, undefined);
  assert.equal(f.installmentAmount, undefined);
});

test('stripForPrintGroup returns [] on non-array input', () => {
  assert.deepEqual(stripForPrintGroup(null), []);
  assert.deepEqual(stripForPrintGroup(undefined), []);
  assert.deepEqual(stripForPrintGroup({}), []);
});

test('stripForPrintGroup handles missing facilities array', () => {
  const out = stripForPrintGroup([{ subject: { subjectType: 'INDIVIDUAL' } }]);
  assert.equal(out[0].subject.subjectType, 'INDIVIDUAL');
  assert.deepEqual(out[0].facilities, []);
});

test('stripForPrintGroup scales — projection is significantly smaller than full report', () => {
  const bigReport = {
    reportNo: 'R', fileName: 'x.pdf', inquiryDate: '01-Jan-2026',
    subject: { subjectType: 'COMPANY', displayName: 'X', cibSubjectCode: 'A', nid: 'N' },
    directors: Array.from({ length: 20 }, (_, i) => ({ name: 'D' + i, nid: 'NID' + i })),
    facilities: Array.from({ length: 95 }, (_, i) => ({
      rawText: 'A'.repeat(500), // simulate preserved rawText pressure
      history: Array.from({ length: 24 }, () => ({ dateStr: '01-Jan-2026', npi: 1, overdue: 100, outstanding: 10000, limit: 20000 })),
      role: 'Borrower', type: 'Term Loan', startDate: '01/01/2024',
      endDate: '01/01/2026', outstanding: i * 1000, overdue: 0, classification: 'STD',
      contractCode: 'C' + i, pageNo: i, securityType: '80',
    })),
  };
  const fullSize = JSON.stringify(bigReport).length;
  const projectedSize = JSON.stringify(stripForPrintGroup([bigReport])).length;
  // Projection should be at least 10x smaller
  assert.ok(projectedSize * 10 < fullSize, `Expected projectedSize*10 < fullSize, got ${projectedSize} vs ${fullSize}`);
});
