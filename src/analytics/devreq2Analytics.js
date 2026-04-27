// DevReq-2 Phase 2 analytics — pure functions over the facility/report model
// produced by parseBBCIB. See spec at:
// ~/Projects/claude-second-brain/01_Projects/CIBXray/DevReq-2-Spec.md §8
//
// All exported functions are pure: they take a report or facility object,
// return a new value, and NEVER mutate their inputs.

import { parseCibDate, isInstallmentFacility } from './devreq1Analytics.js';

// ── Classification priority ordering ─────────────────────────────────────────
// BLW > BL > DF > SS > SMA > STD
const STATUS_RANK = { BLW: 6, BL: 5, DF: 4, SS: 3, SMA: 2, STD: 1 };

/**
 * Return the worse of two classification strings.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function worstOf(a, b) {
  const ra = STATUS_RANK[a] || 1;
  const rb = STATUS_RANK[b] || 1;
  return ra >= rb ? a : b;
}

// ── monthsDiff ───────────────────────────────────────────────────────────────

/**
 * Calculate the difference in whole calendar months between two Date objects.
 * monthsDiff(new Date('2023-01-01'), new Date('2024-01-01')) === 12
 *
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export function monthsDiff(start, end) {
  const years = end.getUTCFullYear() - start.getUTCFullYear();
  const months = end.getUTCMonth() - start.getUTCMonth();
  return years * 12 + months;
}

// ── computeDueEmi ─────────────────────────────────────────────────────────────

const PERIODICITY_MONTHS = {
  Monthly: 1,
  Bimonthly: 2,
  Quarterly: 3,
  'Half-Yearly': 6,
};

/**
 * Compute the number of EMIs (installments) that should have been paid by
 * `asOf` per the facility's repayment schedule.
 *
 *   elapsed = monthsDiff(startDate, asOf)
 *   due     = min(floor(elapsed / periodicityMonths), totalInstallments)
 *
 * This is a pure calendar measure — independent of what was actually paid.
 * On a well-behaved loan, Due EMI === Paid. On a delinquent loan, Due > Paid,
 * and (Due − Paid) approximates NPI. Cap at totalInstallments so terminated /
 * fully-matured loans don't overshoot.
 *
 * Returns empty string when startDate or paymentPeriodicity is missing or
 * unparseable (keeps the Excel cell visibly blank rather than a wrong number).
 *
 * @param {{ startDate: string, paymentPeriodicity: string, totalInstallments: number|null }} facility
 * @param {Date} asOf
 * @returns {number|''}
 */
export function computeDueEmi(facility, asOf) {
  const start = parseCibDate(facility.startDate);
  if (!start) return '';
  const periodMonths = PERIODICITY_MONTHS[facility.paymentPeriodicity];
  if (!periodMonths) return '';
  const elapsed = monthsDiff(start, asOf);
  if (elapsed < 0) return 0;
  const due = Math.floor(elapsed / periodMonths);
  const cap = facility.totalInstallments != null ? facility.totalInstallments : Infinity;
  return Math.min(due, cap);
}

// ── classifyTenure ────────────────────────────────────────────────────────────

/**
 * Classify a facility as 'long-term' or 'short-term'.
 * Rule (docx §1): endDate − startDate > 12 months → long-term, else short-term.
 * Conservative fallback: if either date is missing, return 'short-term'.
 *
 * @param {{ startDate: string, endDate: string }} facility
 * @returns {'long-term'|'short-term'}
 */
export function classifyTenure(facility) {
  const start = parseCibDate(facility.startDate);
  const end = parseCibDate(facility.endDate);
  if (!start || !end) return 'short-term';
  return monthsDiff(start, end) > 12 ? 'long-term' : 'short-term';
}

// ── classifyFundedNature ─────────────────────────────────────────────────────

const NON_FUNDED_PATTERN = /letter\s+of\s+credit|lc\b|\bguarantee\b|other\s+indirect/i;

/**
 * Classify a facility as 'funded' or 'non-funded'.
 * Rule (docx §1 Step 2): LC / Guarantee / Other Indirect → non-funded; else funded.
 * This is authoritative over the parser's facility.nature field.
 *
 * @param {{ type: string }} facility
 * @returns {'funded'|'non-funded'}
 */
