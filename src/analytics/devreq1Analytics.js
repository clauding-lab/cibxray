// DevReq-1 Phase A analytics — pure functions over the facility model
// produced by parseBBCIB. See spec at:
// ~/Projects/claude-second-brain/01_Projects/CIBXray/DevReq-1-Clarifications.md
//
// Each exported compute* function takes a parsed report (`{ facilities: [...] }`)
// and returns a single number or small object. None of them mutate their input.

const INSTALLMENT_TYPE_PATTERNS = /term\s*loan|hpsm|mpf|personal\s*loan|auto\s*loan|ahl/i;
const NON_INSTALLMENT_TYPE_PATTERNS = /credit\s*card|overdraft|cc\s*\/\s*od|demand\s*loan|guarantee|letter\s*of\s*credit/i;

export function isInstallmentFacility(facility) {
  const type = String(facility.type || '');
  if (NON_INSTALLMENT_TYPE_PATTERNS.test(type)) return false;
  if ((facility.installmentAmount || 0) > 0) return true;
  return INSTALLMENT_TYPE_PATTERNS.test(type);
}

export function parseCibDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function isWithinMonths(date, months, asOf = new Date()) {
  if (!(date instanceof Date)) return false;
  const cutoff = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - months, asOf.getUTCDate()));
  return date >= cutoff && date <= asOf;
}

const isBorrowerRole = f => f.role === 'Borrower' || f.role === 'CoBorrower';
const isGuarantorRole = f => f.role === 'Guarantor';
const isLive = f => f.status === 'Live';
const isTerminated = f => f.status === 'Terminated';

// ── Item 1: Existing Live Loans EMI ─────────────────────────────────────
export function computeLiveLoansEmi(report) {
  return report.facilities
    .filter(isBorrowerRole)
    .filter(isLive)
    .filter(isInstallmentFacility)
    .reduce((sum, f) => sum + (f.installmentAmount || 0), 0);
}

// ── Item 5: Number of Reschedule/Restructure, split by role ─────────────
// Per the 2026-04-22 clarification: show both Borrower/Co-Borrower and
// Guarantor metrics separately.
export function computeRescheduleStats(report) {
  const collect = (predicate) => {
    let count = 0;
    let latest = null;
    let latestStr = '';
    for (const f of report.facilities) {
      if (!predicate(f)) continue;
      count += f.rescheduledCount || 0;
      const d = parseCibDate(f.dateOfLastRescheduling);
      if (d && (!latest || d > latest)) { latest = d; latestStr = f.dateOfLastRescheduling; }
    }
    return { count, lastDate: latestStr };
  };

  return {
    asBorrower: collect(isBorrowerRole),
    asGuarantor: collect(isGuarantorRole),
  };
}

// ── Item 10: New Installment Facilities in the last N months ────────────
export function computeNewInstallmentFacilities(report, { months = 24, asOf = new Date() } = {}) {
  return newFacilitiesStats(report, months, asOf, isInstallmentFacility);
}

// ── Item 11: New Non-Installment Facilities in the last N months ────────
export function computeNewNonInstallmentFacilities(report, { months = 24, asOf = new Date() } = {}) {
  return newFacilitiesStats(report, months, asOf, f => !isInstallmentFacility(f));
}

function newFacilitiesStats(report, months, asOf, kindPredicate) {
  let count = 0;
  let totalAmount = 0;
  for (const f of report.facilities) {
    if (!kindPredicate(f)) continue;
    const d = parseCibDate(f.startDate);
    if (!d || !isWithinMonths(d, months, asOf)) continue;
    count += 1;
    totalAmount += f.limit || 0;
  }
  return { count, totalAmount };
}

// ── Item 13: Guaranteed Installment Loan exposure ───────────────────────
// Per spec: sum Remaining Installments Amount, fallback to outstanding
// only when the remaining-amount field is zero/missing.
export function computeGuaranteedInstallmentExposure(report) {
  return report.facilities
    .filter(isGuarantorRole)
    .filter(isLive)
    .filter(isInstallmentFacility)
    .reduce((sum, f) => {
      const exposure = (f.remainingInstallmentsAmount || 0) > 0
        ? f.remainingInstallmentsAmount
        : (f.outstanding || 0);
      return sum + exposure;
    }, 0);
}

// ── Item 14: Guaranteed Non-Installment Loan exposure ───────────────────
export function computeGuaranteedNonInstallmentExposure(report) {
  return report.facilities
    .filter(isGuarantorRole)
    .filter(isLive)
    .filter(f => !isInstallmentFacility(f))
    .reduce((sum, f) => sum + (f.outstanding || 0), 0);
}

// ── Item 15: Terminated + Terminated-in-advance installment loan count ──
// Note: the parser collapses "Terminated" and "Terminated in advance" into
// plain "Terminated" on the facility object; per spec the two are lumped
// together anyway, so no per-subtype split is needed here.
export function computeTerminatedInstallmentCount(report) {
  return report.facilities
    .filter(isTerminated)
    .filter(isInstallmentFacility)
    .length;
}
