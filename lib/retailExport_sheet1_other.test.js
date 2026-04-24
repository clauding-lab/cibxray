/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 1 builders (non-Findings).
 *
 * Covers 1a (KYC), 1b (Individual Liability Grid), 1c (Group Liability Grid),
 * 1d (PG Role Status), 1e (Terminated Contracts Status).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKycRows,
  buildIndividualLiabilityGrid,
  buildGroupLiabilityGrid,
  buildPgRoleStatusRows,
  buildTerminatedContractsRows,
} from '../src/export/retailExport/sheet1_dashboard.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Term Loan',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  installmentAmount: 25_000,
  startDate: '01/01/2023',
  endDate: '31/12/2025',
  classification: 'STD',
  history: [],
  ...overrides,
});

const report = (overrides = {}) => ({
  subject: {},
  facilities: [],
  linkedProprietorships: [],
  reportNo: 'CIB-001',
  ...overrides,
});

// ── 1a KYC ───────────────────────────────────────────────────────────────────

test('buildKycRows returns 8 rows in spec order', () => {
  const r = report({
    reportNo: 'CIB-042',
    subject: {
      displayName: 'Main Borrower',
      mainRepresentative: 'Rep Name',
      nid: '1234567890',
      dob: '01/01/1980',
      tin: '987',
      fatherName: 'Father',
      motherName: 'Mother',
    },
  });
  const rows = buildKycRows(r);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], ['Ref. Number', 'CIB-042']);
  assert.deepEqual(rows[1], ['Name of Main Borrower', 'Main Borrower']);
  assert.deepEqual(rows[2], ['Name of main representative', 'Rep Name']);
  assert.deepEqual(rows[3], ['NID No.', '1234567890']);
  assert.deepEqual(rows[4], ['DOB', '01/01/1980']);
  assert.deepEqual(rows[5], ['TIN No.', '987']);
  assert.deepEqual(rows[6], ["Father's Name", 'Father']);
  assert.deepEqual(rows[7], ["Mother's Name", 'Mother']);
});

test('buildKycRows falls back to subject.name when displayName missing', () => {
  const r = report({ subject: { name: 'Fallback Name' } });
  const rows = buildKycRows(r);
  assert.equal(rows[1][1], 'Fallback Name');
});

test('buildKycRows emits empty string for missing fields', () => {
  const rows = buildKycRows(report({ reportNo: undefined, subject: {} }));
  for (const row of rows) assert.equal(row[1], '');
});

// ── 1b Individual Liability Grid ─────────────────────────────────────────────

test('buildIndividualLiabilityGrid emits header + 5 data rows', () => {
  const rows = buildIndividualLiabilityGrid(report());
  assert.equal(rows.length, 6);
  assert.equal(rows[0][0], 'Particular');
  assert.equal(rows[1][0], 'Funded — Long term');
  assert.equal(rows[2][0], 'Funded — Short term');
  assert.equal(rows[3][0], 'Total Funded');
  assert.equal(rows[4][0], 'Non-Funded');
  assert.equal(rows[5][0], 'Total');
});

test('liability grid partitions facilities by tenure and nature', () => {
  const r = report({
    facilities: [
      fac({ type: 'Term Loan', startDate: '01/01/2020', endDate: '01/01/2025', outstanding: 5_000_000, limit: 10_000_000 }), // long-term funded
      fac({ type: 'Term Loan', startDate: '01/01/2024', endDate: '01/06/2024', outstanding: 1_000_000, limit: 2_000_000 }), // short-term funded
      fac({ type: 'Letter of credit', startDate: '01/01/2024', endDate: '01/12/2024', outstanding: 3_000_000, limit: 5_000_000 }), // non-funded
    ],
  });
  const rows = buildIndividualLiabilityGrid(r);
  // Long-term funded row: [label, live=1, limit=10.0, outstanding=5.0, ...]
  assert.equal(rows[1][1], 1);
  assert.equal(rows[1][2], 10);
  assert.equal(rows[1][3], 5);
  // Short-term funded
  assert.equal(rows[2][3], 1);
  // Non-funded
  assert.equal(rows[4][3], 3);
  // Total funded outstanding = 5 + 1 = 6
  assert.equal(rows[3][3], 6);
  // Total = 6 + 3 = 9
  assert.equal(rows[5][3], 9);
});

