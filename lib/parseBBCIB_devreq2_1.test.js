/**
 * DevReq-2.1 Parser additions tests
 *
 * Tests for 5 new fields:
 *   1. classificationBasis  — facility.classificationBasis
 *   2. stayOrder            — facility.stayOrder
 *   3. wdRemarks (expanded) — facility.wdRemarks (per-month variant)
 *   4. stayOrderCount       — report.stayOrderCount (report-level rollup)
 *   5. stayOrderOutstanding — report.stayOrderOutstanding (report-level rollup)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBBCIB } from '../src/parser/parseBBCIB.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const installmentBlock = (contractCode = 'T1234567', extra = '') => `
Ref FI code Branch code CIB contract
code
### ### ${contractCode} ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 5,000,000
${extra}
`;

const withHistory = (extra = '') => installmentBlock('T1234567', `
Monthly History
Accounting Date Outstanding Overdue NPI Status Default & Willful  Remarks
                                                         Default            for WD
01/03/2025 500,000 0 0 STD No
01/02/2025 510,000 0 0 STD No
${extra}
`);

// ── 1. classificationBasis ────────────────────────────────────────────────────

test('classificationBasis is captured when "Basis for classification:qualitative judgment:" appears', () => {
  // Real CIB layout (from sample recon): value wraps across two lines with trailing colon
  const text = installmentBlock('T1234567', `
Security Amount: 0  Basis for
                    classification:qualitative
                    judgment:
Third Party guarantee 0  Remarks:
`);
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.ok(
    /qualitative judgment/i.test(report.facilities[0].classificationBasis),
    'classificationBasis should contain "qualitative judgment"'
  );
});

test('classificationBasis is captured when value is on one line', () => {
  const text = installmentBlock('T1234567', 'Basis for classification:qualitative judgment');
  const report = parseBBCIB(text, 'test.pdf');
  assert.ok(/qualitative judgment/i.test(report.facilities[0].classificationBasis));
});

test('classificationBasis defaults to empty string when field is absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].classificationBasis, '');
});

test('classificationBasis is empty string when Basis for classification has no value', () => {
  // Observed: "Basis for\nclassification:" with blank value (system-assigned)
  const text = installmentBlock('T1234567', 'Basis for\nclassification:\nRemarks:');
  const report = parseBBCIB(text, 'test.pdf');
  // Either empty string or not "qualitative judgment" — the flag trigger won't fire
  assert.ok(
    report.facilities[0].classificationBasis === '' ||
    !/qualitative judgment/i.test(report.facilities[0].classificationBasis),
    'system-assigned classification should not trigger qualitative judgment'
  );
});

// ── 2. stayOrder (per-facility) ───────────────────────────────────────────────

test('stayOrder is true when contract identifier starts with *', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### *T9876543 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 2,000,000
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.equal(report.facilities[0].stayOrder, true);
});

test('stayOrder is false for a normal contract (no * prefix)', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].stayOrder, false);
});

test('stayOrder false does not affect other fields', () => {
  const text = installmentBlock('T1234567', 'Basis for classification:qualitative judgment');
  const report = parseBBCIB(text, 'test.pdf');
  const f = report.facilities[0];
  assert.equal(f.stayOrder, false);
  assert.ok(/qualitative judgment/i.test(f.classificationBasis));
});

// ── 3. wdRemarks expanded (per-month variant) ─────────────────────────────────

test('wdRemarks is "WD" when per-month Remarks for WD column contains "WD"', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### T1234567 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 5,000,000
Monthly History
Accounting Date Outstanding Overdue NPI Status Default & Willful  Remarks
                                                                   for WD
01/03/2025 500,000 100,000 2 STD WD
01/02/2025 510,000 0 0 STD No
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].wdRemarks, 'WD');
});

test('wdRemarks is "WD" when per-month value is "Yes" (normalised)', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### T1234567 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 5,000,000
Monthly History
Accounting Date Outstanding Overdue NPI Status Default & Willful  Remarks
                                                                   for WD
01/03/2025 500,000 100,000 2 STD Yes
01/02/2025 510,000 0 0 STD No
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].wdRemarks, 'WD');
});

test('wdRemarks stays "Appeal lodged" when block-level Willful Default (Appeal) is present', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### T1234567 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 5,000,000
Willful Default (Appeal)
Monthly History
Accounting Date Outstanding Overdue NPI Status Default & Willful  Remarks
                                                                   for WD
01/03/2025 500,000 100,000 2 STD WD
01/02/2025 510,000 0 0 STD No
`;
  const report = parseBBCIB(text, 'test.pdf');
  // Block-level takes precedence; per-month WD appended in parens
  assert.ok(report.facilities[0].wdRemarks.startsWith('Appeal lodged'));
});

test('wdRemarks is empty string when all per-month values are "No"', () => {
  const text = withHistory();
  const report = parseBBCIB(text, 'test.pdf');
  // No Willful Default block-level, all history rows are "No" — wdRemarks stays ""
  assert.equal(report.facilities[0].wdRemarks, '');
});

test('wdRemarks is empty string when Monthly History is absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].wdRemarks, '');
});

// ── 4. stayOrderCount (report-level) ─────────────────────────────────────────

test('stayOrderCount is captured from "No of Stay order contracts: N"', () => {
  const text = `
No of Living Contracts: 2   No of Stay order contracts: 3
Total Outstanding Amount: 5,000,000  Total Outstanding amount for Stay Order 2,000,000
Contracts:
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderCount, 3);
});

test('stayOrderCount is 0 when no stay order contracts', () => {
  const text = `
No of Living Contracts: 2   No of Stay order contracts: 0
Total Outstanding Amount: 5,000,000  Total Outstanding amount for Stay Order 0
Contracts:
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderCount, 0);
});

test('stayOrderCount defaults to 0 when field is absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderCount, 0);
});

// ── 5. stayOrderOutstanding (report-level) ────────────────────────────────────

test('stayOrderOutstanding is captured and parsed as integer', () => {
  const text = `
No of Living Contracts: 2   No of Stay order contracts: 1
Total Outstanding Amount: 5,000,000  Total Outstanding amount for Stay Order 1,500,000
Contracts:
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderOutstanding, 1500000);
});

test('stayOrderOutstanding sums across multiple subject sections', () => {
  // Two summary blocks (multi-section CIB)
  const text = `
No of Stay order contracts: 2
Total Outstanding amount for Stay Order 1,000,000
Contracts:

No of Stay order contracts: 1
Total Outstanding amount for Stay Order 500,000
Contracts:
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderOutstanding, 1500000);
});

test('stayOrderOutstanding defaults to 0 when field is absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.stayOrderOutstanding, 0);
});

// ── Regression: existing fields unaffected ────────────────────────────────────

test('DevReq-2.1 new fields do not disturb existing parser fields', () => {
  const text = installmentBlock('T1234567', `
Basis for
classification:qualitative
judgment:
Reorganized credit: YES
Number of time(s) rescheduled: 2
Date of last rescheduling: 15/03/2024
`);
  const report = parseBBCIB(text, 'test.pdf');
  const f = report.facilities[0];
  assert.equal(f.role, 'Borrower');
  assert.equal(f.status, 'Live');
  assert.equal(f.type, 'Term Loan');
  assert.equal(f.reorganized, true);
  assert.equal(f.rescheduledCount, 2);
  assert.equal(f.stayOrder, false);
  assert.ok(/qualitative judgment/i.test(f.classificationBasis));
});
