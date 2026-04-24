/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 6 (Details of non-funded) builder tests.
 *
 * One row per non-funded product type. Columns:
 *   Type of financing | No. of live contract | Amount of live contract (M) |
 *   Status | No. of expired contract
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNonFundedDetailsRows } from '../src/export/retailExport/sheet6_nonFundedDetails.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Letter of credit',
  outstanding: 1_000_000,
  classification: 'STD',
  ...overrides,
});

const report = (facilities) => ({ facilities });

test('buildNonFundedDetailsRows emits header + rows, one per non-funded type', () => {
  const rows = buildNonFundedDetailsRows(report([
    fac({ type: 'Letter of credit', status: 'Live', outstanding: 2_000_000 }),
    fac({ type: 'Letter of credit', status: 'Live', outstanding: 3_000_000 }),
    fac({ type: 'Guarantee', status: 'Live', outstanding: 5_000_000 }),
    fac({ type: 'Other indirect', status: 'Terminated', outstanding: 1_000_000 }),
    fac({ type: 'Term Loan', status: 'Live', outstanding: 9_000_000 }), // funded — excluded
  ]));

  assert.equal(rows[0][0], 'Type of financing');
  assert.equal(rows[0].length, 5);

  const dataRows = rows.slice(1);
  const byType = Object.fromEntries(dataRows.map(r => [r[0], r]));

  // Letter of credit: 2 live, 5M outstanding, 0 expired
  const lc = byType['Letter of credit'];
  assert.deepEqual(lc, ['Letter of credit', 2, 5, 'Live', 0]);

  // Guarantee: 1 live, 5M
  const g = byType['Guarantee'];
  assert.deepEqual(g, ['Guarantee', 1, 5, 'Live', 0]);

  // Other indirect: 0 live, 0 amount, 1 expired
  const oi = byType['Other indirect'];
  assert.deepEqual(oi, ['Other indirect', 0, 0, 'Expired', 1]);
});

test('buildNonFundedDetailsRows returns only header when no non-funded facilities', () => {
  const rows = buildNonFundedDetailsRows(report([
    fac({ type: 'Term Loan' }),
    fac({ type: 'Auto loan' }),
  ]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'Type of financing');
});

test('buildNonFundedDetailsRows returns only header for empty facilities', () => {
  const rows = buildNonFundedDetailsRows(report([]));
  assert.equal(rows.length, 1);
});

test('buildNonFundedDetailsRows groups case-insensitively and preserves first-seen label', () => {
  const rows = buildNonFundedDetailsRows(report([
    fac({ type: 'Letter of Credit', status: 'Live', outstanding: 1_000_000 }),
    fac({ type: 'letter of credit', status: 'Live', outstanding: 1_000_000 }),
  ]));
  const lcRow = rows.slice(1).find(r => r[0].toLowerCase() === 'letter of credit');
  assert.equal(lcRow[1], 2);
  assert.equal(lcRow[2], 2);
});

test('row status reflects mix of Live and Terminated contracts', () => {
  const rows = buildNonFundedDetailsRows(report([
    fac({ type: 'Guarantee', status: 'Live', outstanding: 1_000_000 }),
    fac({ type: 'Guarantee', status: 'Terminated', outstanding: 500_000 }),
  ]));
  const g = rows.slice(1).find(r => r[0] === 'Guarantee');
  assert.equal(g[1], 1); // live count
  assert.equal(g[2], 1); // live amount millions
  assert.equal(g[3], 'Mixed');
  assert.equal(g[4], 1); // expired count
});
