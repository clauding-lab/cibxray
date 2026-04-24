// Committee Summary .docx export — a one-page Word document for the
// Credit Committee meeting, summarizing an applying concern's liability
// and the group-wide liability (companies only) in the same 6-row /
// 5-column pivot layout used by the print summary tables.
//
// Filename: CIBxRay_CommitteeSummary_<applyingConcern>_<YYYY-MM-DD>.docx

import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Packer,
} from 'docx';

import {
  splitLongShortTerm,
  detectApplyingConcern,
  filterCompaniesOnly,
} from '../analytics/devreq2Analytics.js';

const CLASSIFIED_STATUSES = new Set(['SS', 'DF', 'BL', 'BLW']);

// ── Pure data builders ─────────────────────────────────────────────────

/**
 * Convert raw BDT to "Million BDT, 2dp" rendered as the `-` dash for zero.
 * (Matches the print-table convention — zero is visually empty, non-zero is a
 * 2-decimal number without any suffix since the caption already says "Million".)
 * @param {number} n
 * @returns {string}
 */
export function fmtMillionOrDash(n) {
  if (!n || !Number.isFinite(n) || n === 0) return '-';
  return (Math.round((n / 1_000_000) * 100) / 100).toFixed(2);
}

/**
 * Sum outstanding where classification is a classified adverse status.
 * @param {Array} facs
 */
function sumClassified(facs) {
  return facs
    .filter(f => CLASSIFIED_STATUSES.has(f.classification))
    .reduce((s, f) => s + (f.outstanding || 0), 0);
}

/**
 * Sum outstanding where classification is SMA.
 * @param {Array} facs
 */
function sumSma(facs) {
  return facs
    .filter(f => f.classification === 'SMA')
    .reduce((s, f) => s + (f.outstanding || 0), 0);
}

function sumField(facs, field) {
  return facs.reduce((s, f) => s + (f[field] || 0), 0);
}

/**
 * Build the 5-row data pivot for a list of facilities. Row 6 (Remarks)
 * is rendered by the docx table itself as an empty cell spanning all
 * amount columns.
 * @param {Array} facilities
 * @returns {{label: string, values: string[]}[]} 5 rows of {label, [Outstanding, Overdue, SMA, Classified]}
 */
export function buildSummaryRows(facilities) {
  const { longTerm, shortTermFunded, shortTermNonFunded } = splitLongShortTerm(facilities || []);
  const stTotal = [...shortTermFunded, ...shortTermNonFunded];
  const grandTotal = [...longTerm, ...shortTermFunded, ...shortTermNonFunded];
  const rowFor = (label, facs) => ({
    label,
    values: [
      fmtMillionOrDash(sumField(facs, 'outstanding')),
      fmtMillionOrDash(sumField(facs, 'overdue')),
      fmtMillionOrDash(sumSma(facs)),
      fmtMillionOrDash(sumClassified(facs)),
    ],
  });
  return [
    rowFor('Long term', longTerm),
    rowFor('Short term funded', shortTermFunded),
    rowFor('Short term Non-funded', shortTermNonFunded),
    rowFor('Total (short term)', stTotal),
    rowFor('Total (short term + long term)', grandTotal),
  ];
}

// ── Header meta ────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Parse cibxray's inquiry date string ("DD-Mon-YYYY HH:MM:SS AM/PM") into
 * "Month DD, YYYY" like "March 01, 2026". Returns the original string on
 * failure so the report always has a value.
 * @param {string} inquiryDate
 */
export function formatInquiryDate(inquiryDate) {
  if (!inquiryDate) return '';
  const m = inquiryDate.match(/^(\d{1,2})[-\s]([A-Za-z]{3,})[-\s](\d{4})/);
  if (!m) return inquiryDate;
  const day = m[1].padStart(2, '0');
  const monthName = m[2];
  const year = m[3];
  // Look up by full name match (case-insensitive, prefix match handles "Mar" / "March")
  const monthIdx = MONTHS.findIndex(full => full.toLowerCase().startsWith(monthName.toLowerCase()));
  return monthIdx >= 0 ? `${MONTHS[monthIdx]} ${day}, ${year}` : inquiryDate;
}

/**
 * Compute the overall CIB Status for the applying concern. Walks its
 * facilities and returns the worst current classification. "Unclassified"
 * if all STD or the concern has no facilities.
 * @param {Array} facilities
 */
export function computeCibStatus(facilities) {
  const order = { BLW: 6, BL: 5, DF: 4, SS: 3, SMA: 2, STD: 1 };
  let worst = 'STD';
  for (const f of facilities || []) {
    const c = f.classification || 'STD';
    if ((order[c] || 0) > (order[worst] || 0)) worst = c;
  }
  return worst === 'STD' ? 'Unclassified' : worst;
}

/**
 * Parse the numeric base + hyphen-suffix from a CIB filename. Bare base
 * returns suffix 0; "-N" suffix returns N. Matches the detectApplyingConcern
 * filename parser.
 * @param {string} fileName
 * @returns {{base: string|null, suffix: number}}
 */
