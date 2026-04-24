// Wholesale Sheet 5 — "5. Long Term Loan_Summary"
//
// Per-LT-loan detail across all loaded reports. 25 columns:
//   CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Security Type | Page Number | Role |
//   Start Date | End Date | Sanction Limit (BDT Million) |
//   Total Disbursement Amount (BDT Million) |
//   Payment Periodicity | Outstanding (BDT Million) |
//   Overdue (BDT Million) | Current Classification |
//   Debt Burden Per Year (BDT Million) | Moratorium/Irregularity |
//   Total Installments | Remaining Installments |
//   Highest NPI (past/present) | Date of Highest Amount Overdue |
//   Worst Status (Previous) | Number of Rescheduling Instances |
//   Remarks for WD (stubbed — empty: DevReq-2.1 follow-up)
//
// Long-term = endDate - startDate > 12 months.
// All BDT amounts in millions.

import {
  classifyTenure,
  computeHistoryRollup,
  detectMoratorium,
  computeDebtBurdenPerYear,
} from '../../analytics/devreq2Analytics.js';
import { fmtM, formatDate } from '../exportHelpers.js';

/**
 * Build the long-term loan summary rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildLtLoanSummaryRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Security Type',
    'Page Number',
    'Role',
    'Start Date',
    'End Date',
    'Sanction Limit (BDT Million)',
    'Total Disbursement Amount (BDT Million)',
    'Payment Periodicity',
    'Outstanding (BDT Million)',
    'Overdue (BDT Million)',
    'Current Classification',
    'Debt Burden Per Year (BDT Million)',
    'Moratorium/Irregularity',
    'Total Installments',
    'Remaining Installments',
    'Highest NPI (past/present)',
    'Date of Highest Amount Overdue',
    'Worst Status (Previous)',
    'Number of Rescheduling Instances',
    'Remarks for WD',  // stubbed — WD remark parser is DevReq-2.1
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const ltFacilities = (report.facilities || []).filter(
      f => classifyTenure(f) === 'long-term'
    );

    for (const f of ltFacilities) {
      const rollup = computeHistoryRollup(f);
      const moratorium = detectMoratorium(f);
      const debtBurden = computeDebtBurdenPerYear(f);

      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        f.securityType || '',
        f.pageNo || '',
        f.role || '',
        formatDate(f.startDate),
        formatDate(f.endDate),
        fmtM(f.limit),
        fmtM(f.disbursementAmount),
        f.paymentPeriodicity || '',
        fmtM(f.outstanding),
        fmtM(f.overdue),
        f.classification || 'STD',
        fmtM(debtBurden),
        moratorium ? 'Yes' : 'No',
        f.totalInstallments != null ? f.totalInstallments : '',
        f.remainingInstallmentsCount != null ? f.remainingInstallmentsCount : '',
        rollup.highestNpi,
        rollup.highestOverdueDate,
        rollup.worstStatus,
        f.rescheduledCount || 0,
        '',  // Remarks for WD — stubbed per spec §3a / DevReq-2.1
      ]);
    }
  }

  return [header, ...dataRows];
}
