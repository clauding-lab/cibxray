// Wholesale Sheet 7 — "7. Overdue Details_STF"
//
// All currently-overdue short-term funded (STF) facilities across all reports.
// 13 columns: CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Page Number | Role |
//   Outstanding (BDT Million) | Overdue (BDT Million) | NPI |
//   Current Classification | Worst Status (Previous) | Highest NPI

import {
  classifyTenure,
  classifyFundedNature,
  computeHistoryRollup,
} from '../../analytics/devreq2Analytics.js';
import { fmtM } from '../exportHelpers.js';

/**
 * Build the STF overdue detail rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildStfOverdueRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Page Number',
    'Role',
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'NPI',
    'Current Classification',
    'Worst Status (Previous)',
    'Highest NPI',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const stfOverdue = (report.facilities || []).filter(
      f =>
        (f.overdue || 0) > 0 &&
        classifyTenure(f) === 'short-term' &&
        classifyFundedNature(f) === 'funded'
    );

    for (const f of stfOverdue) {
      const rollup = computeHistoryRollup(f);
      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        f.pageNo || '',
        f.role || '',
        fmtM(f.outstanding),
        fmtM(f.overdue),
        rollup.currentNpi,
        f.classification || 'STD',
        rollup.worstStatus,
        rollup.highestNpi,
      ]);
    }
  }

  return [header, ...dataRows];
}
