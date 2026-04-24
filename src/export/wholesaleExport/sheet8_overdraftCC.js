// Wholesale Sheet 8 — "8. Overdraft & CC"
//
// OD / CC facility list with Performance Utilization column.
// 15 columns: CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Page Number | Role | Status |
//   Sanction Limit (BDT Million) | Outstanding (BDT Million) |
//   Overdue (BDT Million) | NPI | Current Classification |
//   Performance Utilization | Highest NPI

import { computePerformanceUtilization, computeHistoryRollup } from '../../analytics/devreq2Analytics.js';
import { fmtM } from '../exportHelpers.js';

const OD_CC_TYPES = /overdraft|od\b|credit\s*card|cc\b/i;

/**
 * Check whether a facility is an overdraft or credit card product.
 * @param {object} facility
 * @returns {boolean}
 */
function isOdOrCc(facility) {
  return OD_CC_TYPES.test(facility.type || '');
}

/**
 * Build the overdraft + credit card detail rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildOverdraftCcRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Page Number',
    'Role',
    'Status',
    'Sanction Limit (BDT Million)',
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'NPI',
    'Current Classification',
    'Performance Utilization',
    'Highest NPI',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const odCcFacilities = (report.facilities || []).filter(isOdOrCc);

    for (const f of odCcFacilities) {
      const rollup = computeHistoryRollup(f);
      const utilization = computePerformanceUtilization(f);
      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        f.pageNo || '',
        f.role || '',
        f.status || '',
        fmtM(f.limit),
        fmtM(f.outstanding),
        fmtM(f.overdue),
        rollup.currentNpi,
        f.classification || 'STD',
        utilization || 'N/A',
        rollup.highestNpi,
      ]);
    }
  }

  return [header, ...dataRows];
}
