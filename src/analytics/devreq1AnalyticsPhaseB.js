// DevReq-1 Phase B analytics — time-series scans over facility.history[].
// Covers items 2, 3, 4 (per-facility pattern detection) and 6, 7, 8, 9, 12
// (portfolio-level peak aggregation + 12-month burden delta).
//
// Spec: ~/Projects/claude-second-brain/01_Projects/CIBXray/DevReq-1-Clarifications.md
//
// All exports are pure functions; none mutate their input.

import {
  isInstallmentFacility,
  computeLiveLoansEmi,
  parseCibDate,
} from './devreq1Analytics.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function yearMonthKey(dateStr) {
  const d = parseCibDate(dateStr);
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatYearMonth(key) {
  if (!key) return '';
  const [y, m] = key.split('-');
  return `${MONTH_SHORT[Number(m) - 1]} ${y}`;
}

const pickFacilityMeta = (f) => ({
  contractCode: f.contractCode,
  institution: f.institution,
  type: f.type,
});

// ── Item 2: Unchanged Outstanding ───────────────────────────────────────
// Per spec: flag facilities where outstanding is identical across
// ≥ minConsecutive consecutive monthly rows AND overdue == 0 AND npi == 0.
// A facility can contribute multiple runs if the flatness is interrupted
// and resumes.
export function findUnchangedOutstandingFacilities(report, { minConsecutive = 3 } = {}) {
  const results = [];
  for (const f of report.facilities) {
    if (!f.history || f.history.length < minConsecutive) continue;
    let runStart = -1;
    let runValue = null;
    const closeRun = (endIdx) => {
      if (runStart < 0) return;
      const len = endIdx - runStart + 1;
      if (len >= minConsecutive) {
        results.push({
          ...pickFacilityMeta(f),
          flatValue: runValue,
          fromDate: f.history[runStart].dateStr,
          toDate: f.history[endIdx].dateStr,
          monthCount: len,
        });
      }
      runStart = -1;
      runValue = null;
    };
    for (let i = 0; i < f.history.length; i++) {
      const r = f.history[i];
      const isCandidate = (r.overdue || 0) === 0 && (r.npi || 0) === 0;
      if (!isCandidate) { closeRun(i - 1); continue; }
      if (runStart < 0) {
        runStart = i;
        runValue = r.outstanding;
      } else if (r.outstanding !== runValue) {
        closeRun(i - 1);
        runStart = i;
        runValue = r.outstanding;
      }
    }
    closeRun(f.history.length - 1);
  }
  return results;
}

// ── Item 3: Sudden Multiple Overdue ─────────────────────────────────────
// Per CRM-CD clarification 2026-04-22: flag any NPI transition 0 → ≥1
// between two consecutive accounting dates. Any first entry into overdue
// on a facility triggers an event (a facility can emit multiple events
// across a recover/relapse cycle).
export function findSuddenOverdueEvents(report) {
  const events = [];
  for (const f of report.facilities) {
    if (!f.history || f.history.length < 2) continue;
    for (let i = 1; i < f.history.length; i++) {
      const prev = f.history[i - 1];
      const cur = f.history[i];
      if ((prev.npi || 0) === 0 && (cur.npi || 0) >= 1) {
        events.push({
          ...pickFacilityMeta(f),
          date: cur.dateStr,
          overdueAmount: cur.overdue,
          npi: cur.npi,
          classification: cur.status,
        });
      }
    }
  }
  return events;
}

