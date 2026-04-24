/**
 * Tests for wholesale Sheet 2 — Directors Profile.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDirectorsProfileRows } from '../src/export/wholesaleExport/sheet2_directorsProfile.js';

const makeCompanyReport = (overrides = {}) => ({
  reportNo: 'RPT-001',
  fileName: '1011500056801.pdf',
  subject: {
    cibSubjectCode: 'S001',
    subjectType: 'COMPANY',
    tradeName: 'Akij Food & Beverage Ltd.',
    displayName: 'Akij Food & Beverage Ltd.',
  },
  directors: [
    { cibCode: 'D001', name: 'Sheikh Akijuddin', role: 'Managing director' },
    { cibCode: 'D002', name: 'Sheikh Bashiruddin', role: 'Chairman' },
  ],
  facilities: [],
  ...overrides,
});

const makeIndividualReport = (overrides = {}) => ({
  reportNo: 'IND-001',
  fileName: '1011500056801-1.pdf',
  subject: {
    cibSubjectCode: 'I001',
    subjectType: 'INDIVIDUAL',
    name: 'Sheikh Akijuddin',
    displayName: 'Sheikh Akijuddin',
  },
  directors: [],
  facilities: [],
  ...overrides,
});

test('buildDirectorsProfileRows emits correct header', () => {
  const rows = buildDirectorsProfileRows([]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0][0], 'CIB Subject Code (Company)');
  assert.equal(rows[0][5], "Director's Name");
  assert.equal(rows[0][6], 'Role In the Company');
});

test('buildDirectorsProfileRows emits one row per (company, director) pair', () => {
  const r = makeCompanyReport();
  const rows = buildDirectorsProfileRows([r]);
  assert.equal(rows.length, 3); // header + 2 directors
  assert.equal(rows[1][0], 'S001');
  assert.equal(rows[1][1], '1011500056801.pdf');
  assert.equal(rows[1][2], 'COMPANY');
  assert.equal(rows[1][3], 'Akij Food & Beverage Ltd.');
  assert.equal(rows[1][4], 'D001');
  assert.equal(rows[1][5], 'Sheikh Akijuddin');
  assert.equal(rows[1][6], 'Managing director');
  assert.equal(rows[2][5], 'Sheikh Bashiruddin');
});

test('buildDirectorsProfileRows skips INDIVIDUAL-type reports', () => {
  const indiv = makeIndividualReport();
  const rows = buildDirectorsProfileRows([indiv]);
  assert.equal(rows.length, 1); // header only
});

test('buildDirectorsProfileRows mixes company and individual reports correctly', () => {
  const company = makeCompanyReport();
  const indiv = makeIndividualReport();
  const rows = buildDirectorsProfileRows([company, indiv]);
  assert.equal(rows.length, 3); // header + 2 from company, 0 from individual
});

test('buildDirectorsProfileRows handles company with no directors', () => {
  const r = makeCompanyReport({ directors: [] });
  const rows = buildDirectorsProfileRows([r]);
  assert.equal(rows.length, 1); // header only
});

test('buildDirectorsProfileRows handles multiple company reports', () => {
  const r1 = makeCompanyReport();
  const r2 = makeCompanyReport({
    fileName: '1011500056801-2.pdf',
    subject: {
      cibSubjectCode: 'S002',
      subjectType: 'COMPANY',
      tradeName: 'Akij Cement Ltd.',
      displayName: 'Akij Cement Ltd.',
    },
    directors: [{ cibCode: 'D003', name: 'Sheikh Fariduddin', role: 'Director' }],
  });
  const rows = buildDirectorsProfileRows([r1, r2]);
  // 1 header + 2 from r1 + 1 from r2
  assert.equal(rows.length, 4);
  assert.equal(rows[3][4], 'D003');
});
