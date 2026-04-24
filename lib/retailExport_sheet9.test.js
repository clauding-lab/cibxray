/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 9 (Loan with Sudden Multiple OD).
 * Reshapes findSuddenOverdueEvents output to the 8-column layout of Sheet 8.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSuddenOdRows } from '../src/export/retailExport/sheet9_suddenOd.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Term Loan',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  classification: 'STD',
  contractCode: 'C001',
  pageNo: 3,
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'Sudden Borrower' }) => ({
  facilities,
  subject,
});

test('buildSuddenOdRows emits header', () => {
  const rows = buildSuddenOdRows(report([]));
  assert.deepEqual(rows[0], [
    'Borrower Name', 'Ref. No.', 'Page No.', 'Sanclimit', 'Outstanding',
    'Overdue', 'NPI', 'Status',
  ]);
});

test('buildSuddenOdRows flags facilities with 0 → ≥1 NPI transition', () => {
  const rows = buildSuddenOdRows(report([
    fac({
      contractCode: 'SUD1',
      history: [
        { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 100, overdue: 50, limit: 1000, npi: 1, status: 'SMA' },
      ],
    }),
  ]));
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'SUD1');
});

test('buildSuddenOdRows deduplicates multiple events on same facility', () => {
  const rows = buildSuddenOdRows(report([
    fac({
      contractCode: 'MULT',
      history: [
        { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 100, overdue: 50, limit: 1000, npi: 1, status: 'SMA' },
        { dateStr: '01/03/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
        { dateStr: '01/04/2024', outstanding: 100, overdue: 80, limit: 1000, npi: 1, status: 'SMA' },
      ],
    }),
  ]));
  // One row despite two events
  assert.equal(rows.length, 2);
});

test('buildSuddenOdRows skips non-sudden facilities', () => {
  const rows = buildSuddenOdRows(report([
    fac({
      contractCode: 'STAB',
      history: [
        { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
      ],
    }),
  ]));
  assert.equal(rows.length, 1);
});
