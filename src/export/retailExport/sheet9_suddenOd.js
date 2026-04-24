// Sheet 9 — "Loan with Sudden Multiple OD" builder.
//
// Uses findSuddenOverdueEvents to detect any 0 → ≥1 NPI transitions.
// Reshapes to the same 8-column layout as Sheet 8:
//   Borrower Name | Ref. No. | Page No. | Sanclimit | Outstanding |
//   Overdue | NPI | Status
//
// A facility with multiple detected events still emits one row (facility-level).

import { findSuddenOverdueEvents } from '../../analytics/devreq1AnalyticsPhaseB.js';
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
 * Build Sheet 9 rows.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildSuddenOdRows(report) {
  const facilities = report.facilities || [];
  const events = findSuddenOverdueEvents(report);
  const flaggedContractCodes = new Set(events.map(e => e.contractCode));

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
