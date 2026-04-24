// Sheet 6 — "Details of non-funded" builder for the Retail Lending Analytics exporter.
//
// One row per non-funded product type. Columns (spec §4 Sheet 6):
//   Type of financing | No. of live contract | Amount of live contract (M) |
//   Status | No. of expired contract
//
// Non-funded = LC / Guarantee / Other Indirect (per classifyFundedNature).
// Pure builder: takes a report, returns plain arrays. No mutation.

import { classifyFundedNature } from '../../analytics/devreq2Analytics.js';
import { toMillions } from './helpers.js';

const HEADERS = [
  'Type of financing',
  'No. of live contract',
  'Amount of live contract',
  'Status',
  'No. of expired contract',
];

function statusLabel(liveCount, terminatedCount) {
  if (liveCount > 0 && terminatedCount > 0) return 'Mixed';
  if (liveCount > 0) return 'Live';
  if (terminatedCount > 0) return 'Expired';
  return '-';
}

/**
 * Build Sheet 6 rows.
 * Groups non-funded facilities by type (case-insensitive, first-seen label wins).
 * Returns header row + one row per distinct type.
 * @param {{ facilities: Array }} report
 * @returns {Array<Array>}
 */
export function buildNonFundedDetailsRows(report) {
  const facilities = report.facilities || [];
  const groups = new Map(); // key: normalized type, value: { label, liveCount, liveAmount, terminatedCount }

  for (const f of facilities) {
    if (classifyFundedNature(f) !== 'non-funded') continue;
    const label = String(f.type || '').trim() || 'Unknown';
    const key = label.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { label, liveCount: 0, liveAmount: 0, terminatedCount: 0 });
    }
    const g = groups.get(key);
    if (f.status === 'Live') {
      g.liveCount += 1;
      g.liveAmount += f.outstanding || 0;
    } else if (f.status === 'Terminated') {
      g.terminatedCount += 1;
    }
  }

  const dataRows = [];
  for (const g of groups.values()) {
    dataRows.push([
      g.label,
      g.liveCount,
      toMillions(g.liveAmount),
      statusLabel(g.liveCount, g.terminatedCount),
      g.terminatedCount,
    ]);
  }
  return [HEADERS, ...dataRows];
}
