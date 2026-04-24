// Sheet 7 — "Overdue Loans" builder for the Retail Lending Analytics exporter.
//
// All facilities where overdue > 0 today. One row per facility.
// Columns (spec §4 Sheet 7):
//   Borrower Name | Ref. No. | Page No. | Sanclimit | Outstanding |
//   Overdue | NPI | Highest NPI | Status
// Amounts in millions, NPI as integer counts.

import { computeHistoryRollup } from '../../analytics/devreq2Analytics.js';
import { toMillions } from './helpers.js';

const HEADERS = [
  'Borrower Name',
  'Ref. No.',
  'Page No.',
  'Sanclimit',
  'Outstanding',
  'Overdue',
  'NPI',
  'Highest NPI',
  'Status',
];

/**
 * Build Sheet 7 rows. Filters facilities with current overdue > 0.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildOverdueLoansRows(report) {
  const facilities = report.facilities || [];
  const borrowerName = (report.subject && report.subject.displayName) || '';
  const dataRows = [];
  for (const f of facilities) {
    if ((f.overdue || 0) <= 0) continue;
    const rollup = computeHistoryRollup(f);
    dataRows.push([
      borrowerName,
      f.contractCode || '',
      f.pageNo ?? '',
      toMillions(f.limit),
      toMillions(f.outstanding),
      toMillions(f.overdue),
      rollup.currentNpi,
      rollup.highestNpi,
      f.classification || 'STD',
    ]);
  }
  return [HEADERS, ...dataRows];
}
