import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCreditCardFacility,
  analyzeCreditCard,
  analyzeCreditCards,
} from '../src/analytics/devreq1AnalyticsPhaseC.js';

const f = (overrides = {}) => ({
  contractCode: 'CC001',
  institution: 'Test Bank',
  role: 'Borrower',
  status: 'Live',
  nature: 'Funded',
  type: 'Credit Card',
  limit: 100_000,
  outstanding: 30_000,
  overdue: 0,
  installmentAmount: 0,
  startDate: '01/01/2025',
  history: [],
  ...overrides,
});

const row = (dateStr, limit, outstanding, overdue = 0, npi = 0, status = 'STD') => ({
  dateStr,
  date: dateStr.split('/').reverse().join('-'),
  limit,
  outstanding,
  overdue,
  npi,
  status,
});

const r = (facilities = []) => ({ facilities });
const asOf = new Date('2026-04-22T00:00:00Z');

// ── helpers ──

test('isCreditCardFacility: true for Credit Card type', () => {
  assert.equal(isCreditCardFacility(f({ type: 'Credit Card' })), true);
});

test('isCreditCardFacility: case-insensitive', () => {
  assert.equal(isCreditCardFacility(f({ type: 'credit card (Revolving)' })), true);
});

test('isCreditCardFacility: false for Term Loan', () => {
  assert.equal(isCreditCardFacility(f({ type: 'Term Loan' })), false);
});

test('isCreditCardFacility: false for CC/OD (overdraft, not credit card)', () => {
  assert.equal(isCreditCardFacility(f({ type: 'CC/OD' })), false);
});

// ── analyzeCreditCard: the 6 payment-behavior metrics ──

test('analyzeCreditCard: computes months with overdue, months with NPI, peak NPI', () => {
  const card = f({
    history: [
      row('31/05/2025', 100_000, 20_000, 0, 0),
      row('30/06/2025', 100_000, 40_000, 0, 0),
      row('31/07/2025', 100_000, 70_000, 500, 1),    // overdue + NPI
      row('31/08/2025', 100_000, 85_000, 1200, 2),   // overdue + NPI, peak NPI=2
      row('30/09/2025', 100_000, 50_000, 0, 0),
      row('31/10/2025', 100_000, 30_000, 0, 0),
    ],
  });
  const result = analyzeCreditCard(card, { asOf, windowMonths: 12 });
  assert.equal(result.monthsWithOverdue, 2);
  assert.equal(result.monthsWithNpi, 2);
  assert.equal(result.peakNpi, 2);
});

test('analyzeCreditCard: avg and max utilization as percentages', () => {
  const card = f({
    history: [
      row('31/01/2026', 100_000, 20_000),  // 20%
      row('28/02/2026', 100_000, 50_000),  // 50%
      row('31/03/2026', 100_000, 80_000),  // 80%
    ],
  });
  const result = analyzeCreditCard(card, { asOf, windowMonths: 12 });
  assert.equal(Math.round(result.avgUtilization), 50);
  assert.equal(result.maxUtilization, 80);
});

test('analyzeCreditCard: excludes rows with zero limit from utilization avg', () => {
  const card = f({
    history: [
      row('31/01/2026', 0,       30_000),  // zero limit — skipped
      row('28/02/2026', 100_000, 50_000),  // 50%
      row('31/03/2026', 100_000, 80_000),  // 80%
    ],
  });
  const result = analyzeCreditCard(card, { asOf, windowMonths: 12 });
  assert.equal(Math.round(result.avgUtilization), 65);
});

test('analyzeCreditCard: windowMonths trims to last N rows', () => {
  // 14 rows of history; window=12 keeps only the last 12
  const history = Array.from({ length: 14 }, (_, i) => row(
    `01/${String((i % 12) + 1).padStart(2, '0')}/2025`,
    100_000,
    (i + 1) * 1_000
  ));
  const card = f({ history });
  const result = analyzeCreditCard(card, { asOf, windowMonths: 12 });
  assert.equal(result.timeline.length, 12);
  // The two oldest rows (outstanding 1,000 and 2,000) were dropped
  assert.equal(result.timeline[0].outstanding, 3_000);
});

test('analyzeCreditCard: returns null utilizations when no usable rows', () => {
  const card = f({ history: [row('31/01/2026', 0, 30_000)] });  // zero limit only
  const result = analyzeCreditCard(card, { asOf });
  assert.equal(result.avgUtilization, null);
  assert.equal(result.maxUtilization, null);
});

test('analyzeCreditCard: timeline rows carry per-row utilization', () => {
  const card = f({
    history: [
      row('31/01/2026', 100_000, 25_000, 0, 0, 'STD'),
      row('28/02/2026', 100_000, 75_000, 500, 1, 'STD'),
    ],
  });
  const result = analyzeCreditCard(card, { asOf });
  assert.equal(result.timeline[0].utilization, 25);
  assert.equal(result.timeline[0].status, 'STD');
  assert.equal(result.timeline[1].utilization, 75);
  assert.equal(result.timeline[1].npi, 1);
});

// ── analyzeCreditCards: portfolio aggregation ──

test('analyzeCreditCards: portfolio summary counts + totals', () => {
  const report = r([
    f({ contractCode: 'A', status: 'Live',       startDate: '01/01/2025', limit: 100_000, outstanding: 30_000 }),  // >12M ago
    f({ contractCode: 'B', status: 'Live',       startDate: '01/02/2026', limit: 200_000, outstanding: 80_000 }),  // within 12M
    f({ contractCode: 'C', status: 'Terminated', startDate: '01/01/2020', limit: 50_000,  outstanding: 0 }),
    f({ contractCode: 'D', type: 'Term Loan',    status: 'Live',                                                }),  // not a card
  ]);
  const result = analyzeCreditCards(report, { asOf, windowMonths: 12 });
  assert.equal(result.cards.length, 3);
  assert.equal(result.summary.totalCards, 3);
  assert.equal(result.summary.livingCards, 2);
  assert.equal(result.summary.newCards12M, 1); // B only
  assert.equal(result.summary.totalSanction, 300_000); // live only
  assert.equal(result.summary.totalOutstanding, 110_000); // live only
});

test('analyzeCreditCards: empty report is safe', () => {
  const result = analyzeCreditCards(r([]), { asOf });
  assert.equal(result.cards.length, 0);
  assert.equal(result.summary.totalCards, 0);
  assert.equal(result.summary.totalOutstanding, 0);
});
