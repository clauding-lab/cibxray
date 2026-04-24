// User Manual .pptx export — a banker-facing reference deck covering the
// full CIBxRay feature set. Polished design with:
//   • Title slide + Table of Contents
//   • Three section dividers (Overview / Rules / Reference)
//   • Per-tab slides with a screenshot-placeholder frame on the right
//   • Visual accents (accent bars, callout boxes)
//   • Page numbers + footer on every content slide
//
// Filename: CIBxRay_UserManual_<YYYY-MM-DD>.pptx
//
// pptxgenjs is loaded via dynamic import so it never inflates the main
// bundle — users only pay the ~250KB cost when they click the Manual button.
//
// Screenshot placeholders: every tab-tour slide reserves a framed empty box
// on the right half. After downloading, the banker opens the .pptx in
// PowerPoint and drops a screenshot over each placeholder.

// ── Brand palette ──────────────────────────────────────────────────────

const C = {
  navy:     '0C1A3D',
  navyDark: '020617',
  sky:      '0EA5E9',
  skyLight: '7DD3FC',
  slate:    '334155',
  muted:    '64748B',
  light:    'F8FAFC',
  white:    'FFFFFF',
  ink:      '0F172A',
  emerald:  '059669',
  amber:    'D97706',
  red:      'DC2626',
  border:   'E2E8F0',
  // Section accents
  section1: '0EA5E9', // Overview — sky blue
  section2: 'D97706', // Rules — amber
  section3: '059669', // Reference — emerald
};

// ── Slide data ─────────────────────────────────────────────────────────
// Each content slide has: title, body (string[]), optional section, optional
// showsPlaceholder (frames a screenshot-placeholder on the right half).