export function classifyFundedNature(facility) {
  const type = String(facility.type || '');
  return NON_FUNDED_PATTERN.test(type) ? 'non-funded' : 'funded';
}

// ── splitLongShortTerm ───────────────────────────────────────────────────────

/**
 * Split facilities into three buckets: longTerm, shortTermFunded, shortTermNonFunded.
 * Excludes role === 'Guarantor' per code standard.
 * Does not mutate the input array.
 *
 * @param {Array} facilities
 * @returns {{ longTerm: Array, shortTermFunded: Array, shortTermNonFunded: Array }}
 */
export function splitLongShortTerm(facilities) {
  const longTerm = [];
  const shortTermFunded = [];
  const shortTermNonFunded = [];

  for (const f of facilities) {
    if (f.role === 'Guarantor') continue;
    const tenure = classifyTenure(f);
    if (tenure === 'long-term') {
      longTerm.push(f);
    } else {
      const nature = classifyFundedNature(f);
      if (nature === 'non-funded') {
        shortTermNonFunded.push(f);
      } else {
        shortTermFunded.push(f);
      }
    }
  }

  return { longTerm, shortTermFunded, shortTermNonFunded };
}

// ── computeHistoryRollup ─────────────────────────────────────────────────────

/**
 * Compute summary metrics from a facility's history array.
 * history is stored oldest→newest (after Phase 1 parser `.slice().reverse()`).
 *
 * Returns:
 *   currentNpi       — count of consecutive overdue months from most-recent row
 *                      walking backwards until a zero-overdue row is found
 *   highestNpi       — max npi across all history rows
 *   highestOverdue   — max overdue amount across all history rows
 *   highestOverdueDate — dateStr of the row with max overdue
 *   worstStatus      — worst classification across all rows (BLW > BL > DF > SS > SMA > STD)
 *   classificationHistory — array of { dateStr, status } with consecutive duplicates removed
 *
 * @param {{ history: Array, overdue?: number }} facility
 * @returns {{ currentNpi: number, highestNpi: number, highestOverdue: number,
 *             highestOverdueDate: string, worstStatus: string, classificationHistory: Array }}
 */
export function computeHistoryRollup(facility) {
  const history = facility.history || [];

  if (history.length === 0) {
    return {
      currentNpi: 0,
      highestNpi: 0,
      highestOverdue: 0,
      highestOverdueDate: '',
      worstStatus: 'STD',
      classificationHistory: [],
    };
  }

  // currentNpi: walk from most-recent (last index) backwards
  let currentNpi = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if ((history[i].overdue || 0) > 0) {
      currentNpi += 1;
    } else {
      break;
    }
  }

  let highestNpi = 0;
  let highestOverdue = 0;
  let highestOverdueDate = '';
  let worstStatus = 'STD';

  for (const row of history) {
    const npi = row.npi || 0;
    const overdue = row.overdue || 0;
    if (npi > highestNpi) highestNpi = npi;
    if (overdue > highestOverdue) {
      highestOverdue = overdue;
      highestOverdueDate = row.dateStr || '';
    }
    worstStatus = worstOf(worstStatus, row.status || 'STD');
  }

  // classificationHistory: dedup consecutive runs
  const classificationHistory = [];
  for (const row of history) {
    const status = row.status || 'STD';
    if (classificationHistory.length === 0 ||
        classificationHistory[classificationHistory.length - 1].status !== status) {
      classificationHistory.push({ dateStr: row.dateStr || '', status });
    }
  }

  return { currentNpi, highestNpi, highestOverdue, highestOverdueDate, worstStatus, classificationHistory };
}

// ── detectMoratorium ─────────────────────────────────────────────────────────

/**
 * Detect moratorium / irregularity per docx §3:
 * facility.overdue === 0 AND (history[0].outstanding − history[3].outstanding) >= 0
 * i.e. balance has NOT decreased over the last 3 full months.
 * Returns false if fewer than 4 history rows are available.
 * history is oldest→newest; index 0 = oldest, index [length-1] = newest.
 * Per docx the check is: h[0].outstanding (oldest in window) vs h[3].outstanding (most recent).
 * With 4 rows: indices 0,1,2,3 → h[3] is newest, h[0] is oldest.
 *
 * Judgment call: "history[0].outstanding − history[3].outstanding ≥ 0" means
 * the oldest row's outstanding is >= the newest, i.e. balance has not gone down.
 *
 * @param {{ overdue: number, history: Array }} facility
 * @returns {boolean}
 */
