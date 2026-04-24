/**
 * Tests for wholesale Sheets 3 & 4 — CIB Summary (Borrower / Guarantor).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCibSummaryBorrowerRows,
  buildCibSummaryGuarantorRows,
} from '../src/export/wholesaleExport/sheet3_4_cibSummary.js';

const makeFacility = (overrides = {}) => ({
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2026',
  limit: 10_000_000,
  outstanding: 6_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  isForeign: false,
  willfulDefault: false,
  ...overrides,
});

const makeReport = (facilities = [], subjectOverrides = {}, reportOverrides = {}) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: {
    cibSubjectCode: 'S001',
    subjectType: 'COMPANY',
    tradeName: 'Akij Food & Beverage Ltd.',
    displayName: 'Akij Food & Beverage Ltd.',
    ...subjectOverrides,
  },
  facilities,
  ...reportOverrides,
});

// ── Sheet 3 (Borrower) ────────────────────────────────────────────────────────

test('buildCibSummaryBorrowerRows emits 23-column header', () => {
  const rows = buildCibSummaryBorrowerRows([]);
  assert.equal(rows.length, 2); // header + 1 group-total row (empty companies)
  assert.equal(rows[0].length, 23);
  assert.equal(rows[0][0], 'Ref No.');
  assert.equal(rows[0][20], 'Stay Order No.');
  assert.equal(rows[0][22], 'Total Foreign Loan');
});

test('buildCibSummaryBorrowerRows emits one row per report plus group total', () => {
  const r1 = makeReport([makeFacility()]);
  const r2 = makeReport([makeFacility({ outstanding: 4_000_000 })], {}, {
    fileName: '1011500056801-1.pdf',
    reportNo: 'RPT-002',
  });
  const rows = buildCibSummaryBorrowerRows([r1, r2]);
  // header + 2 data + 1 group total
  assert.equal(rows.length, 4);
  assert.equal(rows[3][0], 'Group Total (Companies)');
});

test('buildCibSummaryBorrowerRows aggregates borrower-role live facilities', () => {
  const borrower = makeFacility({ outstanding: 8_000_000, role: 'Borrower', status: 'Live' });
  const guarantor = makeFacility({ outstanding: 5_000_000, role: 'Guarantor', status: 'Live' });
  const terminated = makeFacility({ outstanding: 3_000_000, role: 'Borrower', status: 'Terminated' });
  const r = makeReport([borrower, guarantor, terminated]);
  const rows = buildCibSummaryBorrowerRows([r]);
  const dataRow = rows[1];
  // Only borrower + live: 8M installments
  assert.equal(dataRow[4], 8); // installments column
  assert.equal(dataRow[13], 8); // totalLoan
});

test('buildCibSummaryBorrowerRows shows Stay Order as 0', () => {
  const r = makeReport([makeFacility()]);
  const rows = buildCibSummaryBorrowerRows([r]);
  assert.equal(rows[1][20], 0); // Stay Order No.
});

test('buildCibSummaryBorrowerRows group total excludes INDIVIDUAL reports', () => {
  const company = makeReport([makeFacility({ outstanding: 6_000_000 })]);
  const individual = makeReport(
    [makeFacility({ outstanding: 4_000_000 })],
    { subjectType: 'INDIVIDUAL' },
    { fileName: '1011500056801-1.pdf' }
  );
  const rows = buildCibSummaryBorrowerRows([company, individual]);
  const total = rows[rows.length - 1];
  // Total should only include company's 6M, not individual's 4M
  assert.equal(total[13], 6); // totalLoan
});

test('buildCibSummaryBorrowerRows handles SMA classification bucket', () => {
  const f = makeFacility({ outstanding: 3_000_000, classification: 'SMA', overdue: 100_000 });
  const rows = buildCibSummaryBorrowerRows([makeReport([f])]);
  assert.equal(rows[1][15], 3); // SMA = 3M
});

test('buildCibSummaryBorrowerRows handles SS(Yes) vs SS(No) split', () => {
  const ssWithOverdue = makeFacility({ outstanding: 2_000_000, classification: 'SS', overdue: 500_000 });
  const ssWithoutOverdue = makeFacility({ contractCode: 'TL-002', outstanding: 1_000_000, classification: 'SS', overdue: 0 });
  const rows = buildCibSummaryBorrowerRows([makeReport([ssWithOverdue, ssWithoutOverdue])]);
  assert.equal(rows[1][16], 2); // SS(Yes) = 2M (has overdue)
  assert.equal(rows[1][17], 1); // SS(No) = 1M (no overdue)
});

// ── Sheet 4 (Guarantor) ───────────────────────────────────────────────────────

test('buildCibSummaryGuarantorRows emits 24-column header', () => {
  const rows = buildCibSummaryGuarantorRows([]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].length, 24);
  assert.equal(rows[0][0], 'Ref No.');
  assert.equal(rows[0][4], 'Guaranteed Exposure');
  assert.equal(rows[0][21], 'Stay Order No.');
});

test('buildCibSummaryGuarantorRows aggregates guarantor-role live facilities', () => {
  const guarantor = makeFacility({ outstanding: 5_000_000, role: 'Guarantor', status: 'Live' });
  const borrower = makeFacility({ outstanding: 8_000_000, role: 'Borrower', status: 'Live' });
  const r = makeReport([guarantor, borrower]);
  const rows = buildCibSummaryGuarantorRows([r]);
  const dataRow = rows[1];
  assert.equal(dataRow[4], 5); // Guaranteed Exposure column
  assert.equal(dataRow[14], 5); // Total Loan (guarantor only)
});

test('buildCibSummaryGuarantorRows group total excludes INDIVIDUAL reports', () => {
  const company = makeReport([makeFacility({ outstanding: 6_000_000, role: 'Guarantor' })]);
  const individual = makeReport(
    [makeFacility({ outstanding: 3_000_000, role: 'Guarantor' })],
    { subjectType: 'INDIVIDUAL' },
    { fileName: '1011500056801-1.pdf' }
  );
  const rows = buildCibSummaryGuarantorRows([company, individual]);
  const total = rows[rows.length - 1];
  assert.equal(total[14], 6); // Only company's guarantor exposure
});
