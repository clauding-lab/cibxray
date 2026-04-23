/**
 * DevReq-2 Phase 1 — Parser additions tests
 *
 * Tests for the 8 new fields added in Phase 1:
 *   1. pageNo         — facility.pageNo (from <<PAGE n>> markers)
 *   2. securityType   — facility.securityType
 *   3. disbursementAmount — facility.disbursementAmount
 *   4. totalInstallments  — facility.totalInstallments
 *   5. remainingInstallmentsCount — facility.remainingInstallmentsCount
 *   6. paymentPeriodicity — facility.paymentPeriodicity
 *   7. mainRepresentative — report.subject.mainRepresentative (corporate only)
 *   8. isForeign      — facility.isForeign
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBBCIB } from '../src/parser/parseBBCIB.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal installment contract block for use in fixture text */
const installmentBlock = (extra = '') => `
Ref FI code Branch code CIB contract
code
### ### T1234567 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2023
End date of contract: 01/01/2028
Sanction Limit: 5,000,000
${extra}
`;

/** Non-installment block (SancLmt pattern) */
const nonInstallmentBlock = (extra = '') => `
Ref FI code Branch code CIB contract
code
### ### D1234567 ###
Role: Borrower
Phase: Living
Facility: Overdraft
Starting date: 01/06/2024
End date of contract: 31/05/2025
Credit limit: 2,000,000
Monthly History
Accounting SancLmt Outstanding Overdue Status
31/01/2025 2,000,000 1,500,000 0 STD
${extra}
`;

// ── 1. pageNo ────────────────────────────────────────────────────────────────

test('pageNo is set to the page number of the nearest preceding <<PAGE n>> marker', () => {
  const text = `
<<PAGE 1>>
Some subject information
Type of subject: INDIVIDUAL
<<PAGE 2>>
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.equal(report.facilities[0].pageNo, 2);
});

test('pageNo handles multiple contracts on different pages', () => {
  const text = `
<<PAGE 3>>
${installmentBlock('Sanction Limit: 1,000,000')}
<<PAGE 5>>
${installmentBlock('Sanction Limit: 2,000,000').replace('T1234567', 'T9999999')}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 2);
  assert.equal(report.facilities[0].pageNo, 3);
  assert.equal(report.facilities[1].pageNo, 5);
});

test('pageNo defaults to null when no <<PAGE n>> marker precedes the contract block', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.equal(report.facilities[0].pageNo, null);
});

// ── 2. securityType ──────────────────────────────────────────────────────────

test('securityType is captured when present', () => {
  const text = installmentBlock('Security Type: 80 ( Without any security)');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].securityType, '80 ( Without any security)');
});

test('securityType is captured when followed immediately by whitespace and then Remarks', () => {
  // Real-CIB pattern: "Security Type:   80 ( Without any   Remarks:"
  const text = installmentBlock('Security Type:   80 ( Without any\nsecurity)  Remarks:');
  const report = parseBBCIB(text, 'test.pdf');
  assert.ok(report.facilities[0].securityType.includes('80'));
});

test('securityType defaults to empty string when field is blank', () => {
  // Real CIB: "Security Type:          Remarks:" — value is blank
  const text = installmentBlock('Security Type:          Remarks:');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].securityType, '');
});

test('securityType defaults to empty string when field is absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].securityType, '');
});

// ── 3. disbursementAmount ────────────────────────────────────────────────────

test('disbursementAmount is captured on same line', () => {
  const text = installmentBlock('Total Disbursement Amount: 4,800,000');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].disbursementAmount, 4800000);
});

test('disbursementAmount is captured when label wraps — "Total Disbursement\\nAmount:" form', () => {
  // Real CIB (Akij): "Total Disbursement       480,000,000 Payments periodicity: ..."
  // and also "Total Disbursement            50,000,000\n      Amount:"
  const text = installmentBlock(
    'Total Disbursement            50,000,000\nAmount:'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].disbursementAmount, 50000000);
});

test('disbursementAmount is captured in the compact form from real Akij CIB', () => {
  // Real: "Total Disbursement       480,000,000 Payments periodicity: Quarterly Installments"
  const text = installmentBlock(
    'Total Disbursement       480,000,000 Payments periodicity: Quarterly Installments'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].disbursementAmount, 480000000);
});

