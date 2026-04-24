/**
 * Tests for wholesale Sheet 8 — Overdraft & CC.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverdraftCcRows } from '../src/export/wholesaleExport/sheet8_overdraftCC.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY' },
  facilities,
});

const overdraftFacility = {
  contractCode: 'OD-001',
  type: 'Overdraft',
  nature: 'Funded',
  startDate: '01/01/2023',
  endDate: '01/01/2024',
  limit: 10_000_000,
  outstanding: 7_500_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 2,
  history: [
    { dateStr: '2023-06', outstanding: 8_000_000, overdue: 0, npi: 0, status: 'STD', limit: 10_000_000 },
    { dateStr: '2023-09', outstanding: 9_200_000, overdue: 0, npi: 0, status: 'STD', limit: 10_000_000 },
    { dateStr: '2023-12', outstanding: 7_500_000, overdue: 0, npi: 0, status: 'STD', limit: 10_000_000 },
  ],
};

const creditCardFacility = {
  contractCode: 'CC-001',
  type: 'Credit Card',
  nature: 'Funded',
  startDate: '01/01/2023',
  endDate: '01/01/2024',
  limit: 500_000,
  outstanding: 480_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 5,
  history: [],
};

const termLoanFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2025',
  limit: 20_000_000,
  outstanding: 12_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 1,
  history: [],
};

test('buildOverdraftCcRows emits correct header with 15 columns', () => {
  const rows = buildOverdraftCcRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 15);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][13], 'Performance Utilization');
  assert.equal(rows[0][14], 'Highest NPI');
});

test('buildOverdraftCcRows includes only OD and CC facilities', () => {
  const r = makeReport([overdraftFacility, creditCardFacility, termLoanFacility]);
  const rows = buildOverdraftCcRows([r]);
  assert.equal(rows.length, 3); // header + OD + CC
});

test('buildOverdraftCcRows computes performance utilization correctly', () => {
  // mean util = (8.0 + 9.2 + 7.5) / 3 / 10 = 0.823 → Moderate (>=0.75 <=0.9)
  const rows = buildOverdraftCcRows([makeReport([overdraftFacility])]);
  assert.equal(rows[1][13], 'Moderate');
});

test('buildOverdraftCcRows shows N/A utilization when no history', () => {
  const rows = buildOverdraftCcRows([makeReport([creditCardFacility])]);
  assert.equal(rows[1][13], 'N/A');
});

test('buildOverdraftCcRows populates all 15 columns correctly', () => {
  const rows = buildOverdraftCcRows([makeReport([overdraftFacility])]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[3], 'OD-001');
  assert.equal(row[4], 'Overdraft');
  assert.equal(row[5], 2);
  assert.equal(row[7], 'Live');
  assert.equal(row[8], 10);  // 10,000,000 million
  assert.equal(row[9], 7.5); // 7,500,000 million
  assert.equal(row[10], '-'); // zero overdue
  assert.equal(row[11], 0);  // no current NPI
  assert.equal(row[12], 'STD');
  assert.equal(row[14], 0);  // no historical NPI
});

test('buildOverdraftCcRows aggregates across multiple reports', () => {
  const r1 = makeReport([overdraftFacility]);
  const r2 = makeReport([creditCardFacility]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildOverdraftCcRows([r1, r2]);
  assert.equal(rows.length, 3); // header + 2 facilities
});
