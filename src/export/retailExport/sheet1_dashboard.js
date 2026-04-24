// Sheet 1 — "CIB Dashboard" builders for the Retail Lending Analytics exporter.
//
// Five sub-blocks (spec §4 Sheet 1):
//   1a. KYC (rows 4–9)
//   1b. Individual Liability Status grid (rows 11–16)
//   1c. Group Liability Status grid (rows 17–22)
//   1d. PG Role Status (rows 23–24)
//   1e. Terminated Contracts Status (rows 25–27)
//   1f. Findings (rows 29–57)
//
// All builders are pure: they take a report, return arrays of cell values.
// No mutation of inputs. No ExcelJS calls.

import {
  computeGuaranteedInstallmentExposure,
  computeGuaranteedNonInstallmentExposure,
  computeTerminatedInstallmentCount,
  computeLiveLoansEmi,
  computeRescheduleStats,
  computeNewInstallmentFacilities,
  computeNewNonInstallmentFacilities,
} from '../../analytics/devreq1Analytics.js';
import {
  computePeakExposure,
  computePeakEmi,
  computeBurdenDelta,
  findSuddenOverdueEvents,
} from '../../analytics/devreq1AnalyticsPhaseB.js';
import {
  classifyTenure,
  classifyFundedNature,
  computeHistoryRollup,
  computeTerminatedAmount,
  computeTerminatedNonInstallmentCount,
  detectForcedLoan,
} from '../../analytics/devreq2Analytics.js';
import { toMillions, yesNo, worstOf, parseInquiryDate, daysBetween } from './helpers.js';

const BORROWER_ROLES = new Set(['Borrower', 'CoBorrower']);
const isBorrowerRole = (f) => BORROWER_ROLES.has(f.role);
const isGuarantorRole = (f) => f.role === 'Guarantor';
const isLive = (f) => f.status === 'Live';

// ── Sheet 1a: KYC ────────────────────────────────────────────────────────────

/**
 * Build KYC rows (1a). 8 rows × 2 columns [Label, Value].
 * Order matches spec §4 Sheet 1a.
 * @param {object} report
 * @returns {Array<[string, string]>}
 */
export function buildKycRows(report) {
  const s = report.subject || {};
  return [
    ['Ref. Number', report.reportNo || ''],
    ['Name of Main Borrower', s.displayName || s.name || ''],
    ['Name of main representative', s.mainRepresentative || ''],
    ['NID No.', s.nid || ''],
    ['DOB', s.dob || ''],
    ['TIN No.', s.tin || ''],
    ["Father's Name", s.fatherName || ''],
    ["Mother's Name", s.motherName || ''],
  ];
}

// ── Liability-grid shared helper ─────────────────────────────────────────────

const LIABILITY_HEADERS = [
  'Particular',
  '# Live Contracts',
  'Sanctioned Limit',
  'Outstanding',
  'Overdue',
  'SMA',
  'SS/DF/BL/BLW',
  'Previous Overdue Amount (Date)',
  'Previous Classification',
];

const SEVERE_BUCKET = new Set(['SS', 'DF', 'BL', 'BLW']);

/**
 * Partition a facility list into the five liability-grid buckets.
 * Rules (spec §4 Sheet 1b):
 *   - Long-term: `endDate − startDate > 12 months` AND funded
 *   - Short-term funded: tenure ≤ 12 months AND funded
 *   - Non-Funded: LC / Guarantee / Other Indirect (regardless of tenure)
 *   - Total Funded: long-term + short-term funded
 *   - Total: all buckets combined
 * Guarantor-role facilities are excluded (# Live Contracts is a
 * borrower-role count; amounts follow the same partition to stay consistent).
 * @param {Array} facilities
 * @returns {{ longFunded: Array, shortFunded: Array, nonFunded: Array }}
 */
function partitionForLiabilityGrid(facilities) {
  const longFunded = [];
  const shortFunded = [];
  const nonFunded = [];
  for (const f of facilities) {
    if (isGuarantorRole(f)) continue;
    const nature = classifyFundedNature(f);
    if (nature === 'non-funded') {
      nonFunded.push(f);
    } else {
      const tenure = classifyTenure(f);
      if (tenure === 'long-term') longFunded.push(f);
      else shortFunded.push(f);
    }
  }
  return { longFunded, shortFunded, nonFunded };
}

