export const PRINT_PAYLOAD_KEY = 'cibxray.printPayload';

export function stripRawText(input) {
  if (Array.isArray(input)) {
    return input.map(stripRawText);
  }
  if (input && typeof input === 'object') {
    // Drop top-level rawText (full PDF text set by parseBBCIB) as well as
    // per-facility rawText. Both can run to hundreds of KB on large CIBs.
    const { rawText: _topRaw, ...copy } = input;
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
    // Drop top-level rawText (full PDF text set by parseBBCIB) and
    // per-facility rawText + history. All three can run to hundreds of KB.
    const { rawText: _topRaw, ...copy } = input;
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

/**
 * Ultra-minimal projection of a reports[] list for the print Group summary
 * table. The group table only aggregates across facilities (no per-report
 * rendering), and only reads `subject.subjectType` (via filterCompaniesOnly)
 * plus facility-level {role, type, startDate, endDate, outstanding, overdue,
 * classification}. Everything else on a report is unused in print.
 *
 * At 50+ reports, even stripForPrint() output can exceed localStorage's ~5MB
 * per-origin quota. This projection typically reduces payload by 10-20x.
 *
 * @param {Array} reports
 * @returns {Array} minimal reports list
 */
export function stripForPrintGroup(reports) {
  if (!Array.isArray(reports)) return [];
  return reports.map((r) => ({
    subject: { subjectType: r?.subject?.subjectType },
    facilities: (r?.facilities || []).map((f) => ({
      role: f.role,
      type: f.type,
      startDate: f.startDate,
      endDate: f.endDate,
      outstanding: f.outstanding,
      overdue: f.overdue,
      classification: f.classification,
    })),
  }));
}

export function clearPrintPayload(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(PRINT_PAYLOAD_KEY);
}
