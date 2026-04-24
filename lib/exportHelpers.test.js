/**
 * Tests for src/export/exportHelpers.js
 * Verifies both re-exported primitives and the new formatDate / fmtM / isClassified helpers.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMillions,
  yesNo,
  worstOf,
  formatDate,
  fmtM,
  isClassified,
  sanitizeSheetName,
  AMOUNT_CAPTION,
} from '../src/export/exportHelpers.js';

// ── Re-exported primitives (smoke checks only — full tests in retailExport_helpers.test.js) ──

test('toMillions is re-exported and works', () => {
  assert.equal(toMillions(1_000_000), 1);
  assert.equal(toMillions(null), 0);
});

test('yesNo is re-exported and works', () => {
  assert.equal(yesNo(true), 'Yes');
  assert.equal(yesNo(false), 'No');
});

test('worstOf is re-exported and works', () => {
  assert.equal(worstOf('STD', 'BLW'), 'BLW');
});

// ── formatDate ────────────────────────────────────────────────────────────────

test('formatDate parses ISO "YYYY-MM-DD"', () => {
  assert.equal(formatDate('2026-04-24'), '24/04/2026');
});

test('formatDate parses "DD/MM/YYYY"', () => {
  assert.equal(formatDate('01/01/2022'), '01/01/2022');
});

test('formatDate passes through Date objects', () => {
  const d = new Date(Date.UTC(2026, 3, 24)); // April 24
  assert.equal(formatDate(d), '24/04/2026');
});

test('formatDate returns empty string for null/undefined', () => {
  assert.equal(formatDate(null), '');
  assert.equal(formatDate(undefined), '');
  assert.equal(formatDate(''), '');
});

test('formatDate returns empty string for unparseable strings', () => {
  assert.equal(formatDate('garbage'), '');
});

// ── fmtM ──────────────────────────────────────────────────────────────────────

test('fmtM returns "-" for zero values', () => {
  assert.equal(fmtM(0), '-');
  assert.equal(fmtM(null), '-');
  assert.equal(fmtM(undefined), '-');
});

test('fmtM returns 2dp number for non-zero', () => {
  assert.equal(fmtM(5_000_000), 5);
  assert.equal(fmtM(1_234_567), 1.23);
  assert.equal(fmtM(-2_000_000), -2);
});

// ── isClassified ──────────────────────────────────────────────────────────────

test('isClassified returns true for SS, DF, BL, BLW', () => {
  assert.equal(isClassified('SS'), true);
  assert.equal(isClassified('DF'), true);
  assert.equal(isClassified('BL'), true);
  assert.equal(isClassified('BLW'), true);
});

test('isClassified returns false for STD, SMA, unknown', () => {
  assert.equal(isClassified('STD'), false);
  assert.equal(isClassified('SMA'), false);
  assert.equal(isClassified('UC'), false);
  assert.equal(isClassified(''), false);
});

// ── sanitizeSheetName ────────────────────────────────────────────────────────

test('sanitizeSheetName removes illegal Excel chars', () => {
  assert.equal(sanitizeSheetName('Sheet: 1'), 'Sheet_ 1');
  assert.equal(sanitizeSheetName('A/B?C*D'), 'A_B_C_D');
});

test('sanitizeSheetName truncates at 31 chars', () => {
  const long = 'A'.repeat(40);
  assert.equal(sanitizeSheetName(long).length, 31);
});

// ── AMOUNT_CAPTION ─────────────────────────────────────────────────────────────

test('AMOUNT_CAPTION is the standard string', () => {
  assert.equal(AMOUNT_CAPTION, '(Amount in BDT Million)');
});
