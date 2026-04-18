import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isScannedPdf } from '../src/parser/scanDetect.js';

const PDFJS_OPS = { showText: 44, showSpacedText: 45, paintImageXObject: 85 };

function mockPdf(opsPerPage) {
  return {
    numPages: opsPerPage.length,
    getPage: async (i) => ({
      getOperatorList: async () => ({ fnArray: opsPerPage[i - 1] }),
    }),
  };
}

test('returns true when every page has only image ops', async () => {
  const pdf = mockPdf([
    [PDFJS_OPS.paintImageXObject],
    [PDFJS_OPS.paintImageXObject, PDFJS_OPS.paintImageXObject],
  ]);
  assert.equal(await isScannedPdf(pdf, PDFJS_OPS), true);
});

test('returns false when any page has showText', async () => {
  const pdf = mockPdf([
    [PDFJS_OPS.paintImageXObject],
    [PDFJS_OPS.paintImageXObject, PDFJS_OPS.showText],
  ]);
  assert.equal(await isScannedPdf(pdf, PDFJS_OPS), false);
});

test('returns false when any page has showSpacedText', async () => {
  const pdf = mockPdf([[PDFJS_OPS.showSpacedText]]);
  assert.equal(await isScannedPdf(pdf, PDFJS_OPS), false);
});

test('returns true for empty-page document (0 pages)', async () => {
  const pdf = mockPdf([]);
  assert.equal(await isScannedPdf(pdf, PDFJS_OPS), true);
});
