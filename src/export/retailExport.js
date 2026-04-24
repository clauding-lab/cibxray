// DevReq-2 Phase 3 — Retail Lending Analytics exporter.
//
// Entry point: doRetailExport(report) → downloads `CIBxRay_Retail_<reportNo>.xlsx`
// with the 9-sheet workbook matching Dashboard V2.xlsx:
//   1. CIB Dashboard
//   2. Linked Concerns & Institute
//   3. Term Loans
//   4. Non-Installment Loan
//   5. Credit Cards
//   6. Details of non-funded
//   7. Overdue Loans
//   8. Loan with unchanged Outstanding
//   9. Loan with Sudden Multiple OD
//
// All BDT amounts are in millions (÷1,000,000, 2dp) per spec §12 Q5 default.
// Affected sheet headers carry "(Amount in BDT Million)" caption.
//
// For testing and headless snapshot use, buildRetailWorkbookData(report)
// returns a plain { sheetName: Array<Array> } shape without writing a file.

import {
  buildKycRows,
  buildIndividualLiabilityGrid,
  buildGroupLiabilityGrid,
  buildPgRoleStatusRows,
  buildTerminatedContractsRows,
  buildFindingsRows,
} from './retailExport/sheet1_dashboard.js';
import { buildLinkedConcernsRows } from './retailExport/sheet2_linkedConcerns.js';
import { buildTermLoansRows } from './retailExport/sheet3_termLoans.js';
import { buildNonInstallmentRows } from './retailExport/sheet4_nonInstallment.js';
import { buildCreditCardsRows } from './retailExport/sheet5_creditCards.js';
import { buildNonFundedDetailsRows } from './retailExport/sheet6_nonFundedDetails.js';
import { buildOverdueLoansRows } from './retailExport/sheet7_overdueLoans.js';
import { buildUnchangedOutstandingRows } from './retailExport/sheet8_unchangedOutstanding.js';
import { buildSuddenOdRows } from './retailExport/sheet9_suddenOd.js';

const AMOUNT_CAPTION = '(Amount in BDT Million)';

/**
 * Build the full retail workbook as a plain object. Pure — no IO.
 * Key structure is stable for snapshot tests.
 * @param {object} report
 * @param {{ asOf?: Date }} [options] — date of record; defaults to now. Passed
 *   to sheet builders that use it (Sheet 3 Due EMI, etc).
 * @returns {object}
 */
export function buildRetailWorkbookData(report, { asOf = new Date() } = {}) {
  // ── Sheet 1 assembly: stack the five sub-blocks vertically ──
  const sheet1 = [];
  sheet1.push(['CIB Dashboard', AMOUNT_CAPTION]);
  sheet1.push([]); // spacer
  sheet1.push(['KYC']);
  for (const row of buildKycRows(report)) sheet1.push(row);
  sheet1.push([]);
  sheet1.push(['Individual Liability Status']);
  for (const row of buildIndividualLiabilityGrid(report)) sheet1.push(row);
  sheet1.push(['Group Liability Status']);
  for (const row of buildGroupLiabilityGrid(report)) sheet1.push(row);
  sheet1.push(['PG Role Status']);
  for (const row of buildPgRoleStatusRows(report)) sheet1.push(row);
  sheet1.push(['Terminated Contracts Status']);
  for (const row of buildTerminatedContractsRows(report)) sheet1.push(row);
  sheet1.push([]);
  sheet1.push(['Findings']);
  sheet1.push(['Particular', 'Finding']);
  for (const row of buildFindingsRows(report)) sheet1.push(row);

  return {
    'CIB Dashboard': sheet1,
    'Linked Concerns & Institute': withCaption(buildLinkedConcernsRows(report)),
    'Term Loans': withCaption(buildTermLoansRows(report, { asOf })),
    'Non-Installment Loan': withCaption(buildNonInstallmentRows(report)),
    'Credit Cards': withCaption(buildCreditCardsRows(report)),
    'Details of non-funded': withCaption(buildNonFundedDetailsRows(report)),
    'Overdue Loans': withCaption(buildOverdueLoansRows(report)),
    'Loan with unchanged Outstanding': withCaption(buildUnchangedOutstandingRows(report)),
    'Loan with Sudden Multiple OD': withCaption(buildSuddenOdRows(report)),
  };
}

/**
 * Prepend a caption row above the builder output so the banker sees the
 * "(Amount in BDT Million)" hint at the top of every amount-bearing sheet.
 */
function withCaption(rows) {
  return [[AMOUNT_CAPTION], ...rows];
}

/**
 * Run the exporter end-to-end in a browser: build the workbook, write it to
 * a Blob, and trigger a download. Does NOT mutate the input report.
 * @param {object} report
 */
export async function doRetailExport(report) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const data = buildRetailWorkbookData(report);

  for (const [sheetName, rows] of Object.entries(data)) {
    const sheet = wb.addWorksheet(sanitizeSheetName(sheetName));
    for (const row of rows) {
      sheet.addRow(row);
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CIBxRay_Retail_${report.reportNo || 'Report'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}

/**
 * Excel disallows : \\ / ? * [ ] and caps sheet names at 31 chars.
 * @param {string} name
 * @returns {string}
 */
function sanitizeSheetName(name) {
  return String(name).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
}
