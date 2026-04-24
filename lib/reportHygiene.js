export const PRINT_PAYLOAD_KEY = 'cibxray.printPayload';

export function stripRawText(input) {
  if (Array.isArray(input)) {
    return input.map(stripRawText);
  }
  if (input && typeof input === 'object') {
    const copy = { ...input };
    if (Array.isArray(copy.facilities)) {
      copy.facilities = copy.facilities.map((f) => {
        const { rawText, ...rest } = f;
        return rest;
      });
    }
    return copy;
  }
  return input;
}

/**
 * Aggressive shrinker for the print-payload path. Drops `rawText` AND
 * per-facility `history[]` — the print view uses pre-computed score aggregates
 * and facility-level fields (classification, role, type, dates, outstanding,
 * overdue) but never per-month history rows. A heavy corporate CIB can push
 * the localStorage payload past the ~5MB per-origin quota without this trim.
 *
 * @param {object|Array} input report or reports array
 * @returns {object|Array}
 */
export function stripForPrint(input) {
  if (Array.isArray(input)) {
    return input.map(stripForPrint);
  }
  if (input && typeof input === 'object') {
    const copy = { ...input };
    if (Array.isArray(copy.facilities)) {
      copy.facilities = copy.facilities.map((f) => {
        const { rawText, history, ...rest } = f;
        return rest;
      });
    }
    return copy;
  }
  return input;
}

export function clearPrintPayload(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(PRINT_PAYLOAD_KEY);
}