export const MANUAL_SLIDES = [
  // === 1. TITLE ========================================================
  { kind: 'title', title: 'CIBxRay', subtitle: 'Banker\'s User Manual', tagline: 'Credit Bureau Intelligence Platform' },

  // === 2. TOC ==========================================================
  { kind: 'toc', title: 'What\'s inside', toc: [
    ['1. App Overview',        'What it does, how to upload, a tour of every tab'],
    ['2. Rules & Methodology', 'Group detection, KYC, accuracy checks, scoring'],
    ['3. Reference',           'Error banners, print audit, red flags, exports, privacy'],
  ] },

  // === SECTION 1: APP OVERVIEW ========================================
  { kind: 'divider', section: 1, sectionTitle: 'App Overview', sectionNo: '01' },

  { kind: 'content', section: 1, title: 'What CIBxRay does',
    body: [
      'Parses Bangladesh Bank CIB PDF reports and turns them into structured, scored credit intelligence.',
      'Built for IDLC Finance SME + Corporate credit teams.',
      'Single-borrower or whole-group analysis — upload one PDF or a batch.',
      'Fully client-side: PDFs are parsed in your browser, never uploaded to a server.',
    ] },

  { kind: 'content', section: 1, title: 'Uploading reports',
    body: [
      'Drag-and-drop PDFs onto the upload pane, or click to browse.',
      'Batch upload supported — drop an entire group of CIBs at once.',
      'Filename pattern controls group detection: the numeric ref-base is the group key.',
      '  Applying concern — bare base (e.g. 1011500041801.pdf)',
      '  Sister concern — hyphen suffix (e.g. 1011500041801-3.pdf)',
      'Mixing different bases in one upload raises a warning banner.',
    ], showsPlaceholder: 'Upload screen' },

  { kind: 'content', section: 1, title: 'Nine tabs — at a glance',
    body: [
      'Summary & Rating — final score, KPI strip, flags',
      'Borrower — borrower + co-borrower facilities + timeline',
      'Guarantor — guarantor-role facilities + timeline',
      'Exposure Analytics — EMI burden, peaks, new facilities',
      'Behavioral Signals — hidden NPL, reschedule, sudden OD',
      'Credit Cards — per-card metrics + delinquency timeline',
      'Red Flags — critical + warning flags in one place',
      'Linked Entities — sister concerns from the CIB itself',
      'Export — retail / wholesale / committee-summary downloads',
    ] },

  { kind: 'content', section: 1, title: 'Tab tour — Summary & Rating',
    body: [
      'Final score (0–100) via 3-factor weighted model + penalty',
      'Overdue History 60% + Utilization 30% + Facility Mix 10%',
      'Penalty up to −50 for live DF / BL / BLW / SMA + historical',
      'Five KPI cards — Live Facilities, Total Limit, Outstanding, Overdue, Utilization',
      'Flag block — Clean Classification, Zero Overdue, High Utilization',
    ], showsPlaceholder: 'Summary & Rating tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Borrower / Guarantor',
    body: [
      'Filters the facility list to the role group (Borrower + Co-Borrower) or Guarantor-only',
      'Split into Funded and Non-Funded groups with Live and Terminated sections',
      'Full facility table — classification, outstanding, overdue, NPI, history',
      'Repayment Timeline chart — month-by-month outstanding + overdue with classification dot color',
      'Filter dropdown — aggregate, by status, by nature, or any single facility',
    ], showsPlaceholder: 'Borrower tab + timeline chart' },

  { kind: 'content', section: 1, title: 'Tab tour — Exposure Analytics',
    body: [
      'Live Loans EMI — sum of installment amounts across live borrower-role facilities',
      'Guaranteed exposure — installment + non-installment where role is Guarantor',
      'New facilities in last 24 months — count + total sanction amount',
      'Peak exposure — highest term-loan / non-installment / cumulative at any point',
      'Peak monthly EMI — maximum monthly installment burden across history',
      'Reschedule history — count and last date as borrower and guarantor',
    ], showsPlaceholder: 'Exposure Analytics tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Behavioral Signals',
    body: [
      'Loans with unchanged outstanding — hidden NPL signal; borrower is not reducing balance',
      'Loans with sudden multiple overdue — NPI jumps of 2+ in a single month',
      'Continuous overdue — facilities overdue for 3+ consecutive months',
      'Incremental burden 12M and 24M — change in monthly EMI versus the peak in that window',
      'Cumulative highest EMI — peak monthly burden across all facilities',
    ], showsPlaceholder: 'Behavioral Signals tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Credit Cards',
    body: [
      'Per-card 6-metric summary',
      '  Consistent full payment — never rolled a balance',
      '  Partial payment frequency — rolled but met the minimum',
      '  Missed minimum — short of the minimum at any point',
      '  Limit utilization trend — rising, stable, or falling',
      '  Delinquency episodes — months with NPI ≥ 1',
      '  Peak NPI — worst streak in window',
      '12-month delinquency bar — green / amber / red cells by month',
    ], showsPlaceholder: 'Credit Cards tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Red Flags',
    body: [
      'Critical (red) — must review before approval',
      '  Live Defaulter / Bad-Loss / Written-Off facility',
      '  Lawsuit filed',
      'Warning (amber) — elevated risk, not an auto-decline',
      '  Live SMA, historical SS / DF / BL / BLW',
      '  Expired CIB (> 60 days old)',
      '  Unverified Name / NID (Bangladesh Bank marker = false)',
      'Count badge on the tab label — zero hides, non-zero shows red',
    ], showsPlaceholder: 'Red Flags tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Linked Entities',
    body: [
      'Sister concerns extracted from inside the CIB PDF itself (not uploaded files)',
      'Each linked proprietorship shows trade name + CIB code',
      'For corporates: also shows directors, partners, and their individual CIB codes',
      'Use this to plan which other CIBs to request for a full group picture',
    ], showsPlaceholder: 'Linked Entities tab' },

  { kind: 'content', section: 1, title: 'Tab tour — Export',
    body: [
      'Retail Lending Analytics (.xlsx, 9 sheets) — single-concern deep-dive in CRM-CD Dashboard V2 layout',
      'Wholesale Lending Analytics (.xlsx, 12 sheets) — group-level workbook in Corporate Template layout (needs 2+ reports loaded)',
      'Summary for Credit Committee (.docx) — one-page applying-concern + group liability tables',
      'Technical Export (.xlsx) — legacy raw exporter; kept for power users',
      'Print report — printable 1-page summary via the browser\'s print dialog',
    ], showsPlaceholder: 'Export tab' },

  // === SECTION 2: RULES & METHODOLOGY =================================
  { kind: 'divider', section: 2, sectionTitle: 'Rules & Methodology', sectionNo: '02' },

  { kind: 'content', section: 2, title: 'Key rule — Group detection',
    body: [
      'The applying concern is identified by filename, not by subject relationships.',
      'Rule:',
      '  1. Strip the .pdf extension; parse /^(\\d+)(-\\d+)?/',
      '  2. Applying concern — the file with no hyphen-suffix (bare base)',
      '  3. Sisters — files with hyphen suffix sharing the same base',
      '  4. Error — two or more bare bases → banner "upload one group at a time"',
      'Consequence: different ref-base = different group. No exceptions.',
    ] },

  { kind: 'content', section: 2, title: 'Key rule — KYC + accuracy',
    body: [
      'KYC fields extracted per subject — Ref No, CIB Code, NID 17/10, TIN, Reg No, DOB, address, gender, sector',
      'Bangladesh Bank verified markers — each KYC field surfaces the BB verified true / false flag',
      'Summary vs facilities reconciliation — parse quality tier',
      '  OK — summary and facility totals match',
      '  Minor — gap is small → yellow banner, still scorable',
      '  Major — gap too large → red banner + score hidden + print disabled',
      '  Unavailable — no summary block found → yellow banner',
    ] },

  { kind: 'content', section: 2, title: 'Scoring methodology — under the hood',
    body: [
      'Three positive factors (0–100 each) with fixed weights',
      '  Overdue History — 60%  •  Utilization — 30%  •  Facility Mix — 10%',
      'Weighted subtotal gives the base score',
      'Classification penalty (up to −50 points) applied for adverse live classifications, weighted by each facility\'s outstanding share',
      'Auto-decline override — any live BL / BLW / Written-Off forces an UNACCEPTABLE band regardless of score',
      'Data tier note — when inquiry date is recent but history is short, the score is marked "Limited data" for transparency',
    ] },

  // === SECTION 3: REFERENCE ===========================================
  { kind: 'divider', section: 3, sectionTitle: 'Reference', sectionNo: '03' },

  { kind: 'content', section: 3, title: 'Error banners — what they mean',
    body: [
      'Parse quality: Minor (yellow) — verify totals before trusting',
      'Parse quality: Major (red) — score hidden, print disabled, re-upload the PDF',
      'Multiple root references — filename bases conflict; upload one group at a time',
      'Expired CIB — inquiry date > 60 days old; request fresh report',
      'Unverified Name / NID — Bangladesh Bank has not verified this field; confirm identity manually',
      'Print: popup blocked — allow popups for the site',
      'Print: report too large — reduce batch size or switch browser',
    ] },

  { kind: 'content', section: 3, title: 'Print report — audit measures',
    body: [
      'Audit stamp — printed on every report: date, time, signed-in user, app build version',
      'Data tier note — prints whether the CIB had sufficient data for a full score or limited history',
      'Stale-payload guard — the print tab must open within 10 seconds of click; otherwise errors out',
      'Parse-quality lock — print disabled when parseQuality.tier === "major"',
      'Raw PDF text is stripped from the print payload before transfer — no leakage through localStorage',
    ], showsPlaceholder: 'Printed report with audit stamp' },

  { kind: 'content', section: 3, title: 'Red Flags — quick reference',
    body: [
      'Critical:  Live Defaulter · Bad-Loss · Written-Off · Lawsuit Filed',
      'Warning:   Live SMA · Adverse historical (SS/DF/BL/BLW) · Expired CIB · Unverified Name/NID',
      'Classification ordering (worst → best): BLW > BL > DF > SS > SMA > STD',
      'Severity badges are color-coded red (critical) or amber (warning)',
      'Tab label shows the total count badge; zero hides the tab underline',
    ] },

  { kind: 'content', section: 3, title: 'Exported files — what\'s in each',
    body: [
      'Retail .xlsx — 9 sheets: CIB Dashboard, Linked Concerns, Term Loans, Non-Installment, Credit Cards, Non-Funded Details, Overdue, Unchanged Outstanding, Sudden OD',
      'Wholesale .xlsx — 12 sheets: Sister Concerns, Directors, CIB Summary (Borrower), CIB Summary (Guarantor), Long Term Loan, STF Summary, Overdue Details STF, OD/CC, Forced Loan Details, Forced Loan Summary, Non-Funded Overdue, Reschedule',
      'Committee Summary .docx — one-page: CIB Status + collection date + applying concern, plus two tables (applying-concern + companies-only group)',
      'Printable 1-page PDF — from browser print dialog; audit-stamped',
    ] },

  { kind: 'content', section: 3, title: 'Data privacy',
    body: [
      'PDF parsing runs entirely in your browser. The PDF bytes never leave your machine.',
      'Scoring, analytics, and chart rendering — all client-side',
      'Print handoff uses localStorage only — no network round-trip',
      'Raw PDF text is stripped from the print payload before serialization',
      'Excel and Word downloads are generated in-browser; no server-side compilation',
    ] },

  // === CLOSING ========================================================
  { kind: 'closing', title: 'CIBxRay', tagline: 'Credit Bureau Intelligence Platform' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function sectionAccent(section) {
  if (section === 1) return C.section1;
  if (section === 2) return C.section2;
  if (section === 3) return C.section3;
  return C.sky;
}

function addFooter(slide, pageNum, totalPages) {
  slide.addText('CIBxRay · Banker\'s User Manual', {
    x: 0.4, y: 7.1, w: 6, h: 0.3,
    fontSize: 9, color: C.muted, italic: true, fontFace: 'Calibri',
  });
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: 12.5, y: 7.1, w: 0.8, h: 0.3,
    fontSize: 9, color: C.muted, align: 'right', fontFace: 'Calibri',
  });
}

