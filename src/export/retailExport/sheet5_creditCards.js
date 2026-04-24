// Sheet 5 — "Credit Cards" builder.
//
// Credit card facilities only. 17 columns, two sections (Live + Terminated).
// Most metrics come from analyzeCreditCard (Phase C analytics); additions
// per spec: Page No., explicit Overlimit History column, Highest Overdue
// as an amount.
//
// Columns (0-indexed):
//  0 Borrower
//  1 CIB Ref No.
//  2 Page No.
//  3 Role
//  4 CIB Code
//  5 Starting Date
//  6 Limit (M)
//  7 Outstanding (M)
//  8 Utilization (current, %)
//  9 Avg. Utilization 12M (%)
// 10 Highest Utilization 12M (%)
// 11 Overlimit History (count)
// 12 CIB Status (current)
// 13 Status (Live / Terminated)
// 14 NPI (current)
// 15 Overdue amount (current, M)
// 16 Highest Overdue (M)

import { analyzeCreditCard, isCreditCardFacility } from '../../analytics/devreq1AnalyticsPhaseC.js';
import { computeHistoryRollup } from '../../analytics/devreq2Analytics.js';
import { toMillions } from './helpers.js';

const HEADERS = [
  'Borrower', 'CIB Ref No.', 'Page No.', 'Role', 'CIB Code', 'Starting Date',
  'Limit', 'Outstanding', 'Utilization (%)', 'Avg. Utilization 12M (%)',
  'Highest Utilization 12M (%)', 'Overlimit History', 'CIB Status', 'Status',
  'NPI', 'Overdue amount', 'Highest Overdue',
];

function roundPct(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return Math.round(n * 100) / 100;
}

function countOverlimitMonths(history) {
  let count = 0;
  for (const r of history || []) {
    if ((r.outstanding || 0) > (r.limit || 0) && (r.limit || 0) > 0) count += 1;
  }
  return count;
}

function facilityToRow(f, borrowerName) {
  const analysis = analyzeCreditCard(f);
  const rollup = computeHistoryRollup(f);
  return [
    borrowerName,
    f.contractCode || '',
    f.pageNo ?? '',
    f.role || '',
    f.contractCode || '',
    f.startDate || '',
    toMillions(f.limit),
    toMillions(f.outstanding),
    roundPct(analysis.currentUtilization),
    roundPct(analysis.avgUtilization),
    roundPct(analysis.maxUtilization),
    countOverlimitMonths(f.history || []),
    f.classification || 'STD',
    f.status || '',
    rollup.currentNpi,
    toMillions(f.overdue),
    toMillions(rollup.highestOverdue),
  ];
}

/**
 * Build Sheet 5 rows.
 * @param {{ facilities: Array, subject: object }} report
 * @returns {Array<Array>}
 */
export function buildCreditCardsRows(report) {
  const facilities = (report.facilities || []).filter(isCreditCardFacility);
  const borrowerName = (report.subject && report.subject.displayName) || '';
  const live = facilities.filter(f => f.status === 'Live');
  const terminated = facilities.filter(f => f.status === 'Terminated');

  const sectionLabel = (label) => {
    const row = new Array(17).fill('');
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
