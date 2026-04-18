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
  const OPS = typeof window !== 'undefined' && window.pdfjsLib ? window.pdfjsLib.OPS : null;
  if (!OPS) throw new Error('pdfjsLib not loaded');
  return { showText: OPS.showText, showSpacedText: OPS.showSpacedText };
}