// ── Slide builders ─────────────────────────────────────────────────────

function buildTitleSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: C.navyDark };
  // Accent strip
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 3.2, w: 13.33, h: 0.08, fill: { color: C.sky }, line: { color: C.sky, width: 0 } });
  s.addText(slide.title, {
    x: 0.5, y: 2.0, w: 12.3, h: 1.2,
    fontSize: 72, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
    charSpacing: 4,
  });
  s.addText(slide.subtitle, {
    x: 0.5, y: 3.4, w: 12.3, h: 0.7,
    fontSize: 28, color: C.skyLight, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.tagline, {
    x: 0.5, y: 4.3, w: 12.3, h: 0.5,
    fontSize: 16, italic: true, color: C.muted, align: 'center', fontFace: 'Calibri',
  });
  return s;
}

function buildTocSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: C.white };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.8, fill: { color: C.navy }, line: { color: C.navy, width: 0 } });
  s.addText(slide.title, {
    x: 0.4, y: 0.15, w: 12.5, h: 0.5,
    fontSize: 26, bold: true, color: C.white, fontFace: 'Calibri',
  });
  const accents = [C.section1, C.section2, C.section3];
  slide.toc.forEach(([title, sub], i) => {
    const y = 1.5 + i * 1.5;
    s.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 0.15, h: 1.0, fill: { color: accents[i] }, line: { color: accents[i], width: 0 } });
    s.addText(title, {
      x: 1.0, y, w: 11.0, h: 0.45, fontSize: 24, bold: true, color: C.ink, fontFace: 'Calibri',
    });
    s.addText(sub, {
      x: 1.0, y: y + 0.5, w: 11.0, h: 0.5, fontSize: 14, color: C.slate, fontFace: 'Calibri',
    });
  });
  return s;
}

