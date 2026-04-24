// Wholesale Sheets 3 & 4 — CIB Summary (Borrower and Guarantor roles)
//
// Sheet 3 — "3. CIB Summary (Borrower role)": 19 columns
// Sheet 4 — "4. CIB Summary (Guarantor role)": 20 columns (adds Guaranteed Exposure)
//
// Both sheets share the same structure: one row per loaded report +
// a grand total row (companies-only) at the bottom.
// All BDT amounts in millions.
//
// Spec §5 Sheet 3 columns:
//   Ref No. | CIB Subject Code | INDIVIDUAL/COMPANY | Trade Name |
//   Installments | Non-Installments | Non Listed Securities | Credit Card |
//   Guarantee | Letter of Credit (LC) | Other Indirect Facility (OF) |
//   Sub-Total STNF | Total STF + STNF | Total Loan |
//   Total Overdue Amount | SMA | SS (Yes) | SS (No) | DF | BL+BLW |
//   Stay Order No. | Willful Default (WD) | Total Foreign Loan
//
// Sheet 4 adds: Guaranteed Exposure (a separate column for guarantor amounts)
//
// Stay Order No. ships as 0 (deferred to DevReq-2.1 parser work).

import {
  aggregateByConcern,
  filterCompaniesOnly,
  computeTotalForeignLoan,
} from '../../analytics/devreq2Analytics.js';
import { toMillions } from '../exportHelpers.js';

/**
 * Format a raw amount into millions, returning 0 (not "-") for totals rows.
 * Summary tables use 0 for clarity in group-total arithmetic.
 */
function m(n) {
  return toMillions(n);
}

const BORROWER_PREDICATE = f =>
  f.status === 'Live' && (f.role === 'Borrower' || f.role === 'CoBorrower');

const GUARANTOR_PREDICATE = f =>
  f.status === 'Live' && f.role === 'Guarantor';

/**
 * Build a CIB summary section (header + per-report rows + total row).
 * @param {string} role - 'borrower' or 'guarantor'
 * @param {Array} reports
 * @returns {Array<Array>} rows
 */
