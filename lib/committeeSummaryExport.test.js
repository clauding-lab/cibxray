import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fmtMillionOrDash,
  buildSummaryRows,
  formatInquiryDate,
  computeCibStatus,
  computeRefNoDisplay,
  buildHeaderMeta,
  buildCommitteeSummaryDoc,
} from '../src/export/committeeSummaryExport.js';

// ── fmtMillionOrDash ──────────────────────────────────────────────

test('fmtMillionOrDash: zero renders as "-"', () => {
  assert.equal(fmtMillionOrDash(0), '-');
  assert.equal(fmtMillionOrDash(null), '-');
  assert.equal(fmtMillionOrDash(undefined), '-');
  assert.equal(fmtMillionOrDash(NaN), '-');
});

test('fmtMillionOrDash: converts raw BDT to millions 2dp', () => {
  assert.equal(fmtMillionOrDash(1_000_000), '1.00');
  assert.equal(fmtMillionOrDash(12_345_678), '12.35');
  assert.equal(fmtMillionOrDash(500_000), '0.50');
});

// ── buildSummaryRows ──────────────────────────────────────────────

test('buildSummaryRows: 5 rows with 4 numeric columns each', () => {
  const rows = buildSummaryRows([]);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].label, 'Long term');
  assert.equal(rows[1].label, 'Short term funded');
  assert.equal(rows[2].label, 'Short term Non-funded');
  assert.equal(rows[3].label, 'Total (short term)');
  assert.equal(rows[4].label, 'Total (short term + long term)');
  for (const r of rows) assert.equal(r.values.length, 4);
});

test('buildSummaryRows: aggregates correctly across tenure + funded-nature', () => {
  const rows = buildSummaryRows([
    // Long term funded → Long term bucket + grand total
    { role: 'Borrower', type: 'Term Loan', startDate: '01/01/2023', endDate: '01/01/2026', outstanding: 10_000_000, overdue: 0, classification: 'STD' },
    // Short term funded
    { role: 'Borrower', type: 'Overdraft', startDate: '01/01/2025', endDate: '01/07/2025', outstanding: 2_000_000, overdue: 500_000, classification: 'SMA' },
    // Short term non-funded (LC)
    { role: 'Borrower', type: 'Letter of Credit', startDate: '01/01/2025', endDate: '01/03/2025', outstanding: 3_000_000, overdue: 0, classification: 'STD' },
    // Classified (DF)
    { role: 'Borrower', type: 'Term Loan', startDate: '01/01/2023', endDate: '01/07/2023', outstanding: 1_500_000, overdue: 1_500_000, classification: 'DF' },
  ]);
  // Long term row: the 10M term loan (3 years) — outstanding 10.00
  assert.equal(rows[0].values[0], '10.00');
  // Short term funded row: 2M overdraft + 1.5M classified short-term loan = 3.50
  assert.equal(rows[1].values[0], '3.50');
  assert.equal(rows[1].values[2], '2.00'); // SMA column (only the overdraft is SMA)
  // Short term non-funded row: 3M LC + 1.5M classified short-term loan
  // LC (type matches /letter of credit/) is non-funded; classified short-term loan (<6 months) is funded
  assert.equal(rows[2].values[0], '3.00');
  // Total (short term): 2M funded + 3M non-funded + 1.5M classified-funded = 6.50
  assert.equal(rows[3].values[0], '6.50');
  // Grand total: 10M + 6.5M = 16.50
  assert.equal(rows[4].values[0], '16.50');
  // Classified column across all three total-bearing rows: 1.5M
  assert.equal(rows[4].values[3], '1.50');
});

// ── formatInquiryDate ──────────────────────────────────────────────

test('formatInquiryDate: "01-Mar-2026" → "March 01, 2026"', () => {
  assert.equal(formatInquiryDate('01-Mar-2026'), 'March 01, 2026');
  assert.equal(formatInquiryDate('20-Feb-2026 11:23:45 AM'), 'February 20, 2026');
});