function parseRefFromFilename(fileName) {
  if (!fileName) return { base: null, suffix: 0 };
  const m = String(fileName).replace(/\.pdf$/i, '').match(/^(\d+)(?:-(\d+))?/);
  if (!m) return { base: null, suffix: 0 };
  return { base: m[1], suffix: m[2] ? Number(m[2]) : 0 };
}

/**
 * Compute the CIB Ref No string for the committee header. For a group of
 * reports sharing ref-base 1011500041801 with suffixes 0..24, returns
 * "1011500041801 (0-24)". For a single report with no suffix, returns just
 * the base.
 * @param {Array} reports
 */
export function computeRefNoDisplay(reports) {
  const parsed = (reports || []).map(r => parseRefFromFilename(r.fileName));
  const withBase = parsed.filter(p => p.base != null);
  if (withBase.length === 0) return '';
  const base = withBase[0].base;
  const suffixes = withBase.filter(p => p.base === base).map(p => p.suffix);
  const min = Math.min(...suffixes);
  const max = Math.max(...suffixes);
  if (min === max) return `${base}${min > 0 ? `-${min}` : ''}`;
  return `${base} (${min}-${max})`;
}

/**
 * Header meta shared by the docx and by any tests that want to assert
 * the values independently.
 * @param {Array} reports
 */
export function buildHeaderMeta(reports) {
  const { applyingConcern } = detectApplyingConcern(reports || []);
  const cibStatus = computeCibStatus(applyingConcern?.facilities || []);
  const inquiryDate = formatInquiryDate(applyingConcern?.inquiryDate || '');
  const concernName = applyingConcern?.subject?.displayName || '';
  const refNo = computeRefNoDisplay(reports || []);
  return { cibStatus, inquiryDate, concernName, refNo, applyingConcern };
}

// ── docx assembly ──────────────────────────────────────────────────────

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
};

function cellText(text, { bold = false, align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    borders: ALL_BORDERS,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text), bold })],
    })],
  });
}

function buildTable(rows, { boldLabels = [] } = {}) {
  const headerRow = new TableRow({
    children: [
      cellText('Particular', { bold: true, align: AlignmentType.CENTER }),
      cellText('Outstanding', { bold: true, align: AlignmentType.CENTER }),
      cellText('Overdue', { bold: true, align: AlignmentType.CENTER }),
      cellText('SMA', { bold: true, align: AlignmentType.CENTER }),
      cellText('Classified', { bold: true, align: AlignmentType.CENTER }),
    ],
  });

  const dataRows = rows.map(({ label, values }) => {
    const isBold = boldLabels.includes(label);
    return new TableRow({
      children: [
        cellText(label, { bold: isBold }),
        ...values.map(v => cellText(v, { align: AlignmentType.RIGHT, bold: isBold })),
      ],
    });
  });

  const remarksRow = new TableRow({
    children: [
      cellText('Remarks'),
      new TableCell({
        borders: ALL_BORDERS,
        columnSpan: 4,
        children: [new Paragraph({ children: [new TextRun('')] })],
      }),
    ],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows, remarksRow],
  });
}

function sectionHeading(label) {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: '\t\t' }),
      new TextRun({ text: '(Amount in Million BDT)', italics: true }),
    ],
  });
}

/**
 * Build the Document instance for the Committee Summary. Pure — no IO.
 * @param {Array} reports
 * @returns {Document}
 */
export function buildCommitteeSummaryDoc(reports) {
  const meta = buildHeaderMeta(reports);
  const applyingRows = buildSummaryRows(meta.applyingConcern?.facilities || []);
  const groupFacilities = filterCompaniesOnly(reports || []).flatMap(r => r.facilities || []);
  const groupRows = buildSummaryRows(groupFacilities);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: 22 } },
      },
    },
    sections: [{
      children: [
        new Paragraph({ children: [new TextRun({ text: `CIB Status: ${meta.cibStatus}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `CIB collected on ${meta.inquiryDate}`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `Applying Concern: ${meta.concernName}.`, bold: true })] }),
        new Paragraph({ children: [new TextRun({ text: `CIB Ref. No.: ${meta.refNo},`, bold: true })] }),
        new Paragraph({ children: [new TextRun('')] }),
        sectionHeading('For applying concern:'),
        buildTable(applyingRows, { boldLabels: ['Long term', 'Total (short term)', 'Total (short term + long term)'] }),
        sectionHeading('For Group:'),
        buildTable(groupRows, { boldLabels: ['Total (short term)', 'Total (short term + long term)'] }),
      ],
    }],
  });

  return doc;
}

// ── Browser entry ──────────────────────────────────────────────────────

function sanitizeFileName(s) {
  return String(s || 'applying-concern').replace(/[\\/:*?"<>|]+/g, '_').trim();
}

/**
 * Generate and trigger a download of the committee-summary .docx.
 * Filename: CIBxRay_CommitteeSummary_<concern>_<YYYY-MM-DD>.docx
 * @param {Array} reports
 */
export async function doCommitteeSummaryExport(reports) {
  const meta = buildHeaderMeta(reports);
  const doc = buildCommitteeSummaryDoc(reports);
  const blob = await Packer.toBlob(doc);
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `CIBxRay_CommitteeSummary_${sanitizeFileName(meta.concernName)}_${today}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
