/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 3 (Term Loans) builder tests.
 *
 * Two stacked sections: Live + Terminated. 23 columns each. Filter:
 * installment facilities (classifyFundedNature===funded + paymentPeriodicity
 * or installmentAmount>0 implying installments).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTermLoansRows } from '../src/export/retailExport/sheet3_termLoans.js';

const fac = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  type: 'Term Loan',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  installmentAmount: 25_000,
  totalInstallments: 36,
  remainingInstallmentsCount: 18,
  paymentPeriodicity: 'Monthly',
  startDate: '01/01/2023',
  endDate: '31/12/2025',
  classification: 'STD',
  contractCode: 'C001',
  pageNo: 5,
  securityType: '',
  history: [],
  ...overrides,
});

const report = (facilities, subject = { displayName: 'B' }) => ({ facilities, subject });

test('buildTermLoansRows emits section labels and headers', () => {
  const rows = buildTermLoansRows(report([]));
  assert.equal(rows[0][0], 'Live Contracts');
  assert.equal(rows[1][0], 'Borrower'); // header row
  assert.equal(rows[1].length, 23);
  // Terminated section appears after the Live section
  const termHeader = rows.find(r => r[0] === 'Terminated Contracts');
  assert.ok(termHeader);
});

test('buildTermLoansRows places Live vs Terminated in correct sections', () => {
  const rows = buildTermLoansRows(report([
    fac({ contractCode: 'LIVE1', status: 'Live' }),
    fac({ contractCode: 'TERM1', status: 'Terminated' }),
  ]));

  // Find section boundaries
  const liveIdx = rows.findIndex(r => r[0] === 'Live Contracts');
  const termIdx = rows.findIndex(r => r[0] === 'Terminated Contracts');
  const liveContractRow = rows.slice(liveIdx, termIdx).find(r => r[1] === 'LIVE1');
  const termContractRow = rows.slice(termIdx).find(r => r[1] === 'TERM1');
  assert.ok(liveContractRow);
  assert.ok(termContractRow);
});

test('buildTermLoansRows excludes non-installment facilities', () => {
  const rows = buildTermLoansRows(report([
    fac({ contractCode: 'T1', type: 'Term Loan' }),
    fac({ contractCode: 'L1', type: 'Letter of credit' }),
    fac({ contractCode: 'OD1', type: 'Overdraft' }),
  ]));
  const allCodes = rows.flatMap(r => [r[1]]);
  assert.ok(allCodes.includes('T1'));
  assert.ok(!allCodes.includes('L1'));
  assert.ok(!allCodes.includes('OD1'));
});

test('buildTermLoansRows emits Term/Due EMI/Paid/Remaining term correctly', () => {
  // Fixture: started 01/01/2023 Monthly, asOf 01/01/2025 → 24 months elapsed,
  // 24 EMIs due. Paid = 60 - 42 = 18. 6 EMIs delinquent on schedule.
  const rows = buildTermLoansRows(report([
    fac({
      contractCode: 'COUNT',
      totalInstallments: 60,
      remainingInstallmentsCount: 42,
    }),
  ]), { asOf: new Date('2025-01-01') });
  const dataRow = rows.find(r => r[1] === 'COUNT');
  // Term col is at index 11 (0 = Borrower, 1 = CIB Ref No.)
  // Per spec: Term | Due EMI | Paid | Remaining term
  assert.equal(dataRow[11], 60); // Term
  assert.equal(dataRow[12], 24); // Due EMI — schedule-based count
  assert.equal(dataRow[13], 18); // Paid = 60 - 42
  assert.equal(dataRow[14], 42); // Remaining term
});

test('buildTermLoansRows emits amounts in millions', () => {
  const rows = buildTermLoansRows(report([
    fac({
      contractCode: 'AMT',
      limit: 5_000_000,
      outstanding: 3_000_000,
      overdue: 200_000,
      installmentAmount: 100_000,
    }),
  ]));
  const r = rows.find(row => row[1] === 'AMT');
  // Limit at col 8, Outstanding 9, EMI 10
  assert.equal(r[8], 5);
  assert.equal(r[9], 3);
  assert.equal(r[10], 0.1); // EMI millions
});

test('buildTermLoansRows populates history rollup columns', () => {
  const rows = buildTermLoansRows(report([
    fac({
      contractCode: 'HIST',
      history: [
        { dateStr: '01/01/2024', outstanding: 100, overdue: 0, limit: 1000, npi: 0, status: 'STD' },
        { dateStr: '01/02/2024', outstanding: 100, overdue: 200_000, limit: 1000, npi: 2, status: 'SMA' },
        { dateStr: '01/03/2024', outstanding: 100, overdue: 300_000, limit: 1000, npi: 3, status: 'SS' },
      ],
    }),
  ]));
  const r = rows.find(row => row[1] === 'HIST');
  // NPI (current) col 17, Overdue amount current col 18, Highest Overdue col 19,
  // Highest NPI col 20, Classification History col 21, Worst Status col 22
  assert.equal(r[17], 2); // currentNpi (walk back: SS=1, SMA=1, STD=0 → 2)
  assert.equal(r[19], 0.3); // highest overdue in millions
  assert.equal(r[20], 3); // highest NPI
  assert.equal(r[22], 'SS'); // worst status
  assert.ok(r[21].includes('STD'));
  assert.ok(r[21].includes('SS'));
});
