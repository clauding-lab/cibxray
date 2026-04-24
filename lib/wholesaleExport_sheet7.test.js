/**
 * Tests for wholesale Sheet 7 — STF Overdue Details.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStfOverdueRows } from '../src/export/wholesaleExport/sheet7_stfOverdue.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY' },
  facilities,
});

// STF = short-term + funded: endDate - startDate <= 12 months
const stfOverdueFacility = {
  contractCode: 'DL-001',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',   // 8 months — short-term
  outstanding: 4_000_000,
  overdue: 600_000,
  classification: 'SMA',
  role: 'Borrower',
  status: 'Live',
  pageNo: 2,
  history: [
    { dateStr: '2025-06', overdue: 600_000, npi: 1, status: 'SMA' },
    { dateStr: '2025-07', overdue: 800_000, npi: 2, status: 'SS' },
  ],
};

// Long-term — should not appear on this sheet
const ltOverdueFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2025',  // 5 years — long-term
  outstanding: 5_000_000,
  overdue: 100_000,
  classification: 'SMA',
  role: 'Borrower',
  status: 'Live',
  pageNo: 1,
  history: [],
};

// Non-funded — should not appear on this sheet
const nonFundedOverdue = {
  contractCode: 'LC-001',
  type: 'Letter of Credit',
  nature: 'Non-Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',
  outstanding: 2_000_000,
  overdue: 300_000,
  classification: 'SMA',
  role: 'Borrower',
  status: 'Live',
  pageNo: 3,
  history: [],
};

test('buildStfOverdueRows emits correct header with 13 columns', () => {
  const rows = buildStfOverdueRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 13);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][11], 'Worst Status (Previous)');
  assert.equal(rows[0][12], 'Highest NPI');
});

test('buildStfOverdueRows includes only overdue short-term funded facilities', () => {
  const r = makeReport([stfOverdueFacility, ltOverdueFacility, nonFundedOverdue]);
  const rows = buildStfOverdueRows([r]);
  assert.equal(rows.length, 2); // header + 1 STF overdue
  assert.equal(rows[1][3], 'DL-001');
});

test('buildStfOverdueRows populates all 13 columns correctly', () => {
  const rows = buildStfOverdueRows([makeReport([stfOverdueFacility])]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[1], '1011500056801.pdf');
  assert.equal(row[3], 'DL-001');
  assert.equal(row[4], 'Demand Loan');
  assert.equal(row[5], 2);
  assert.equal(row[6], 'Borrower');
  assert.equal(row[7], 4);    // 4,000,000 million
  assert.equal(row[8], 0.6);  // 600,000 million
  assert.equal(row[9], 2);    // currentNpi: both history rows have overdue > 0
  assert.equal(row[10], 'SMA');
  assert.equal(row[11], 'SS');  // worstStatus
  assert.equal(row[12], 2);     // highestNpi
});

test('buildStfOverdueRows skips non-overdue STF facilities', () => {
  const noOverdue = { ...stfOverdueFacility, overdue: 0 };
  const rows = buildStfOverdueRows([makeReport([noOverdue])]);
  assert.equal(rows.length, 1);
});

test('buildStfOverdueRows aggregates across multiple reports', () => {
  const r1 = makeReport([stfOverdueFacility]);
  const r2 = makeReport([{ ...stfOverdueFacility, contractCode: 'DL-002' }]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildStfOverdueRows([r1, r2]);
  assert.equal(rows.length, 3);
});
