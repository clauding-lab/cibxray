import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessParseQuality } from '../src/parser/parseQuality.js';

test('returns ok when sums match summary exactly', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('returns unavailable when summary section is missing', () => {
  const report = { summary: {}, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});

test('returns unavailable when summary.totalOutstanding is null', () => {
  const report = { summary: { totalOutstanding: null, totalOverdue: null }, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});

test('returns ok when gap is below 1% and below 1 lakh', () => {
  const report = {
    summary: { totalOutstanding: 50_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 49_950_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('small loan: ok when gap is below 1 lakh even if above 1%', () => {
  const report = {
    summary: { totalOutstanding: 500_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 420_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('returns minor when gap exceeds threshold by up to 2x', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 98_500_000, overdue: 0 },
    ],
  };
  const result = assessParseQuality(report);
  assert.equal(result.tier, 'minor');
  assert.equal(result.issues[0].field, 'outstanding');
});

test('returns major when gap exceeds 2x threshold', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 50_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('overdue mismatch alone elevates the tier', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 5_000_000 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 1_000_000 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('overall tier is worst of the two checks', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 5_000_000 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 98_500_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('excludes historical (terminated) facilities from computed sums', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
      { status: 'Terminated', nature: 'Funded', outstanding: 20_000_000, overdue: 0 },
      { status: 'Terminated', nature: 'Non-Funded', outstanding: 15_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('includes live non-funded facilities in computed sums (LC/BG/BLW)', () => {
  // Summary = funded + non-funded combined (CITY LUBE OIL case).
  const report = {
    summary: { totalOutstanding: 693_772_586, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 269_143_716, overdue: 0 },
      { status: 'Live', nature: 'Non-Funded', outstanding: 424_628_870, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('live non-funded overdue contributes to the overdue check', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 3_000_000 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 6_000_000, overdue: 1_000_000 },
      { status: 'Live', nature: 'Non-Funded', outstanding: 4_000_000, overdue: 2_000_000 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('excludes guarantor facilities from computed sums', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { role: 'Borrower', status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
      { role: 'Guarantor', status: 'Live', nature: 'Funded', outstanding: 50_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('includes co-borrower facilities in computed sums', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { role: 'Borrower', status: 'Live', nature: 'Funded', outstanding: 6_000_000, overdue: 0 },
      { role: 'CoBorrower', status: 'Live', nature: 'Funded', outstanding: 4_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('guarantor overdue is not counted against the overdue check', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { role: 'Borrower', status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
      { role: 'Guarantor', status: 'Live', nature: 'Funded', outstanding: 20_000_000, overdue: 5_000_000 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});
