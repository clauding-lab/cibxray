const ONE_MILLION = 1_000_000;

/**
 * Render a BDT amount for dashboard display.
 *
 * Threshold-based self-labelling format (per spec §12 Q5 / DevReq-2 Phase 5):
 *   n === 0           → "0"
 *   |n| >= 1,000,000  → "X.XX million" (raw ÷ 1e6, 2 decimals, suffix " million")
 *   |n| <  1,000,000  → locale-formatted full integer with thousand separators
 *
 * Sign preserved in both threshold branches.
 * null / undefined / NaN are treated as 0.
 *
 * @param {number|null|undefined} n  raw BDT amount
 * @returns {string}
 */
export const fmt = (n) => {
  const num = Number(n || 0);
  if (num === 0) return "0";
  if (Math.abs(num) >= ONE_MILLION) {
    return (num / ONE_MILLION).toFixed(2) + " million";
  }
  return Math.round(num).toLocaleString();
};
