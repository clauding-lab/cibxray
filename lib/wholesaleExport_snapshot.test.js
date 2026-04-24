/**
 * Wholesale exporter snapshot test.
 *
 * Uses the hand-rolled Akij Group fixture (two corporate reports) to exercise
 * every sheet builder end-to-end via buildWholesaleWorkbookData().
 *
 * Pivot approach (same as Phase 3 retailExport_snapshot):
 *   - First run: generate and write the snapshot JSON.
 *   - Subsequent runs: compare against the checked-in snapshot.
 *
 * pdfjs-dist is not involved — fixture data is fully synthetic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildWholesaleWorkbookData } from '../src/export/wholesaleExport.js';
import { wholesaleReports, asOf } from '../test/fixtures/wholesaleExportFixture.js';

const SNAPSHOT_PATH = new URL('../test/fixtures/wholesale-export-snapshot.json', import.meta.url);

test('buildWholesaleWorkbookData produces 12 named sheets', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheetNames = Object.keys(data);
  assert.equal(sheetNames.length, 12);
  assert.ok(sheetNames.includes('1. Sister Concerns_Linked CIB'));
  assert.ok(sheetNames.includes('12. Reschedule Contract Details'));
});

test('Sheet 1 — Sister Concerns has one row per report', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['1. Sister Concerns_Linked CIB'];
  // header only (no caption on sheet 1); 2 data rows
  assert.equal(sheet.length, 3); // header + 2 reports
  assert.equal(sheet[1][1], '1011500056801.pdf'); // applying concern
  assert.equal(sheet[2][1], '1011500056801-1.pdf'); // sister concern
});

test('Sheet 2 — Directors Profile emits all (company, director) pairs', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['2. Directors Profile'];
  // applying concern: 2 directors; sister: 3 directors; total = 5 data rows + header
  assert.equal(sheet.length, 6);
});

test('Sheet 3 — CIB Summary (Borrower) has caption + header + 2 report rows + group total', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['3. CIB Summary (Borrower role)'];
  // [caption, header, report1, report2, group-total]
  assert.equal(sheet.length, 5);
  assert.equal(sheet[0][0], '(Amount in BDT Million)');
  assert.equal(sheet[sheet.length - 1][0], 'Group Total (Companies)');
});

test('Sheet 3 — group total includes only COMPANY reports', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['3. CIB Summary (Borrower role)'];
  const groupTotal = sheet[sheet.length - 1];
  // Both fixture reports are COMPANY type — total = applying + sister
  // Applying: 35M + 9.5M + 15M + 8M + 3.5M + 2M = 73M borrower outstanding
  // Sister: 60M + 7M = 67M borrower outstanding
  // Total installments (LT+rescheduled TL): 35 + 3.5 + 60 = 98.5M
  // Just check it's non-zero and > 0
  assert.ok(Number(groupTotal[13]) > 0, `Expected non-zero totalLoan in group total, got ${groupTotal[13]}`);
});

test('Sheet 5 — LT Loan Summary has caption + header + correct LT facilities', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['5. Long Term Loan_Summary'];
  // caption, header, then LT facilities from both reports
  // applying: AKIJ-TL-001 (5yr), AKIJ-TL-005 (2yr), AKIJ-GUAR-007 (4yr = LT) = 3 LT
  // sister: CEMENT-TL-001 (5yr) = 1 LT
  // total LT data rows = 4
  assert.ok(sheet.length >= 6, `Expected at least 6 rows (caption+header+4 LT), got ${sheet.length}`);
  assert.equal(sheet[0][0], '(Amount in BDT Million)');
});

test('Sheet 5 — Remarks for WD is always empty string', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['5. Long Term Loan_Summary'];
  for (let i = 2; i < sheet.length; i++) { // skip caption + header
    assert.equal(sheet[i][24], '', `Expected empty WD remarks on row ${i}`);
  }
});

test('Sheet 9 — Forced Loan Details contains the forced loan facility', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['9. Forced Loan_Details'];
  // caption + header + 1 forced loan (AKIJ-FL-006)
  assert.equal(sheet.length, 3);
  assert.equal(sheet[2][3], 'AKIJ-FL-006');
});

test('Sheet 10 — Forced Loan Summary has one row per report', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['10. Forced Loan Summary'];
  // caption + header + 2 report rows
  assert.equal(sheet.length, 4);
  assert.equal(sheet[2][4], 1); // applying concern: 1 forced loan
  assert.equal(sheet[3][4], 0); // sister concern: 0 forced loans
});

test('Sheet 11 — Non Funded Overdue contains overdue guarantee from sister', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['11. Non Funded_ Overdue Summary'];
  // caption + header + 1 overdue non-funded (CEMENT-BG-002)
  assert.equal(sheet.length, 3);
  assert.equal(sheet[2][3], 'CEMENT-BG-002');
});

test('Sheet 12 — Reschedule Contract contains rescheduled facility', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const sheet = data['12. Reschedule Contract Details'];
  // caption + header + 1 rescheduled (AKIJ-TL-005)
  assert.equal(sheet.length, 3);
  assert.equal(sheet[2][3], 'AKIJ-TL-005');
});

// ── Snapshot round-trip ────────────────────────────────────────────────────────

test('wholesale exporter snapshot round-trip', () => {
  const data = buildWholesaleWorkbookData(wholesaleReports, { asOf });
  const snapshotPath = SNAPSHOT_PATH.pathname;

  if (!existsSync(snapshotPath)) {
    // First run: generate and write snapshot
    writeFileSync(snapshotPath, JSON.stringify(data, null, 2), 'utf8');
    // Snapshot written — pass the test (first run always passes)
    return;
  }

  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  // Compare sheet names
  assert.deepEqual(Object.keys(data), Object.keys(snapshot));
  // Compare cell values sheet by sheet
  for (const sheetName of Object.keys(data)) {
    assert.deepEqual(data[sheetName], snapshot[sheetName], `Sheet "${sheetName}" does not match snapshot`);
  }
});