/**
 * Aggregate a facility bucket into liability-grid cell values.
 * Returns an object keyed by column semantics. Amounts are converted to millions.
 * @param {Array} bucket
 * @returns {object}
 */
function aggregateBucket(bucket) {
  let liveContracts = 0;
  let totalLimit = 0;
  let totalOutstanding = 0;
  let totalOverdue = 0;
  let smaAmount = 0;
  let severeAmount = 0;
  let prevOverdue = 0;
  let prevOverdueDate = '';
  let prevWorstStatus = 'STD';

  for (const f of bucket) {
    if (isLive(f)) liveContracts += 1;
    totalLimit += f.limit || 0;
    totalOutstanding += f.outstanding || 0;
    totalOverdue += f.overdue || 0;
    const cls = f.classification || 'STD';
    if (cls === 'SMA') smaAmount += f.outstanding || 0;
    if (SEVERE_BUCKET.has(cls)) severeAmount += f.outstanding || 0;

    const rollup = computeHistoryRollup(f);
    if (rollup.highestOverdue > prevOverdue) {
      prevOverdue = rollup.highestOverdue;
      prevOverdueDate = rollup.highestOverdueDate;
    }
    prevWorstStatus = worstOf(prevWorstStatus, rollup.worstStatus);
  }

  const prevOverdueDisplay = prevOverdue > 0
    ? `${toMillions(prevOverdue)}${prevOverdueDate ? ` (${prevOverdueDate})` : ''}`
    : '';

  return {
    liveContracts,
    limit: toMillions(totalLimit),
    outstanding: toMillions(totalOutstanding),
    overdue: toMillions(totalOverdue),
    sma: toMillions(smaAmount),
    severe: toMillions(severeAmount),
    prevOverdueDisplay,
    prevClassification: prevWorstStatus,
  };
}

function bucketToRow(label, agg) {
  return [
    label,
    agg.liveContracts,
    agg.limit,
    agg.outstanding,
    agg.overdue,
    agg.sma,
    agg.severe,
    agg.prevOverdueDisplay,
    agg.prevClassification,
  ];
}

/**
 * Build the 5-row × 9-column liability grid for a facility list.
 * Includes the header row as row 0.
 * @param {Array} facilities
 * @returns {Array<Array>}
 */
export function buildLiabilityGrid(facilities) {
  const { longFunded, shortFunded, nonFunded } = partitionForLiabilityGrid(facilities || []);
  const totalFunded = [...longFunded, ...shortFunded];
  const total = [...totalFunded, ...nonFunded];

  return [
    LIABILITY_HEADERS,
    bucketToRow('Funded — Long term', aggregateBucket(longFunded)),
    bucketToRow('Funded — Short term', aggregateBucket(shortFunded)),
    bucketToRow('Total Funded', aggregateBucket(totalFunded)),
    bucketToRow('Non-Funded', aggregateBucket(nonFunded)),
    bucketToRow('Total', aggregateBucket(total)),
  ];
}

/**
 * Build the Individual Liability Status grid (1b).
 * Uses the report's own facilities only.
 * @param {object} report
 * @returns {Array<Array>}
 */
export function buildIndividualLiabilityGrid(report) {
  return buildLiabilityGrid(report.facilities || []);
}

/**
 * Build the Group Liability Status grid (1c).
 * For the single-PDF retail context, the spec says populate only if the PDF
 * has linked proprietorships and their facilities are surfaced (they are not
 * in the current parser). If no linked-concern facility data exists, emit the
 * structural grid with zero values.
 * @param {object} report
 * @returns {Array<Array>}
 */
export function buildGroupLiabilityGrid(report) {
  // Retail context: linkedProprietorships is a metadata list (cibCode + tradeName)
  // without per-facility data in the current PDF. Emit structural grid with zeros.
  const _linked = report.linkedProprietorships || [];
  return buildLiabilityGrid([]);
}

// ── Sheet 1d: PG Role Status ─────────────────────────────────────────────────

const INSTALLMENT_TYPE_PATTERNS = /term\s*loan|hpsm|mpf|personal\s*loan|auto\s*loan|ahl/i;
const NON_INSTALLMENT_TYPE_PATTERNS = /credit\s*card|overdraft|cc\s*\/\s*od|demand\s*loan|guarantee|letter\s*of\s*credit/i;

function isInstallmentLike(facility) {
  const type = String(facility.type || '');
  if (NON_INSTALLMENT_TYPE_PATTERNS.test(type)) return false;
  if ((facility.installmentAmount || 0) > 0) return true;
  return INSTALLMENT_TYPE_PATTERNS.test(type);
}

