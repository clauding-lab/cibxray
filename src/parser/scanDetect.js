import { pdfjsLib } from './loadPdfjs.js';

export async function isScannedPdf(pdfDoc, ops = globalOps()) {
  const { showText, showSpacedText } = ops;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const opList = await page.getOperatorList();
    for (const fn of opList.fnArray) {
      if (fn === showText || fn === showSpacedText) return false;
    }
  }
  return true;
}

function globalOps() {
  const OPS = pdfjsLib.OPS;
  return { showText: OPS.showText, showSpacedText: OPS.showSpacedText };
}
