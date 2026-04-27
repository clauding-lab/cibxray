/**
 * Formatter for the user-facing banner shown when a banker uploads CIBs
 * from multiple distinct ref-bases and then clicks Wholesale Export or
 * Committee Summary.
 *
 * Pure function — no imports, no side-effects.
 */

/**
 * Build a file-count label for a single base entry.
 * @param {{ base: string, count: number }} entry
 * @returns {string}  e.g. "1011500041801 (5 files)" or "2099887766554 (1 file)"
 */
function formatEntry(entry) {
  const word = entry.count === 1 ? 'file' : 'files';
  return `${entry.base} (${entry.count} ${word})`;
}

/**
 * Build the joined list string from an array of base entries.
 * - 0 entries → empty string (defensive; should not occur in practice)
 * - 1 entry  → just the formatted entry
 * - 2 entries → "A and B"
 * - 3+ entries → "A, B, and C" (Oxford comma)
 *
 * @param {Array<{base: string, count: number}>} bases
 * @returns {string}
 */
function joinBases(bases) {
  if (bases.length === 0) return '';
  if (bases.length === 1) return formatEntry(bases[0]);
  if (bases.length === 2) {
    return `${formatEntry(bases[0])} and ${formatEntry(bases[1])}`;
  }
  const allButLast = bases.slice(0, -1).map(formatEntry).join(', ');
  const last = formatEntry(bases[bases.length - 1]);
  return `${allButLast}, and ${last}`;
}

/**
 * Format the user-facing banner message for a multi-ref-base upload.
 *
 * @param {Array<{base: string, count: number}>} bases  — ordered by descending count
 * @returns {string}
 */
export function formatMultiBaseMessage(bases) {
  const list = joinBases(bases);
  return (
    `Multiple root references detected: ${list}. ` +
    `Remove one group and try again. ` +
    `Until then Wholesale Lending Analytics and Summary for Credit Committee export will remain unavailable as they are designed for group exposure basis.`
  );
}
