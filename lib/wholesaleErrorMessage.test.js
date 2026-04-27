/**
 * Tests for the multi-base error message formatter.
 * TDD: tests written first (RED) before the implementation exists.
 * Pattern: node:test + node:assert/strict, AAA structure.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMultiBaseMessage } from '../src/utils/wholesaleErrorMessage.js';

const PREFIX = 'Multiple root references detected: ';
const SUFFIX = '. Remove one group and try again. Until then Wholesale Lending Analytics and Summary for Credit Committee export will remain unavailable as they are designed for group exposure basis.';

// ── 2-base case ─────────────────────────────────────────────────────────────

test('formatMultiBaseMessage: 2 bases joined with "and", no Oxford comma', () => {
  // Arrange
  const bases = [
    { base: '1011500041801', count: 5 },
    { base: '2099887766554', count: 1 },
  ];
  // Act
  const result = formatMultiBaseMessage(bases);
  // Assert
  const expected =
    PREFIX +
    '1011500041801 (5 files) and 2099887766554 (1 file)' +
    SUFFIX;
  assert.equal(result, expected);
});

// ── singular "file" vs plural "files" ────────────────────────────────────────

test('formatMultiBaseMessage: count of 1 uses singular "file"', () => {
  // Arrange
  const bases = [
    { base: 'AAA', count: 1 },
    { base: 'BBB', count: 3 },
  ];
  // Act
  const result = formatMultiBaseMessage(bases);
  // Assert
  assert.ok(result.includes('AAA (1 file)'), 'should use singular for count=1');
  assert.ok(result.includes('BBB (3 files)'), 'should use plural for count>1');
});

// ── 3-base case with Oxford comma ────────────────────────────────────────────

test('formatMultiBaseMessage: 3 bases use Oxford comma before last', () => {
  // Arrange
  const bases = [
    { base: 'X111', count: 4 },
    { base: 'Y222', count: 2 },
    { base: 'Z333', count: 1 },
  ];
  // Act
  const result = formatMultiBaseMessage(bases);
  // Assert
  const expected =
    PREFIX +
    'X111 (4 files), Y222 (2 files), and Z333 (1 file)' +
    SUFFIX;
  assert.equal(result, expected);
});

// ── all-plural counts ─────────────────────────────────────────────────────────

test('formatMultiBaseMessage: all counts > 1 all use plural "files"', () => {
  // Arrange
  const bases = [
    { base: 'BASE1', count: 6 },
    { base: 'BASE2', count: 2 },
  ];
  // Act
  const result = formatMultiBaseMessage(bases);
  // Assert
  assert.ok(result.includes('BASE1 (6 files)'), 'should use plural for 6');
  assert.ok(result.includes('BASE2 (2 files)'), 'should use plural for 2');
});

// ── defensive: empty / single-base input ─────────────────────────────────────

test('formatMultiBaseMessage: single-base input still returns a sensible string', () => {
  // Arrange
  const bases = [{ base: 'ONLY1', count: 3 }];
  // Act
  const result = formatMultiBaseMessage(bases);
  // Assert — must be a non-empty string and contain the base
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.ok(result.includes('ONLY1'));
});
