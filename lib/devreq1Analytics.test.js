import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInstallmentFacility,
  parseCibDate,
  computeLiveLoansEmi,
  computeRescheduleStats,
  computeNewInstallmentFacilities,
  computeNewNonInstallmentFacilities,
  computeGuaranteedInstallmentExposure,
  computeGuaranteedNonInstallmentExposure,
  computeTerminatedInstallmentCount,
} from '../src/analytics/devreq1Analytics.js';

// ── facility factory helper ──
const f = (overrides = {}) => ({
  role: 'Borrower',
  status: 'Live',
  nature: 'Funded',
  type: 'Term Loan',
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  installmentAmount: 25_000,
  remainingInstallmentsAmount: 0,
  rescheduledCount: 0,
  dateOfLastRescheduling: '',
  startDate: '01/01/2024',
  endDate: '01/01/2029',
  history: [],
  ...overrides,
});

const r = (facilities = []) => ({ facilities });

// ────────────────────────── helpers ──────────────────────────

test('isInstallmentFacility: true when installmentAmount > 0', () => {
  assert.equal(isInstallmentFacility(f({ installmentAmount: 25_000 })), true);
});

test('isInstallmentFacility: false when installmentAmount is 0', () => {
  assert.equal(isInstallmentFacility(f({ installmentAmount: 0, type: 'CC/OD' })), false);
});

test('isInstallmentFacility: type-based fallback for Term Loan with missing installmentAmount', () => {
  assert.equal(isInstallmentFacility(f({ installmentAmount: 0, type: 'Term Loan' })), true);
});

test('isInstallmentFacility: credit card is not installment even if installmentAmount > 0', () => {
  assert.equal(isInstallmentFacility(f({ installmentAmount: 5_000, type: 'Credit Card' })), false);
});

test('parseCibDate: valid DD/MM/YYYY → Date', () => {
  const d = parseCibDate('15/03/2024');
  assert.ok(d instanceof Date);
  assert.equal(d.getUTCFullYear(), 2024);
  assert.equal(d.getUTCMonth(), 2); // March is 2
  assert.equal(d.getUTCDate(), 15);
});

test('parseCibDate: empty string → null', () => {
  assert.equal(parseCibDate(''), null);
});

test('parseCibDate: malformed → null', () => {
  assert.equal(parseCibDate('not a date'), null);
});

// ────────────────────────── item 1 ──────────────────────────

test('item 1 — live loans EMI sums installment amount across living installment facilities (Borrower/Co-Borrower)', () => {
  const report = r([
    f({ role: 'Borrower',   status: 'Live',       installmentAmount: 25_000 }),
    f({ role: 'CoBorrower', status: 'Live',       installmentAmount: 15_000 }),
    f({ role: 'Guarantor',  status: 'Live',       installmentAmount: 50_000 }),  // excluded
    f({ role: 'Borrower',   status: 'Terminated', installmentAmount: 99_000 }),  // excluded
    f({ role: 'Borrower',   status: 'Live',       installmentAmount: 0, type: 'CC/OD' }), // excluded (non-installment)
  ]);
  assert.equal(computeLiveLoansEmi(report), 40_000);
});

test('item 1 — returns 0 for empty facilities', () => {
  assert.equal(computeLiveLoansEmi(r([])), 0);
});

// ────────────────────────── item 5 ──────────────────────────

test('item 5 — reschedule stats split by role', () => {
  const report = r([
    f({ role: 'Borrower',   rescheduledCount: 2, dateOfLastRescheduling: '15/03/2024' }),
    f({ role: 'CoBorrower', rescheduledCount: 1, dateOfLastRescheduling: '01/07/2024' }),
    f({ role: 'Guarantor',  rescheduledCount: 3, dateOfLastRescheduling: '10/11/2023' }),
    f({ role: 'Borrower',   rescheduledCount: 0, dateOfLastRescheduling: '' }),
  ]);
  const stats = computeRescheduleStats(report);
  assert.equal(stats.asBorrower.count, 3);
  assert.equal(stats.asBorrower.lastDate, '01/07/2024'); // latest of the two
  assert.equal(stats.asGuarantor.count, 3);
  assert.equal(stats.asGuarantor.lastDate, '10/11/2023');
});

test('item 5 — empty stats when no reschedules anywhere', () => {
  const stats = computeRescheduleStats(r([f({ rescheduledCount: 0 })]));
  assert.equal(stats.asBorrower.count, 0);
  assert.equal(stats.asBorrower.lastDate, '');
  assert.equal(stats.asGuarantor.count, 0);
  assert.equal(stats.asGuarantor.lastDate, '');
});

// ────────────────────────── items 10 / 11 ──────────────────────────

const asOf = new Date('2026-04-22T00:00:00Z');

