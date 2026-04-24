// Sheet 3 — "Term Loans" builder for the Retail Lending Analytics exporter.
//
// Two sections stacked: Live + Terminated. 23 columns each.
// Filter: installment facilities = funded (classifyFundedNature) with an
// installment signal (paymentPeriodicity or installmentAmount > 0 or
// installment-type keyword).
//
// Columns (spec §4 Sheet 3 — 0-indexed):
//  0 Borrower
//  1 CIB Ref No.
//  2 Page No.
//  3 Role of main applicant
//  4 CIB Code
//  5 Security Type
//  6 Starting Date
//  7 End of Contract
//  8 Limit (M)
//  9 Outstanding (M)
// 10 EMI (M)
// 11 Term (totalInstallments)
// 12 Due (unclear — judgment call: render empty)
// 13 Paid (totalInstallments - remainingInstallmentsCount)
// 14 Remaining term (remainingInstallmentsCount)
// 15 CIB Status (current classification)
// 16 Status (Live / Terminated)
// 17 NPI (currentNpi)
// 18 Overdue amount (current, M)
// 19 Highest Overdue (M)
// 20 Highest NPI
// 21 Classification History
// 22 Worst Status

import { computeHistoryRollup, classifyFundedNature } from '../../analytics/devreq2Analytics.js';
import { toMillions } from './helpers.js';

const HEADERS = [
  'Borrower', 'CIB Ref No.', 'Page No.', 'Role of main applicant', 'CIB Code',
  'Security Type', 'Starting Date', 'End of Contract', 'Limit', 'Outstanding',
  'EMI', 'Term', 'Due', 'Paid', 'Remaining term', 'CIB Status', 'Status', 'NPI',
  'Overdue amount', 'Highest Overdue', 'Highest NPI', 'Classification History',
  'Worst Status',
];

const NON_INSTALLMENT_TYPE_PATTERNS = /credit\s*card|overdraft|cc\s*\/\s*od|demand\s*loan/i;
const INSTALLMENT_TYPE_PATTERNS = /term\s*loan|hpsm|mpf|personal\s*loan|auto\s*loan|ahl/i;

/**
 * A facility is a "term loan" for Sheet 3 when it is funded AND has an
 * installment nature (periodicity, EMI, or installment-type keyword).
 * @param {object} f
 * @returns {boolean}
 */
function isTermLoanFacility(f) {
  if (classifyFundedNature(f) !== 'funded') return false;
  const type = String(f.type || '');
  if (NON_INSTALLMENT_TYPE_PATTERNS.test(type)) return false;
  if (f.paymentPeriodicity) return true;
  if ((f.installmentAmount || 0) > 0) return true;
  return INSTALLMENT_TYPE_PATTERNS.test(type);
}

function facilityToRow(f, borrowerName) {
  const rollup = computeHistoryRollup(f);
  const paid = (f.totalInstallments != null && f.remainingInstallmentsCount != null)
    ? f.totalInstallments - f.remainingInstallmentsCount
    : '';
  const classificationHistory = rollup.classificationHistory
    .map(c => c.status)
    .join(' → ');

  return [
    borrowerName,
    f.contractCode || '',
    f.pageNo ?? '',
    f.role || '',
    f.contractCode || '',
    f.securityType || '',
    f.startDate || '',
    f.endDate || '',
    toMillions(f.limit),
    toMillions(f.outstanding),
    toMillions(f.installmentAmount),
    f.totalInstallments != null ? f.totalInstallments : '',
    '', // Due — judgment call (spec §4 Sheet 3 "Due" derivation unclear; flag Phase 3.1)
    paid,
    f.remainingInstallmentsCount != null ? f.remainingInstallmentsCount : '',
    f.classification || 'STD',
    f.status || '',
    rollup.currentNpi,
    toMillions(f.overdue),
    toMillions(rollup.highestOverdue),
    rollup.highestNpi,
    classificationHistory,
    rollup.worstStatus,
  ];
}

/**
 * Build Sheet 3 rows. Emits Live section header + data + Terminated section
 * header + data.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildTermLoansRows(report) {
  const facilities = (report.facilities || []).filter(isTermLoanFacility);
  const borrowerName = (report.subject && report.subject.displayName) || '';

  const live = facilities.filter(f => f.status === 'Live');
  const terminated = facilities.filter(f => f.status === 'Terminated');

  const sectionLabel = (label) => {
    const row = new Array(23).fill('');
    row[0] = label;
    return row;
  };

  return [
    sectionLabel('Live Contracts'),
    HEADERS,
    ...live.map(f => facilityToRow(f, borrowerName)),
    sectionLabel('Terminated Contracts'),
    HEADERS,
    ...terminated.map(f => facilityToRow(f, borrowerName)),
  ];
}
