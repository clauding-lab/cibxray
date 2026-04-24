/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 8 (Loan with unchanged Outstanding)
 * builder tests.
 *
 * Reshapes findUnchangedOutstandingFacilities output to 8-column layout:
 *   Borrower Name | Ref. No. | Page No. | Sanclimit | Outstanding |
 *   Overdue | NPI | Status
 * One row per detected flat-outstanding run on the underlying facility.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUnchangedOutstandingRows } from '../src/export/retailExport/sheet8_unchangedOutstanding.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Overdraft',
  limit: 2_000_000,
  outstanding: 1_500_000,
  overdue: 0,
  classification: 'STD',
  contractCode: 'C001',
  pageNo: 7,
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'Subject A' }) => ({
  facilities,
  subject,
});

function stableHistoryRow(dateStr, outstanding) {
  return { dateStr, outstanding, overdue: 0, npi: 0, limit: 2_000_000, status: 'STD' };
}

test('buildUnchangedOutstandingRows emits header', () => {
  const rows = buildUnchangedOutstandingRows(report([]));
  assert.deepEqual(rows[0], [
    'Borrower Name', 'Ref. No.', 'Page No.', 'Sanclimit', 'Outstanding',
    'Overdue', 'NPI', 'Status',
  ]);
});

test('buildUnchangedOutstandingRows maps each flat-run to a row', () => {
  const rows = buildUnchangedOutstandingRows(report([
    fac({
      contractCode: 'FLAT1',
      history: [
        stableHistoryRow('01/01/2024', 1_500_000),
        stableHistoryRow('01/02/2024', 1_500_000),
        stableHistoryRow('01/03/2024', 1_500_000),
      ],
    }),
  ]));
  // Header + 1 flat run
  assert.equal(rows.length, 2);
  const r = rows[1];
  assert.equal(r[0], 'Subject A');
  assert.equal(r[1], 'FLAT1');
  assert.equal(r[2], 7);
  assert.equal(r[3], 2); // Sanclimit in millions
  assert.equal(r[4], 1.5); // Outstanding (current) in millions
  assert.equal(r[7], 'STD');
});

test('buildUnchangedOutstandingRows skips facilities without qualifying runs', () => {
  const rows = buildUnchangedOutstandingRows(report([
    fac({
      contractCode: 'CHG',
      history: [
        stableHistoryRow('01/01/2024', 1_000_000),
        stableHistoryRow('01/02/2024', 1_500_000),
        stableHistoryRow('01/03/2024', 2_000_000),
      ],
    }),
  ]));
  assert.equal(rows.length, 1);
});

test('buildUnchangedOutstandingRows deduplicates multiple flat runs on same facility to one row', () => {
  // findUnchangedOutstandingFacilities can return multiple runs per facility;
  // Sheet 8 is facility-level so we emit one row per facility with a flat run.
  const rows = buildUnchangedOutstandingRows(report([
    fac({
      contractCode: 'MULT',
      history: [
        stableHistoryRow('01/01/2024', 1_500_000),
        stableHistoryRow('01/02/2024', 1_500_000),
        stableHistoryRow('01/03/2024', 1_500_000),
        // break run
        stableHistoryRow('01/04/2024', 2_000_000),
        stableHistoryRow('01/05/2024', 2_000_000),
        stableHistoryRow('01/06/2024', 2_000_000),
      ],
    }),
  ]));
  // Expect a single facility-level row
  assert.equal(rows.length, 2);
  assert.equal(rows[1][1], 'MULT');
});
