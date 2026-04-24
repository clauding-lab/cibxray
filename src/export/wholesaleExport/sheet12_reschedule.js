// Wholesale Sheet 12 — "12. Reschedule Contract Details"
//
// All rescheduled contracts across all loaded reports.
// 11 columns: CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Start Date | Expiry Date |
//   Outstanding | Overdue | Number of times Rescheduled | Page Number
//
// Per docx rule: only include facilities where rescheduledCount > 0.
// Outstanding and Overdue in BDT millions.

import { fmtM, formatDate } from '../exportHelpers.js';

/**
 * Build the reschedule contract detail rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildRescheduleRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Start Date',
    'Expiry Date',
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'Number of times Rescheduled',
    'Page Number',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const rescheduled = (report.facilities || []).filter(
      f => (f.rescheduledCount || 0) > 0
    );

    for (const f of rescheduled) {
      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        formatDate(f.startDate),
        formatDate(f.endDate),
        fmtM(f.outstanding),
        fmtM(f.overdue),
        f.rescheduledCount || 0,
        f.pageNo || '',
      ]);
    }
  }

  return [header, ...dataRows];
}
