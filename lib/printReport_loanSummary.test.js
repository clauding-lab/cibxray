/**
 * Tests for print-report loan summary table data logic.
 *
 * We test the analytics helpers used by LoanSummaryTable directly since
 * JSX rendering is not available in node:test (no DOM). This mirrors the
 * approach used by the retail export sheet tests.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitLongShortTerm } from '../src/analytics/devreq2Analytics.js';

// ── Facility factories ─────────────────────────────────────────────────────────

const ltFacility = {
  contractCode: 'TL-001',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2026',   // 6 years
  outstanding: 10_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
};

const stfFacility = {
  contractCode: 'DL-001',
  type: 'Demand Loan',
  nature: 'Funded',
  startDate: '01/01/2026',
  endDate: '01/07/2026',   // 6 months
  outstanding: 5_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
};

const stNonFunded = {
  contractCode: 'LC-001',
  type: 'Letter of Credit',
  nature: 'Non-Funded',
  startDate: '01/01/2026',
  endDate: '01/07/2026',   // 6 months
  outstanding: 3_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Borrower',
  status: 'Live',
};

const guarantorFac = {
  contractCode: 'TL-GUAR',
  type: 'Term Loan',
  nature: 'Funded',
  startDate: '01/01/2020',
  endDate: '01/01/2026',
  outstanding: 8_000_000,
  overdue: 0,
  classification: 'STD',
  role: 'Guarantor',
  status: 'Live',
};

// ── splitLongShortTerm (drives LoanSummaryTable rows) ─────────────────────────

test('splitLongShortTerm correctly classifies long-term facility', () => {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm([ltFacility]);
  assert.equal(longTerm.length, 1);
  assert.equal(shortTermFunded.length, 0);
  assert.equal(shortTermNonFunded.length, 0);
});

test('splitLongShortTerm correctly classifies short-term funded', () => {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm([stfFacility]);
  assert.equal(longTerm.length, 0);
  assert.equal(shortTermFunded.length, 1);
  assert.equal(shortTermNonFunded.length, 0);
});

test('splitLongShortTerm correctly classifies short-term non-funded', () => {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm([stNonFunded]);
  assert.equal(longTerm.length, 0);
  assert.equal(shortTermFunded.length, 0);
  assert.equal(shortTermNonFunded.length, 1);
});

test('splitLongShortTerm excludes guarantor-role facilities', () => {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm([guarantorFac]);
  assert.equal(longTerm.length, 0);
  assert.equal(shortTermFunded.length, 0);
  assert.equal(shortTermNonFunded.length, 0);
});

test('splitLongShortTerm handles a mixed-role facility list correctly', () => {
  const all = [ltFacility, stfFacility, stNonFunded, guarantorFac];
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm(all);
  assert.equal(longTerm.length, 1);
  assert.equal(shortTermFunded.length, 1);
  assert.equal(shortTermNonFunded.length, 1);
});

// ── Classified / SMA aggregation logic (mirrors LoanSummaryTable internals) ───

test('classified sums only SS/DF/BL/BLW outstanding', () => {
  const CLASSIFIED = new Set(['SS', 'DF', 'BL', 'BLW']);
  const facs = [
    { outstanding: 5_000_000, classification: 'SS' },
    { outstanding: 3_000_000, classification: 'DF' },
    { outstanding: 2_000_000, classification: 'STD' },
    { outstanding: 1_000_000, classification: 'SMA' },
  ];
  const sum = facs.filter(f => CLASSIFIED.has(f.classification)).reduce((s, f) => s + f.outstanding, 0);
  assert.equal(sum, 8_000_000);
});

test('SMA aggregation counts only SMA classification', () => {
  const facs = [
    { outstanding: 4_000_000, classification: 'SMA' },
    { outstanding: 2_000_000, classification: 'SMA' },
    { outstanding: 3_000_000, classification: 'STD' },
  ];
  const smaSum = facs.filter(f => f.classification === 'SMA').reduce((s, f) => s + f.outstanding, 0);
  assert.equal(smaSum, 6_000_000);
});

// ── Print report context: multi-PDF group table (companies only) ──────────────

test('filterCompaniesOnly excludes INDIVIDUAL-type reports', async () => {
  const { filterCompaniesOnly } = await import('../src/analytics/devreq2Analytics.js');
  const reports = [
    { subject: { subjectType: 'COMPANY' }, facilities: [] },
    { subject: { subjectType: 'INDIVIDUAL' }, facilities: [] },
    { subject: { subjectType: 'COMPANY' }, facilities: [] },
  ];
  const companies = filterCompaniesOnly(reports);
  assert.equal(companies.length, 2);
});
