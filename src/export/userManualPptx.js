// User Manual .pptx export — a banker-facing reference deck with real
// screenshots, three-section color system, and presentation-grade polish.
//
// Filename: CIBxRay_UserManual_<YYYY-MM-DD>.pptx
//
// pptxgenjs is loaded via dynamic import so it never inflates the main
// bundle — users only pay the ~250KB cost when they click the Manual button.
// Screenshots are served from `public/manual-screenshots/*.png` at runtime.

// ── Brand palette ──────────────────────────────────────────────────────

const C = {
  navy:     '0C1A3D',
  navyDark: '020617',
  sky:      '0EA5E9',
  skyLight: '7DD3FC',
  skySoft:  'E0F2FE',
  slate:    '334155',
  slateSoft:'F1F5F9',
  muted:    '64748B',
  light:    'F8FAFC',
  white:    'FFFFFF',
  ink:      '0F172A',
  emerald:  '059669',
  emerGreen:'D1FAE5',
  amber:    'D97706',
  amberSoft:'FEF3C7',
  red:      'DC2626',
  redSoft:  'FEE2E2',
  border:   'E2E8F0',
  section1: '0EA5E9', // Overview — sky blue
  section2: 'D97706', // Rules — amber
  section3: '059669', // Reference — emerald
  // Classification palette (matches the app's CLS constants)
  clsBLW:   '7F1D1D',
  clsBL:    'DC2626',
  clsDF:    'EA580C',
  clsSS:    'F59E0B',
  clsSMA:   'EAB308',
  clsSTD:   '059669',
};

// ── Slide data ─────────────────────────────────────────────────────────

