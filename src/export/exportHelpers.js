// Shared export helpers for Retail and Wholesale Lending Analytics exporters.
//
// This module re-exports the core primitives from the retail exporter's
// helpers so the wholesale exporter can import from one stable location
// without duplicating logic. See src/export/retailExport/helpers.js for
// the canonical implementations.
//
// Per spec §12 Q5: every BDT amount divides by 1,000,000, rounds to 2 dp,
// and the sheet header carries "(Amount in BDT Million)".

import {
  toMillions as _toMillions,
  yesNo as _yesNo,
  worstOf as _worstOf,
  parseInquiryDate as _parseInquiryDate,
  daysBetween as _daysBetween,
} from './retailExport/helpers.js';

export {
  _toMillions as toMillions,
  _yesNo as yesNo,
  _worstOf as worstOf,
  _parseInquiryDate as parseInquiryDate,
  _daysBetween as daysBetween,
};

/**
 * Format a date string or Date object as "DD/MM/YYYY".
 * Returns empty string for null / unparseable input.
 * @param {string|Date|null|undefined} d
 * @returns {string}
 */
export function formatDate(d) {
  if (!d) return '';
  let dateObj = d instanceof Date ? d : null;
  if (!dateObj) {
    // Try ISO or "DD/MM/YYYY" patterns
    const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      dateObj = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    } else {
      const dmy = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dmy) {
        dateObj = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
      }
    }
  }
  if (!dateObj || Number.isNaN(dateObj.getTime())) return '';
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const year = dateObj.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a BDT amount in millions, displaying "-" for zero values.
 * Per docx sample convention — zero → "-", non-zero → 2dp number.
 * @param {number|null|undefined} n  raw BDT value
 * @returns {number|string}
 */
export function fmtM(n) {
  const m = _toMillions(n);
  return m === 0 ? '-' : m;
}

/**
 * Classify the current classification as "Classified" (SS/DF/BL/BLW)
 * or not. Used by both print tables and Sheet 3/4.
 * @param {string} classification
 * @returns {boolean}
 */
export function isClassified(classification) {
  return ['SS', 'DF', 'BL', 'BLW'].includes(classification);
}

/**
 * Excel disallows : \ / ? * [ ] and caps sheet names at 31 chars.
 * @param {string} name
 * @returns {string}
 */
export function sanitizeSheetName(name) {
  return String(name).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
}

// Re-export the amount caption constant so all sheets are consistent.
export const AMOUNT_CAPTION = '(Amount in BDT Million)';
