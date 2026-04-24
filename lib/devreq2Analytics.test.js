/**
 * DevReq-2 Phase 2 — Analytics layer tests
 *
 * TDD: tests are written first. Each function group follows RED → GREEN → commit.
 * Pattern: node --test (same as existing test suite)
 * Style: AAA (Arrange / Act / Assert), one describe block per function.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTenure,
  classifyFundedNature,
  splitLongShortTerm,
  monthsDiff,
  computeHistoryRollup,
  detectMoratorium,
  computePerformanceUtilization,
  detectForcedLoan,
  computeDebtBurdenPerYear,
  computeDebtBurdenPerYearWithDiagnostics,
  computeTerminatedNonInstallmentCount,
  computeTerminatedAmount,
  aggregateByConcern,
  filterCompaniesOnly,
  computePercentOfConcernSTF,
  detectApplyingConcern,
  computeTotalForeignLoan,
  analyzeNonInstallmentUtilization,
} from '../src/analytics/devreq2Analytics.js';

// ── factory helpers ──────────────────────────────────────────────────────────

/** Minimal facility with sensible defaults */
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
  endDate: '01/01/2026',
  history: [],
  ...overrides,
});

/** Minimal report */
const rep = (facilities = [], subjectOverrides = {}) => ({
  fileName: '1011500056801.pdf',
  subject: {
    subjectType: 'COMPANY',
    name: 'Test Co',
    cibSubjectCode: 'C001',
    mainRepresentative: '',
    ...subjectOverrides,
  },
  facilities,
});

