// LoanSummaryTable — generic 5-row × 5-column pivot table used in the
// print-report overhaul (spec §6, resolved §12 Q4).
//
// Rows (fixed per spec):
//   Long term | Short term funded | Short term non-funded |
//   Total (short term) | Total (short term + long term)
//
// Columns:
//   Particular | Outstanding | Overdue | SMA | Classified
//
// Amounts: BDT millions, 2 decimals. Zero → "-" per docx sample.
// No Remarks row (spec §12 Q4 resolved 2026-04-24).

import { splitLongShortTerm } from '../../analytics/devreq2Analytics.js';

const CLASSIFIED_STATUSES = new Set(['SS', 'DF', 'BL', 'BLW']);

/**
 * Convert a raw BDT amount to millions, 2dp. Returns "-" for zero.
 * @param {number} n
 * @returns {string}
 */
function fmt(n) {
  if (!n || !Number.isFinite(n) || n === 0) return '-';
  return (Math.round((n / 1_000_000) * 100) / 100).toFixed(2);
}

/**
 * Sum a field across a list of facilities.
 * @param {Array} facilities
 * @param {string} field
 * @returns {number}
 */
function sumField(facilities, field) {
  return facilities.reduce((s, f) => s + (f[field] || 0), 0);
}

/**
 * Sum classified (SS/DF/BL/BLW) outstanding across a list of facilities.
 */
function sumClassified(facilities) {
  return facilities
    .filter(f => CLASSIFIED_STATUSES.has(f.classification))
    .reduce((s, f) => s + (f.outstanding || 0), 0);
}

/**
 * Sum SMA outstanding across a list of facilities.
 */
function sumSma(facilities) {
  return facilities
    .filter(f => f.classification === 'SMA')
    .reduce((s, f) => s + (f.outstanding || 0), 0);
}

// Inline styles — simple, print-safe, matches the existing print report style
const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  marginBottom: 8,
};

const thStyle = {
  background: '#0f172a',
  color: '#f8fafc',
  padding: '5px 8px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 10,
  border: '1px solid #334155',
};

const tdStyle = {
  padding: '4px 8px',
  border: '1px solid #e2e8f0',
  fontSize: 11,
  color: '#0f172a',
};

const tdNumStyle = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'monospace',
};

/**
 * LoanSummaryTable renders the 5-row amount pivot.
 *
 * @param {{ facilities: Array, caption?: string, captionStyle?: object }} props
 */
export default function LoanSummaryTable({ facilities = [], caption, captionStyle }) {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm(facilities);

  const stTotal = [...shortTermFunded, ...shortTermNonFunded];
  const grandTotal = [...longTerm, ...shortTermFunded, ...shortTermNonFunded];

  const rows = [
    { label: 'Long term', facs: longTerm },
    { label: 'Short term funded', facs: shortTermFunded },
    { label: 'Short term non-funded', facs: shortTermNonFunded },
    { label: 'Total (short term)', facs: stTotal },
    { label: 'Total (short term + long term)', facs: grandTotal },
  ];

  return (
    <div>
      {caption && (
        <div style={{ fontSize: 10, color: '#475569', marginBottom: 4, fontStyle: 'italic', ...captionStyle }}>
          {caption}
        </div>
      )}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Particular</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Outstanding</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Overdue</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>SMA</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Classified</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, facs }, i) => (
            <tr key={label} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
              <td style={tdStyle}>{label}</td>
              <td style={tdNumStyle}>{fmt(sumField(facs, 'outstanding'))}</td>
              <td style={tdNumStyle}>{fmt(sumField(facs, 'overdue'))}</td>
              <td style={tdNumStyle}>{fmt(sumSma(facs))}</td>
              <td style={tdNumStyle}>{fmt(sumClassified(facs))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: '#94a3b8', marginBottom: 4 }}>
        Amount in BDT Million
      </div>
    </div>
  );
}