export const MANUAL_SLIDES = [
  // === 1. TITLE ========================================================
  { kind: 'title', title: 'CIBxRay', subtitle: 'Banker\'s User Manual', tagline: 'Credit Bureau Intelligence Platform' },

  // === 2. TOC ==========================================================
  { kind: 'toc', title: 'What\'s inside', toc: [
    ['1. App Overview',        'What CIBxRay does, how to upload, a tour of every tab'],
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
    ], screenshot: '/manual-screenshots/upload.png' },

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
    ], screenshot: '/manual-screenshots/summary.png' },

  { kind: 'content', section: 1, title: 'Tab tour — Borrower / Guarantor',
    body: [
      'Filters the facility list to the role group (Borrower + Co-Borrower) or Guarantor-only',
      'Split into Funded and Non-Funded groups with Live and Terminated sections',
      'Full facility table — classification, outstanding, overdue, NPI, history',
      'Repayment Timeline — month-by-month outstanding + overdue with classification dot color',
      'Filter dropdown — aggregate, by status, by nature, or any single facility',
    ], screenshot: '/manual-screenshots/borrower.png' },

  { kind: 'content', section: 1, title: 'Tab tour — Exposure Analytics',
    body: [
      'Live Loans EMI — sum of installment amounts across live borrower-role facilities',
      'Guaranteed exposure — installment + non-installment where role is Guarantor',
      'New facilities in last 24 months — count + total sanction amount',
      'Peak exposure — highest term-loan / non-installment / cumulative at any point',
      'Peak monthly EMI — maximum monthly installment burden across history',
      'Reschedule history — count and last date as borrower and guarantor',
    ], screenshot: '/manual-screenshots/exposure-analytics.png' },

  { kind: 'content', section: 1, title: 'Tab tour — Behavioral Signals',
    body: [
      'Loans with unchanged outstanding — hidden NPL signal; borrower is not reducing balance',
      'Loans with sudden multiple overdue — NPI jumps of 2+ in a single month',
      'Continuous overdue — facilities overdue for 3+ consecutive months',
      'Incremental burden 12M and 24M — change in monthly EMI versus the peak in that window',
      'Cumulative highest EMI — peak monthly burden across all facilities',
    ], screenshot: '/manual-screenshots/behavioral-signals.png' },

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
    ], screenshot: '/manual-screenshots/credit-cards.png' },

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
    ], screenshot: '/manual-screenshots/red-flags.png' },

  { kind: 'content', section: 1, title: 'Tab tour — Linked Entities',
    body: [
      'Sister concerns extracted from inside the CIB PDF itself (not uploaded files)',
      'Each linked proprietorship shows trade name + CIB code',
      'For corporates: also shows directors, partners, and their individual CIB codes',
      'Use this to plan which other CIBs to request for a full group picture',
    ], screenshot: '/manual-screenshots/linked-entities.png' },

  { kind: 'content', section: 1, title: 'Tab tour — Export',
    body: [
      'Retail Lending Analytics (.xlsx, 9 sheets) — single-concern deep-dive in CRM-CD Dashboard V2 layout',
      'Wholesale Lending Analytics (.xlsx, 12 sheets) — group-level workbook in Corporate Template layout (needs 2+ reports loaded)',
      'Summary for Credit Committee (.docx) — one-page applying-concern + group liability tables',
      'Technical Export (.xlsx) — legacy raw exporter; kept for power users',
      'Print report — printable 1-page summary via the browser\'s print dialog',
    ], screenshot: '/manual-screenshots/export.png' },

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
      'Different ref-base = different group. No exceptions.',
    ],
    callout: { label: 'REMEMBER', text: 'Filename defines the group. No subject-relationship heuristics.' } },

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
      'Data tier note — when inquiry date is recent but history is short, the score is marked "Limited data" for transparency',
    ],
    callout: { label: 'AUTO-DECLINE', text: 'Any live BL / BLW / Written-Off forces an UNACCEPTABLE band — regardless of score.' } },

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
    ], screenshot: '/manual-screenshots/print-report.png' },

  { kind: 'content', section: 3, title: 'Red Flags — quick reference',
    body: [
      'Critical:  Live Defaulter · Bad-Loss · Written-Off · Lawsuit Filed',
      'Warning:   Live SMA · Adverse historical (SS/DF/BL/BLW) · Expired CIB · Unverified Name/NID',
      'Classification ordering (worst → best): BLW > BL > DF > SS > SMA > STD',
      'Severity badges are color-coded red (critical) or amber (warning)',
      'Tab label shows the total count badge; zero hides the tab underline',
    ], showsClassificationLegend: true },

  { kind: 'content', section: 3, title: 'Exported files — what\'s in each',
    body: [
      'Retail .xlsx — 9 sheets: CIB Dashboard, Linked Concerns, Term Loans, Non-Installment, Credit Cards, Non-Funded Details, Overdue, Unchanged Outstanding, Sudden OD',
      'Wholesale .xlsx — 12 sheets: Sister Concerns, Directors, CIB Summary (Borrower/Guarantor), Long Term Loan, STF Summary, Overdue Details STF, OD/CC, Forced Loan Details + Summary, Non-Funded Overdue, Reschedule',
      'Committee Summary .docx — one-page: CIB Status + collection date + applying concern, plus two liability tables (applying-concern + companies-only group)',
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

// Three progress dots at top-right of content slides; current section solid,
// others hollow. Gives the reader a sense of where they are in the deck.
function addSectionProgress(pptx, slide, currentSection) {
  const sections = [1, 2, 3];
  const colors = [C.section1, C.section2, C.section3];
  sections.forEach((sec, i) => {
    const x = 11.8 + i * 0.35;
    slide.addShape(pptx.ShapeType.ellipse, {
      x, y: 0.25, w: 0.2, h: 0.2,
      fill: { color: sec === currentSection ? colors[i] : 'FFFFFF' },
      line: { color: colors[i], width: 1.5 },
    });
  });
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
  // Large decorative accent — three horizontal stripes in section colors
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 3.1, w: 4.44, h: 0.1, fill: { color: C.section1 }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 4.44, y: 3.1, w: 4.44, h: 0.1, fill: { color: C.section2 }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 8.88, y: 3.1, w: 4.45, h: 0.1, fill: { color: C.section3 }, line: { width: 0 } });
  s.addText(slide.title, {
    x: 0.5, y: 1.9, w: 12.3, h: 1.2,
    fontSize: 84, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
    charSpacing: 6,
  });
  s.addText(slide.subtitle, {
    x: 0.5, y: 3.4, w: 12.3, h: 0.7,
    fontSize: 28, color: C.skyLight, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.tagline, {
    x: 0.5, y: 4.2, w: 12.3, h: 0.5,
    fontSize: 16, italic: true, color: C.muted, align: 'center', fontFace: 'Calibri',
  });
  // Subtle corner accents
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.4, w: 0.5, h: 0.05, fill: { color: C.sky }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 0.4, y: 0.4, w: 0.05, h: 0.5, fill: { color: C.sky }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 12.43, y: 7.05, w: 0.5, h: 0.05, fill: { color: C.sky }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 12.88, y: 6.6, w: 0.05, h: 0.5, fill: { color: C.sky }, line: { width: 0 } });
}

function buildTocSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: C.white };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.8, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.2, h: 0.8, fill: { color: C.sky }, line: { width: 0 } });
  s.addText(slide.title, {
    x: 0.5, y: 0.15, w: 12.5, h: 0.5,
    fontSize: 26, bold: true, color: C.white, fontFace: 'Calibri',
  });
  const accents = [C.section1, C.section2, C.section3];
  const labels  = ['01', '02', '03'];
  slide.toc.forEach(([title, sub], i) => {
    const y = 1.5 + i * 1.65;
    // Numbered circle
    s.addShape(pptx.ShapeType.ellipse, {
      x: 0.6, y, w: 1.1, h: 1.1,
      fill: { color: accents[i] }, line: { width: 0 },
    });
    s.addText(labels[i], {
      x: 0.6, y, w: 1.1, h: 1.1,
      fontSize: 32, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Calibri',
    });
    s.addText(title, {
      x: 2.0, y: y + 0.05, w: 10.5, h: 0.55, fontSize: 24, bold: true, color: C.ink, fontFace: 'Calibri',
    });
    s.addText(sub, {
      x: 2.0, y: y + 0.6, w: 10.5, h: 0.5, fontSize: 13, color: C.muted, fontFace: 'Calibri',
    });
  });
}

function buildDividerSlide(pptx, slide) {
  const accent = sectionAccent(slide.section);
  const s = pptx.addSlide();
  s.background = { color: C.navyDark };
  // Accent vertical bar on the left
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: accent }, line: { width: 0 } });
  // Section number — very large
  s.addText(slide.sectionNo, {
    x: 1.0, y: 1.5, w: 11.3, h: 3.0,
    fontSize: 240, bold: true, color: accent, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.sectionTitle, {
    x: 0.5, y: 4.6, w: 12.3, h: 0.9,
    fontSize: 48, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
  });
  s.addShape(pptx.ShapeType.rect, { x: 5.0, y: 5.8, w: 3.33, h: 0.08, fill: { color: accent }, line: { width: 0 } });
  // Section label footer
  s.addText('CIBxRay User Manual · Section ' + slide.sectionNo, {
    x: 0.5, y: 7.1, w: 12.3, h: 0.3,
    fontSize: 10, color: C.muted, italic: true, align: 'center', fontFace: 'Calibri',
  });
}

