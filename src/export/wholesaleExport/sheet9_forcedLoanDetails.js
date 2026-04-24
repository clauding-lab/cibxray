// Wholesale Sheet 9 — "9. Forced Loan_Details"
//
// List of all forced loans (start – end ≤ 5 days) across all reports.
// 15 columns: CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Page Number | Role |
//   Start Date | End Date | Status |
//   Outstanding (BDT Million) | Overdue (BDT Million) |
//   Highest NPI | Worst Status (Previous) | Current Classification
//
// Only live forced loans are included.

import { detectForcedLoan, computeHistoryRollup } from '../../analytics/devreq2Analytics.js';
import { fmtM, formatDate } from '../exportHelpers.js';

/**
 * Build the forced loan detail rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildForcedLoanDetailsRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Page Number',
    'Role',
    'Start Date',
    'End Date',
    'Status',
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'Highest NPI',
    'Worst Status (Previous)',
    'Current Classification',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const forcedFacilities = (report.facilities || []).filter(
      f => f.status === 'Live' && detectForcedLoan(f)
    );

    for (const f of forcedFacilities) {
      const rollup = computeHistoryRollup(f);
      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        f.pageNo || '',
        f.role || '',
        formatDate(f.startDate),
        formatDate(f.endDate),
        f.status || '',
        fmtM(f.outstanding),
        fmtM(f.overdue),
        rollup.highestNpi,
        rollup.worstStatus,
        f.classification || 'STD',
      ]);
    }
  }

  return [header, ...dataRows];
}
