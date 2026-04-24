/**
 * DevReq-2 Phase 3 — Retail Exporter Sheet 2 (Linked Concerns & Institute).
 *
 * One row per linked proprietorship. 22 columns per the source template.
 * For the single-PDF retail context only metadata (cibCode + tradeName) is
 * available; per-facility rollups resolve to empty strings.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLinkedConcernsRows } from '../src/export/retailExport/sheet2_linkedConcerns.js';

test('buildLinkedConcernsRows emits header only when no linked concerns', () => {
  const rows = buildLinkedConcernsRows({ linkedProprietorships: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, 22);
  assert.equal(rows[0][0], 'Sl');
  assert.equal(rows[0][1], 'Concern Name');
  assert.equal(rows[0][2], 'CIB Subject Code');
});

test('buildLinkedConcernsRows emits one data row per linked concern', () => {
  const rows = buildLinkedConcernsRows({
    linkedProprietorships: [
      { cibCode: 'P001', tradeName: 'Concern Alpha' },
      { cibCode: 'P002', tradeName: 'Concern Beta' },
    ],
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], 1);
  assert.equal(rows[1][1], 'Concern Alpha');
  assert.equal(rows[1][2], 'P001');
  assert.equal(rows[2][0], 2);
  assert.equal(rows[2][1], 'Concern Beta');
});

test('buildLinkedConcernsRows leaves unsourced columns blank', () => {
  const rows = buildLinkedConcernsRows({
    linkedProprietorships: [{ cibCode: 'P001', tradeName: 'A' }],
  });
  // Columns beyond Sl / Name / CIB code are blank strings
  for (let i = 3; i < 22; i++) {
    assert.equal(rows[1][i], '', `column ${i} should be blank`);
  }
});

test('buildLinkedConcernsRows handles report without linkedProprietorships field', () => {
  const rows = buildLinkedConcernsRows({});
  assert.equal(rows.length, 1);
});
