// Wholesale Sheet 1 — "1. Sister Concerns_Linked CIB"
//
// PDF manifest. One row per loaded report, 4 columns:
//   CIB Subject Code | Ref No. (filename) | Individual/Company | Trade Name/Title, Name
//
// Pure extraction — all fields are already parsed.

/**
 * Build the sister concerns manifest rows.
 * @param {Array} reports - all loaded reports (including applying concern)
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildSisterConcernsRows(reports) {
  const header = [
    'CIB Subject Code',
    'Ref No. (filename)',
    'Individual/Company',
    'Trade Name/Title, Name',
  ];

  const dataRows = reports.map(report => {
    const subj = report.subject || {};
    return [
      subj.cibSubjectCode || '',
      report.fileName || report.reportNo || '',
      subj.subjectType || '',
      subj.tradeName || subj.displayName || subj.name || '',
    ];
  });

  return [header, ...dataRows];
}
