// Sheet 8 — "Loan with unchanged Outstanding" builder.
//
// Uses findUnchangedOutstandingFacilities to detect flat-outstanding runs,
// then reshapes to 8-column layout at facility granularity:
//   Borrower Name | Ref. No. | Page No. | Sanclimit | Outstanding |
//   Overdue | NPI | Status
//
// If a single facility has multiple detected runs, it still emits one row
// (the current facility state). Amounts in millions.

import { findUnchangedOutstandingFacilities } from '../../analytics/devreq1AnalyticsPhaseB.js';
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
  'Status',
];

/**
 * Build Sheet 8 rows.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildUnchangedOutstandingRows(report) {
  const facilities = report.facilities || [];
  const flaggedRuns = findUnchangedOutstandingFacilities(report);
  const flaggedContractCodes = new Set(flaggedRuns.map(r => r.contractCode));

  const borrowerName = (report.subject && report.subject.displayName) || '';
  const dataRows = [];
  for (const f of facilities) {
    if (!flaggedContractCodes.has(f.contractCode)) continue;
    const rollup = computeHistoryRollup(f);
    dataRows.push([
      borrowerName,
      f.contractCode || '',
      f.pageNo ?? '',
      toMillions(f.limit),
      toMillions(f.outstanding),
      toMillions(f.overdue),
      rollup.currentNpi,
      f.classification || 'STD',
    ]);
  }
  return [HEADERS, ...dataRows];
}
