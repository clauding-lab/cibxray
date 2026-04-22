#!/usr/bin/env node
// Dev utility: extract text from a CIB PDF, run it through parseBBCIB,
// and print the resulting facility model. Useful for eyeballing parser
// output against new CIB sample variants — especially when evaluating
// new requirements (e.g., DevReq-1) against real PDFs without having
// to open the browser app.
//
// NOT on the test path. Run manually:
//
//     node scripts/inspect-cib.mjs <path/to/cib.pdf>
//
// Paths to sample CIB PDFs are not committed (they contain real NIDs/TINs).

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseBBCIB } from '../src/parser/parseBBCIB.js';

const require = createRequire(import.meta.url);
// Legacy build works in Node without the Vite worker resolution used by
// the browser-side loadPdfjs.js.
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

async function pdfToText(buf) {
  const uint8 = new Uint8Array(buf);
  const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let lastY = null;
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) text += '\n';
      text += item.str + ' ';
      lastY = y;
    });
    text += '\n';
  }
  return text;
}

function snippet(text, needle, before = 40, after = 200) {
  const i = text.indexOf(needle);
  if (i < 0) return `<< "${needle}" not found >>`;
  return text.slice(Math.max(0, i - before), i + after);
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('usage: node scripts/inspect-cib.mjs <pdf>');
  process.exit(1);
}

const buf = await fs.readFile(pdfPath);
const text = await pdfToText(buf.buffer);
console.log('=== PDF:', path.basename(pdfPath), '— text length:', text.length);

console.log('\n--- snippet: Installment Amount ---');
console.log(snippet(text, 'Installment Amount'));

console.log('\n--- snippet: Date of last rescheduling ---');
console.log(snippet(text, 'Date of last rescheduling', 40, 150));

console.log('\n--- snippet: Monthly History (first occurrence, 1200 chars) ---');
const mhi = text.indexOf('Monthly History');
console.log(mhi >= 0 ? text.slice(mhi, mhi + 1200) : '<< not found >>');

console.log('\n=== parseBBCIB facility summary ===');
const report = parseBBCIB(text, path.basename(pdfPath));
console.log('Facilities parsed:', report.facilities.length);
report.facilities.slice(0, 5).forEach((f, idx) => {
  console.log(`\n[${idx}] ${f.institution} | ${f.type} | role=${f.role} phase=${f.status} nature=${f.nature}`);
  console.log(`    limit=${f.limit.toLocaleString()} outstanding=${f.outstanding.toLocaleString()} overdue=${f.overdue.toLocaleString()} cls=${f.classification}`);
  console.log(`    installmentAmount=${f.installmentAmount?.toLocaleString?.() ?? f.installmentAmount}  remainingInstallmentsAmount=${f.remainingInstallmentsAmount?.toLocaleString?.() ?? f.remainingInstallmentsAmount}`);
  console.log(`    rescheduledCount=${f.rescheduledCount} dateOfLastRescheduling="${f.dateOfLastRescheduling}"`);
  console.log(`    start=${f.startDate} end=${f.endDate}`);
  console.log(`    history rows: ${f.history.length} (oldest→newest)`);
  if (f.history.length > 0) {
    const fmt = h => `${h.dateStr} out=${h.outstanding.toLocaleString()} over=${h.overdue.toLocaleString()} npi=${h.npi} lim=${h.limit.toLocaleString()} ${h.status}`;
    console.log('    first 3:', f.history.slice(0, 3).map(fmt).join(' | '));
    console.log('    last 3: ', f.history.slice(-3).map(fmt).join(' | '));
  }
});
