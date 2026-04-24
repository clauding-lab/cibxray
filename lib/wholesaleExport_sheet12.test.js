/**
 * Tests for wholesale Sheet 12 — Reschedule Contract Details.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRescheduleRows } from '../src/export/wholesaleExport/sheet12_reschedule.js';

const makeReport = (facilities = []) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: { cibSubjectCode: 'S001', subjectType: 'COMPANY', tradeName: 'Test Co.' },
  facilities,
});

const rescheduledFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  startDate: '01/01/2020',
  endDate: '01/01/2025',
  outstanding: 5_000_000,
  overdue: 500_000,
  rescheduledCount: 2,
  pageNo: 3,
  role: 'Borrower',
  status: 'Live',
};

const normalFacility = {
  contractCode: 'TL-002',
  type: 'Term Loan',
  startDate: '01/01/2021',
  endDate: '01/01/2026',
  outstanding: 3_000_000,
  overdue: 0,
  rescheduledCount: 0,
  pageNo: 5,
  role: 'Borrower',
  status: 'Live',
};

test('buildRescheduleRows emits correct header', () => {
  const rows = buildRescheduleRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'CIB Subject Code');
  assert.equal(rows[0][9], 'Number of times Rescheduled');
  assert.equal(rows[0][10], 'Page Number');
});

test('buildRescheduleRows includes only facilities with rescheduledCount > 0', () => {
  const r = makeReport([rescheduledFacility, normalFacility]);
  const rows = buildRescheduleRows([r]);
  assert.equal(rows.length, 2); // header + 1 rescheduled
  assert.equal(rows[1][3], 'TL-001');
});

test('buildRescheduleRows populates all columns correctly', () => {
  const r = makeReport([rescheduledFacility]);
  const rows = buildRescheduleRows([r]);
  const row = rows[1];
  assert.equal(row[0], 'S001');
  assert.equal(row[1], '1011500056801.pdf');
  assert.equal(row[2], 'COMPANY');
  assert.equal(row[3], 'TL-001');
  assert.equal(row[4], 'Term Loan');
  assert.equal(row[5], '01/01/2020');
  assert.equal(row[6], '01/01/2025');
  assert.equal(row[7], 5);   // 5,000,000 / 1,000,000
  assert.equal(row[8], 0.5); // 500,000 / 1,000,000
  assert.equal(row[9], 2);
  assert.equal(row[10], 3);
});

test('buildRescheduleRows aggregates across multiple reports', () => {
  const r1 = makeReport([rescheduledFacility]);
  const r2 = makeReport([{ ...rescheduledFacility, contractCode: 'TL-003', rescheduledCount: 1 }]);
  r2.fileName = '1011500056801-1.pdf';
  const rows = buildRescheduleRows([r1, r2]);
  assert.equal(rows.length, 3); // header + 2 rows
});

test('buildRescheduleRows shows "-" for zero outstanding/overdue', () => {
  const f = { ...rescheduledFacility, outstanding: 0, overdue: 0 };
  const rows = buildRescheduleRows([makeReport([f])]);
  assert.equal(rows[1][7], '-');
  assert.equal(rows[1][8], '-');
});

test('buildRescheduleRows returns header only when no rescheduled facilities', () => {
  const rows = buildRescheduleRows([makeReport([normalFacility])]);
  assert.equal(rows.length, 1);
});