// ── Item 4: Continuous Overdue ──────────────────────────────────────────
// Flag facilities with NPI ≥ 1 (or overdue > 0) for ≥ minConsecutive
// consecutive accounting dates. Mark escalated = true when the run
// reaches escalateAt.
export function findContinuousOverdueFacilities(report, { minConsecutive = 2, escalateAt = 3 } = {}) {
  const results = [];
  for (const f of report.facilities) {
    if (!f.history || f.history.length < minConsecutive) continue;
    let runStart = -1;
    let peakNpi = 0;
    const closeRun = (endIdx) => {
      if (runStart < 0) return;
      const len = endIdx - runStart + 1;
      if (len >= minConsecutive) {
        results.push({
          ...pickFacilityMeta(f),
          fromDate: f.history[runStart].dateStr,
          toDate: f.history[endIdx].dateStr,
          monthCount: len,
          peakNpi,
          escalated: len >= escalateAt,
        });
      }
      runStart = -1;
      peakNpi = 0;
    };
    for (let i = 0; i < f.history.length; i++) {
      const r = f.history[i];
      const isOverdue = (r.npi || 0) >= 1 || (r.overdue || 0) > 0;
      if (!isOverdue) { closeRun(i - 1); continue; }
      if (runStart < 0) {
        runStart = i;
        peakNpi = r.npi || 0;
      } else if ((r.npi || 0) > peakNpi) {
        peakNpi = r.npi || 0;
      }
    }
    closeRun(f.history.length - 1);
  }
  return results;
}

// ── Shared primitive for items 6 / 7 / 8 / 9 ────────────────────────────
// Walks the full report's history and sums a row-derived value per month.
// Returns { peakAmount, peakMonth (display), peakMonthKey (YYYY-MM), months }.
function scanTimeline(report, { rowValue, facilityPredicate }) {
  const byMonth = new Map();
  for (const f of report.facilities) {
    if (facilityPredicate && !facilityPredicate(f)) continue;
    for (const r of f.history || []) {
      const key = yearMonthKey(r.dateStr);
      if (!key) continue;
      const v = rowValue(f, r);
      byMonth.set(key, (byMonth.get(key) || 0) + v);
    }
  }
  let peakKey = null;
  let peakAmount = 0;
  for (const [k, v] of byMonth) {
    if (v > peakAmount) { peakAmount = v; peakKey = k; }
  }
  return {
    peakAmount,
    peakMonth: formatYearMonth(peakKey),
    peakMonthKey: peakKey,
    months: byMonth.size,
  };
}

// ── Items 6 / 7 / 8: Peak outstanding ───────────────────────────────────
// kind ∈ {'installment', 'nonInstallment', 'all'}.
export function computePeakExposure(report, kind = 'all') {
  const predicate =
    kind === 'installment' ? isInstallmentFacility
  : kind === 'nonInstallment' ? (f) => !isInstallmentFacility(f)
  : null;
  return scanTimeline(report, {
    rowValue: (_f, r) => r.outstanding || 0,
    facilityPredicate: predicate,
  });
}

// ── Item 9: Peak cumulative EMI ─────────────────────────────────────────
// EMI is a per-facility constant (`installmentAmount`); the per-month sum
// counts only installment facilities with a history row at that month.
export function computePeakEmi(report) {
  return scanTimeline(report, {
    rowValue: (f) => f.installmentAmount || 0,
    facilityPredicate: isInstallmentFacility,
  });
}

// ── Item 12: Incremental Loan & EMI burden ──────────────────────────────
// today totals are taken from facility-level state (live facilities).
// Then totals are taken from the history row at the target year-month.
export function computeBurdenDelta(report, { months = 12, asOf = new Date() } = {}) {
  const liveFacilities = report.facilities.filter(f => f.status === 'Live');
  const todayOutstanding = liveFacilities.reduce((s, f) => s + (f.outstanding || 0), 0);
  const todayEmi = computeLiveLoansEmi(report);

  const targetYear = asOf.getUTCFullYear();
  const targetMonth = asOf.getUTCMonth() - months;
  const target = new Date(Date.UTC(targetYear, targetMonth, 1));
  const targetKey = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}`;

  let thenOutstanding = 0;
  let thenEmi = 0;
  for (const f of report.facilities) {
    const row = (f.history || []).find(r => yearMonthKey(r.dateStr) === targetKey);
    if (!row) continue;
    thenOutstanding += row.outstanding || 0;
    if (isInstallmentFacility(f)) thenEmi += f.installmentAmount || 0;
  }

  return {
    today: { outstanding: todayOutstanding, emi: todayEmi },
    then: { outstanding: thenOutstanding, emi: thenEmi },
    outstandingDelta: todayOutstanding - thenOutstanding,
    emiDelta: todayEmi - thenEmi,
    targetMonthKey: targetKey,
    targetMonth: formatYearMonth(targetKey),
  };
}
