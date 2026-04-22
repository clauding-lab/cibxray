import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  yearMonthKey,
  findUnchangedOutstandingFacilities,
  findSuddenOverdueEvents,
  findContinuousOverdueFacilities,
  computePeakExposure,
  computePeakEmi,
  computeBurdenDelta,
} from '../src/analytics/devreq1AnalyticsPhaseB.js';

// ── facility factory (with history rows) ──
const f = (overrides = {}) => ({
  contractCode: 'C001',
  institution: 'Test Bank',
  role: 'Borrower',
  status: 'Live',
  nature: 'Funded',
  type: 'Term Loan',
  installmentAmount: 25_000,
  remainingInstallmentsAmount: 0,
  limit: 1_000_000,
  outstanding: 500_000,
  overdue: 0,
  history: [],
  ...overrides,
});

// history row factory — oldest → newest order caller's responsibility
const row = (dateStr, outstanding, overdue = 0, npi = 0, status = 'STD') => ({
  dateStr,
  date: dateStr.split('/').reverse().join('-'),
  outstanding,
  overdue,
  npi,
  limit: 1_000_000,
  status,
});

const r = (facilities = []) => ({ facilities });

// ── helper tests ──

test('yearMonthKey: parses DD/MM/YYYY to YYYY-MM', () => {
  assert.equal(yearMonthKey('15/03/2024'), '2024-03');
  assert.equal(yearMonthKey('31/12/2023'), '2023-12');
});

test('yearMonthKey: null on garbage input', () => {
  assert.equal(yearMonthKey(''), null);
  assert.equal(yearMonthKey('not a date'), null);
});

// ── item 2: unchanged outstanding ──

test('item 2 — flags a flat run of ≥3 months with zero overdue and zero NPI', () => {
  const report = r([f({
    contractCode: 'F1',
    history: [
      row('31/01/2024', 500_000),
      row('29/02/2024', 500_000),
      row('31/03/2024', 500_000),
      row('30/04/2024', 480_000), // breaks the flat
    ],
  })]);
  const flags = findUnchangedOutstandingFacilities(report);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].contractCode, 'F1');
  assert.equal(flags[0].flatValue, 500_000);
  assert.equal(flags[0].fromDate, '31/01/2024');
  assert.equal(flags[0].toDate, '31/03/2024');
  assert.equal(flags[0].monthCount, 3);
});

test('item 2 — does NOT flag when any row in the run has overdue > 0', () => {
  const report = r([f({
    history: [
      row('31/01/2024', 500_000, 0, 0),
      row('29/02/2024', 500_000, 5_000, 0),  // overdue non-zero
      row('31/03/2024', 500_000, 0, 0),
    ],
  })]);
  assert.equal(findUnchangedOutstandingFacilities(report).length, 0);
});

test('item 2 — does NOT flag when NPI > 0 anywhere in the run', () => {
  const report = r([f({
    history: [
      row('31/01/2024', 500_000, 0, 0),
      row('29/02/2024', 500_000, 0, 1),
      row('31/03/2024', 500_000, 0, 0),
    ],
  })]);
  assert.equal(findUnchangedOutstandingFacilities(report).length, 0);
});

test('item 2 — run shorter than minConsecutive is ignored', () => {
  const report = r([f({
    history: [
      row('31/01/2024', 500_000),
      row('29/02/2024', 500_000),
      row('31/03/2024', 480_000),
    ],
  })]);
  assert.equal(findUnchangedOutstandingFacilities(report).length, 0);
});

test('item 2 — captures multiple runs per facility', () => {
  const report = r([f({
    history: [
      row('31/01/2024', 500_000),
      row('29/02/2024', 500_000),
      row('31/03/2024', 500_000),  // end of first flat
      row('30/04/2024', 480_000),  // movement
      row('31/05/2024', 460_000),
      row('30/06/2024', 460_000),
      row('31/07/2024', 460_000),
      row('31/08/2024', 460_000),  // second flat, 4 months
    ],
  })]);
  const flags = findUnchangedOutstandingFacilities(report);
  assert.equal(flags.length, 2);
  assert.equal(flags[0].flatValue, 500_000);
  assert.equal(flags[0].monthCount, 3);
  assert.equal(flags[1].flatValue, 460_000);
  assert.equal(flags[1].monthCount, 4);
});

// ── item 3: sudden multiple overdue (per CRM-CD: NPI 0 → ≥1) ──