test('formatInquiryDate: pads single-digit days', () => {
  assert.equal(formatInquiryDate('5-Apr-2026'), 'April 05, 2026');
});

test('formatInquiryDate: returns original on unparseable input', () => {
  assert.equal(formatInquiryDate('not a date'), 'not a date');
  assert.equal(formatInquiryDate(''), '');
  assert.equal(formatInquiryDate(null), '');
});

// ── computeCibStatus ──────────────────────────────────────────────

test('computeCibStatus: all STD → "Unclassified"', () => {
  const facs = [
    { classification: 'STD' }, { classification: 'STD' },
  ];
  assert.equal(computeCibStatus(facs), 'Unclassified');
});

test('computeCibStatus: returns worst classification across facilities', () => {
  assert.equal(computeCibStatus([
    { classification: 'STD' },
    { classification: 'SMA' },
    { classification: 'SS' },
  ]), 'SS');
  assert.equal(computeCibStatus([
    { classification: 'STD' },
    { classification: 'BL' },
    { classification: 'SMA' },
  ]), 'BL');
});

test('computeCibStatus: empty → "Unclassified"', () => {
  assert.equal(computeCibStatus([]), 'Unclassified');
  assert.equal(computeCibStatus(null), 'Unclassified');
});

// ── computeRefNoDisplay ──────────────────────────────────────────────

test('computeRefNoDisplay: range across base + suffixes', () => {
  const reports = [
    { fileName: '1011500041801.pdf' },
    { fileName: '1011500041801-1.pdf' },
    { fileName: '1011500041801-5.pdf' },
    { fileName: '1011500041801-24.pdf' },
  ];
  assert.equal(computeRefNoDisplay(reports), '1011500041801 (0-24)');
});

test('computeRefNoDisplay: single bare base → just the base', () => {
  assert.equal(computeRefNoDisplay([{ fileName: '1234567890.pdf' }]), '1234567890');
});

test('computeRefNoDisplay: single with suffix → base-suffix', () => {
  assert.equal(computeRefNoDisplay([{ fileName: '1234567890-3.pdf' }]), '1234567890-3');
});

test('computeRefNoDisplay: empty reports → empty string', () => {
  assert.equal(computeRefNoDisplay([]), '');
});

// ── buildHeaderMeta ──────────────────────────────────────────────

test('buildHeaderMeta: pulls applying concern + formats inquiry date', () => {
  const reports = [
    {
      fileName: '1011500041801.pdf',
      inquiryDate: '01-Mar-2026',
      subject: { subjectType: 'COMPANY', displayName: 'Healthcare Pharmaceuticals Limited' },
      facilities: [{ classification: 'STD' }],
    },
    { fileName: '1011500041801-1.pdf', subject: { subjectType: 'COMPANY', displayName: 'Sister' }, facilities: [] },
  ];
  const meta = buildHeaderMeta(reports);
  assert.equal(meta.cibStatus, 'Unclassified');
  assert.equal(meta.inquiryDate, 'March 01, 2026');
  assert.equal(meta.concernName, 'Healthcare Pharmaceuticals Limited');
  assert.equal(meta.refNo, '1011500041801 (0-1)');
});

// ── buildCommitteeSummaryDoc (smoke) ──────────────────────────────────

test('buildCommitteeSummaryDoc: produces a valid Document instance', () => {
  const reports = [
    {
      fileName: '1011500041801.pdf',
      inquiryDate: '01-Mar-2026',
      subject: { subjectType: 'COMPANY', displayName: 'Test Co' },
      facilities: [
        { role: 'Borrower', type: 'Term Loan', startDate: '01/01/2023', endDate: '01/01/2026', outstanding: 5_000_000, overdue: 0, classification: 'STD' },
      ],
    },
  ];
  const doc = buildCommitteeSummaryDoc(reports);
  assert.ok(doc);
  assert.ok(doc.Document);
  // sanity — the sections container should exist on the docx Document
  assert.ok(doc.constructor.name === 'Document' || typeof doc === 'object');
});
