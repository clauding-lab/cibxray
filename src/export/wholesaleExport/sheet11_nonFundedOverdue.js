// Wholesale Sheet 11 — "11. Non Funded_ Overdue Summary"
//
// All currently-overdue non-funded facilities across all reports.
// 13 columns: CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Page Number | Role |
//   Start Date | End Date | Outstanding (BDT Million) |
//   Overdue (BDT Million) | NPI | Current Classification

import { classifyFundedNature, computeHistoryRollup } from '../../analytics/devreq2Analytics.js';
import { fmtM, formatDate } from '../exportHelpers.js';

/**
 * Build the non-funded overdue summary rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildNonFundedOverdueRows(reports) {
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
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'NPI',
    'Current Classification',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const overdueFacilities = (report.facilities || []).filter(
      f => (f.overdue || 0) > 0 && classifyFundedNature(f) === 'non-funded'
    );

    for (const f of overdueFacilities) {
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
        fmtM(f.outstanding),
        fmtM(f.overdue),
        rollup.currentNpi,
        f.classification || 'STD',
      ]);
    }
  }

  return [header, ...dataRows];
}
