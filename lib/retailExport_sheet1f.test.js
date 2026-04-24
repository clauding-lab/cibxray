/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 1f (Findings) builder tests.
 *
 * The Findings builder returns a plain 29-row × 2-column array of
 * [Particular, Finding] pairs. The workbook assembler writes these to
 * rows 29–57 of the "CIB Dashboard" sheet.
 *
 * Each row corresponds to spec §4 Sheet 1f item number. The test exercises
 * every row against a hand-rolled report fixture so spec drift is caught.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFindingsRows } from '../src/export/retailExport/sheet1_dashboard.js';

// ── fixture helpers ──────────────────────────────────────────────────────────

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Term Loan',
  nature: 'Funded',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  installmentAmount: 25_000,
  remainingInstallmentsAmount: 0,
  disbursementAmount: 1_000_000,
  totalInstallments: 36,
  remainingInstallmentsCount: 18,
  paymentPeriodicity: 'Monthly',
  isForeign: false,
  startDate: '01/01/2023',
  endDate: '31/12/2025',
  classification: 'STD',
  defaultStatus: 'No',
  willfulDefault: false,
  wdRemarks: '',
  lawsuit: '',
  rescheduled: false,
  rescheduledCount: 0,
  dateOfLastRescheduling: '',
  reorganized: false,
  contractCode: 'C001',
  institution: 'Bank X',
  fiCode: '001',
  securityType: '',
  pageNo: 1,
  history: [],
  ...overrides,
});

const makeReport = (overrides = {}) => ({
  subject: {
    cibSubjectCode: 'CIB-001',
    displayName: 'Test Borrower',
    mainRepresentative: '',
    nid: '1234567890',
    tin: '987654321',
    dob: '01/01/1980',
    fatherName: 'Father Name',
    motherName: 'Mother Name',
  },
  inquiryDate: '15-Mar-2026',
  facilities: [],
  linkedProprietorships: [],
  directors: [],
  reportNo: 'CIB-001',
  fileName: 'test.pdf',
  ...overrides,
});

// ── tests ────────────────────────────────────────────────────────────────────

test('buildFindingsRows returns 29 rows in order', () => {
  // Arrange
  const report = makeReport();

  // Act
  const rows = buildFindingsRows(report);

  // Assert
  assert.equal(rows.length, 29);
  assert.equal(rows[0][0], 'Date');
  assert.equal(rows[1][0], 'Age of CIB Report (Days)');
  assert.equal(rows[28][0], 'Any loan with sudden Multiple Overdue');
});

test('row 1 (Date) uses inquiryDate verbatim', () => {
  const report = makeReport({ inquiryDate: '15-Mar-2026' });
  const rows = buildFindingsRows(report);
  assert.equal(rows[0][1], '15-Mar-2026');
});

test('row 1 handles missing inquiryDate', () => {
  const report = makeReport({ inquiryDate: '' });
  const rows = buildFindingsRows(report);
  assert.equal(rows[0][1], '');
});

test('row 2 (Age in Days) returns numeric day count', () => {
  const asOf = new Date('2026-04-24T00:00:00Z');
  const report = makeReport({ inquiryDate: '20-Mar-2026' }); // 35 days before 24-Apr
  const rows = buildFindingsRows(report, { asOf });
  assert.equal(rows[1][1], 35);
});

test('row 2 returns empty string for missing inquiryDate', () => {
  const report = makeReport({ inquiryDate: '' });
  const rows = buildFindingsRows(report);
  assert.equal(rows[1][1], '');
});