test('disbursementAmount defaults to 0 when absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].disbursementAmount, 0);
});

// ── 4. totalInstallments ─────────────────────────────────────────────────────

test('totalInstallments is captured when on same line', () => {
  const text = installmentBlock('Total number of installments: 60');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].totalInstallments, 60);
});

test('totalInstallments is captured when label wraps across lines (real CIB layout)', () => {
  // Real CIB (Akij): "Total number of          20\ninstallments:"
  const text = installmentBlock('Total number of          20\ninstallments:');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].totalInstallments, 20);
});

test('totalInstallments is captured for 4-installment loan', () => {
  const text = installmentBlock(
    'Total number of               4               Number of time(s)\ninstallments:                                 rescheduled:'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].totalInstallments, 4);
});

test('totalInstallments is captured when history data appears between number and label (real Akij layout)', () => {
  // Real Akij facility 1: "Total number of               4               Number of time(s)\n
  //   <history row>         30/09/2025       25,310,547       0         0       STD             No\n
  //   installments:                                 rescheduled:"
  const text = installmentBlock(
    'Total number of               4               Number of time(s)            0\n' +
    '                                                                                   30/09/2025       25,310,547       0         0       STD             No\n' +
    'installments:                                 rescheduled:'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].totalInstallments, 4);
});

test('totalInstallments defaults to null when absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].totalInstallments, null);
});

// ── 5. remainingInstallmentsCount ────────────────────────────────────────────

test('remainingInstallmentsCount is captured on same line', () => {
  const text = installmentBlock('Remaining installments\nNumber: 2');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, 2);
});

test('remainingInstallmentsCount is captured with "Remaining installments Number:" compact form', () => {
  // Real (Akij): "Remaining                2\ninstallments Number:"
  const text = installmentBlock('Remaining                2\ninstallments Number:');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, 2);
});

test('remainingInstallmentsCount is captured with value before "Reorganized credit:" then label on next line (real Akij facility 0 layout)', () => {
  // Real Akij facility 0: "Remaining                2                 Reorganized credit:          NO\ninstallments Number:"
  const text = installmentBlock(
    'Remaining                2                 Reorganized credit:          NO\ninstallments Number:'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, 2);
});

test('remainingInstallmentsCount is captured for 45-remaining case', () => {
  // Real (Akij): "Remaining installments    45           Reorganized credit: NO"
  const text = installmentBlock(
    'Remaining installments    45           Reorganized credit:          NO'
  );
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, 45);
});

test('remainingInstallmentsCount is captured for 1-remaining case', () => {
  const text = installmentBlock('Remaining installments        1               Reorganized credit:             NO');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, 1);
});

test('remainingInstallmentsCount defaults to null when absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsCount, null);
});

// ── 6. paymentPeriodicity ────────────────────────────────────────────────────

test('paymentPeriodicity is captured as "Quarterly" from "Quarterly Installments" form', () => {
  const text = installmentBlock('Payments periodicity: Quarterly Installments');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].paymentPeriodicity, 'Quarterly');
});

test('paymentPeriodicity is captured as "Monthly"', () => {
  const text = installmentBlock('Payments periodicity:         Monthly Installments');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].paymentPeriodicity, 'Monthly');
});

test('paymentPeriodicity is captured when "Installments" is on the next line', () => {
  // Real (Akij second contract):
  // "Payments periodicity:  Quarterly\n  Installments"
  const text = installmentBlock('Payments periodicity:           Quarterly\n                                                                      Installments');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].paymentPeriodicity, 'Quarterly');
});

test('paymentPeriodicity captures "Monthly" without "Installments" suffix', () => {
  // Real (bulk_cib): "Payments periodicity:         Monthly" (no Installments word)
  const text = installmentBlock('Total Disbursement             15,000,000                Payments periodicity:           Monthly');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].paymentPeriodicity, 'Monthly');
});

test('paymentPeriodicity defaults to empty string when absent', () => {
  const text = installmentBlock();
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].paymentPeriodicity, '');
});

// ── 7. mainRepresentative ────────────────────────────────────────────────────