test('item 10 — new installment facilities in last 24 months: count and total sanction', () => {
  const report = r([
    f({ startDate: '15/03/2025', limit: 1_000_000, installmentAmount: 25_000 }),   // within 24M ✓
    f({ startDate: '01/06/2024', limit: 500_000,   installmentAmount: 10_000 }),   // within 24M ✓
    f({ startDate: '01/01/2020', limit: 2_000_000, installmentAmount: 50_000 }),   // > 24M ago ✗
    f({ startDate: '01/03/2025', limit: 300_000,   installmentAmount: 0, type: 'CC/OD' }), // non-installment ✗
  ]);
  const result = computeNewInstallmentFacilities(report, { months: 24, asOf });
  assert.equal(result.count, 2);
  assert.equal(result.totalAmount, 1_500_000);
});

test('item 10 — ignores facilities with missing/unparseable startDate', () => {
  const report = r([
    f({ startDate: '', limit: 500_000 }),
    f({ startDate: 'garbage', limit: 500_000 }),
    f({ startDate: '01/01/2026', limit: 100_000 }),
  ]);
  const result = computeNewInstallmentFacilities(report, { months: 24, asOf });
  assert.equal(result.count, 1);
  assert.equal(result.totalAmount, 100_000);
});

test('item 11 — new non-installment facilities in last 24M', () => {
  const report = r([
    f({ startDate: '15/03/2025', limit: 200_000, installmentAmount: 0, type: 'CC/OD' }),
    f({ startDate: '01/06/2024', limit: 300_000, installmentAmount: 0, type: 'Overdraft' }),
    f({ startDate: '15/03/2025', limit: 999_999, installmentAmount: 25_000 }), // installment, excluded
  ]);
  const result = computeNewNonInstallmentFacilities(report, { months: 24, asOf });
  assert.equal(result.count, 2);
  assert.equal(result.totalAmount, 500_000);
});

// ────────────────────────── item 13 ──────────────────────────

test('item 13 — guaranteed installment exposure uses remainingInstallmentsAmount when present', () => {
  const report = r([
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 2_000, remainingInstallmentsAmount: 30_000, outstanding: 28_000 }),
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 5_000, remainingInstallmentsAmount: 50_000, outstanding: 45_000 }),
  ]);
  assert.equal(computeGuaranteedInstallmentExposure(report), 80_000);
});

test('item 13 — falls back to outstanding when remainingInstallmentsAmount is 0', () => {
  const report = r([
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 2_000, remainingInstallmentsAmount: 0, outstanding: 28_000 }),
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 5_000, remainingInstallmentsAmount: 50_000, outstanding: 45_000 }),
  ]);
  assert.equal(computeGuaranteedInstallmentExposure(report), 78_000); // 28k fallback + 50k direct
});

test('item 13 — excludes non-guarantor, terminated, and non-installment facilities', () => {
  const report = r([
    f({ role: 'Borrower',  status: 'Live',       remainingInstallmentsAmount: 100_000 }), // not guarantor
    f({ role: 'Guarantor', status: 'Terminated', remainingInstallmentsAmount: 200_000 }), // not live
    f({ role: 'Guarantor', status: 'Live',       installmentAmount: 0, type: 'CC/OD', outstanding: 50_000 }), // not installment
    f({ role: 'Guarantor', status: 'Live',       remainingInstallmentsAmount: 30_000 }),  // counted
  ]);
  assert.equal(computeGuaranteedInstallmentExposure(report), 30_000);
});

// ────────────────────────── item 14 ──────────────────────────

test('item 14 — guaranteed non-installment exposure sums outstanding', () => {
  const report = r([
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 0, type: 'CC/OD',     outstanding: 250_000 }),
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 0, type: 'Overdraft', outstanding: 100_000 }),
    f({ role: 'Guarantor', status: 'Live', installmentAmount: 5_000, type: 'Term Loan', outstanding: 999_999 }), // installment, excluded
    f({ role: 'Borrower',  status: 'Live', installmentAmount: 0, type: 'CC/OD',     outstanding: 888_888 }), // wrong role
  ]);
  assert.equal(computeGuaranteedNonInstallmentExposure(report), 350_000);
});

// ────────────────────────── item 15 ──────────────────────────

test('item 15 — count of terminated installment loans', () => {
  const report = r([
    f({ status: 'Terminated', installmentAmount: 25_000 }),
    f({ status: 'Terminated', installmentAmount: 15_000 }),
    f({ status: 'Live',       installmentAmount: 10_000 }),                           // live, excluded
    f({ status: 'Terminated', installmentAmount: 0, type: 'CC/OD' }),                 // non-installment, excluded
  ]);
  assert.equal(computeTerminatedInstallmentCount(report), 2);
});

test('item 15 — zero when no terminated installment loans', () => {
  assert.equal(computeTerminatedInstallmentCount(r([f({ status: 'Live' })])), 0);
});