/** History row factory */
const hrow = (overrides = {}) => ({
  dateStr: '01/01/2024',
  outstanding: 500_000,
  overdue: 0,
  limit: 1_000_000,
  npi: 0,
  status: 'STD',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════
// monthsDiff helper
// ═══════════════════════════════════════════════════════════════════════

test('monthsDiff: returns 12 for same-month 1-year apart', () => {
  // Arrange
  const start = new Date('2023-01-01');
  const end = new Date('2024-01-01');
  // Act
  const result = monthsDiff(start, end);
  // Assert
  assert.equal(result, 12);
});

test('monthsDiff: returns 6 for half-year gap', () => {
  const result = monthsDiff(new Date('2023-01-01'), new Date('2023-07-01'));
  assert.equal(result, 6);
});

test('monthsDiff: returns 0 for same date', () => {
  const result = monthsDiff(new Date('2023-06-15'), new Date('2023-06-15'));
  assert.equal(result, 0);
});

// ═══════════════════════════════════════════════════════════════════════
// classifyTenure
// ═══════════════════════════════════════════════════════════════════════

test('classifyTenure: > 12 months → long-term', () => {
  // Arrange: 2 years
  const f = fac({ startDate: '01/01/2023', endDate: '01/01/2025' });
  // Act
  const result = classifyTenure(f);
  // Assert
  assert.equal(result, 'long-term');
});

test('classifyTenure: exactly 12 months → short-term (boundary)', () => {
  const f = fac({ startDate: '01/01/2023', endDate: '01/01/2024' });
  assert.equal(classifyTenure(f), 'short-term');
});

test('classifyTenure: < 12 months → short-term', () => {
  const f = fac({ startDate: '01/06/2023', endDate: '31/05/2024' });
  assert.equal(classifyTenure(f), 'short-term');
});

test('classifyTenure: 13 months → long-term', () => {
  const f = fac({ startDate: '01/01/2023', endDate: '01/02/2024' });
  assert.equal(classifyTenure(f), 'long-term');
});

test('classifyTenure: missing startDate → short-term (conservative fallback)', () => {
  const f = fac({ startDate: '', endDate: '01/01/2024' });
  assert.equal(classifyTenure(f), 'short-term');
});

test('classifyTenure: missing endDate → short-term (conservative fallback)', () => {
  const f = fac({ startDate: '01/01/2023', endDate: '' });
  assert.equal(classifyTenure(f), 'short-term');
});

test('classifyTenure: both dates missing → short-term', () => {
  const f = fac({ startDate: '', endDate: '' });
  assert.equal(classifyTenure(f), 'short-term');
});

// ═══════════════════════════════════════════════════════════════════════
// classifyFundedNature
// ═══════════════════════════════════════════════════════════════════════

test('classifyFundedNature: LC → non-funded', () => {
  const f = fac({ type: 'Letter of Credit' });
  assert.equal(classifyFundedNature(f), 'non-funded');
});

test('classifyFundedNature: Guarantee → non-funded', () => {
  const f = fac({ type: 'Bank Guarantee' });
  assert.equal(classifyFundedNature(f), 'non-funded');
});

test('classifyFundedNature: Other Indirect → non-funded', () => {
  const f = fac({ type: 'Other Indirect Facility' });
  assert.equal(classifyFundedNature(f), 'non-funded');
});

test('classifyFundedNature: LC case-insensitive match', () => {
  const f = fac({ type: 'letter of credit (non funded)' });
  assert.equal(classifyFundedNature(f), 'non-funded');
});

test('classifyFundedNature: Term Loan → funded', () => {
  const f = fac({ type: 'Term Loan' });
  assert.equal(classifyFundedNature(f), 'funded');
});

test('classifyFundedNature: Overdraft → funded', () => {
  const f = fac({ type: 'Overdraft' });
  assert.equal(classifyFundedNature(f), 'funded');
});

test('classifyFundedNature: Credit Card → funded (not in non-funded list)', () => {
  const f = fac({ type: 'Credit Card' });
  assert.equal(classifyFundedNature(f), 'funded');
});

// ═══════════════════════════════════════════════════════════════════════
// splitLongShortTerm
// ═══════════════════════════════════════════════════════════════════════

test('splitLongShortTerm: splits correctly into 3 buckets', () => {
  // Arrange
  const lt = fac({ startDate: '01/01/2020', endDate: '01/01/2023' }); // 3 years
  const stf = fac({ startDate: '01/01/2024', endDate: '01/06/2024', type: 'Overdraft' }); // 5 months
  const stnf = fac({ startDate: '01/01/2024', endDate: '01/06/2024', type: 'Letter of Credit' });
  // Act
  const result = splitLongShortTerm([lt, stf, stnf]);
  // Assert
  assert.equal(result.longTerm.length, 1);
  assert.equal(result.shortTermFunded.length, 1);
  assert.equal(result.shortTermNonFunded.length, 1);
});

test('splitLongShortTerm: excludes Guarantor role', () => {
  const gt = fac({ role: 'Guarantor', startDate: '01/01/2020', endDate: '01/01/2025' });
  const result = splitLongShortTerm([gt]);
  assert.equal(result.longTerm.length, 0);
  assert.equal(result.shortTermFunded.length, 0);
  assert.equal(result.shortTermNonFunded.length, 0);
});

test('splitLongShortTerm: empty input returns empty buckets', () => {
  const result = splitLongShortTerm([]);
  assert.deepEqual(result, { longTerm: [], shortTermFunded: [], shortTermNonFunded: [] });
});

test('splitLongShortTerm: does not mutate input array', () => {
  const facilities = [fac()];
  const before = [...facilities];
  splitLongShortTerm(facilities);
  assert.deepEqual(facilities, before);
});

// ═══════════════════════════════════════════════════════════════════════
// computeHistoryRollup
// ═══════════════════════════════════════════════════════════════════════

test('computeHistoryRollup: all zeros on empty history', () => {
  // Arrange
  const f = fac({ overdue: 0, history: [] });
  // Act
  const r = computeHistoryRollup(f);
  // Assert
  assert.equal(r.currentNpi, 0);
  assert.equal(r.highestNpi, 0);
  assert.equal(r.highestOverdue, 0);
  assert.equal(r.highestOverdueDate, '');
  assert.equal(r.worstStatus, 'STD');
  assert.deepEqual(r.classificationHistory, []);
});

test('computeHistoryRollup: currentNpi counts from most-recent until zero-overdue', () => {
  // Arrange: rows oldest→newest, last 3 have overdue
  const history = [
    hrow({ overdue: 0, npi: 0, status: 'STD' }),
    hrow({ overdue: 0, npi: 0, status: 'STD' }),
    hrow({ overdue: 10_000, npi: 1, status: 'SMA', dateStr: '01/03/2024' }),
    hrow({ overdue: 20_000, npi: 2, status: 'SS', dateStr: '01/04/2024' }),
    hrow({ overdue: 30_000, npi: 3, status: 'SS', dateStr: '01/05/2024' }),
  ];
  const f = fac({ history });
  // Act
  const r = computeHistoryRollup(f);
  // Assert: walk from last row back; all 3 have overdue > 0 → currentNpi = 3
  assert.equal(r.currentNpi, 3);
});

test('computeHistoryRollup: currentNpi stops at first zero-overdue from end', () => {
  const history = [
    hrow({ overdue: 50_000, npi: 2, dateStr: '01/01/2024' }),
    hrow({ overdue: 0, npi: 0, status: 'STD', dateStr: '01/02/2024' }),
    hrow({ overdue: 10_000, npi: 1, status: 'SMA', dateStr: '01/03/2024' }),
  ];
  const f = fac({ history });
  const r = computeHistoryRollup(f);
  // Only the last row has overdue > 0 → currentNpi = 1
  assert.equal(r.currentNpi, 1);
});

test('computeHistoryRollup: highestNpi is max over all history npi', () => {
  const history = [
    hrow({ npi: 1 }),
    hrow({ npi: 5 }),
    hrow({ npi: 3 }),
  ];
  const r = computeHistoryRollup(fac({ history }));
  assert.equal(r.highestNpi, 5);
});

test('computeHistoryRollup: highestOverdue and date from argmax row', () => {
  const history = [
    hrow({ overdue: 10_000, dateStr: '01/01/2024' }),
    hrow({ overdue: 50_000, dateStr: '01/02/2024' }),
    hrow({ overdue: 20_000, dateStr: '01/03/2024' }),
  ];
  const r = computeHistoryRollup(fac({ history }));
  assert.equal(r.highestOverdue, 50_000);
  assert.equal(r.highestOverdueDate, '01/02/2024');
});

test('computeHistoryRollup: worstStatus ordering BLW > BL > DF > SS > SMA > STD', () => {
  const history = [
    hrow({ status: 'STD' }),
    hrow({ status: 'SMA' }),
    hrow({ status: 'SS' }),
    hrow({ status: 'DF' }),
    hrow({ status: 'BL' }),
  ];
  const r = computeHistoryRollup(fac({ history }));
  assert.equal(r.worstStatus, 'BL');
});

test('computeHistoryRollup: worstStatus BLW beats BL', () => {
  const history = [
    hrow({ status: 'BL' }),
    hrow({ status: 'BLW' }),
  ];
  const r = computeHistoryRollup(fac({ history }));
  assert.equal(r.worstStatus, 'BLW');
});

test('computeHistoryRollup: classificationHistory dedupes consecutive runs', () => {
  const history = [
    hrow({ status: 'STD', dateStr: '01/01/2024' }),
    hrow({ status: 'STD', dateStr: '01/02/2024' }),
    hrow({ status: 'SMA', dateStr: '01/03/2024' }),
    hrow({ status: 'SMA', dateStr: '01/04/2024' }),
    hrow({ status: 'STD', dateStr: '01/05/2024' }),
  ];
  const r = computeHistoryRollup(fac({ history }));
  assert.equal(r.classificationHistory.length, 3);
  assert.equal(r.classificationHistory[0].status, 'STD');
  assert.equal(r.classificationHistory[1].status, 'SMA');
  assert.equal(r.classificationHistory[2].status, 'STD');
});

test('computeHistoryRollup: does not mutate input facility', () => {
  const f = fac({ history: [hrow()] });
  const histBefore = JSON.stringify(f.history);
  computeHistoryRollup(f);
  assert.equal(JSON.stringify(f.history), histBefore);
});

// ═══════════════════════════════════════════════════════════════════════
// detectMoratorium
// ═══════════════════════════════════════════════════════════════════════

test('detectMoratorium: overdue > 0 → false', () => {
  const f = fac({ overdue: 5_000, history: [
    hrow({ outstanding: 100 }),
    hrow({ outstanding: 100 }),
    hrow({ outstanding: 100 }),
    hrow({ outstanding: 100 }),
  ]});
  assert.equal(detectMoratorium(f), false);
});

test('detectMoratorium: overdue === 0 and h[0] >= h[3] outstanding → true', () => {
  // Arrange: overdue 0, balance has not decreased (moratorium suspicion)
  const f = fac({ overdue: 0, history: [
    hrow({ outstanding: 1_000_000, dateStr: '01/01/2024' }),  // oldest
    hrow({ outstanding: 1_000_000, dateStr: '01/02/2024' }),
    hrow({ outstanding: 1_000_000, dateStr: '01/03/2024' }),
    hrow({ outstanding: 1_000_000, dateStr: '01/04/2024' }),  // newest [3]
  ]});
  assert.equal(detectMoratorium(f), true);
});

test('detectMoratorium: overdue === 0 and h[0] < h[3] outstanding → false (balance reducing)', () => {
  const f = fac({ overdue: 0, history: [
    hrow({ outstanding: 1_000_000 }),
    hrow({ outstanding: 900_000 }),
    hrow({ outstanding: 800_000 }),
    hrow({ outstanding: 700_000 }),
  ]});
  assert.equal(detectMoratorium(f), false);
});

test('detectMoratorium: fewer than 4 history rows → false', () => {
  const f = fac({ overdue: 0, history: [
    hrow({ outstanding: 1_000_000 }),
    hrow({ outstanding: 1_000_000 }),
    hrow({ outstanding: 1_000_000 }),
  ]});
  assert.equal(detectMoratorium(f), false);
});

test('detectMoratorium: empty history → false', () => {
  const f = fac({ overdue: 0, history: [] });
  assert.equal(detectMoratorium(f), false);
});

// ═══════════════════════════════════════════════════════════════════════
// computePerformanceUtilization
// ═══════════════════════════════════════════════════════════════════════

test('computePerformanceUtilization: null when no history', () => {
  const f = fac({ history: [] });
  assert.equal(computePerformanceUtilization(f), null);
});

test('computePerformanceUtilization: null when all limits are zero', () => {
  const f = fac({ history: [hrow({ limit: 0, outstanding: 500_000 })] });
  assert.equal(computePerformanceUtilization(f), null);
});

test('computePerformanceUtilization: < 0.75 mean → Good', () => {
  // Arrange: outstanding / limit = 0.5 each row
  const history = [
    hrow({ outstanding: 500_000, limit: 1_000_000 }),
    hrow({ outstanding: 600_000, limit: 1_000_000 }),
  ];
  const result = computePerformanceUtilization(fac({ history }));
  assert.equal(result, 'Good');
});

test('computePerformanceUtilization: exactly 0.75 → Moderate', () => {
  const history = [hrow({ outstanding: 750_000, limit: 1_000_000 })];
  const result = computePerformanceUtilization(fac({ history }));
  assert.equal(result, 'Moderate');
});

test('computePerformanceUtilization: 0.85 mean → Moderate', () => {
  const history = [hrow({ outstanding: 850_000, limit: 1_000_000 })];
  const result = computePerformanceUtilization(fac({ history }));
  assert.equal(result, 'Moderate');
});

test('computePerformanceUtilization: > 0.90 mean → Poor', () => {
  const history = [hrow({ outstanding: 950_000, limit: 1_000_000 })];
  const result = computePerformanceUtilization(fac({ history }));
  assert.equal(result, 'Poor');
});

test('computePerformanceUtilization: exactly 0.90 → Moderate (boundary)', () => {
  const history = [hrow({ outstanding: 900_000, limit: 1_000_000 })];
  const result = computePerformanceUtilization(fac({ history }));
  assert.equal(result, 'Moderate');
});

// ═══════════════════════════════════════════════════════════════════════
// detectForcedLoan
// ═══════════════════════════════════════════════════════════════════════

test('detectForcedLoan: end - start <= 5 days → true', () => {
  const f = fac({ startDate: '01/01/2024', endDate: '05/01/2024' }); // 4 days
  assert.equal(detectForcedLoan(f), true);
});

test('detectForcedLoan: end - start exactly 5 days → true', () => {
  const f = fac({ startDate: '01/01/2024', endDate: '06/01/2024' }); // exactly 5 days
  assert.equal(detectForcedLoan(f), true);
});

test('detectForcedLoan: end - start = 6 days → false', () => {
  const f = fac({ startDate: '01/01/2024', endDate: '07/01/2024' }); // 6 days
  assert.equal(detectForcedLoan(f), false);
});

test('detectForcedLoan: normal long-term loan → false', () => {
  const f = fac({ startDate: '01/01/2023', endDate: '01/01/2026' });
  assert.equal(detectForcedLoan(f), false);
});

test('detectForcedLoan: missing startDate → false', () => {
  const f = fac({ startDate: '', endDate: '01/01/2024' });
  assert.equal(detectForcedLoan(f), false);
});

test('detectForcedLoan: missing endDate → false', () => {
  const f = fac({ startDate: '01/01/2024', endDate: '' });
  assert.equal(detectForcedLoan(f), false);
});

// ═══════════════════════════════════════════════════════════════════════
// computeDebtBurdenPerYear
// ═══════════════════════════════════════════════════════════════════════

test('computeDebtBurdenPerYear: monthly periodicity → installmentAmount × 12', () => {
  // Arrange: monthly installments, installmentAmount matches EMI
  const f = fac({
    disbursementAmount: 1_000_000,
    startDate: '01/01/2023',
    endDate: '01/01/2026',  // 3 years = 36 months
    installmentAmount: 30_000,
    paymentPeriodicity: 'Monthly',
  });
  // Act
  const result = computeDebtBurdenPerYear(f);
  // Assert: 30_000 × 12 = 360_000
  assert.equal(result, 360_000);
});

test('computeDebtBurdenPerYear: quarterly periodicity → installmentAmount × 4', () => {
  const f = fac({
    disbursementAmount: 1_000_000,
    startDate: '01/01/2023',
    endDate: '01/01/2026',
    installmentAmount: 90_000,
    paymentPeriodicity: 'Quarterly',
  });
  const result = computeDebtBurdenPerYear(f);
  assert.equal(result, 360_000); // 90_000 × 4
});

test('computeDebtBurdenPerYear: bimonthly → installmentAmount × 6', () => {
  const f = fac({
    installmentAmount: 60_000,
    paymentPeriodicity: 'Bimonthly',
  });
  assert.equal(computeDebtBurdenPerYear(f), 360_000);
});

test('computeDebtBurdenPerYear: half-yearly → installmentAmount × 2', () => {
  const f = fac({
    installmentAmount: 180_000,
    paymentPeriodicity: 'Half-Yearly',
  });
  assert.equal(computeDebtBurdenPerYear(f), 360_000);
});

test('computeDebtBurdenPerYear: no periodicity, no installmentAmount → 0', () => {
  const f = fac({
    disbursementAmount: 0,
    installmentAmount: 0,
    paymentPeriodicity: '',
    startDate: '',
    endDate: '',
  });
  assert.equal(computeDebtBurdenPerYear(f), 0);
});

test('computeDebtBurdenPerYearWithDiagnostics: returns result and method', () => {
  const f = fac({ installmentAmount: 25_000, paymentPeriodicity: 'Monthly' });
  const d = computeDebtBurdenPerYearWithDiagnostics(f);
  assert.ok('annualBurden' in d);
  assert.ok('method' in d);
  assert.equal(d.annualBurden, 300_000);
});

// ═══════════════════════════════════════════════════════════════════════
// computeTerminatedNonInstallmentCount
// ═══════════════════════════════════════════════════════════════════════

test('computeTerminatedNonInstallmentCount: counts only terminated non-installment', () => {
  // Arrange
  const live_inst = fac({ status: 'Live', type: 'Term Loan', installmentAmount: 10_000 });
  const term_inst = fac({ status: 'Terminated', type: 'Term Loan', installmentAmount: 10_000 });
  const term_ni = fac({ status: 'Terminated', type: 'Overdraft', installmentAmount: 0 });
  const term_ni2 = fac({ status: 'Terminated', type: 'Letter of Credit', installmentAmount: 0 });
  const r = rep([live_inst, term_inst, term_ni, term_ni2]);
  // Act
  const result = computeTerminatedNonInstallmentCount(r);
  // Assert: only the two terminated non-installment facilities count
  assert.equal(result, 2);
});

test('computeTerminatedNonInstallmentCount: zero when no terminated non-installment', () => {
  const r = rep([fac({ status: 'Live' }), fac({ status: 'Terminated', type: 'Term Loan', installmentAmount: 10_000 })]);
  assert.equal(computeTerminatedNonInstallmentCount(r), 0);
});

// ═══════════════════════════════════════════════════════════════════════
// computeTerminatedAmount
// ═══════════════════════════════════════════════════════════════════════

test('computeTerminatedAmount: kind=all sums all terminated outstanding', () => {
  const t1 = fac({ status: 'Terminated', outstanding: 200_000, type: 'Term Loan', installmentAmount: 10_000 });
  const t2 = fac({ status: 'Terminated', outstanding: 300_000, type: 'Overdraft', installmentAmount: 0 });
  const l1 = fac({ status: 'Live', outstanding: 500_000 });
  const r = rep([t1, t2, l1]);
  assert.equal(computeTerminatedAmount(r, 'all'), 500_000);
});

test('computeTerminatedAmount: kind=installment sums only installment terminated', () => {
  const t1 = fac({ status: 'Terminated', outstanding: 200_000, type: 'Term Loan', installmentAmount: 10_000 });
  const t2 = fac({ status: 'Terminated', outstanding: 300_000, type: 'Overdraft', installmentAmount: 0 });
  const r = rep([t1, t2]);
  assert.equal(computeTerminatedAmount(r, 'installment'), 200_000);
});

test('computeTerminatedAmount: kind=non-installment sums only non-installment terminated', () => {
  const t1 = fac({ status: 'Terminated', outstanding: 200_000, type: 'Term Loan', installmentAmount: 10_000 });
  const t2 = fac({ status: 'Terminated', outstanding: 300_000, type: 'Overdraft', installmentAmount: 0 });
  const r = rep([t1, t2]);
  assert.equal(computeTerminatedAmount(r, 'non-installment'), 300_000);
});

test('computeTerminatedAmount: returns 0 when no terminated facilities', () => {
  const r = rep([fac({ status: 'Live', outstanding: 500_000 })]);
  assert.equal(computeTerminatedAmount(r, 'all'), 0);
});

// ═══════════════════════════════════════════════════════════════════════
// filterCompaniesOnly
// ═══════════════════════════════════════════════════════════════════════

test('filterCompaniesOnly: returns only COMPANY-type reports', () => {
  const company = rep([], { subjectType: 'COMPANY' });
  const individual = rep([], { subjectType: 'INDIVIDUAL' });
  const result = filterCompaniesOnly([company, individual]);
  assert.equal(result.length, 1);
  assert.equal(result[0].subject.subjectType, 'COMPANY');
});

test('filterCompaniesOnly: empty input → empty output', () => {
  assert.deepEqual(filterCompaniesOnly([]), []);
});

test('filterCompaniesOnly: does not mutate input array', () => {
  const reports = [rep([], { subjectType: 'COMPANY' }), rep([], { subjectType: 'INDIVIDUAL' })];
  const before = reports.length;
  filterCompaniesOnly(reports);
  assert.equal(reports.length, before);
});

// ═══════════════════════════════════════════════════════════════════════
// computePercentOfConcernSTF
// ═══════════════════════════════════════════════════════════════════════

test('computePercentOfConcernSTF: correct percentage of STF outstanding', () => {
  // Arrange: report has two short-term funded live facilities
  const stf1 = fac({ outstanding: 200_000, startDate: '01/01/2024', endDate: '01/06/2024', type: 'Overdraft' });
  const stf2 = fac({ outstanding: 300_000, startDate: '01/01/2024', endDate: '01/06/2024', type: 'Term Loan', installmentAmount: 0 });
  const r = rep([stf1, stf2]);
  // Act: stf1 is 200/500 = 40%
  const result = computePercentOfConcernSTF(stf1, r);
  // Assert
  assert.ok(Math.abs(result - 40) < 0.01);
});

test('computePercentOfConcernSTF: returns 0 when denominator is 0', () => {
  const f = fac({ outstanding: 100_000, startDate: '01/01/2024', endDate: '01/06/2024' });
  const r = rep([]); // no STF facilities
  assert.equal(computePercentOfConcernSTF(f, r), 0);
});

// ═══════════════════════════════════════════════════════════════════════
// computeTotalForeignLoan
// ═══════════════════════════════════════════════════════════════════════

test('computeTotalForeignLoan: sums outstanding of isForeign borrower-role live facilities', () => {
  // Arrange
  const foreign = fac({ isForeign: true, outstanding: 5_000_000, role: 'Borrower', status: 'Live' });
  const domestic = fac({ isForeign: false, outstanding: 3_000_000, role: 'Borrower', status: 'Live' });
  const r = rep([foreign, domestic]);
  // Act
  const result = computeTotalForeignLoan(r);
  // Assert
  assert.equal(result, 5_000_000);
});

test('computeTotalForeignLoan: excludes guarantor-role facilities', () => {
  const fg = fac({ isForeign: true, outstanding: 2_000_000, role: 'Guarantor', status: 'Live' });
  const r = rep([fg]);
  assert.equal(computeTotalForeignLoan(r), 0);
});

test('computeTotalForeignLoan: excludes terminated facilities', () => {
  const ft = fac({ isForeign: true, outstanding: 2_000_000, role: 'Borrower', status: 'Terminated' });
  const r = rep([ft]);
  assert.equal(computeTotalForeignLoan(r), 0);
});

test('computeTotalForeignLoan: returns 0 when no foreign facilities', () => {
  const r = rep([fac({ isForeign: false, outstanding: 1_000_000 })]);
  assert.equal(computeTotalForeignLoan(r), 0);
});

// ═══════════════════════════════════════════════════════════════════════
// detectApplyingConcern
// ═══════════════════════════════════════════════════════════════════════

test('detectApplyingConcern: bare filename → applying concern', () => {
  // Arrange: one bare + one hyphen-indexed
  const base = rep([], {}, { fileName: '1011500056801.pdf' });
  const sister = { ...rep([]), fileName: '1011500056801-1.pdf' };
  base.fileName = '1011500056801.pdf';
  // Act
  const result = detectApplyingConcern([base, sister]);
  // Assert
  assert.equal(result.applyingConcern.fileName, '1011500056801.pdf');
  assert.equal(result.sisterConcerns.length, 1);
  assert.equal(result.groupRefBase, '1011500056801');
});

test('detectApplyingConcern: no bare file → fallback to smallest suffix index', () => {
  const r1 = { ...rep([]), fileName: '1011500056801-2.pdf' };
  const r2 = { ...rep([]), fileName: '1011500056801-1.pdf' };
  const result = detectApplyingConcern([r1, r2]);
  assert.equal(result.applyingConcern.fileName, '1011500056801-1.pdf');
});

test('detectApplyingConcern: single report → returns it as applying concern', () => {
  const r = { ...rep([]), fileName: '1011500056801.pdf' };
  const result = detectApplyingConcern([r]);
  assert.equal(result.applyingConcern.fileName, '1011500056801.pdf');
  assert.equal(result.sisterConcerns.length, 0);
});

test('detectApplyingConcern: multiple bare bases → throws error', () => {
  const r1 = { ...rep([]), fileName: '1011500056801.pdf' };
  const r2 = { ...rep([]), fileName: '2022300078901.pdf' };
  assert.throws(() => detectApplyingConcern([r1, r2]), /multiple|ambiguous/i);
});

// ═══════════════════════════════════════════════════════════════════════
// aggregateByConcern
// ═══════════════════════════════════════════════════════════════════════

test('aggregateByConcern: groups by fileName and sums facility amounts', () => {
  // Arrange
  const f1 = fac({ outstanding: 100_000, overdue: 0, type: 'Term Loan', installmentAmount: 5_000 });
  const f2 = fac({ outstanding: 200_000, overdue: 10_000, type: 'Overdraft', installmentAmount: 0 });
  const f3 = fac({ outstanding: 50_000, overdue: 5_000, type: 'Letter of Credit', installmentAmount: 0 });
  const r1 = { ...rep([f1, f2, f3]), fileName: 'A.pdf' };
  // Act
  const result = aggregateByConcern([r1], () => true);
  // Assert
  assert.ok(result instanceof Map);
  assert.ok(result.has('A.pdf'));
  const a = result.get('A.pdf');
  assert.equal(a.totalLoan, 350_000); // 100+200+50
});

test('aggregateByConcern: predicate filters facilities', () => {
  const f1 = fac({ outstanding: 100_000, status: 'Live', type: 'Term Loan', installmentAmount: 5_000 });
  const f2 = fac({ outstanding: 200_000, status: 'Terminated', type: 'Overdraft', installmentAmount: 0 });
  const r1 = { ...rep([f1, f2]), fileName: 'B.pdf' };
  // Only include Live facilities
  const result = aggregateByConcern([r1], (f) => f.status === 'Live');
  const b = result.get('B.pdf');
  assert.equal(b.totalLoan, 100_000);
});

test('aggregateByConcern: does not mutate input reports', () => {
  const r = { ...rep([fac()]), fileName: 'C.pdf' };
  const facilityCountBefore = r.facilities.length;
  aggregateByConcern([r], () => true);
  assert.equal(r.facilities.length, facilityCountBefore);
});

// ═══════════════════════════════════════════════════════════════════════
// analyzeNonInstallmentUtilization
// ═══════════════════════════════════════════════════════════════════════

test('analyzeNonInstallmentUtilization: computes avgUtilization and maxUtilization', () => {
  const history = [
    hrow({ outstanding: 500_000, limit: 1_000_000 }),
    hrow({ outstanding: 800_000, limit: 1_000_000 }),
  ];
  const f = fac({ type: 'Overdraft', installmentAmount: 0, history });
  const result = analyzeNonInstallmentUtilization(f);
  assert.ok(Math.abs(result.avgUtilization - 65) < 0.01);  // (50+80)/2 = 65%
  assert.equal(result.maxUtilization, 80);
});

test('analyzeNonInstallmentUtilization: null when no history', () => {
  const f = fac({ type: 'Overdraft', installmentAmount: 0, history: [] });
  const result = analyzeNonInstallmentUtilization(f);
  assert.equal(result.avgUtilization, null);
  assert.equal(result.maxUtilization, null);
});

test('analyzeNonInstallmentUtilization: skips rows with zero limit', () => {
  const history = [
    hrow({ outstanding: 500_000, limit: 0 }),       // limit zero, skip
    hrow({ outstanding: 800_000, limit: 1_000_000 }), // 80%
  ];
  const f = fac({ type: 'Overdraft', installmentAmount: 0, history });
  const result = analyzeNonInstallmentUtilization(f);
  assert.equal(result.maxUtilization, 80);
});

// ═══════════════════════════════════════════════════════════════════════
// computeBurdenDelta extension — months: 24 test
// ═══════════════════════════════════════════════════════════════════════

import { computeBurdenDelta } from '../src/analytics/devreq1AnalyticsPhaseB.js';

test('computeBurdenDelta: months:24 computes correct targetMonthKey', () => {
  // Arrange: fix asOf to a known date
  const asOf = new Date('2024-03-01');
  const report = {
    facilities: [
      {
        status: 'Live',
        type: 'Term Loan',
        installmentAmount: 20_000,
        outstanding: 500_000,
        history: [
          { dateStr: '01/03/2022', outstanding: 300_000, overdue: 0, npi: 0, status: 'STD', limit: 1_000_000 },
        ],
      },
    ],
  };
  // Act
  const result = computeBurdenDelta(report, { months: 24, asOf });
  // Assert: target = 24 months before 2024-03 = 2022-03
  assert.equal(result.targetMonthKey, '2022-03');
  assert.equal(result.then.outstanding, 300_000);
  assert.equal(result.outstandingDelta, 200_000);
});
