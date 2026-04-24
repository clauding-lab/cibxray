/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 7 (Overdue Loans) builder tests.
 *
 * All facilities where overdue > 0 today. Columns (spec §4 Sheet 7):
 *   Borrower Name | Ref. No. | Page No. | Sanclimit | Outstanding |
 *   Overdue | NPI | Highest NPI | Status
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverdueLoansRows } from '../src/export/retailExport/sheet7_overdueLoans.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Term Loan',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  installmentAmount: 25_000,
  startDate: '01/01/2023',
  endDate: '31/12/2025',
  classification: 'STD',
  contractCode: 'C001',
  pageNo: 1,
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'Subject A' }) => ({
  facilities,
  subject,
});

test('buildOverdueLoansRows filters for overdue > 0', () => {
  const rows = buildOverdueLoansRows(report([
    fac({ contractCode: 'A', overdue: 0 }),
    fac({ contractCode: 'B', overdue: 100_000 }),
    fac({ contractCode: 'C', overdue: 50 }),
  ]));
  // Header + 2 data rows (B and C)
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], 'B');
  assert.equal(rows[2][1], 'C');
});

test('buildOverdueLoansRows header matches spec', () => {
  const rows = buildOverdueLoansRows(report([]));
  assert.deepEqual(rows[0], [
    'Borrower Name', 'Ref. No.', 'Page No.', 'Sanclimit', 'Outstanding',
    'Overdue', 'NPI', 'Highest NPI', 'Status',
  ]);
});

test('buildOverdueLoansRows emits amounts in millions', () => {
  const rows = buildOverdueLoansRows(report([
    fac({
      contractCode: 'X',
      limit: 2_000_000,
      outstanding: 1_500_000,
      overdue: 300_000,
      classification: 'SS',
      pageNo: 42,
      history: [
        { dateStr: '01/01/2024', outstanding: 1_400_000, overdue: 100_000, limit: 2_000_000, npi: 1, status: 'SMA' },
        { dateStr: '01/02/2024', outstanding: 1_500_000, overdue: 300_000, limit: 2_000_000, npi: 3, status: 'SS' },
      ],
    }),
  ]));
  const r = rows[1];
  assert.equal(r[0], 'Subject A');
  assert.equal(r[1], 'X');
  assert.equal(r[2], 42);
  assert.equal(r[3], 2); // Sanclimit millions
  assert.equal(r[4], 1.5); // Outstanding millions
  assert.equal(r[5], 0.3); // Overdue millions
  assert.equal(r[6], 2); // currentNpi = 2 consecutive overdue months walking backward
  assert.equal(r[7], 3); // Highest NPI across all history rows
  assert.equal(r[8], 'SS');
});

test('buildOverdueLoansRows returns header only when no overdue facilities', () => {
  const rows = buildOverdueLoansRows(report([fac()]));
  assert.equal(rows.length, 1);
});