/**
 * Build PG Role Status rows (1d). 2 rows × 2 cols.
 * @param {object} report
 * @returns {Array<[string, number]>}
 */
export function buildPgRoleStatusRows(report) {
  const facilities = report.facilities || [];
  let installmentGuarantor = 0;
  let nonInstallmentGuarantor = 0;
  for (const f of facilities) {
    if (!isGuarantorRole(f)) continue;
    if (isInstallmentLike(f)) installmentGuarantor += 1;
    else nonInstallmentGuarantor += 1;
  }
  return [
    ['No. of Guaranteed Installment Loan', installmentGuarantor],
    ['No. of Guaranteed Non-Installment Loan', nonInstallmentGuarantor],
  ];
}

// ── Sheet 1e: Terminated Contracts Status ────────────────────────────────────

/**
 * Build Terminated Contracts Status rows (1e). 3 rows × 2 cols.
 * Row 3 is the EMI sum of terminated installment loans (in millions).
 * @param {object} report
 * @returns {Array<[string, number]>}
 */
export function buildTerminatedContractsRows(report) {
  const facilities = report.facilities || [];
  const termInstallmentCount = computeTerminatedInstallmentCount(report);
  const termNonInstallmentCount = computeTerminatedNonInstallmentCount(report);
  const termInstallmentEmi = facilities
    .filter(f => f.status === 'Terminated' && isInstallmentLike(f))
    .reduce((sum, f) => sum + (f.installmentAmount || 0), 0);

  return [
    ['No. of Terminated Installment Loans', termInstallmentCount],
    ['No. of Terminated Non-Installment Loans', termNonInstallmentCount],
    ['Sum of EMI of Terminated Installment Loans', toMillions(termInstallmentEmi)],
  ];
}

// ── Sheet 1f: Findings ───────────────────────────────────────────────────────

/**
 * Compute the worst current classification across a facility list.
 * Empty list → 'STD'.
 * @param {Array} facilities
 * @returns {string}
 */
function worstCurrentClassification(facilities) {
  let worst = 'STD';
  for (const f of facilities) worst = worstOf(worst, f.classification || 'STD');
  return worst;
}

/**
 * Compute the worst historical classification across a role-filtered facility list.
 * @param {Array} facilities
 * @param {Function} roleFilter
 * @returns {string}
 */
function worstHistoricalForRole(facilities, roleFilter) {
  let worst = 'STD';
  for (const f of facilities) {
    if (!roleFilter(f)) continue;
    const rollup = computeHistoryRollup(f);
    worst = worstOf(worst, rollup.worstStatus);
  }
  return worst;
}

/**
 * Build the 29-row Findings table (Sheet 1f).
 * Each element is [Particular, Finding]. Row 9 ("Any Stay Order") renders "N/A"
 * per spec — parser extraction is deferred to DevReq-2.1.
 *
 * @param {object} report
 * @param {{ asOf?: Date }} [options]
 * @returns {Array<[string, any]>}
 */
