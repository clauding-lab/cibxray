// Shared helpers for the Retail Lending Analytics exporter (DevReq-2 Phase 3).
//
// toMillions converts a raw BDT amount to millions, rounded to 2 decimals.
// Per spec §12 open question #5 default: every BDT amount column is in
// millions with the caption "(Amount in BDT Million)" in the sheet header.

/**
 * Convert a raw BDT amount to millions, rounded to 2 decimals.
 * Returns 0 for null/undefined/non-finite numbers (conservative).
 * @param {number|null|undefined} n
 * @returns {number}
 */
export function toMillions(n) {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round((n / 1_000_000) * 100) / 100;
}

/**
 * Compose a Yes/No flag for a boolean-ish value.
 * @param {boolean} v
 * @returns {'Yes'|'No'}
 */
export function yesNo(v) {
  return v ? 'Yes' : 'No';
}

// Classification priority ordering (mirrors devreq2Analytics internal ranking).
// BLW > BL > DF > SS > SMA > STD
const STATUS_RANK = { BLW: 6, BL: 5, DF: 4, SS: 3, SMA: 2, STD: 1 };

/**
 * Return the worse of two classification strings.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function worstOf(a, b) {
  const ra = STATUS_RANK[a] || 1;
  const rb = STATUS_RANK[b] || 1;
  return ra >= rb ? a : b;
}

/**
 * Parse a CIB inquiry-date string like "15-Mar-2026 11:23:45 AM" or "15-Mar-2026"
 * into a Date object (UTC). Returns null if unparseable.
 * @param {string} str
 * @returns {Date|null}
 */
export function parseInquiryDate(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/^(\d{2})-([A-Z][a-z]{2})-(\d{4})/);
  if (!m) return null;
  const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const monthIdx = months[m[2]];
  if (monthIdx == null) return null;
  const d = new Date(Date.UTC(Number(m[3]), monthIdx, Number(m[1])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Compute the number of whole UTC days between two Dates (end − start).
 * @param {Date} start
 * @param {Date} end
 * @returns {number}
 */
export function daysBetween(start, end) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
}
