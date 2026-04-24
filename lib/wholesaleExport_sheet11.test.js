/**
 * Tests for wholesale Sheet 11 — Non Funded Overdue Summary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNonFundedOverdueRows } from '../src/export/wholesaleExport/sheet11_nonFundedOverdue.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY', tradeName: 'Test Co.' },
  facilities,
});

const overdueNonFunded = {
  contractCode: 'LC-001',
  type: 'Letter of Credit',
  nature: 'Non-Funded',
  startDate: '01/01/2023',
  endDate: '01/01/2024',
  outstanding: 2_000_000,
  overdue: 500_000,
  classification: 'SS',
  role: 'Borrower',
  status: 'Live',
  pageNo: 4,
  history: [
    { dateStr: '2023-10', overdue: 500_000, npi: 1, status: 'SS' },
  ],
};

const noOverdueNonFunded = {
  contractCode: 'BG-001',
  type: 'Guarantee',
  nature: 'Non-Funded',
  startDate: '01/01/2023',
  endDate: '01/01/2024',
  outstanding: 3_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 6,
  history: [],
};

const overdrueFunded = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2022',
  endDate: '01/01/2027',
  outstanding: 4_000_000,
  overdue: 200_000,
  classification: 'SMA',
  role: 'Borrower',
  status: 'Live',
  pageNo: 2,
  history: [],
};

test('buildNonFundedOverdueRows emits correct header with 13 columns', () => {
  const rows = buildNonFundedOverdueRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 13);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][12], 'Current Classification');
});

test('buildNonFundedOverdueRows includes only overdue non-funded facilities', () => {
  const r = makeReport([overdueNonFunded, noOverdueNonFunded, overdrueFunded]);
  const rows = buildNonFundedOverdueRows([r]);
  assert.equal(rows.length, 2); // header + 1 (only overdueNonFunded)
  assert.equal(rows[1][3], 'LC-001');
});

test('buildNonFundedOverdueRows populates all 13 columns correctly', () => {
  const rows = buildNonFundedOverdueRows([makeReport([overdueNonFunded])]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[1], '1011500056801.pdf');
  assert.equal(row[2], 'COMPANY');
  assert.equal(row[3], 'LC-001');
  assert.equal(row[4], 'Letter of Credit');
  assert.equal(row[5], 4);
  assert.equal(row[6], 'Borrower');
  assert.equal(row[7], '01/01/2023');
  assert.equal(row[8], '01/01/2024');
  assert.equal(row[9], 2);   // 2,000,000 million
  assert.equal(row[10], 0.5); // 500,000 million
  assert.equal(row[11], 1);  // currentNpi from history
  assert.equal(row[12], 'SS');
});

test('buildNonFundedOverdueRows handles no overdue non-funded facilities', () => {
  const rows = buildNonFundedOverdueRows([makeReport([noOverdueNonFunded])]);
  assert.equal(rows.length, 1); // header only
});

test('buildNonFundedOverdueRows aggregates across multiple reports', () => {
  const r1 = makeReport([overdueNonFunded]);
  const r2 = makeReport([{ ...overdueNonFunded, contractCode: 'LC-002' }]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildNonFundedOverdueRows([r1, r2]);
  assert.equal(rows.length, 3);
});
