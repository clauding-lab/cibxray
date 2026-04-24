/**
 * Tests for wholesale Sheet 10 — Forced Loan Summary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildForcedLoanSummaryRows } from '../src/export/wholesaleExport/sheet10_forcedLoanSummary.js';

const makeReport = (facilities = [], overrides = {}) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY', tradeName: 'Test Co.' },
  facilities,
  ...overrides,
});

// Forced loan: endDate - startDate <= 5 days
const forcedFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '04/01/2020', // 3 days — forced
  outstanding: 5_000_000,
  overdue: 0,
  role: 'Borrower',
  status: 'Live',
};

// Normal loan: endDate - startDate > 5 days
const normalFacility = {
  contractCode: 'TL-002',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '01/01/2025', // 5 years — not forced
  outstanding: 3_000_000,
  overdue: 0,
  role: 'Borrower',
  status: 'Live',
};

// Terminated forced — should NOT count
const terminatedForced = {
  contractCode: 'TL-003',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '02/01/2020',
  outstanding: 1_000_000,
  overdue: 0,
  role: 'Borrower',
  status: 'Terminated',
};

test('buildForcedLoanSummaryRows emits correct header', () => {
  const rows = buildForcedLoanSummaryRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][3], 'Outstanding Amount, Living (BDT Million)');
  assert.equal(rows[0][4], 'No. of Forced Loan Instances');
});

test('buildForcedLoanSummaryRows emits one row per report', () => {
  const r = makeReport([forcedFacility]);
  const rows = buildForcedLoanSummaryRows([r]);
  assert.equal(rows.length, 2); // header + 1 report row
});

test('buildForcedLoanSummaryRows counts live forced loans correctly', () => {
  const r = makeReport([forcedFacility, normalFacility, terminatedForced]);
  const rows = buildForcedLoanSummaryRows([r]);
  const row = rows[1];
  assert.equal(row[3], 5);   // 5,000,000 / 1,000,000
  assert.equal(row[4], 1);   // only 1 live forced
});

test('buildForcedLoanSummaryRows shows "-" when zero outstanding from forced loans', () => {
  const r = makeReport([normalFacility]);
  const rows = buildForcedLoanSummaryRows([r]);
  assert.equal(rows[1][3], '-');
  assert.equal(rows[1][4], 0);
});

test('buildForcedLoanSummaryRows sums outstanding for multiple forced loans', () => {
  const f2 = { ...forcedFacility, contractCode: 'TL-004', outstanding: 3_000_000 };
  const r = makeReport([forcedFacility, f2]);
  const rows = buildForcedLoanSummaryRows([r]);
  assert.equal(rows[1][3], 8); // (5+3) million
  assert.equal(rows[1][4], 2);
});

test('buildForcedLoanSummaryRows handles multiple reports', () => {
  const r1 = makeReport([forcedFacility]);
  const r2 = makeReport([normalFacility], { fileName: '1011500056801-1.pdf' });
  const rows = buildForcedLoanSummaryRows([r1, r2]);
  assert.equal(rows.length, 3); // header + 2 report rows
  assert.equal(rows[1][4], 1);
  assert.equal(rows[2][4], 0);
});
