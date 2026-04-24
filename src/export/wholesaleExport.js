// DevReq-2 Phase 4 — Wholesale Lending Analytics exporter.
//
// Entry point: doWholesaleExport(reports) → downloads
//   CIBxRay_Wholesale_<applyingConcernName>_<YYYY-MM-DD>.xlsx
// with the 12-sheet workbook matching CIB Analyzer Corporate Template.xlsx.
//
// Sheets (per spec §5):
//   1. Sister Concerns_Linked CIB
//   2. Directors Profile
//   3. CIB Summary (Borrower role)
//   4. CIB Summary (Guarantor role)
//   5. Long Term Loan_Summary
//   6. Short Term Funded_Summary
//   7. Overdue Details_STF
//   8. Overdraft & CC
//   9. Forced Loan_Details
//  10. Forced Loan Summary
//  11. Non Funded_ Overdue Summary
//  12. Reschedule Contract Details
//
// For testing use, buildWholesaleWorkbookData(reports, { asOf }) returns
// a plain { sheetName: Array<Array> } object without writing a file.

import { buildSisterConcernsRows } from './wholesaleExport/sheet1_sisterConcerns.js';
import { buildDirectorsProfileRows } from './wholesaleExport/sheet2_directorsProfile.js';
import {
  buildCibSummaryBorrowerRows,
  buildCibSummaryGuarantorRows,
} from './wholesaleExport/sheet3_4_cibSummary.js';
import { buildLtLoanSummaryRows } from './wholesaleExport/sheet5_ltLoanSummary.js';
import { buildStfSummaryRows } from './wholesaleExport/sheet6_stfSummary.js';
import { buildStfOverdueRows } from './wholesaleExport/sheet7_stfOverdue.js';
import { buildOverdraftCcRows } from './wholesaleExport/sheet8_overdraftCC.js';
import { buildForcedLoanDetailsRows } from './wholesaleExport/sheet9_forcedLoanDetails.js';
import { buildForcedLoanSummaryRows } from './wholesaleExport/sheet10_forcedLoanSummary.js';
import { buildNonFundedOverdueRows } from './wholesaleExport/sheet11_nonFundedOverdue.js';
import { buildRescheduleRows } from './wholesaleExport/sheet12_reschedule.js';
import { detectApplyingConcern } from '../analytics/devreq2Analytics.js';
import { sanitizeSheetName, AMOUNT_CAPTION } from './exportHelpers.js';

const AMOUNT_SHEETS = new Set([
  '3. CIB Summary (Borrower role)',
  '4. CIB Summary (Guarantor role)',
  '5. Long Term Loan_Summary',
  '6. Short Term Funded_Summary',
  '7. Overdue Details_STF',
  '8. Overdraft & CC',
  '9. Forced Loan_Details',
  '10. Forced Loan Summary',
  '11. Non Funded_ Overdue Summary',
  '12. Reschedule Contract Details',
]);

/**
 * Prepend the "(Amount in BDT Million)" caption row to amount-bearing sheets.
 */
function withCaption(sheetName, rows) {
  if (AMOUNT_SHEETS.has(sheetName)) {
    return [[AMOUNT_CAPTION], ...rows];
  }
  return rows;
}

/**
 * Build the full wholesale workbook as a plain object. Pure — no IO.
 * Key structure is stable for snapshot tests.
 * @param {Array} reports - all loaded reports
 * @param {{ asOf?: Date }} [options]
 * @returns {object} { sheetName: Array<Array> }
 */
export function buildWholesaleWorkbookData(reports, { asOf = new Date() } = {}) {
  const sheets = {
    '1. Sister Concerns_Linked CIB': buildSisterConcernsRows(reports),
    '2. Directors Profile': buildDirectorsProfileRows(reports),
    '3. CIB Summary (Borrower role)': buildCibSummaryBorrowerRows(reports),
    '4. CIB Summary (Guarantor role)': buildCibSummaryGuarantorRows(reports),
    '5. Long Term Loan_Summary': buildLtLoanSummaryRows(reports),
    '6. Short Term Funded_Summary': buildStfSummaryRows(reports),
    '7. Overdue Details_STF': buildStfOverdueRows(reports),
    '8. Overdraft & CC': buildOverdraftCcRows(reports),
    '9. Forced Loan_Details': buildForcedLoanDetailsRows(reports),
    '10. Forced Loan Summary': buildForcedLoanSummaryRows(reports),
    '11. Non Funded_ Overdue Summary': buildNonFundedOverdueRows(reports),
    '12. Reschedule Contract Details': buildRescheduleRows(reports),
  };

  // Add amount captions to amount-bearing sheets
  const result = {};
  for (const [sheetName, rows] of Object.entries(sheets)) {
    result[sheetName] = withCaption(sheetName, rows);
  }
  return result;
}

/**
 * Derive the applying concern name for the filename.
 * Falls back to groupRefBase if tradeName is missing.
 * @param {Array} reports
 * @returns {string}
 */
function getApplyingConcernName(reports) {
  try {
    const { applyingConcern, groupRefBase } = detectApplyingConcern(reports);
    const subj = applyingConcern.subject || {};
    return subj.tradeName || subj.displayName || subj.name || groupRefBase || 'Group';
  } catch (_e) {
    return 'Group';
  }
}

/**
 * Derive a YYYY-MM-DD date string from a Date object.
 */
function toDateStr(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Run the exporter end-to-end in a browser: build the workbook, write it to
 * a Blob, and trigger a download. Does NOT mutate input reports.
 * @param {Array} reports - all loaded reports
 * @throws {Error} if detectApplyingConcern throws (multiple ref-bases) — caller
 *   must handle and surface the error banner instead of crashing.
 */
export async function doWholesaleExport(reports) {
  // Validate applying concern detection before building anything.
  // Throws if ambiguous — caller in App.jsx catches and shows banner.
  const { applyingConcern } = detectApplyingConcern(reports);
  const subj = applyingConcern.subject || {};
  const concernName = subj.tradeName || subj.displayName || subj.name || 'Group';
  const safeName = concernName.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  const dateStr = toDateStr(new Date());
  const filename = `CIBxRay_Wholesale_${safeName}_${dateStr}.xlsx`;

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const data = buildWholesaleWorkbookData(reports);

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
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
