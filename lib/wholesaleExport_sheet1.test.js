/**
 * Tests for wholesale Sheet 1 — Sister Concerns manifest.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSisterConcernsRows } from '../src/export/wholesaleExport/sheet1_sisterConcerns.js';

const makeReport = (overrides = {}) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: {
    cibSubjectCode: 'S001',
    subjectType: 'COMPANY',
    tradeName: 'Akij Food & Beverage Ltd.',
    displayName: 'Akij Food & Beverage Ltd.',
    name: 'Akij Food & Beverage Ltd.',
  },
  facilities: [],
  ...overrides,
});

test('buildSisterConcernsRows returns header + one row per report', () => {
  const r1 = makeReport({ fileName: '1011500056801.pdf' });
  const r2 = makeReport({
    fileName: '1011500056801-1.pdf',
    subject: {
      cibSubjectCode: 'S002',
      subjectType: 'COMPANY',
      tradeName: 'Akij Cement Ltd.',
      displayName: 'Akij Cement Ltd.',
    },
  });
  const rows = buildSisterConcernsRows([r1, r2]);
  assert.equal(rows.length, 3); // header + 2 data rows
  assert.deepEqual(rows[0], ['CIB Subject Code', 'Ref No. (filename)', 'Individual/Company', 'Trade Name/Title, Name']);
  assert.equal(rows[1][0], 'S001');
  assert.equal(rows[1][1], '1011500056801.pdf');
  assert.equal(rows[1][2], 'COMPANY');
  assert.equal(rows[1][3], 'Akij Food & Beverage Ltd.');
  assert.equal(rows[2][1], '1011500056801-1.pdf');
});

test('buildSisterConcernsRows falls back to displayName when tradeName absent', () => {
  const r = makeReport({
    subject: { cibSubjectCode: 'S003', subjectType: 'INDIVIDUAL', displayName: 'Md. Test', name: 'Md. Test' },
  });
  const rows = buildSisterConcernsRows([r]);
  assert.equal(rows[1][3], 'Md. Test');
});

test('buildSisterConcernsRows handles empty reports array', () => {
  const rows = buildSisterConcernsRows([]);
  assert.equal(rows.length, 1); // header only
  assert.equal(rows[0][0], 'CIB Subject Code');
});

test('buildSisterConcernsRows uses fileName over reportNo', () => {
  const r = makeReport({ fileName: 'somefile.pdf', reportNo: 'RPT-XYZ' });
  const rows = buildSisterConcernsRows([r]);
  assert.equal(rows[1][1], 'somefile.pdf');
});

test('buildSisterConcernsRows falls back to reportNo when fileName absent', () => {
  const r = makeReport({ fileName: '', reportNo: 'RPT-XYZ' });
  const rows = buildSisterConcernsRows([r]);
  assert.equal(rows[1][1], 'RPT-XYZ');
});
