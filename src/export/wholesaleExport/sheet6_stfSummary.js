// Wholesale Sheet 6 — "6. Short Term Funded_Summary"
//
// Per-STF-loan detail across all reports. 18 columns:
//   CIB Subject Code | Ref No. | Individual/Company |
//   CIB Contract Code | Facility | Page Number | Role | Status |
//   Sanction Limit (BDT Million) | Outstanding (BDT Million) |
//   UC/STD | SMA | SS | DF | BL | BLW |  (amounts by classification bucket)
//   % of Concern STF | No. of Rescheduling Instances
//
// Classification split: the facility's outstanding fills the matching bucket;
// all other buckets are 0 / "-".
// % of Concern STF = facility.outstanding / sum(STF outstanding for this report).

import {
  classifyTenure,
  classifyFundedNature,
  computePercentOfConcernSTF,
} from '../../analytics/devreq2Analytics.js';
import { fmtM, toMillions } from '../exportHelpers.js';

/**
 * Build the STF summary detail rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildStfSummaryRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No.',
    'Individual/Company',
    'CIB Contract Code',
    'Facility',
    'Page Number',
    'Role',
    'Status',
    'Sanction Limit (BDT Million)',
    'Outstanding (BDT Million)',
    'UC/STD (BDT Million)',
    'SMA (BDT Million)',
    'SS (BDT Million)',
    'DF (BDT Million)',
    'BL (BDT Million)',
    'BLW (BDT Million)',
    '% of Concern STF',
    'No. of Rescheduling Instances',
  ];

  const CLASSIFICATION_COLS = {
    UC: 10, STD: 10, SMA: 11, SS: 12, DF: 13, BL: 14, BLW: 15,
  };

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    const stfFacilities = (report.facilities || []).filter(
      f =>
        classifyTenure(f) === 'short-term' &&
        classifyFundedNature(f) === 'funded'
    );

    for (const f of stfFacilities) {
      const pct = computePercentOfConcernSTF(f, report);
      const cls = f.classification || 'STD';
      const out = f.outstanding || 0;

      // Build classification bucket amounts (one bucket filled, rest "-")
      const buckets = ['-', '-', '-', '-', '-', '-']; // UC/STD, SMA, SS, DF, BL, BLW
      const colIdx = CLASSIFICATION_COLS[cls];
      if (colIdx !== undefined) {
        const bucketIndex = colIdx - 10; // offset 0 = UC/STD
        buckets[bucketIndex] = toMillions(out) || '-';
      }

      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        f.contractCode || '',
        f.type || '',
        f.pageNo || '',
        f.role || '',
        f.status || '',
        fmtM(f.limit),
        fmtM(f.outstanding),
        buckets[0], // UC/STD
        buckets[1], // SMA
        buckets[2], // SS
        buckets[3], // DF
        buckets[4], // BL
        buckets[5], // BLW
        Math.round(pct * 100) / 100, // % rounded to 2dp
        f.rescheduledCount || 0,
      ]);
    }
  }

  return [header, ...dataRows];
}