test('mainRepresentative is extracted as the first Managing director from OWNERS LIST', () => {
  const text = `
SUBJECT INFORMATION
CIB subject code: A0000143312
Type of subject: COMPANY
Trade Name: ACME GROUP LIMITED

OWNERS LIST
 CIB subject code         Name of the Owner/Company                     Role in the company
 A0003035453              MAHMUDUL HUQ                                   Managing director                ###
 G0120012192              SK. BASHIR UDDIN                               Sponsor director                 ###

1. SUMMARY OF FACILITY(S) AS BORROWER & CO-BORROWER
${installmentBlock()}
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.subject.mainRepresentative, 'MAHMUDUL HUQ');
});

test('mainRepresentative picks the first Managing director when multiple exist', () => {
  const text = `
SUBJECT INFORMATION
CIB subject code: A0000143312
Type of subject: COMPANY
Trade Name: ACME GROUP LIMITED

OWNERS LIST
 CIB subject code         Name of the Owner/Company                     Role in the company
 G0120012192              SK. BASHIR UDDIN                               Managing director   ###
 A0003035453              MAHMUDUL HUQ                                   Managing director   ###

1. SUMMARY
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.subject.mainRepresentative, 'SK. BASHIR UDDIN');
});

test('mainRepresentative defaults to empty string when no Managing director present', () => {
  const text = `
SUBJECT INFORMATION
CIB subject code: A0000143312
Type of subject: COMPANY
Trade Name: ACME GROUP LIMITED

OWNERS LIST
 CIB subject code         Name of the Owner/Company                     Role in the company
 G0120012192              SK. BASHIR UDDIN                               Sponsor director    ###

1. SUMMARY
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.subject.mainRepresentative, '');
});

test('mainRepresentative defaults to empty string for INDIVIDUAL subject type', () => {
  const text = `
SUBJECT INFORMATION
CIB subject code: A0000778101
Type of subject: INDIVIDUAL
Name: JOHN DOE Verified

1. SUMMARY
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.subject.mainRepresentative, '');
});

// ── 8. isForeign ─────────────────────────────────────────────────────────────

test('isForeign is true when facility type starts with "Foreign"', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### X1234567 ###
Role: Borrower
Phase: Living
Facility: Foreign Other Non-       Date of last payment:
          Installment Loan
Starting date: 30/12/2025
End date of contract: 23/06/2026
Sanction Limit: 4,590
Approved Foreign             EURO
Currency:
Foreign Lender's          HUAWEI        Approved Foreign             EURO
Name:                                   Currency:
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.equal(report.facilities[0].isForeign, true);
});

test('isForeign is true when "Approved Foreign\\n+Currency:" appears in the contract block', () => {
  const text = `
Ref FI code Branch code CIB contract
code
### ### X9999999 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2024
End date of contract: 01/01/2029
Sanction Limit: 1,000,000
Foreign Lender's Name: SOME BANK
Approved Foreign
Currency: EURO
`;
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].isForeign, true);
});

test('isForeign is false for a regular domestic facility', () => {
  const text = installmentBlock('Sanction Limit: 1,000,000');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].isForeign, false);
});

// ── Regression: existing fields unaffected by new regex additions ─────────────

test('existing fields are not disturbed by DevReq-2 additions', () => {
  const text = installmentBlock(`
Installment Amount: 25,000
Total Disbursement Amount: 5,000,000
Total number of installments: 60
Remaining installments    45           Reorganized credit:          NO
Payments periodicity: Monthly Installments
Security Type:          Remarks:
`);
  const report = parseBBCIB(text, 'test.pdf');
  const f = report.facilities[0];
  assert.equal(f.role, 'Borrower');
  assert.equal(f.status, 'Live');
  assert.equal(f.type, 'Term Loan');
  assert.equal(f.startDate, '01/01/2023');
  assert.equal(f.endDate, '01/01/2028');
  assert.equal(f.installmentAmount, 25000);
  // New fields should also be correct
  assert.equal(f.disbursementAmount, 5000000);
  assert.equal(f.totalInstallments, 60);
  assert.equal(f.remainingInstallmentsCount, 45);
  assert.equal(f.paymentPeriodicity, 'Monthly');
  assert.equal(f.securityType, '');
  assert.equal(f.isForeign, false);
});
