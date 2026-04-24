// Wholesale Sheet 10 — "10. Forced Loan Summary"
//
// Per-concern rollup of forced loans (start – end ≤ 5 days).
// 5 columns: CIB Subject Code | Ref No. | Individual/Company |
//   Outstanding Amount (Living) | No. of Forced Loan Instances
//
// Outstanding in BDT millions.

import { detectForcedLoan } from '../../analytics/devreq2Analytics.js';
import { fmtM } from '../exportHelpers.js';

/**
 * Build the forced loan summary rows (per-concern rollup).
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildForcedLoanSummaryRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'Outstanding Amount, Living (BDT Million)',
    'No. of Forced Loan Instances',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const forcedFacilities = (report.facilities || []).filter(
      f => f.status === 'Live' && detectForcedLoan(f)
    );
    const totalOutstanding = forcedFacilities.reduce(
      (sum, f) => sum + (f.outstanding || 0), 0
    );

    dataRows.push([
      subj.cibSubjectCode || '',
      report.fileName || report.reportNo || '',
      subj.subjectType || '',
      fmtM(totalOutstanding),
      forcedFacilities.length,
    ]);
  }

  return [header, ...dataRows];
}