export function detectMoratorium(facility) {
  if ((facility.overdue || 0) > 0) return false;
  const history = facility.history || [];
  if (history.length < 4) return false;
  // Use the last 4 rows: [len-4] = oldest of window, [len-1] = newest.
  // Moratorium = balance did not reduce → newest >= oldest.
  const oldest = history[history.length - 4];
  const newest = history[history.length - 1];
  return (newest.outstanding - oldest.outstanding) >= 0;
}

// ── computePerformanceUtilization ────────────────────────────────────────────

/**
 * Compute performance utilization rating from history.
 * Rule (docx §5): mean(outstanding/limit) across history.
 * Bucket: < 0.75 → Good, 0.75–0.90 → Moderate, > 0.90 → Poor.
 * Returns null if no history or all limits are zero.
 *
 * @param {{ history: Array }} facility
 * @returns {'Good'|'Moderate'|'Poor'|null}
 */
export function computePerformanceUtilization(facility) {
  const history = facility.history || [];
  const ratios = [];
  for (const row of history) {
    if ((row.limit || 0) > 0) {
      ratios.push((row.outstanding || 0) / row.limit);
    }
  }
  if (ratios.length === 0) return null;
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  if (mean > 0.90) return 'Poor';
  if (mean >= 0.75) return 'Moderate';
  return 'Good';
}

// ── detectForcedLoan ──────────────────────────────────────────────────────────

/**
 * Detect a forced loan: endDate − startDate ≤ 5 days.
 * Rule (docx §6). Returns false if either date is missing.
 *
 * @param {{ startDate: string, endDate: string }} facility
 * @returns {boolean}
 */
export function detectForcedLoan(facility) {
  const start = parseCibDate(facility.startDate);
  const end = parseCibDate(facility.endDate);
  if (!start || !end) return false;
  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 5;
}

// ── computeDebtBurdenPerYear ──────────────────────────────────────────────────

/**
 * Compute annual debt burden (BDT) per docx §2 EMI/EQI reconciliation.
 *
 * Algorithm (in priority order):
 *   1. Use paymentPeriodicity directly if present:
 *      Monthly → ×12, Bimonthly → ×6, Quarterly → ×4, Half-Yearly → ×2
 *   2. EMI/EQI reconciliation fallback (when periodicity absent):
 *      a) Compute theoretical EMI (monthly, from disbursementAmount, startDate, endDate)
 *      b) Compute theoretical EQI (quarterly)
 *      c) Compare facility.installmentAmount to both; use whichever is closer
 *      d) If closer to EMI → ×12; if closer to EQI → ×4
 *   3. If neither works, return 0.
 *
 * Judgment call: Per docx, the periodicity field is the primary signal.
 * EMI/EQI reconciliation is the documented fallback. When both produce zero
 * (e.g. no disbursement, no dates), we return 0 conservatively.
 *
 * @param {object} facility
 * @returns {number}
 */
export function computeDebtBurdenPerYear(facility) {
  return computeDebtBurdenPerYearWithDiagnostics(facility).annualBurden;
}

/**
 * Same as computeDebtBurdenPerYear but also returns a diagnostics object.
 *
 * @param {object} facility
 * @returns {{ annualBurden: number, method: string, confidence: 'high'|'medium'|'low' }}
 */