test('row 3 (Directors) joins director names', () => {
  const report = makeReport({
    directors: [
      { name: 'Dir One', role: 'Managing director', cibCode: 'X' },
      { name: 'Dir Two', role: 'Chairman', cibCode: 'Y' },
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[2][1], 'Dir One, Dir Two');
});

test('row 3 returns empty string when no directors', () => {
  const report = makeReport({ directors: [] });
  const rows = buildFindingsRows(report);
  assert.equal(rows[2][1], '');
});

test('row 4 (Sister concerns) joins trade names', () => {
  const report = makeReport({
    linkedProprietorships: [
      { cibCode: 'A', tradeName: 'Concern One' },
      { cibCode: 'B', tradeName: 'Concern Two' },
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[3][1], 'Concern One, Concern Two');
});

test('row 5 (Overall current CIB Status) returns worst current classification', () => {
  const report = makeReport({
    facilities: [
      fac({ classification: 'STD' }),
      fac({ classification: 'SS' }),
      fac({ classification: 'SMA' }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[4][1], 'SS');
});

test('row 5 returns STD when no facilities', () => {
  const rows = buildFindingsRows(makeReport());
  assert.equal(rows[4][1], 'STD');
});

test('row 6 (Worst historical status as Borrower)', () => {
  const report = makeReport({
    facilities: [
      fac({
        role: 'Borrower',
        history: [
          { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
          { dateStr: '01/02/2024', outstanding: 200, overdue: 50, limit: 1000, npi: 2, status: 'BL' },
        ],
      }),
      fac({ role: 'Guarantor', history: [{ dateStr: '01/01/2024', outstanding: 0, overdue: 0, limit: 1000, npi: 0, status: 'BLW' }] }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[5][1], 'BL'); // BLW is from guarantor role - excluded
});

test('row 7 (Current overdue, Borrower role) sums overdue on live borrower facilities', () => {
  const report = makeReport({
    facilities: [
      fac({ role: 'Borrower', status: 'Live', overdue: 100_000 }),
      fac({ role: 'Guarantor', status: 'Live', overdue: 500_000 }),
      fac({ role: 'Borrower', status: 'Terminated', overdue: 200_000 }),
    ],
  });
  const rows = buildFindingsRows(report);
  // 100_000 BDT → 0.10 million
  assert.equal(rows[6][1], 0.10);
});

test('row 8 (Forced loan) returns "Yes" if any facility is forced', () => {
  const report = makeReport({
    facilities: [fac({ startDate: '01/01/2024', endDate: '04/01/2024' })],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[7][1], 'Yes');
});

test('row 8 returns "No" when no forced loans', () => {
  const report = makeReport({ facilities: [fac()] });
  const rows = buildFindingsRows(report);
  assert.equal(rows[7][1], 'No');
});

test('row 9 (Any Stay Order) returns "N/A" (deferred to DevReq-2.1)', () => {
  const rows = buildFindingsRows(makeReport());
  assert.equal(rows[8][0], 'Any Stay Order');
  assert.equal(rows[8][1], 'N/A');
});

test('row 10 (Worst historical status as Guarantor)', () => {
  const report = makeReport({
    facilities: [
      fac({ role: 'Borrower', history: [{ dateStr: '01/01/2024', outstanding: 0, overdue: 0, limit: 1000, npi: 0, status: 'BL' }] }),
      fac({ role: 'Guarantor', history: [{ dateStr: '01/01/2024', outstanding: 0, overdue: 0, limit: 1000, npi: 0, status: 'SMA' }] }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[9][1], 'SMA');
});

test('row 11 (Current overdue, Guarantor) sums in millions', () => {
  const report = makeReport({
    facilities: [
      fac({ role: 'Guarantor', status: 'Live', overdue: 2_500_000 }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[10][1], 2.5);
});

test('row 12 (Guaranteed Installment exposure) is in millions', () => {
  const report = makeReport({
    facilities: [
      fac({ role: 'Guarantor', status: 'Live', outstanding: 3_000_000, installmentAmount: 50_000, remainingInstallmentsAmount: 0 }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[11][1], 3.0);
});

test('row 17 (Live loans EMI) in millions', () => {
  const report = makeReport({
    facilities: [
      fac({ role: 'Borrower', status: 'Live', installmentAmount: 100_000 }),
      fac({ role: 'Borrower', status: 'Live', installmentAmount: 50_000 }),
    ],
  });
  const rows = buildFindingsRows(report);
  // 150_000 BDT → 0.15 million
  assert.equal(rows[16][1], 0.15);
});

test('row 18 (Any reschedule) returns "Yes" when borrower rescheduledCount > 0', () => {
  const report = makeReport({
    facilities: [fac({ role: 'Borrower', rescheduled: true, rescheduledCount: 1, dateOfLastRescheduling: '01/01/2024' })],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[17][1], 'Yes');
});

test('row 18 (Any reschedule) returns "No" when no reschedules', () => {
  const rows = buildFindingsRows(makeReport({ facilities: [fac()] }));
  assert.equal(rows[17][1], 'No');
});

test('row 29 (Sudden Multiple OD) returns "No" when no events', () => {
  const rows = buildFindingsRows(makeReport());
  assert.equal(rows[28][1], 'No');
});

test('row 29 (Sudden Multiple OD) returns "Yes" on any transition', () => {
  const report = makeReport({
    facilities: [
      fac({
        history: [
          { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
          { dateStr: '01/02/2024', outstanding: 100, overdue: 50, limit: 1000, npi: 1, status: 'SMA' },
        ],
      }),
    ],
  });
  const rows = buildFindingsRows(report);
  assert.equal(rows[28][1], 'Yes');
});
