// Wholesale Sheet 2 — "2. Directors Profile"
//
// Director cross-reference across the group.
// One row per (company, director) pair, 7 columns:
//   CIB Subject Code (Company) | Ref No. | Individual/Company |
//   Trade Name (company) | CIB Subject Code (Individual) |
//   Director's Name | Role In the Company
//
// Individual-subject reports don't contribute rows here — only
// COMPANY-type reports emit director rows.

/**
 * Build the directors profile rows.
 * @param {Array} reports - all loaded reports
 * @returns {Array<Array>} rows (header + data rows)
 */
export function buildDirectorsProfileRows(reports) {
  const header = [
    'CIB Subject Code (Company)',
    'Ref No.',
    'Individual/Company',
    'Trade Name (Company)',
    'CIB Subject Code (Individual)',
    "Director's Name",
    'Role In the Company',
  ];

  const dataRows = [];

  for (const report of reports) {
    const subj = report.subject || {};
    // Individual-subject reports don't emit director rows
    if (subj.subjectType === 'INDIVIDUAL') continue;

    const directors = report.directors || [];
    for (const dir of directors) {
      dataRows.push([
        subj.cibSubjectCode || '',
        report.fileName || report.reportNo || '',
        subj.subjectType || '',
        subj.tradeName || subj.displayName || subj.name || '',
        dir.cibCode || dir.cibSubjectCode || '',
        dir.name || '',
        dir.role || '',
      ]);
    }
  }

  return [header, ...dataRows];
}
