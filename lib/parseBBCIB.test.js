import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBBCIB } from '../src/parser/parseBBCIB.js';

const baseBlock = (extra = '') => `
Ref FI code Branch code CIB contract
code
### ### C1234567 ###
Role: Borrower
Phase: Living
Facility: Term Loan
Starting date: 01/01/2024
End date of contract: 01/01/2029
Sanction Limit: 1,000,000
${extra}
`;

test('captures Installment Amount on same line', () => {
  const text = baseBlock('Installment Amount: 25,000');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities.length, 1);
  assert.equal(report.facilities[0].installmentAmount, 25000);
});

test('captures Installment Amount when value is on the next line (two-column layout)', () => {
  const text = baseBlock('Installment Amount:\n125,500');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].installmentAmount, 125500);
});

test('installmentAmount defaults to 0 when field is absent', () => {
  const text = baseBlock('');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].installmentAmount, 0);
});

test('captures Date of last rescheduling on same line', () => {
  const text = baseBlock('Number of time(s) rescheduled: 2\nDate of last rescheduling: 15/03/2024');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].rescheduledCount, 2);
  assert.equal(report.facilities[0].dateOfLastRescheduling, '15/03/2024');
});

test('captures Date of last rescheduling when value is on the next line', () => {
  const text = baseBlock('Date of last rescheduling:\n31/12/2023');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].dateOfLastRescheduling, '31/12/2023');
});

test('dateOfLastRescheduling defaults to empty string when absent', () => {
  const text = baseBlock('');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].dateOfLastRescheduling, '');
});

test('previously-captured fields are not disturbed by the new regexes', () => {
  const text = baseBlock('Installment Amount: 25,000\nDate of last rescheduling: 15/03/2024');
  const report = parseBBCIB(text, 'test.pdf');
  const f = report.facilities[0];
  assert.equal(f.role, 'Borrower');
  assert.equal(f.status, 'Live');
  assert.equal(f.type, 'Term Loan');
  assert.equal(f.startDate, '01/01/2024');
  assert.equal(f.endDate, '01/01/2029');
});

test('captures Remaining installments Amount (two-column, label wraps)', () => {
  const text = baseBlock('Installment Amount: 25,000   Remaining installments\nAmount:\n4,014,223');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].installmentAmount, 25000);
  assert.equal(report.facilities[0].remainingInstallmentsAmount, 4014223);
});

test('remainingInstallmentsAmount defaults to 0 when absent', () => {
  const text = baseBlock('');
  const report = parseBBCIB(text, 'test.pdf');
  assert.equal(report.facilities[0].remainingInstallmentsAmount, 0);
});

test('captures NPI per monthly history row for installment facilities', () => {
  // Real CIB PDFs list Monthly History newest-first; parser reverses to oldest→newest.
  const text = baseBlock(`Installment Amount: 25,000
Monthly History
Accounting Date Outstanding Overdue NPI Status
31/03/2025 450,000 25,000 2 SMA No
28/02/2025 475,000 12,500 1 STD No
31/01/2025 500,000 0 0 STD No
`);
  const report = parseBBCIB(text, 'test.pdf');
  const h = report.facilities[0].history;
  assert.equal(h.length, 3);
  // history is ordered oldest → newest after the reverse in parser
  assert.equal(h[0].dateStr, '31/01/2025');
  assert.equal(h[0].outstanding, 500000);
  assert.equal(h[0].overdue, 0);
  assert.equal(h[0].npi, 0);
  assert.equal(h[1].npi, 1);
  assert.equal(h[1].overdue, 12500);
  assert.equal(h[2].npi, 2);
  assert.equal(h[2].outstanding, 450000);
  assert.equal(h[2].status, 'SMA');
});