test('item 3 — flags NPI transition from 0 → 1', () => {
  const report = r([f({
    contractCode: 'F3',
    history: [
      row('31/12/2023', 500_000, 0, 0),
      row('31/01/2024', 480_000, 5_000, 1, 'STD'),
    ],
  })]);
  const events = findSuddenOverdueEvents(report);
  assert.equal(events.length, 1);
  assert.equal(events[0].contractCode, 'F3');
  assert.equal(events[0].date, '31/01/2024');
  assert.equal(events[0].npi, 1);
  assert.equal(events[0].overdueAmount, 5_000);
});

test('item 3 — flags NPI transition from 0 → 3 (still one event)', () => {
  const report = r([f({
    history: [
      row('31/12/2023', 500_000, 0, 0),
      row('31/01/2024', 480_000, 60_000, 3),
    ],
  })]);
  assert.equal(findSuddenOverdueEvents(report).length, 1);
});

test('item 3 — does NOT flag when prev NPI is already ≥1', () => {
  const report = r([f({
    history: [
      row('31/12/2023', 500_000, 5_000, 1),
      row('31/01/2024', 480_000, 10_000, 2),
    ],
  })]);
  assert.equal(findSuddenOverdueEvents(report).length, 0);
});

test('item 3 — records multiple transitions across a recover/relapse cycle', () => {
  const report = r([f({
    history: [
      row('30/11/2023', 500_000, 0, 0),
      row('31/12/2023', 480_000, 5_000, 1),   // transition #1
      row('31/01/2024', 460_000, 0, 0),       // recovery
      row('29/02/2024', 440_000, 5_000, 1),   // transition #2
    ],
  })]);
  assert.equal(findSuddenOverdueEvents(report).length, 2);
});

// ── item 4: continuous overdue ──

test('item 4 — flags ≥2 consecutive overdue months, not escalated', () => {
  const report = r([f({
    contractCode: 'F4',
    history: [
      row('31/12/2023', 500_000, 0, 0),
      row('31/01/2024', 480_000, 5_000, 1),
      row('29/02/2024', 460_000, 10_000, 2),
      row('31/03/2024', 440_000, 0, 0),
    ],
  })]);
  const flags = findContinuousOverdueFacilities(report);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].contractCode, 'F4');
  assert.equal(flags[0].fromDate, '31/01/2024');
  assert.equal(flags[0].toDate, '29/02/2024');
  assert.equal(flags[0].monthCount, 2);
  assert.equal(flags[0].peakNpi, 2);
  assert.equal(flags[0].escalated, false);
});

test('item 4 — marks escalated=true when run is ≥3 consecutive', () => {
  const report = r([f({
    history: [
      row('31/12/2023', 500_000, 0, 0),
      row('31/01/2024', 480_000, 5_000, 1),
      row('29/02/2024', 460_000, 10_000, 2),
      row('31/03/2024', 440_000, 15_000, 3),
    ],
  })]);
  const flags = findContinuousOverdueFacilities(report);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].monthCount, 3);
  assert.equal(flags[0].peakNpi, 3);
  assert.equal(flags[0].escalated, true);
});

test('item 4 — single-month overdue is not flagged', () => {
  const report = r([f({
    history: [
      row('31/12/2023', 500_000, 0, 0),
      row('31/01/2024', 480_000, 5_000, 1),
      row('29/02/2024', 460_000, 0, 0),
    ],
  })]);
  assert.equal(findContinuousOverdueFacilities(report).length, 0);
});

// ── items 6 / 7 / 8: peak exposure ──

test('item 6 — peak installment outstanding across overlapping facilities', () => {
  const report = r([
    f({
      contractCode: 'A',
      type: 'Term Loan',
      installmentAmount: 20_000,
      history: [
        row('31/01/2024', 500_000),
        row('29/02/2024', 480_000),
        row('31/03/2024', 460_000),
      ],
    }),
    f({
      contractCode: 'B',
      type: 'Term Loan',
      installmentAmount: 10_000,
      history: [
        row('29/02/2024', 300_000),
        row('31/03/2024', 280_000),
      ],
    }),
  ]);
  // Peak date is Feb 2024: 480k + 300k = 780k
  const result = computePeakExposure(report, 'installment');
  assert.equal(result.peakAmount, 780_000);
  assert.equal(result.peakMonthKey, '2024-02');
});