function buildContentSlide(pptx, slide) {
  const accent = sectionAccent(slide.section);
  const s = pptx.addSlide();
  s.background = { color: C.white };
  // Header bar with section accent on the left
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.7, fill: { color: C.navy }, line: { width: 0 } });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 0.7, fill: { color: accent }, line: { width: 0 } });
  s.addText(slide.title, {
    x: 0.55, y: 0.1, w: 10.5, h: 0.5,
    fontSize: 22, bold: true, color: C.white, fontFace: 'Calibri',
  });
  // Progress dots
  addSectionProgress(pptx, s, slide.section);

  // Body + optional right-side image or placeholder
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

  const hasRightArea = Boolean(slide.screenshot) || slide.showsClassificationLegend;
  const bodyW = hasRightArea ? 6.3 : 12.5;
  s.addText(textItems, {
    x: 0.5, y: 1.0, w: bodyW, h: slide.callout ? 4.2 : 5.9,
    fontFace: 'Calibri', valign: 'top',
  });

  // Optional callout block (left column, below text)
  if (slide.callout) {
    const calloutY = 5.4;
    const calloutW = bodyW;
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: calloutY, w: calloutW, h: 1.3,
      fill: { color: accent === C.section2 ? C.amberSoft : accent === C.section3 ? C.emerGreen : C.skySoft },
      line: { color: accent, width: 0 },
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: calloutY, w: 0.1, h: 1.3,
      fill: { color: accent }, line: { width: 0 },
    });
    s.addText(slide.callout.label, {
      x: 0.75, y: calloutY + 0.12, w: calloutW - 0.4, h: 0.3,
      fontSize: 10, bold: true, color: accent, charSpacing: 3, fontFace: 'Calibri',
    });
    s.addText(slide.callout.text, {
      x: 0.75, y: calloutY + 0.4, w: calloutW - 0.4, h: 0.85,
      fontSize: 13, color: C.ink, italic: true, fontFace: 'Calibri',
    });
  }

  // Right-side screenshot
  if (slide.screenshot) {
    s.addImage({
      path: slide.screenshot,
      x: 7.0, y: 1.0, w: 5.9, h: 5.6,
      sizing: { type: 'contain', w: 5.9, h: 5.6 },
    });
    // Subtle frame
    s.addShape(pptx.ShapeType.rect, {
      x: 7.0, y: 1.0, w: 5.9, h: 5.6,
      fill: { type: 'none' },
      line: { color: C.border, width: 1 },
    });
  }

  // Classification color legend (Red Flags quick-reference slide)
  if (slide.showsClassificationLegend) {
    const legendX = 7.0;
    const legendY = 1.2;
    s.addText('Classification Severity', {
      x: legendX, y: legendY, w: 5.9, h: 0.4,
      fontSize: 14, bold: true, color: C.ink, fontFace: 'Calibri',
    });
    const classes = [
      { label: 'BLW', color: C.clsBLW, desc: 'Bad Loan Written-off — worst' },
      { label: 'BL',  color: C.clsBL,  desc: 'Bad Loan' },
      { label: 'DF',  color: C.clsDF,  desc: 'Doubtful' },
      { label: 'SS',  color: C.clsSS,  desc: 'Substandard' },
      { label: 'SMA', color: C.clsSMA, desc: 'Special Mention Account' },
      { label: 'STD', color: C.clsSTD, desc: 'Standard — clean' },
    ];
    classes.forEach((cls, i) => {
      const rowY = legendY + 0.7 + i * 0.6;
      s.addShape(pptx.ShapeType.rect, {
        x: legendX, y: rowY, w: 0.85, h: 0.45,
        fill: { color: cls.color }, line: { width: 0 },
      });
      s.addText(cls.label, {
        x: legendX, y: rowY, w: 0.85, h: 0.45,
        fontSize: 14, bold: true, color: C.white, align: 'center', valign: 'middle', fontFace: 'Calibri',
      });
      s.addText(cls.desc, {
        x: legendX + 1.0, y: rowY + 0.05, w: 4.9, h: 0.4,
        fontSize: 13, color: C.slate, valign: 'middle', fontFace: 'Calibri',
      });
    });
  }
  return s;
}

function buildClosingSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: C.navyDark };
  // Three accent bars
  s.addShape(pptx.ShapeType.rect, { x: 4.44, y: 2.2, w: 4.44, h: 0.08, fill: { color: C.sky }, line: { width: 0 } });
  s.addText(slide.title, {
    x: 0.5, y: 2.8, w: 12.3, h: 1.0,
    fontSize: 60, bold: true, color: C.white, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.tagline, {
    x: 0.5, y: 3.9, w: 12.3, h: 0.6,
    fontSize: 18, color: C.skyLight, align: 'center', italic: true, fontFace: 'Calibri',
  });
  s.addShape(pptx.ShapeType.rect, { x: 5.67, y: 4.8, w: 2.0, h: 0.08, fill: { color: C.sky }, line: { width: 0 } });
  s.addText('Generated ' + new Date().toISOString().slice(0, 10), {
    x: 0.5, y: 5.1, w: 12.3, h: 0.4,
    fontSize: 12, color: C.muted, align: 'center', fontFace: 'Calibri',
  });
  s.addText('IDLC Finance PLC · Credit Bureau Intelligence Platform', {
    x: 0.5, y: 5.6, w: 12.3, h: 0.4,
    fontSize: 11, color: C.muted, align: 'center', italic: true, fontFace: 'Calibri',
  });
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
