/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 4 (Non-Installment Loan) builder tests.
 *
 * Covers non-installment facilities: Overdraft, Demand Loan, LC, Guarantee,
 * etc. 19 columns, two sections Live + Terminated with utilization metrics.
 * Credit Card facilities go to Sheet 5, not Sheet 4.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNonInstallmentRows } from '../src/export/retailExport/sheet4_nonInstallment.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Overdraft',
  limit: 2_000_000,
  outstanding: 1_500_000,
  overdue: 0,
  installmentAmount: 0,
  classification: 'STD',
  contractCode: 'NI001',
  pageNo: 9,
  securityType: '',
  startDate: '01/01/2023',
  endDate: '31/12/2025',
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'B' }) => ({ facilities, subject });

test('buildNonInstallmentRows emits section headers + column headers', () => {
  const rows = buildNonInstallmentRows(report([]));
  assert.equal(rows[0][0], 'Live Contracts');
  assert.equal(rows[1].length, 19);
  assert.equal(rows[1][0], 'Borrower');
  const termIdx = rows.findIndex(r => r[0] === 'Terminated Contracts');
  assert.ok(termIdx > 0);
});

test('buildNonInstallmentRows includes Overdraft, DL, LC, Guarantee; excludes Term Loan and Credit Card', () => {
  const rows = buildNonInstallmentRows(report([
    fac({ contractCode: 'OD', type: 'Overdraft' }),
    fac({ contractCode: 'LC', type: 'Letter of credit' }),
    fac({ contractCode: 'GUAR', type: 'Guarantee' }),
    fac({ contractCode: 'TL', type: 'Term Loan', installmentAmount: 25_000 }),
    fac({ contractCode: 'CC', type: 'Credit Card' }),
  ]));
  const codes = rows.map(r => r[1]).filter(Boolean);
  assert.ok(codes.includes('OD'));
  assert.ok(codes.includes('LC'));
  assert.ok(codes.includes('GUAR'));
  assert.ok(!codes.includes('TL'));
  assert.ok(!codes.includes('CC'));
});

test('buildNonInstallmentRows emits utilization columns in %', () => {
  const rows = buildNonInstallmentRows(report([
    fac({
      contractCode: 'UTIL',
      limit: 1_000_000,
      outstanding: 800_000,
      history: [
        { dateStr: '01/01/2024', outstanding: 500_000, overdue: 0, limit: 1_000_000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 750_000, overdue: 0, limit: 1_000_000, npi: 0, status: 'STD' },
        { dateStr: '01/03/2024', outstanding: 1_200_000, overdue: 200_000, limit: 1_000_000, npi: 1, status: 'SMA' },
      ],
    }),
  ]));
  const r = rows.find(row => row[1] === 'UTIL');
  // Layout: ...Limit(8), Outstanding(9), Utilization%(10), Avg12M%(11), Max12M%(12), Overlimit months(13)...
  assert.equal(r[10], 80); // current utilization 800/1000
  // avg = (500 + 750 + 1200) / 1000 / 3 * 100 = 81.67
  assert.ok(Math.abs(r[11] - 81.67) < 1);
  assert.equal(r[12], 120); // max utilization
  assert.equal(r[13], 1); // 1 month outstanding > limit
});

test('buildNonInstallmentRows handles zero-limit facility without crash', () => {
  const rows = buildNonInstallmentRows(report([
    fac({ contractCode: 'ZL', limit: 0, outstanding: 0, history: [] }),
  ]));
  const r = rows.find(row => row[1] === 'ZL');
  assert.equal(r[10], ''); // current utilization blank when limit=0
});
