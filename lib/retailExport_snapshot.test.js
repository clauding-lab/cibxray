/**
 * DevReq-2 Phase 3 — Retail Exporter snapshot test.
 *
 * Runs the full workbook assembler against a rich hand-rolled fixture
 * (exercising every Sheet 1–9 code path) and asserts that the generated
 * shape matches a checked-in JSON fixture. Any layout change requires a
 * targeted update to test/fixtures/retail-export-snapshot.json with its
 * own commit.
 *
 * Using a pure hand-rolled fixture (instead of round-tripping a real PDF)
 * keeps the test deterministic and runnable under plain node --test without
 * pdfjs-dist browser runtime deps.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRetailWorkbookData } from '../src/export/retailExport.js';
import { retailSampleReport, asOf } from '../test/fixtures/retailExportFixture.js';

// Sheet 1's Findings row 2 (Age of CIB Report) depends on wall-clock time.
// Normalize it to keep the snapshot stable.
function stabilizeAgeDays(data) {
  const sheet1 = data['CIB Dashboard'];
  for (const row of sheet1) {
    if (row[0] === 'Age of CIB Report (Days)') {
      row[1] = '<age-days>';
    }
  }
  return data;
}

test('retail workbook shape matches snapshot fixture', () => {
  // Arrange
  const fixturePath = new URL('../test/fixtures/retail-export-snapshot.json', import.meta.url);
  const expected = JSON.parse(readFileSync(fixturePath, 'utf8'));

  // Act — we bypass the dynamic date via the asOf fixture constant for
  // functions that accept it; the top-level Findings row still uses
  // `new Date()` internally, so we stabilize afterward.
  const actual = stabilizeAgeDays(buildRetailWorkbookData(retailSampleReport));

  // Assert
  assert.deepEqual(actual, expected);
});

test('retail workbook has exactly 9 sheets', () => {
  const data = buildRetailWorkbookData(retailSampleReport);
  const sheetNames = Object.keys(data);
  assert.equal(sheetNames.length, 9);
  assert.deepEqual(sheetNames, [
    'CIB Dashboard',
    'Linked Concerns & Institute',
    'Term Loans',
    'Non-Installment Loan',
    'Credit Cards',
    'Details of non-funded',
    'Overdue Loans',
    'Loan with unchanged Outstanding',
    'Loan with Sudden Multiple OD',
  ]);
});

// Unused import guard — keeps asOf in scope for future time-sensitive tests.
void asOf;
