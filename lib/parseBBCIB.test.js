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