function buildDividerSlide(pptx, slide) {
  const accent = sectionAccent(slide.section);
  const s = pptx.addSlide();
  s.background = { color: C.navyDark };
  // Huge section number
  s.addText(slide.sectionNo, {
    x: 0.5, y: 1.2, w: 12.3, h: 3.0,
    fontSize: 220, bold: true, color: accent, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.sectionTitle, {
    x: 0.5, y: 4.5, w: 12.3, h: 1.0,
    fontSize: 42, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
  });
  s.addShape(pptx.ShapeType.rect, { x: 5.0, y: 5.7, w: 3.33, h: 0.08, fill: { color: accent }, line: { color: accent, width: 0 } });
  return s;
}

function buildContentSlide(pptx, slide) {
  const accent = sectionAccent(slide.section);
  const s = pptx.addSlide();
  s.background = { color: C.white };
  // Header bar
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: C.navy }, line: { color: C.navy, width: 0 } });
  // Section accent on the left of header
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.2, h: 0.7, fill: { color: accent }, line: { color: accent, width: 0 } });
  s.addText(slide.title, {
    x: 0.5, y: 0.1, w: 12.5, h: 0.5,
    fontSize: 22, bold: true, color: C.white, fontFace: 'Calibri',
  });

  // Body: text-only on left (full-width) or left half (right half = screenshot placeholder)
  const body = Array.isArray(slide.body) ? slide.body : [slide.body];
  const textItems = body.map(line => {
    const isIndented = line.startsWith('  ') || line.trim().startsWith('•');
    const cleaned = line.replace(/^\s+/, '').replace(/^•\s*/, '');
    return {
      text: cleaned,
      options: isIndented
        ? { bullet: { code: '25CB' }, indentLevel: 1, fontSize: 13, color: C.slate, paraSpaceAfter: 4 }
        : { bullet: { code: '25CF' }, fontSize: 15, color: C.ink, bold: false, paraSpaceAfter: 6 },
    };
  });

  const bodyW = slide.showsPlaceholder ? 6.5 : 12.5;
  s.addText(textItems, {
    x: 0.5, y: 1.0, w: bodyW, h: 5.9,
    fontFace: 'Calibri', valign: 'top',
  });

  // Screenshot placeholder (right half)
  if (slide.showsPlaceholder) {
    s.addShape(pptx.ShapeType.rect, {
      x: 7.3, y: 1.0, w: 5.6, h: 5.5,
      fill: { color: C.light },
      line: { color: C.border, width: 1, dashType: 'dash' },
    });
    s.addText([
      { text: 'Screenshot placeholder\n', options: { fontSize: 14, bold: true, color: C.muted, breakLine: false } },
      { text: slide.showsPlaceholder, options: { fontSize: 12, color: C.muted, italic: true } },
      { text: '\n\nPaste image in PowerPoint', options: { fontSize: 10, color: C.muted } },
    ], {
      x: 7.3, y: 3.2, w: 5.6, h: 1.5,
      align: 'center', valign: 'middle', fontFace: 'Calibri',
    });
  }
  return s;
}

function buildClosingSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: C.navyDark };
  s.addText(slide.title, {
    x: 0.5, y: 2.8, w: 12.3, h: 1.0,
    fontSize: 60, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.tagline, {
    x: 0.5, y: 3.9, w: 12.3, h: 0.6,
    fontSize: 18, color: C.skyLight, align: 'center', italic: true, fontFace: 'Calibri',
  });
  s.addShape(pptx.ShapeType.rect, { x: 5.67, y: 4.8, w: 2.0, h: 0.08, fill: { color: C.sky }, line: { color: C.sky, width: 0 } });
  s.addText('Generated ' + new Date().toISOString().slice(0, 10), {
    x: 0.5, y: 5.1, w: 12.3, h: 0.4,
    fontSize: 12, color: C.muted, align: 'center', fontFace: 'Calibri',
  });
  return s;
}

/**
 * Build the pptx.Presentation. Pure — no IO.
 * @returns {Promise<object>} pptxgenjs presentation instance
 */
export async function buildUserManualPptx() {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = 'CIBxRay User Manual';
  pptx.author = 'CIBxRay';
  pptx.company = 'IDLC Finance PLC';
  pptx.subject = 'Banker\'s User Manual';

  // Count content slides for footer "x / total"
  const contentSlideCount = MANUAL_SLIDES.filter(s => s.kind === 'content').length;
  let contentIdx = 0;

  for (const slide of MANUAL_SLIDES) {
    if (slide.kind === 'title') buildTitleSlide(pptx, slide);
    else if (slide.kind === 'toc') buildTocSlide(pptx, slide);
    else if (slide.kind === 'divider') buildDividerSlide(pptx, slide);
    else if (slide.kind === 'closing') buildClosingSlide(pptx, slide);
    else if (slide.kind === 'content') {
      contentIdx++;
      const built = buildContentSlide(pptx, slide);
      addFooter(built, contentIdx, contentSlideCount);
    }
  }
  return pptx;
}

/**
 * Generate and trigger a download of the User Manual .pptx.
 * Filename: CIBxRay_UserManual_<YYYY-MM-DD>.pptx
 */
export async function doUserManualExport() {
  const pptx = await buildUserManualPptx();
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `CIBxRay_UserManual_${today}.pptx`;
  await pptx.writeFile({ fileName });
}