export function computeDebtBurdenPerYearWithDiagnostics(facility) {
  const installmentAmt = facility.installmentAmount || 0;
  const periodicity = (facility.paymentPeriodicity || '').trim();

  // Step 1: use periodicity directly
  const periodicityMultipliers = {
    'monthly': 12,
    'bimonthly': 6,
    'quarterly': 4,
    'half-yearly': 2,
    'half yearly': 2,
  };
  const key = periodicity.toLowerCase();
  if (periodicityMultipliers[key] && installmentAmt > 0) {
    return {
      annualBurden: installmentAmt * periodicityMultipliers[key],
      method: `periodicity:${periodicity}`,
      confidence: 'high',
    };
  }

  // Step 2: EMI/EQI reconciliation
  const disbursement = facility.disbursementAmount || 0;
  const start = parseCibDate(facility.startDate);
  const end = parseCibDate(facility.endDate);

  if (disbursement > 0 && start && end && installmentAmt > 0) {
    const totalMonths = monthsDiff(start, end);
    const totalQuarters = Math.round(totalMonths / 3);

    const emi = totalMonths > 0 ? computeEmi(disbursement, totalMonths) : 0;
    const eqi = totalQuarters > 0 ? computeEmi(disbursement, totalQuarters) : 0;

    if (emi > 0 || eqi > 0) {
      const diffEmi = Math.abs(installmentAmt - emi);
      const diffEqi = Math.abs(installmentAmt - eqi);

      if (diffEmi <= diffEqi) {
        return { annualBurden: installmentAmt * 12, method: 'emi-reconciliation', confidence: 'medium' };
      } else {
        return { annualBurden: installmentAmt * 4, method: 'eqi-reconciliation', confidence: 'medium' };
      }
    }
  }

  return { annualBurden: 0, method: 'none', confidence: 'low' };
}

/**
 * Compute a simple equal-payment installment amount (no interest — approximation).
 * For EMI/EQI reconciliation only; precision is sufficient for comparison purposes.
 * @param {number} principal
 * @param {number} periods
 * @returns {number}
 */
function computeEmi(principal, periods) {
  if (periods <= 0) return 0;
  return principal / periods;
}

// ── computeTerminatedNonInstallmentCount ─────────────────────────────────────

/**
 * Count terminated non-installment facilities in a report.
 *
 * @param {{ facilities: Array }} report
 * @returns {number}
 */
export function computeTerminatedNonInstallmentCount(report) {
  return (report.facilities || []).filter(
    f => f.status === 'Terminated' && !isInstallmentFacility(f)
  ).length;
}

// ── computeTerminatedAmount ───────────────────────────────────────────────────

/**
 * Sum outstanding for terminated facilities.
 * kind ∈ { 'installment', 'non-installment', 'all' }
 *
 * @param {{ facilities: Array }} report
 * @param {'installment'|'non-installment'|'all'} kind
 * @returns {number}
 */
export function computeTerminatedAmount(report, kind = 'all') {
  const terminated = (report.facilities || []).filter(f => f.status === 'Terminated');
  const filtered = terminated.filter(f => {
    if (kind === 'all') return true;
    const isInst = isInstallmentFacility(f);
    if (kind === 'installment') return isInst;
    return !isInst; // non-installment
  });
  return filtered.reduce((sum, f) => sum + (f.outstanding || 0), 0);
}

// ── aggregateByConcern ────────────────────────────────────────────────────────

/**
 * Aggregate facilities by report (concern) into a Map keyed by fileName.
 * predicate is applied to each facility to filter inclusion.
 *
 * Returned per-concern object matches the wholesale Sheet 3/4/10 column schema:
 * installments, nonInstallments, nonListedSecurities, creditCard, guarantee, lc,
 * otherIndirect, subtotalSTNF, totalSTFSTNF, totalLoan, totalOverdue, sma,
 * ssYes, ssNo, df, blBlw, wdAmount, totalForeignLoan
 *
 * @param {Array} reports
 * @param {Function} predicate  (facility, report) => boolean
 * @returns {Map<string, object>}
 */
