import { loadPdf } from './pdfLoader';

export async function pdfToText(file) {
  if (!await loadPdf()) throw new Error("PDF.js failed to load");
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) text += "\n";
      text += item.str + " ";
      lastY = y;
    });
    text += "\n";
  }
  return text;
}
