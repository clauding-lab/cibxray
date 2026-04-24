/**
 * Tests for wholesale Sheet 9 — Forced Loan Details.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForcedLoanDetailsRows } from '../src/export/wholesaleExport/sheet9_forcedLoanDetails.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY', tradeName: 'Test Co.' },
  facilities,
});

const forcedFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '04/01/2020',  // 3 days — forced
  outstanding: 5_000_000,
  overdue: 200_000,
  classification: 'SS',
  role: 'Borrower',
  status: 'Live',
  pageNo: 3,
  history: [
    { dateStr: '2020-01', overdue: 200_000, npi: 1, status: 'SS' },
    { dateStr: '2020-02', overdue: 300_000, npi: 2, status: 'DF' },
  ],
};

const normalFacility = {
  contractCode: 'TL-002',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '01/01/2025',
  outstanding: 3_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 5,
  history: [],
};

test('buildForcedLoanDetailsRows emits correct header with 15 columns', () => {
  const rows = buildForcedLoanDetailsRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 15);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][13], 'Worst Status (Previous)');
  assert.equal(rows[0][14], 'Current Classification');
});

test('buildForcedLoanDetailsRows includes only forced live loans', () => {
  const r = makeReport([forcedFacility, normalFacility]);
  const rows = buildForcedLoanDetailsRows([r]);
  assert.equal(rows.length, 2); // header + 1
  assert.equal(rows[1][3], 'TL-001');
});

test('buildForcedLoanDetailsRows populates all columns correctly', () => {
  const rows = buildForcedLoanDetailsRows([makeReport([forcedFacility])]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[1], '1011500056801.pdf');
  assert.equal(row[2], 'COMPANY');
  assert.equal(row[3], 'TL-001');
  assert.equal(row[4], 'Term Loan');
  assert.equal(row[5], 3);
  assert.equal(row[6], 'Borrower');
  assert.equal(row[7], '01/01/2020');
  assert.equal(row[8], '04/01/2020');
  assert.equal(row[9], 'Live');
  assert.equal(row[10], 5);   // millions
  assert.equal(row[11], 0.2); // 200k million
  assert.equal(row[12], 2);   // highestNpi from history
  assert.equal(row[13], 'DF');  // worstStatus
  assert.equal(row[14], 'SS'); // current classification
});

test('buildForcedLoanDetailsRows skips terminated forced loans', () => {
  const terminated = { ...forcedFacility, status: 'Terminated' };
  const rows = buildForcedLoanDetailsRows([makeReport([terminated])]);
  assert.equal(rows.length, 1); // header only
});

test('buildForcedLoanDetailsRows handles empty reports', () => {
  const rows = buildForcedLoanDetailsRows([]);
  assert.equal(rows.length, 1); // header only
});