export function aggregateByConcern(reports, predicate) {
  const result = new Map();

  for (const report of reports) {
    const zero = () => 0;
    const agg = {
      fileName: report.fileName,
      subject: report.subject,
      installments: 0,
      nonInstallments: 0,
      nonListedSecurities: 0,
      creditCard: 0,
      guarantee: 0,
      lc: 0,
      otherIndirect: 0,
      subtotalSTNF: 0,
      totalSTFSTNF: 0,
      totalLoan: 0,
      totalOverdue: 0,
      sma: 0,
      ssYes: 0,
      ssNo: 0,
      df: 0,
      blBlw: 0,
      wdAmount: 0,
      totalForeignLoan: 0,
    };

    for (const f of (report.facilities || [])) {
      if (!predicate(f, report)) continue;

      const out = f.outstanding || 0;
      const over = f.overdue || 0;
      const type = String(f.type || '').toLowerCase();
      const cls = f.classification || 'STD';
      const wd = f.willfulDefault || false;

      agg.totalLoan += out;
      agg.totalOverdue += over;
      if (f.isForeign) agg.totalForeignLoan += out;
      if (wd) agg.wdAmount += out;

      // Classification buckets (amounts)
      if (cls === 'SMA') agg.sma += out;
      if (cls === 'SS') {
        if (over > 0) agg.ssYes += out;
        else agg.ssNo += out;
      }
      if (cls === 'DF') agg.df += out;
      if (cls === 'BL' || cls === 'BLW') agg.blBlw += out;

      // Product type buckets
      if (/credit\s*card/i.test(type)) {
        agg.creditCard += out;
      } else if (/guarantee/i.test(type)) {
        agg.guarantee += out;
      } else if (/letter\s+of\s+credit|lc\b/i.test(type)) {
        agg.lc += out;
      } else if (/other\s+indirect/i.test(type)) {
        agg.otherIndirect += out;
      } else if (isInstallmentFacility(f)) {
        agg.installments += out;
      } else {
        agg.nonInstallments += out;
      }
    }

    agg.subtotalSTNF = agg.guarantee + agg.lc + agg.otherIndirect;
    agg.totalSTFSTNF = agg.nonInstallments + agg.subtotalSTNF;

    result.set(report.fileName, agg);
  }

  return result;
}

// ── filterCompaniesOnly ───────────────────────────────────────────────────────

/**
 * Filter reports to only COMPANY-type subjects.
 * Per docx: "Group CIB includes only the company not individual loans"
 *
 * @param {Array} reports
 * @returns {Array}
 */
export function filterCompaniesOnly(reports) {
  return reports.filter(r => r.subject && r.subject.subjectType === 'COMPANY');
}

// ── computePercentOfConcernSTF ────────────────────────────────────────────────

/**
 * Compute a facility's outstanding as a percentage of total STF outstanding
 * for the same report. Returns 0 if denominator is 0.
 *
 * @param {object} facility
 * @param {{ facilities: Array }} report
 * @returns {number}  0–100
 */
export function computePercentOfConcernSTF(facility, report) {
  const stfTotal = (report.facilities || [])
    .filter(f => f.status === 'Live' && f.role !== 'Guarantor' && classifyTenure(f) === 'short-term' && classifyFundedNature(f) === 'funded')
    .reduce((sum, f) => sum + (f.outstanding || 0), 0);
  if (stfTotal === 0) return 0;
  return ((facility.outstanding || 0) / stfTotal) * 100;
}

// ── detectApplyingConcern ─────────────────────────────────────────────────────

/**
 * Detect the Applying Concern from a list of loaded reports.
 * Rule (spec §2, §5):
 *   1. Extract refBase from fileName via digit-extraction (longest digit run ≥10 chars).
 *      Strip trailing .pdf (case-insensitive, repeated) before scanning. If no digit
 *      run ≥10 exists, use the cleaned filename as-is (unparseable → own base).
 *      Suffix index comes from [-_](\d+) immediately after the digit run.
 *   2. Report with no suffix-index → applying concern (bare base).
 *   3. No bare base → fallback to smallest suffix-index.
 *   4. Multiple distinct ref-bases across ALL reports (not just bare) → throw error.
 *
 * @param {Array} reports
 * @returns {{ applyingConcern: object, sisterConcerns: Array, groupRefBase: string }}
 */
