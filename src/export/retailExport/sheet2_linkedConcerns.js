// Sheet 2 — "Linked Concerns & Institute" builder.
//
// One row per linked proprietorship / sister concern from the single PDF's
// linkedProprietorships list. 22 columns per source template.
//
// Retail-context caveat: the parser surfaces only metadata (cibCode + tradeName)
// for linked concerns — per-facility rollups (Worst Status, Highest NPI, Ref
// No. for Highest NPI, Page No. of Highest NPI) aren't available without
// loading the sister concern's own CIB PDF. These columns are emitted blank
// and flagged as Phase 3.1 follow-up (wholesale exporter will populate them).

const HEADERS = [
  'Sl',
  'Concern Name',
  'CIB Subject Code',
  'Designation',
  'Share (%)',
  'Status',
  'Total Limit',
  'Total Outstanding',
  'Total Overdue',
  'No. of Live Contracts',
  'No. of Terminated Contracts',
  'Worst Status',
  'Highest NPI',
  'Ref No. for Highest NPI',
  'Page No. of Highest NPI',
  'Remarks',
  'Col 17',
  'Col 18',
  'Col 19',
  'Col 20',
  'Col 21',
  'Col 22',
];

/**
 * Build Sheet 2 rows.
 * @param {{ linkedProprietorships?: Array }} report
 * @returns {Array<Array>}
 */
export function buildLinkedConcernsRows(report) {
  const linked = report.linkedProprietorships || [];
  const dataRows = linked.map((p, i) => {
    const row = new Array(22).fill('');
    row[0] = i + 1;
    row[1] = p.tradeName || '';
    row[2] = p.cibCode || '';
    return row;
  });
  return [HEADERS, ...dataRows];
}
