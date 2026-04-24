/**
 * DevReq-2 Phase 3 — Retail Exporter entry-point smoke test.
 *
 * doRetailExport is the browser-facing IO wrapper. Under node --test we
 * shim the browser globals (Blob, URL.createObjectURL, document) so the
 * function can run end-to-end and we can assert filename + sheet count.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doRetailExport } from '../src/export/retailExport.js';
import { retailSampleReport } from '../test/fixtures/retailExportFixture.js';

// ── tiny browser shim ─────────────────────────────────────────────────────────

function installBrowserShim() {
  globalThis.Blob = class Blob {
    constructor(parts) { this.size = parts.reduce((s, p) => s + (p.byteLength || p.length || 0), 0); }
  };
  globalThis.URL = {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  };
  const appended = [];
  const clicked = [];
  const removed = [];
  globalThis.document = {
    createElement: () => {
      const el = { setAttribute: () => {}, style: {} };
      Object.defineProperty(el, 'click', { value: () => clicked.push(el) });
      return el;
    },
    body: {
      appendChild: (el) => appended.push(el),
      removeChild: (el) => removed.push(el),
    },
  };
  return { appended, clicked, removed };
}

test('doRetailExport writes a download link with the correct filename', async () => {
  const shim = installBrowserShim();

  await doRetailExport(retailSampleReport);

  assert.equal(shim.appended.length, 1);
  assert.equal(shim.clicked.length, 1);
  const el = shim.appended[0];
  assert.match(el.download, /^CIBxRay_Retail_CIB-042\.xlsx$/);

  // wait for the setTimeout cleanup (300ms in source)
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(shim.removed.length, 1);
});

test('doRetailExport falls back to "Report" when reportNo is missing', async () => {
  const shim = installBrowserShim();
  const reportNoReportNo = { ...retailSampleReport, reportNo: '' };

  await doRetailExport(reportNoReportNo);

  const el = shim.appended[0];
  assert.match(el.download, /^CIBxRay_Retail_Report\.xlsx$/);
});