export function detectApplyingConcern(reports) {
  if (reports.length === 0) {
    throw new Error('detectApplyingConcern: no reports provided');
  }

  const parsed = reports.map(r => {
    // Strip all trailing .pdf extensions (handles accidental double extensions)
    let name = r.fileName || '';
    while (/\.pdf$/i.test(name)) {
      name = name.replace(/\.pdf$/i, '');
    }

    // Find the longest run of digits ≥10 characters in the cleaned name
    const digitRuns = name.match(/\d{10,}/g);
    if (digitRuns) {
      const longest = digitRuns.reduce((a, b) => (b.length > a.length ? b : a));
      const pos = name.lastIndexOf(longest);
      const tail = name.slice(pos + longest.length);
      // Suffix: [-_] followed by digits immediately after the ref-base run
      const suffixMatch = tail.match(/^[-_](\d+)/);
      const suffixIndex = suffixMatch ? parseInt(suffixMatch[1]) : null;
      return { report: r, refBase: longest, suffixIndex };
    }

    // Fallback: unparseable filename — treat entire cleaned name as its own base
    return { report: r, refBase: name, suffixIndex: null };
  });

  // All distinct ref-bases across every report (bare + suffix-bearing)
  const allDistinctBases = new Set(parsed.map(p => p.refBase));
  if (allDistinctBases.size > 1) {
    throw new Error(
      `detectApplyingConcern: ambiguous upload — multiple group ref bases detected ` +
      `(${[...allDistinctBases].join(', ')}). Upload one group at a time.`
    );
  }

  // Find reports with no suffix-index (bare base)
  const bareReports = parsed.filter(p => p.suffixIndex === null);

  let applying;
  if (bareReports.length === 1) {
    applying = bareReports[0];
  } else if (bareReports.length === 0) {
    // Fallback: smallest suffix index
    const sorted = [...parsed].sort((a, b) => (a.suffixIndex || 0) - (b.suffixIndex || 0));
    applying = sorted[0];
  } else {
    // bareReports.length > 1 but same refBase → treat first as applying
    applying = bareReports[0];
  }

  const applyingReport = applying.report;
  const sisterConcerns = reports.filter(r => r !== applyingReport);

  return {
    applyingConcern: applyingReport,
    sisterConcerns,
    groupRefBase: applying.refBase,
  };
}

// ── computeTotalForeignLoan ───────────────────────────────────────────────────

/**
 * Sum outstanding for all isForeign === true, borrower-role, live facilities.
 * For wholesale Sheet 3/4 "Total Foreign Loan" column.
 *
 * @param {{ facilities: Array }} report
 * @returns {number}
 */
export function computeTotalForeignLoan(report) {
  return (report.facilities || [])
    .filter(f => f.isForeign && f.status === 'Live' && (f.role === 'Borrower' || f.role === 'CoBorrower'))
    .reduce((sum, f) => sum + (f.outstanding || 0), 0);
}

// ── analyzeNonInstallmentUtilization ─────────────────────────────────────────

/**
 * Generalized utilization analysis for any non-installment facility.
 * Mirrors the logic in analyzeCreditCard (Phase C) but works on any facility type.
 * This is the generic version; Credit Card tab keeps calling analyzeCreditCard
 * for backward compatibility.
 *
 * Returns:
 *   avgUtilization  — mean(outstanding/limit) across history rows with limit > 0, as %
 *   maxUtilization  — max(outstanding/limit) across those rows, as %
 *   monthsWithOverdue — count of history rows with overdue > 0
 *   monthsWithNpi   — count of history rows with npi >= 1
 *   peakNpi         — max npi across history
 *
 * @param {{ history: Array, limit: number, outstanding: number }} facility
 * @returns {{ avgUtilization: number|null, maxUtilization: number|null,
 *             monthsWithOverdue: number, monthsWithNpi: number, peakNpi: number }}
 */
export function analyzeNonInstallmentUtilization(facility) {
  const history = facility.history || [];
  const utilizations = [];
  let monthsWithOverdue = 0;
  let monthsWithNpi = 0;
  let peakNpi = 0;

  for (const row of history) {
    if ((row.overdue || 0) > 0) monthsWithOverdue += 1;
    if ((row.npi || 0) >= 1) monthsWithNpi += 1;
    if ((row.npi || 0) > peakNpi) peakNpi = row.npi || 0;
    if ((row.limit || 0) > 0) {
      utilizations.push(((row.outstanding || 0) / row.limit) * 100);
    }
  }

  const avgUtilization = utilizations.length > 0
    ? utilizations.reduce((s, u) => s + u, 0) / utilizations.length
    : null;
  const maxUtilization = utilizations.length > 0 ? Math.max(...utilizations) : null;

  return { avgUtilization, maxUtilization, monthsWithOverdue, monthsWithNpi, peakNpi };
}