test('item 7 — peak non-installment outstanding ignores installment facilities', () => {
  const report = r([
    f({
      type: 'CC/OD',
      installmentAmount: 0,
      history: [
        row('31/01/2024', 800_000),
        row('29/02/2024', 900_000),
      ],
    }),
    f({
      type: 'Term Loan',
      installmentAmount: 25_000,  // installment — excluded
      history: [
        row('29/02/2024', 500_000),
      ],
    }),
  ]);
  const result = computePeakExposure(report, 'nonInstallment');
  assert.equal(result.peakAmount, 900_000);
  assert.equal(result.peakMonthKey, '2024-02');
});

test('item 8 — cumulative peak combines everything', () => {
  const report = r([
    f({ type: 'Term Loan', installmentAmount: 25_000,
        history: [row('31/01/2024', 500_000), row('29/02/2024', 480_000)] }),
    f({ type: 'CC/OD', installmentAmount: 0,
        history: [row('31/01/2024', 300_000), row('29/02/2024', 350_000)] }),
  ]);
  // Jan: 500k + 300k = 800k ; Feb: 480k + 350k = 830k
  const result = computePeakExposure(report, 'all');
  assert.equal(result.peakAmount, 830_000);
  assert.equal(result.peakMonthKey, '2024-02');
});

test('peak exposure — returns zero peak for empty facilities', () => {
  const result = computePeakExposure(r([]), 'all');
  assert.equal(result.peakAmount, 0);
  assert.equal(result.peakMonthKey, null);
});

// ── item 9: peak cumulative EMI ──

test('item 9 — peak EMI sums per-facility installmentAmount over active facilities', () => {
  const report = r([
    f({ type: 'Term Loan', installmentAmount: 20_000,
        history: [row('31/01/2024', 500_000), row('29/02/2024', 480_000), row('31/03/2024', 460_000)] }),
    f({ type: 'Term Loan', installmentAmount: 15_000,
        history: [row('29/02/2024', 300_000), row('31/03/2024', 280_000)] }),
    f({ type: 'CC/OD', installmentAmount: 0,  // non-installment, excluded
        history: [row('29/02/2024', 900_000)] }),
  ]);
  // Jan: 20k | Feb: 20k + 15k = 35k | Mar: 35k
  // Peak = 35k at the first month it's reached (Feb 2024)
  const result = computePeakEmi(report);
  assert.equal(result.peakAmount, 35_000);
  assert.equal(result.peakMonthKey, '2024-02');
});

test('item 9 — empty timeline returns zero', () => {
  assert.equal(computePeakEmi(r([])).peakAmount, 0);
});

// ── item 12: burden delta ──

const asOf = new Date('2026-04-22T00:00:00Z');
// 12M ago is Apr 2025 (roughly). Target key = '2025-04'

test('item 12 — outstandingDelta and emiDelta against 12M-ago row', () => {
  const report = r([
    f({
      status: 'Live',
      type: 'Term Loan',
      installmentAmount: 20_000,
      outstanding: 400_000,  // today
      history: [
        row('30/04/2025', 600_000),
        row('30/04/2026', 400_000),
      ],
    }),
    f({
      status: 'Live',
      type: 'CC/OD',
      installmentAmount: 0,
      outstanding: 200_000,  // today
      history: [
        row('30/04/2025', 100_000),
        row('30/04/2026', 200_000),
      ],
    }),
  ]);
  const result = computeBurdenDelta(report, { months: 12, asOf });
  // Today totals: outstanding = 400k + 200k = 600k. EMI = 20k.
  // 12M-ago (Apr 2025): outstanding = 600k + 100k = 700k. EMI = 20k (term loan active).
  assert.equal(result.today.outstanding, 600_000);
  assert.equal(result.today.emi, 20_000);
  assert.equal(result.then.outstanding, 700_000);
  assert.equal(result.then.emi, 20_000);
  assert.equal(result.outstandingDelta, -100_000);
  assert.equal(result.emiDelta, 0);
});

test('item 12 — new facility counted in today but not then → positive delta', () => {
  const report = r([
    f({
      status: 'Live',
      installmentAmount: 10_000,
      outstanding: 200_000,
      history: [row('30/04/2026', 200_000)], // only today, not 12M ago
    }),
  ]);
  const result = computeBurdenDelta(report, { months: 12, asOf });
  assert.equal(result.today.outstanding, 200_000);
  assert.equal(result.today.emi, 10_000);
  assert.equal(result.then.outstanding, 0);
  assert.equal(result.then.emi, 0);
  assert.equal(result.outstandingDelta, 200_000);
  assert.equal(result.emiDelta, 10_000);
});
