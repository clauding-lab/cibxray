/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 5 (Credit Cards) builder tests.
 *
 * 17 columns, two sections (Live + Terminated). Wraps analyzeCreditCard
 * output into the column layout; adds Page No. and explicit Overlimit
 * History and Highest Overdue (amount) columns.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreditCardsRows } from '../src/export/retailExport/sheet5_creditCards.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Credit Card',
  limit: 500_000,
  outstanding: 200_000,
  overdue: 0,
  classification: 'STD',
  contractCode: 'CC001',
  pageNo: 11,
  startDate: '01/01/2023',
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'CardHolder' }) => ({
  facilities,
  subject,
});

test('buildCreditCardsRows emits section + column headers (17 cols)', () => {
  const rows = buildCreditCardsRows(report([]));
  assert.equal(rows[0][0], 'Live Contracts');
  assert.equal(rows[1].length, 17);
  assert.equal(rows[1][0], 'Borrower');
});

test('buildCreditCardsRows filters for credit card facilities only', () => {
  const rows = buildCreditCardsRows(report([
    fac({ contractCode: 'CC1', type: 'Credit Card' }),
    fac({ contractCode: 'TL', type: 'Term Loan' }),
    fac({ contractCode: 'OD', type: 'Overdraft' }),
  ]));
  const codes = rows.map(r => r[1]).filter(Boolean);
  assert.ok(codes.includes('CC1'));
  assert.ok(!codes.includes('TL'));
  assert.ok(!codes.includes('OD'));
});

test('buildCreditCardsRows populates utilization and overlimit columns', () => {
  const rows = buildCreditCardsRows(report([
    fac({
      contractCode: 'CC2',
      limit: 100_000,
      outstanding: 90_000,
      history: [
        { dateStr: '01/01/2024', outstanding: 50_000, overdue: 0, limit: 100_000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 110_000, overdue: 10_000, limit: 100_000, npi: 1, status: 'SMA' },
      ],
    }),
  ]));
  const r = rows.find(row => row[1] === 'CC2');
  // Columns (0-indexed):
  //  0 Borrower, 1 Ref, 2 Page, 3 Role, 4 CIB Code, 5 Start, 6 Limit, 7 Outstanding,
  //  8 Util%, 9 Avg12M%, 10 Max12M%, 11 Overlimit, 12 Status (cur), 13 Status (live/term),
  //  14 NPI, 15 Overdue (cur M), 16 Highest Overdue (M)
  assert.equal(r[6], 0.1); // limit M
  assert.equal(r[7], 0.09); // outstanding M
  assert.equal(r[8], 90); // current utilization %
  assert.equal(r[11], 1); // overlimit months
  // Highest overdue = 10_000 BDT = 0.01M
  assert.equal(r[16], 0.01);
});