function buildCibSummarySection(role, reports) {
  const isBorrower = role === 'borrower';
  const predicate = isBorrower ? BORROWER_PREDICATE : GUARANTOR_PREDICATE;

  const header = isBorrower
    ? [
        'Ref No.',
        'CIB Subject Code',
        'INDIVIDUAL/COMPANY',
        'Trade Name',
        'Installments',
        'Non-Installments',
        'Non Listed Securities',
        'Credit Card',
        'Guarantee',
        'Letter of Credit (LC)',
        'Other Indirect Facility (OF)',
        'Sub-Total STNF',
        'Total STF + STNF',
        'Total Loan',
        'Total Overdue Amount',
        'SMA',
        'SS (Yes)',
        'SS (No)',
        'DF',
        'BL+BLW',
        'Stay Order No.',
        'Willful Default (WD)',
        'Total Foreign Loan',
      ]
    : [
        'Ref No.',
        'CIB Subject Code',
        'INDIVIDUAL/COMPANY',
        'Trade Name',
        'Guaranteed Exposure',
        'Installments',
        'Non-Installments',
        'Non Listed Securities',
        'Credit Card',
        'Guarantee',
        'Letter of Credit (LC)',
        'Other Indirect Facility (OF)',
        'Sub-Total STNF',
        'Total STF + STNF',
        'Total Loan',
        'Total Overdue Amount',
        'SMA',
        'SS (Yes)',
        'SS (No)',
        'DF',
        'BL+BLW',
        'Stay Order No.',
        'Willful Default (WD)',
        'Total Foreign Loan',
      ];

  const aggregated = aggregateByConcern(reports, predicate);
  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const agg = aggregated.get(report.fileName) || {};
    const tradeName = subj.tradeName || subj.displayName || subj.name || '';
    const foreignLoan = computeTotalForeignLoan(report);

    if (isBorrower) {
      dataRows.push([
        report.fileName || report.reportNo || '',
        subj.cibSubjectCode || '',
        subj.subjectType || '',
        tradeName,
        m(agg.installments),
        m(agg.nonInstallments),
        m(agg.nonListedSecurities),
        m(agg.creditCard),
        m(agg.guarantee),
        m(agg.lc),
        m(agg.otherIndirect),
        m(agg.subtotalSTNF),
        m(agg.totalSTFSTNF),
        m(agg.totalLoan),
        m(agg.totalOverdue),
        m(agg.sma),
        m(agg.ssYes),
        m(agg.ssNo),
        m(agg.df),
        m(agg.blBlw),
        0,  // Stay Order No. — deferred to DevReq-2.1
        m(agg.wdAmount),
        m(foreignLoan),
      ]);
    } else {
      // Guarantor: add Guaranteed Exposure column (total guarantor outstanding)
      const guaranteedExposure = (report.facilities || [])
        .filter(GUARANTOR_PREDICATE)
        .reduce((s, f) => s + (f.outstanding || 0), 0);
      dataRows.push([
        report.fileName || report.reportNo || '',
        subj.cibSubjectCode || '',
        subj.subjectType || '',
        tradeName,
        m(guaranteedExposure),
        m(agg.installments),
        m(agg.nonInstallments),
        m(agg.nonListedSecurities),
        m(agg.creditCard),
        m(agg.guarantee),
        m(agg.lc),
        m(agg.otherIndirect),
        m(agg.subtotalSTNF),
        m(agg.totalSTFSTNF),
        m(agg.totalLoan),
        m(agg.totalOverdue),
        m(agg.sma),
        m(agg.ssYes),
        m(agg.ssNo),
        m(agg.df),
        m(agg.blBlw),
        0,  // Stay Order No.
        m(agg.wdAmount),
        m(foreignLoan),
      ]);
    }
  }

  // Grand total row — companies only
  const companiesOnly = filterCompaniesOnly(reports);
  const totalAgg = aggregateByConcern(companiesOnly, predicate);
  let totals;
  if (isBorrower) {
    totals = sumAggregates([...totalAgg.values()]);
    const totalForeign = companiesOnly.reduce((s, r) => s + computeTotalForeignLoan(r), 0);
    dataRows.push([
      'Group Total (Companies)',
      '',
      '',
      '',
      m(totals.installments),
      m(totals.nonInstallments),
      m(totals.nonListedSecurities),
      m(totals.creditCard),
      m(totals.guarantee),
      m(totals.lc),
      m(totals.otherIndirect),
      m(totals.subtotalSTNF),
      m(totals.totalSTFSTNF),
      m(totals.totalLoan),
      m(totals.totalOverdue),
      m(totals.sma),
      m(totals.ssYes),
      m(totals.ssNo),
      m(totals.df),
      m(totals.blBlw),
      0,  // Stay Order No.
      m(totals.wdAmount),
      m(totalForeign),
    ]);
  } else {
    totals = sumAggregates([...totalAgg.values()]);
    const totalGuaranteedExposure = companiesOnly.reduce((s, r) => {
      return s + (r.facilities || []).filter(GUARANTOR_PREDICATE).reduce((fs, f) => fs + (f.outstanding || 0), 0);
    }, 0);
    const totalForeign = companiesOnly.reduce((s, r) => s + computeTotalForeignLoan(r), 0);
    dataRows.push([
      'Group Total (Companies)',
      '',
      '',
      '',
      m(totalGuaranteedExposure),
      m(totals.installments),
      m(totals.nonInstallments),
      m(totals.nonListedSecurities),
      m(totals.creditCard),
      m(totals.guarantee),
      m(totals.lc),
      m(totals.otherIndirect),
      m(totals.subtotalSTNF),
      m(totals.totalSTFSTNF),
      m(totals.totalLoan),
      m(totals.totalOverdue),
      m(totals.sma),
      m(totals.ssYes),
      m(totals.ssNo),
      m(totals.df),
      m(totals.blBlw),
      0,  // Stay Order No.
      m(totals.wdAmount),
      m(totalForeign),
    ]);
  }

  return [header, ...dataRows];
}

/**
 * Sum numeric fields across multiple agg objects.
 * @param {Array} aggs
 * @returns {object}
 */
function sumAggregates(aggs) {
  const fields = [
    'installments', 'nonInstallments', 'nonListedSecurities', 'creditCard',
    'guarantee', 'lc', 'otherIndirect', 'subtotalSTNF', 'totalSTFSTNF',
    'totalLoan', 'totalOverdue', 'sma', 'ssYes', 'ssNo', 'df', 'blBlw',
    'wdAmount', 'totalForeignLoan',
  ];
  const result = {};
  for (const field of fields) {
    result[field] = aggs.reduce((s, a) => s + (a[field] || 0), 0);
  }
  return result;
}

/**
 * Build Sheet 3 — CIB Summary (Borrower role).
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data + group total)
 */
export function buildCibSummaryBorrowerRows(reports) {
  return buildCibSummarySection('borrower', reports);
}

/**
 * Build Sheet 4 — CIB Summary (Guarantor role).
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data + group total)
 */
export function buildCibSummaryGuarantorRows(reports) {
  return buildCibSummarySection('guarantor', reports);
}