test('liability grid excludes Guarantor role facilities', () => {
  const r = report({
    facilities: [
      fac({ role: 'Guarantor', outstanding: 9_000_000 }),
      fac({ role: 'Borrower', outstanding: 1_000_000, limit: 1_000_000 }),
    ],
  });
  const rows = buildIndividualLiabilityGrid(r);
  // Total outstanding in millions = 1.0
  assert.equal(rows[5][3], 1);
});

test('liability grid aggregates SMA column', () => {
  const r = report({
    facilities: [
      fac({ classification: 'SMA', outstanding: 500_000 }),
    ],
  });
  const rows = buildIndividualLiabilityGrid(r);
  // SMA column index = 5
  assert.equal(rows[5][5], 0.5);
});

test('liability grid aggregates SS/DF/BL/BLW column', () => {
  const r = report({
    facilities: [
      fac({ classification: 'SS', outstanding: 1_000_000 }),
      fac({ classification: 'BL', outstanding: 500_000 }),
    ],
  });
  const rows = buildIndividualLiabilityGrid(r);
  // Severe column index = 6
  assert.equal(rows[5][6], 1.5);
});

test('liability grid computes Previous Overdue and Classification from history', () => {
  const r = report({
    facilities: [
      fac({
        classification: 'STD',
        history: [
          { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
          { dateStr: '01/02/2024', outstanding: 100, overdue: 700_000, limit: 1000, npi: 3, status: 'SS' },
        ],
      }),
    ],
  });
  const rows = buildIndividualLiabilityGrid(r);
  // Previous Overdue col (index 7) shows millions + date
  assert.equal(rows[5][7], '0.7 (01/02/2024)');
  // Previous Classification col (index 8)
  assert.equal(rows[5][8], 'SS');
});

// ── 1c Group Liability Grid ──────────────────────────────────────────────────

test('buildGroupLiabilityGrid emits empty structural grid with zeros', () => {
  const rows = buildGroupLiabilityGrid(report());
  assert.equal(rows.length, 6);
  for (let i = 1; i <= 5; i++) {
    assert.equal(rows[i][1], 0);
    assert.equal(rows[i][2], 0);
  }
});

// ── 1d PG Role Status ────────────────────────────────────────────────────────

test('buildPgRoleStatusRows counts guarantor-role installment vs non-installment', () => {
  const r = report({
    facilities: [
      fac({ role: 'Guarantor', type: 'Term Loan', installmentAmount: 10_000 }),
      fac({ role: 'Guarantor', type: 'Term Loan', installmentAmount: 20_000 }),
      fac({ role: 'Guarantor', type: 'Overdraft' }),
      fac({ role: 'Borrower', type: 'Term Loan' }),
    ],
  });
  const rows = buildPgRoleStatusRows(r);
  assert.deepEqual(rows[0], ['No. of Guaranteed Installment Loan', 2]);
  assert.deepEqual(rows[1], ['No. of Guaranteed Non-Installment Loan', 1]);
});

test('buildPgRoleStatusRows returns zeros when no guarantor facilities', () => {
  const rows = buildPgRoleStatusRows(report({ facilities: [fac()] }));
  assert.equal(rows[0][1], 0);
  assert.equal(rows[1][1], 0);
});

// ── 1e Terminated Contracts Status ───────────────────────────────────────────

test('buildTerminatedContractsRows emits 3 rows', () => {
  const r = report({
    facilities: [
      fac({ status: 'Terminated', type: 'Term Loan', installmentAmount: 10_000 }),
      fac({ status: 'Terminated', type: 'Term Loan', installmentAmount: 15_000 }),
      fac({ status: 'Terminated', type: 'Overdraft' }),
      fac({ status: 'Live', type: 'Term Loan' }),
    ],
  });
  const rows = buildTerminatedContractsRows(r);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], ['No. of Terminated Installment Loans', 2]);
  assert.deepEqual(rows[1], ['No. of Terminated Non-Installment Loans', 1]);
  // EMI sum = 25_000 BDT → 0.03 million (rounded 2dp)
  assert.equal(rows[2][0], 'Sum of EMI of Terminated Installment Loans');
  assert.equal(rows[2][1], 0.03);
});

test('buildTerminatedContractsRows returns zeros for no terminated facilities', () => {
  const rows = buildTerminatedContractsRows(report());
  assert.equal(rows[0][1], 0);
  assert.equal(rows[1][1], 0);
  assert.equal(rows[2][1], 0);
});
