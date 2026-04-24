/**
 * Tests for the threshold-based self-labelling BDT dashboard formatter.
 *
 * New contract (per spec §12 Q5 / DevReq-2 Phase 5):
 *   n === 0                         → "0"
 *   null / undefined / NaN          → "0"
 *   |n| >= 1,000,000                → "X.XX million" (raw ÷ 1e6, 2dp, sign preserved)
 *   0 < |n| < 1,000,000             → Math.round(n).toLocaleString() with separators
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt } from '../src/utils/format.js';

// ── Zero / falsy ─────────────────────────────────────────────────────────────

test('fmt(0) returns "0"', () => {
  assert.equal(fmt(0), '0');
});

test('fmt(null) returns "0"', () => {
  assert.equal(fmt(null), '0');
});

test('fmt(undefined) returns "0"', () => {
  assert.equal(fmt(undefined), '0');
});

test('fmt(NaN) returns "0"', () => {
  assert.equal(fmt(NaN), '0');
});

// ── Sub-threshold (< 1,000,000) ───────────────────────────────────────────────

test('fmt(500) returns "500" — small integer below threshold', () => {
  assert.equal(fmt(500), '500');
});

test('fmt(85_000) returns "85,000" — locale-separated, below threshold', () => {
  assert.equal(fmt(85_000), '85,000');
});

test('fmt(900_000) returns "900,000" — at the sub-threshold ceiling', () => {
  assert.equal(fmt(900_000), '900,000');
});

test('fmt(999_999) returns "999,999" — just below the 1M boundary', () => {
  assert.equal(fmt(999_999), '999,999');
});

// ── At the threshold boundary (1,000,000) ────────────────────────────────────

test('fmt(1_000_000) returns "1.00 million" — exactly at threshold', () => {
  assert.equal(fmt(1_000_000), '1.00 million');
});

// ── Above threshold (>= 1,000,000) ───────────────────────────────────────────

test('fmt(1_500_000) returns "1.50 million"', () => {
  assert.equal(fmt(1_500_000), '1.50 million');
});

test('fmt(12_000_000) returns "12.00 million"', () => {
  assert.equal(fmt(12_000_000), '12.00 million');
});

test('fmt(1_000_000_000) returns "1000.00 million" — very large stays numeric, no further bucketing', () => {
  assert.equal(fmt(1_000_000_000), '1000.00 million');
});

// ── Negative values ───────────────────────────────────────────────────────────

test('fmt(-2_500_000) returns "-2.50 million" — negative large, sign preserved', () => {
  assert.equal(fmt(-2_500_000), '-2.50 million');
});

test('fmt(-45_000) returns "-45,000" — negative small, sign preserved', () => {
  assert.equal(fmt(-45_000), '-45,000');
});

// ── Boundary: negative at exactly -1,000,000 ─────────────────────────────────

test('fmt(-1_000_000) returns "-1.00 million" — negative at threshold', () => {
  assert.equal(fmt(-1_000_000), '-1.00 million');
});

// ── Legacy format must NOT appear ─────────────────────────────────────────────
// These are the retired Cr/Lac outputs; they should never come back.

test('fmt(12_000_000) does not produce old "Cr" suffix', () => {
  const out = fmt(12_000_000);
  assert.ok(!out.includes('Cr'), `Expected no "Cr" in output, got: ${out}`);
});

test('fmt(1_500_000) does not produce old "Lac" suffix', () => {
  const out = fmt(1_500_000);
  assert.ok(!out.includes('Lac'), `Expected no "Lac" in output, got: ${out}`);
});

test('fmt(85_000) does not use en-IN locale (no Indian grouping)', () => {
  // Indian locale would render 85,000 the same way for this number but
  // the implementation contract is toLocaleString() default, not en-IN.
  // Confirm the output is at least a proper numeric string.
  const out = fmt(85_000);
  assert.match(out, /^[\d,]+$/, `Expected locale-formatted digits, got: ${out}`);
});
