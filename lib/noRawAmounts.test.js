/**
 * Regression guardrail: fail the build if retired BDT formatting patterns
 * re-enter the src/components tree.
 *
 * Checks (per DevReq-2 Phase 5 spec §3c):
 *   1. No `.toLocaleString("en-IN"` — retired Indian-numbering locale
 *   2. No `"Cr"` or `"Lac"` string literals — old Crore/Lakh suffixes
 *   3. No raw `.toFixed(2)` on variables named outstanding|limit|overdue|emi|amount
 *      — signals manual BDT formatting that bypasses fmt()
 *
 * The guardrail scans src/components/**\/*.{jsx,js} only, to keep the scope
 * narrow and avoid false positives from export helpers (which legitimately
 * use toFixed(2) for numeric Excel cells) or test fixtures.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const COMPONENTS_DIR = join(__dirname, '..', 'src', 'components');

/**
 * Walk a directory recursively and return all files matching the given
 * extension set.
 * @param {string} dir
 * @param {string[]} exts - e.g. ['.jsx', '.js']
 * @returns {string[]} absolute file paths
 */
function walkSync(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkSync(fullPath, exts));
    } else if (exts.includes(extname(entry))) {
      results.push(fullPath);
    }
  }
  return results;
}

const componentFiles = walkSync(COMPONENTS_DIR, ['.jsx', '.js']);

// ── Pattern 1: retired Indian-numbering locale ────────────────────────────────

test('no toLocaleString("en-IN") in src/components — retired Indian-numbering pattern', () => {
  const violators = [];
  for (const file of componentFiles) {
    const src = readFileSync(file, 'utf8');
    if (src.includes('toLocaleString("en-IN"') || src.includes("toLocaleString('en-IN'")) {
      violators.push(file.replace(COMPONENTS_DIR, 'src/components'));
    }
  }
  assert.deepEqual(
    violators,
    [],
    `Files using retired en-IN locale (use fmt() instead):\n  ${violators.join('\n  ')}`
  );
});

// ── Pattern 2: old Cr / Lac suffix string literals ───────────────────────────
//
// Matches the literal strings " Cr" and " Lac" as would appear in template
// literals or string concatenations (e.g. `+ " Cr"`, `+ " Lac"`).
// Does NOT match "Credit", "Lac" in variable names, or prose comments with
// "Crore"/"Lac" in a word boundary context.

test('no " Cr" or " Lac" suffix string literals in src/components — old Crore/Lakh format', () => {
  // Looks for the literal tokens as they appeared in the old fmt():
  //   .toFixed(2) + " Cr"    or    .toFixed(2) + " Lac"
  // More precisely: the string " Cr" or " Lac" surrounded by quotes.
  const crPattern = /["'] Cr["']/;
  const lacPattern = /["'] Lac["']/;

  const violators = [];
  for (const file of componentFiles) {
    const src = readFileSync(file, 'utf8');
    if (crPattern.test(src) || lacPattern.test(src)) {
      violators.push(file.replace(COMPONENTS_DIR, 'src/components'));
    }
  }
  assert.deepEqual(
    violators,
    [],
    `Files with old Cr/Lac suffix literals (use fmt() instead):\n  ${violators.join('\n  ')}`
  );
});

// ── Pattern 3: raw toFixed(2) on BDT amount variable names ───────────────────
//
// Catches patterns like: outstanding.toFixed(2), limit.toFixed(2),
// overdue.toFixed(2), emi.toFixed(2), amount.toFixed(2)
// These signal manual BDT formatting that bypasses fmt().
//
// Does NOT match:
//   - (Math.round(...)).toFixed(2)   — numeric computation result
//   - percentage.toFixed(2)          — non-amount variable names
//   - utilization.toFixed(1)         — 1dp, not 2dp
//   - coordinate.toFixed(1)          — SVG geometry

test('no raw .toFixed(2) on BDT amount variable names in src/components', () => {
  // Match: <amountVarName>.toFixed(2)
  // where amountVarName contains outstanding|limit|overdue|emi|amount
  const amountFixed2 = /\b(outstanding|limit|overdue|emi|amount)\b[^.]*\.toFixed\(2\)/i;

  const violators = [];
  for (const file of componentFiles) {
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    const hits = lines
      .map((line, i) => ({ line, num: i + 1 }))
      .filter(({ line }) => amountFixed2.test(line));
    if (hits.length > 0) {
      violators.push(`${file.replace(COMPONENTS_DIR, 'src/components')} [lines: ${hits.map(h => h.num).join(', ')}]`);
    }
  }
  assert.deepEqual(
    violators,
    [],
    `Files with raw toFixed(2) on BDT amount variables (use fmt() instead):\n  ${violators.join('\n  ')}`
  );
});