export function buildFindingsRows(report, { asOf = new Date() } = {}) {
  const facilities = report.facilities || [];
  const borrowerLiveFacilities = facilities.filter(f => isBorrowerRole(f) && isLive(f));
  const guarantorLiveFacilities = facilities.filter(f => isGuarantorRole(f) && isLive(f));

  // Row 2: age of CIB report in days
  const inqDate = parseInquiryDate(report.inquiryDate || '');
  const ageDays = inqDate ? daysBetween(inqDate, asOf) : '';

  // Row 5: overall current worst classification across all facilities
  const overallCurrent = worstCurrentClassification(facilities);

  // Row 6: worst historical as Borrower/CoBorrower
  const worstHistoricalBorrower = worstHistoricalForRole(facilities, isBorrowerRole);

  // Row 7: sum of overdue on borrower-role live facilities
  const borrowerOverdue = borrowerLiveFacilities.reduce((s, f) => s + (f.overdue || 0), 0);

  // Row 8: forced-loan Y/N
  const anyForced = facilities.some(detectForcedLoan);

  // Row 10: worst historical as Guarantor
  const worstHistoricalGuarantor = worstHistoricalForRole(facilities, isGuarantorRole);

  // Row 11: sum of overdue on guarantor-role live facilities
  const guarantorOverdue = guarantorLiveFacilities.reduce((s, f) => s + (f.overdue || 0), 0);

  // Row 12 / 13: guaranteed exposures
  const guarInstExposure = computeGuaranteedInstallmentExposure(report);
  const guarNonInstExposure = computeGuaranteedNonInstallmentExposure(report);

  // Row 14 / 15 / 16: terminated counts & amounts
  const termInstCount = computeTerminatedInstallmentCount(report);
  const termInstAmount = computeTerminatedAmount(report, 'installment');
  const termNonInstAmount = computeTerminatedAmount(report, 'non-installment');

  // Row 17: live loans EMI
  const liveLoansEmi = computeLiveLoansEmi(report);

  // Row 18: any reschedule (borrower role)
  const reschedule = computeRescheduleStats(report);
  const anyReschedule = (reschedule.asBorrower.count || 0) > 0;

  // Rows 19 / 20 / 21: peak exposure by kind
  const peakInstallment = computePeakExposure(report, 'installment');
  const peakNonInstallment = computePeakExposure(report, 'nonInstallment');
  const peakAll = computePeakExposure(report, 'all');

  // Row 22: peak EMI
  const peakEmi = computePeakEmi(report);

  // Rows 23 / 24: new installment facilities in 24M
  const newInst = computeNewInstallmentFacilities(report, { months: 24, asOf });

  // Rows 25 / 26: new non-installment facilities in 24M
  const newNonInst = computeNewNonInstallmentFacilities(report, { months: 24, asOf });

  // Rows 27 / 28: burden deltas
  const burden12 = computeBurdenDelta(report, { months: 12, asOf });
  const burden24 = computeBurdenDelta(report, { months: 24, asOf });

  // Row 29: any sudden multiple overdue event
  const suddenEvents = findSuddenOverdueEvents(report);
  const anySudden = suddenEvents.length > 0;

  return [
    ['Date', report.inquiryDate || ''],
    ['Age of CIB Report (Days)', ageDays],
    ["Partners Name / Directors Name", (report.directors || []).map(d => d.name).join(', ')],
    ['Name of Sister Concern', (report.linkedProprietorships || []).map(p => p.tradeName).join(', ')],
    ['Overall current CIB Status (borrower & guarantor)', overallCurrent],
    ['SS/DF/BL/BLW as Borrower/Co-borrower (any point)', worstHistoricalBorrower],
    ['Amount of current Overdue in Borrower/Co-borrower role', toMillions(borrowerOverdue)],
    ['Forced Loan (end − start ≤ 5 days)', yesNo(anyForced)],
    ['Any Stay Order', 'N/A'], // DEFERRED to DevReq-2.1 per spec §4 Sheet 1f row 9
    ['SS/DF/BL/BLW under PG Role (any point)', worstHistoricalGuarantor],
    ['Amount of current Overdue in PG role', toMillions(guarantorOverdue)],
    ['Amount of Guaranteed Installment Loan', toMillions(guarInstExposure)],
    ['Amount of Guaranteed Non-Installment Loan', toMillions(guarNonInstExposure)],
    ['No. of Terminated Installment Loans', termInstCount],
    ['Amount of Terminated Installment Loans', toMillions(termInstAmount)],
    ['Amount of Terminated Non-Installment Loans', toMillions(termNonInstAmount)],
    ["Existing Loans' EMI", toMillions(liveLoansEmi)],
    ['Any Reschedule', yesNo(anyReschedule)],
    ['Highest Term loan exposure at the same time', toMillions(peakInstallment.peakAmount)],
    ['Highest Non-installment exposure at the same time', toMillions(peakNonInstallment.peakAmount)],
    ['Cumulative highest exposure', toMillions(peakAll.peakAmount)],
    ['Cumulative highest EMI', toMillions(peakEmi.peakAmount)],
    ['No. of New Installment Facilities in last 24 months', newInst.count],
    ['Amount of New Installment Facilities in last 24 months', toMillions(newInst.totalAmount)],
    ['No. of New Non-Installment Facilities in last 24 months', newNonInst.count],
    ['Amount of New Non-Installment Facilities in last 24 months', toMillions(newNonInst.totalAmount)],
    ['Incremental burden in last 12 months', toMillions(burden12.outstandingDelta)],
    ['Incremental burden in last 24 months', toMillions(burden24.outstandingDelta)],
    ['Any loan with sudden Multiple Overdue', yesNo(anySudden)],
  ];
}
