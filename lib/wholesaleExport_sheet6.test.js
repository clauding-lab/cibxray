/**
 * Tests for wholesale Sheet 6 — Short Term Funded Summary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStfSummaryRows } from '../src/export/wholesaleExport/sheet6_stfSummary.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY' },
  facilities,
});

// STF = short-term + funded
const stfStd = {
  contractCode: 'DL-001',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',
  limit: 5_000_000,
  outstanding: 4_000_000,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 1,
  rescheduledCount: 0,
  history: [],
};

const stfSma = {
  contractCode: 'DL-002',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',
  limit: 3_000_000,
  outstanding: 2_000_000,
  classification: 'SMA',
  role: 'Borrower',
  status: 'Live',
  pageNo: 2,
  rescheduledCount: 1,
  history: [],
};

const stfBl = {
  contractCode: 'DL-003',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2025',
  endDate: '01/09/2025',
  limit: 4_000_000,
  outstanding: 3_500_000,
  classification: 'BL',
  role: 'Borrower',
  status: 'Live',
  pageNo: 3,
  rescheduledCount: 0,
  history: [],
};

// LT — should not appear on this sheet
const ltFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2025',
  limit: 10_000_000,
  outstanding: 6_000_000,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
  pageNo: 4,
  rescheduledCount: 0,
  history: [],
};

test('buildStfSummaryRows emits correct header with 18 columns', () => {
  const rows = buildStfSummaryRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 18);
  assert.equal(rows[0][10], 'UC/STD (BDT Million)');
  assert.equal(rows[0][15], 'BLW (BDT Million)');
  assert.equal(rows[0][16], '% of Concern STF');
  assert.equal(rows[0][17], 'No. of Rescheduling Instances');
});

test('buildStfSummaryRows includes only short-term funded facilities', () => {
  const r = makeReport([stfStd, stfSma, ltFacility]);
  const rows = buildStfSummaryRows([r]);
  assert.equal(rows.length, 3); // header + 2 STF
});

test('buildStfSummaryRows fills correct classification bucket for STD', () => {
  const rows = buildStfSummaryRows([makeReport([stfStd])]);
  const row = rows[1];
  assert.equal(row[10], 4);   // UC/STD bucket
  assert.equal(row[11], '-'); // SMA
  assert.equal(row[12], '-'); // SS
  assert.equal(row[13], '-'); // DF
  assert.equal(row[14], '-'); // BL
  assert.equal(row[15], '-'); // BLW
});

test('buildStfSummaryRows fills correct classification bucket for SMA', () => {
  const rows = buildStfSummaryRows([makeReport([stfSma])]);
  const row = rows[1];
  assert.equal(row[10], '-'); // UC/STD
  assert.equal(row[11], 2);   // SMA bucket: 2,000,000 million
  assert.equal(row[12], '-'); // SS
});

test('buildStfSummaryRows fills correct classification bucket for BL', () => {
  const rows = buildStfSummaryRows([makeReport([stfBl])]);
  const row = rows[1];
  assert.equal(row[14], 3.5); // BL bucket
  assert.equal(row[15], '-'); // BLW
});

test('buildStfSummaryRows computes % of concern STF correctly', () => {
  // stfStd = 4M, stfSma = 2M, total = 6M
  // stfStd pct = 4/6 * 100 ≈ 66.67
  const r = makeReport([stfStd, stfSma]);
  const rows = buildStfSummaryRows([r]);
  assert.ok(rows[1][16] > 66.6 && rows[1][16] < 66.7, `Expected ~66.67, got ${rows[1][16]}`);
  // stfSma pct = 2/6 * 100 ≈ 33.33
  assert.ok(rows[2][16] > 33.3 && rows[2][16] < 33.4);
});

test('buildStfSummaryRows records rescheduling count', () => {
  const rows = buildStfSummaryRows([makeReport([stfSma])]);
  assert.equal(rows[1][17], 1);
});

test('buildStfSummaryRows aggregates across multiple reports', () => {
  const r1 = makeReport([stfStd]);
  const r2 = makeReport([stfSma]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildStfSummaryRows([r1, r2]);
  assert.equal(rows.length, 3);
});
