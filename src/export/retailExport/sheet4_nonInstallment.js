// Sheet 4 — "Non-Installment Loan" builder.
//
// Covers Overdraft, Demand Loan, LC, Guarantee, Other Indirect, etc.
// Credit Cards are EXCLUDED (they go to Sheet 5).
// 19 columns, two sections Live + Terminated.
//
// Columns (spec §4 Sheet 4 — 0-indexed):
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
// 10 Utilization (%, current)
// 11 Avg. Utilization (12M, %)
// 12 Highest Utilization (12M, %)
// 13 Overlimit History (count of months outstanding > limit)
// 14 CIB Status (current)
// 15 Status (Live / Terminated)
// 16 NPI (current)
// 17 Overdue amount (current, M)
// 18 Worst Status

import {
  computeHistoryRollup,
  classifyFundedNature,
  analyzeNonInstallmentUtilization,
} from '../../analytics/devreq2Analytics.js';
import { toMillions } from './helpers.js';

const HEADERS = [
  'Borrower', 'CIB Ref No.', 'Page No.', 'Role of main applicant', 'CIB Code',
  'Security Type', 'Starting Date', 'End of Contract', 'Limit', 'Outstanding',
  'Utilization (%)', 'Avg. Utilization 12M (%)', 'Highest Utilization 12M (%)',
  'Overlimit History', 'CIB Status', 'Status', 'NPI', 'Overdue amount',
  'Worst Status',
];

/**
 * Sheet-4 eligible facility: non-installment + NOT a credit card.
 * Includes LC/Guarantee (non-funded) and Overdraft/Demand Loan (funded but
 * not installment-structured).
 */
function isNonInstallmentLoanFacility(f) {
  const type = String(f.type || '');
  if (/credit\s*card/i.test(type)) return false;
  // Non-funded (LC / Guarantee / Other Indirect) always eligible
  if (classifyFundedNature(f) === 'non-funded') return true;
  // Funded but non-installment: Overdraft, Demand Loan, CC/OD, etc.
  if (/overdraft|demand\s*loan|cc\s*\/\s*od|ltr|packing\s*credit/i.test(type)) return true;
  return false;
}

function countOverlimitMonths(history) {
  let count = 0;
  for (const r of history || []) {
    if ((r.outstanding || 0) > (r.limit || 0) && (r.limit || 0) > 0) count += 1;
  }
  return count;
}

function roundPct(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return Math.round(n * 100) / 100;
}

function facilityToRow(f, borrowerName) {
  const rollup = computeHistoryRollup(f);
  const util = analyzeNonInstallmentUtilization(f);
  const currentUtil = (f.limit || 0) > 0
    ? roundPct(((f.outstanding || 0) / f.limit) * 100)
    : '';
  const overlimit = countOverlimitMonths(f.history || []);

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
    currentUtil,
    roundPct(util.avgUtilization),
    roundPct(util.maxUtilization),
    overlimit,
    f.classification || 'STD',
    f.status || '',
    rollup.currentNpi,
    toMillions(f.overdue),
    rollup.worstStatus,
  ];
}

/**
 * Build Sheet 4 rows.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildNonInstallmentRows(report) {
  const facilities = (report.facilities || []).filter(isNonInstallmentLoanFacility);
  const borrowerName = (report.subject && report.subject.displayName) || '';
  const live = facilities.filter(f => f.status === 'Live');
  const terminated = facilities.filter(f => f.status === 'Terminated');

  const sectionLabel = (label) => {
    const row = new Array(19).fill('');
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
