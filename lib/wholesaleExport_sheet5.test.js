/**
 * Tests for wholesale Sheet 5 — Long Term Loan Summary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLtLoanSummaryRows } from '../src/export/wholesaleExport/sheet5_ltLoanSummary.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY' },
  facilities,
});

// Long-term: endDate - startDate > 12 months
const ltFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  securityType: '60 (Mortgage)',
  startDate: '01/01/2020',
  endDate: '01/01/2026',  // 6 years
  limit: 20_000_000,
  disbursementAmount: 20_000_000,
  outstanding: 12_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 1,
  paymentPeriodicity: 'Monthly',
  installmentAmount: 300_000,
  totalInstallments: 60,
  remainingInstallmentsCount: 36,
  rescheduledCount: 0,
  history: [
    { dateStr: '2020-06', outstanding: 18_000_000, overdue: 0, npi: 0, status: 'STD' },
    { dateStr: '2020-09', outstanding: 17_000_000, overdue: 0, npi: 0, status: 'STD' },
    { dateStr: '2020-12', outstanding: 16_000_000, overdue: 0, npi: 0, status: 'STD' },
  ],
};

// Short-term — should not appear on this sheet
const stFacility = {
  contractCode: 'DL-001',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',  // 8 months
  limit: 5_000_000,
  outstanding: 4_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 2,
  history: [],
};

test('buildLtLoanSummaryRows emits correct header with 25 columns', () => {
  const rows = buildLtLoanSummaryRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 25);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][16], 'Debt Burden Per Year (BDT Million)');
  assert.equal(rows[0][17], 'Moratorium/Irregularity');
  assert.equal(rows[0][24], 'Remarks for WD');
});

test('buildLtLoanSummaryRows includes only long-term facilities', () => {
  const r = makeReport([ltFacility, stFacility]);
  const rows = buildLtLoanSummaryRows([r]);
  assert.equal(rows.length, 2); // header + 1 LT
  assert.equal(rows[1][3], 'TL-001');
});

test('buildLtLoanSummaryRows populates all 25 columns correctly', () => {
  const rows = buildLtLoanSummaryRows([makeReport([ltFacility])]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[1], '1011500056801.pdf');
  assert.equal(row[2], 'COMPANY');
  assert.equal(row[3], 'TL-001');
  assert.equal(row[4], 'Term Loan');
  assert.equal(row[5], '60 (Mortgage)');
  assert.equal(row[6], 1);
  assert.equal(row[7], 'Borrower');
  assert.equal(row[8], '01/01/2020');
  assert.equal(row[9], '01/01/2026');
  assert.equal(row[10], 20);   // limit
  assert.equal(row[11], 20);   // disbursement
  assert.equal(row[12], 'Monthly');
  assert.equal(row[13], 12);   // outstanding
  assert.equal(row[14], '-');  // zero overdue
  assert.equal(row[15], 'STD');
  // Debt burden: 300,000 * 12 = 3,600,000 => 3.6M
  assert.equal(row[16], 3.6);
  assert.equal(row[17], 'No');  // no moratorium (outstanding is declining)
  assert.equal(row[18], 60);
  assert.equal(row[19], 36);
  assert.equal(row[20], 0);    // highestNpi
  assert.equal(row[22], 'STD'); // worstStatus
  assert.equal(row[23], 0);    // rescheduled count
  assert.equal(row[24], '');   // remarks stubbed
});

test('buildLtLoanSummaryRows shows moratorium=Yes when no overdue and stable balance', () => {
  const moratoriumFacility = {
    ...ltFacility,
    contractCode: 'TL-002',
    history: [
      { dateStr: '2025-01', outstanding: 10_000_000, overdue: 0, npi: 0, status: 'STD' },
      { dateStr: '2025-02', outstanding: 10_000_000, overdue: 0, npi: 0, status: 'STD' },
      { dateStr: '2025-03', outstanding: 10_000_000, overdue: 0, npi: 0, status: 'STD' },
      { dateStr: '2025-04', outstanding: 10_000_000, overdue: 0, npi: 0, status: 'STD' },
    ],
  };
  const rows = buildLtLoanSummaryRows([makeReport([moratoriumFacility])]);
  assert.equal(rows[1][17], 'Yes');
});

test('buildLtLoanSummaryRows aggregates across multiple reports', () => {
  const r1 = makeReport([ltFacility]);
  const r2 = makeReport([{ ...ltFacility, contractCode: 'TL-003' }]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildLtLoanSummaryRows([r1, r2]);
  assert.equal(rows.length, 3);
});

test('buildLtLoanSummaryRows stubs Remarks for WD as empty string', () => {
  const rows = buildLtLoanSummaryRows([makeReport([ltFacility])]);
  assert.equal(rows[1][24], '');
});

test('buildLtLoanSummaryRows wires wdRemarks field into Remarks for WD column', () => {
  const facilityWithWd = { ...ltFacility, wdRemarks: 'Appeal lodged' };
  const rows = buildLtLoanSummaryRows([makeReport([facilityWithWd])]);
  assert.equal(rows[1][24], 'Appeal lodged');
});

test('buildLtLoanSummaryRows uses empty string for Remarks for WD when wdRemarks is absent', () => {
  const facilityNoWd = { ...ltFacility };
  delete facilityNoWd.wdRemarks;
  const rows = buildLtLoanSummaryRows([makeReport([facilityNoWd])]);
  assert.equal(rows[1][24], '');
});
