// User Manual .pptx export — a banker-facing reference deck covering the
// full CIBxRay feature set: tab tour, scoring rules, group detection, KYC,
// accuracy checks, error banners, print audit, red flags, exported files,
// and data privacy.
//
// Filename: CIBxRay_UserManual_<YYYY-MM-DD>.pptx
//
// pptxgenjs is loaded via dynamic import so it never inflates the main
// bundle — users only pay the ~250KB cost when they click the Manual button.

const BRAND = {
  navy:    '#0c1a3d',
  accent:  '#0ea5e9',
  darkBg:  '#020617',
  slate:   '#334155',
  muted:   '#64748b',
  light:   '#f8fafc',
  white:   'FFFFFF',
  ink:     '0F172A',
  sky:     '7DD3FC',
};

export const MANUAL_SLIDES = [
  // ── 1. Title ────────────────────────────────────────────────────────
  {
    title: 'CIBxRay',
    subtitle: 'Credit Bureau Intelligence Platform\nBanker\'s User Manual',
    kind: 'title',
  },

  // ── 2. What is CIBxRay ──────────────────────────────────────────────
  {
    title: 'What CIBxRay does',
    body: [
      'Parses Bangladesh Bank CIB PDF reports and turns them into structured, scored credit intelligence.',
      'Built for IDLC Finance SME + Corporate credit teams.',
      'Single-borrower or whole-group analysis — upload one PDF or a batch.',
      'Fully client-side: PDFs are parsed in your browser, never uploaded to a server.',
    ],
  },

  // ── 3. Upload & Processing ──────────────────────────────────────────
  {
    title: 'Uploading reports',
    body: [
      'Drag-and-drop PDFs onto the upload pane, or click to browse.',
      'Batch upload supported — drop an entire group of CIBs at once.',
      'Filename pattern controls group detection: the numeric ref-base is the group key.',
      '  • Applying concern — bare base (e.g. 1011500041801.pdf)',
      '  • Sister concern — hyphen suffix (e.g. 1011500041801-3.pdf)',
      'Mixing different bases in one upload raises a warning banner.',
    ],
  },

  // ── 4. Tab Overview ─────────────────────────────────────────────────
  {
    title: 'Nine tabs — at a glance',
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
    ],
  },

  // ── 5. Summary & Rating ─────────────────────────────────────────────
  {
    title: 'Tab tour — Summary & Rating',
    body: [
      'Final score (0–100) via 3-factor weighted model + penalty:',
      '  • Overdue History (60%) — current overdue + past adverse',
      '  • Utilization (30%) — outstanding / sanctioned limit',
      '  • Facility Mix (10%) — balance of funded / non-funded',
      '  • Penalty (up to −50) — live DF / BL / BLW / SMA + historical',
      'Five KPI cards: Live Facilities, Total Limit, Outstanding, Overdue, Utilization.',
      'Flag block — Clean Classification / Zero Overdue / High Utilization.',
    ],
  },

  // ── 6. Borrower / Guarantor ─────────────────────────────────────────
  {
    title: 'Tab tour — Borrower / Guarantor',
    body: [
      'Filters the facility list to the borrower role group (Borrower + Co-Borrower) or Guarantor.',
      'Split into Funded and Non-Funded groups with live and terminated sections.',
      'Full facility table with classification, outstanding, overdue, NPI, history.',
      'Repayment Timeline — month-by-month outstanding + overdue chart with classification dot color.',
      'Filter dropdown — aggregate view, by status, by nature, or any single facility.',
    ],
  },

  // ── 7. Exposure Analytics ───────────────────────────────────────────
  {
    title: 'Tab tour — Exposure Analytics',
    body: [
      'Live Loans EMI — sum of installment amounts across live borrower-role facilities.',
      'Guaranteed exposure — installment + non-installment amounts where role is Guarantor.',
      'New facilities in last 24 months — count + total sanction amount.',
      'Peak exposure — highest term-loan / non-installment / cumulative amounts at any point.',
      'Peak monthly EMI — maximum monthly installment burden.',
      'Reschedule history — count and last date as borrower and guarantor.',
    ],
  },

  // ── 8. Behavioral Signals ───────────────────────────────────────────
  {
    title: 'Tab tour — Behavioral Signals',
    body: [
      'Loans with unchanged outstanding — hidden NPL signal; the borrower is not reducing balance.',
      'Loans with sudden multiple overdue — NPI jumps of 2+ in a month.',
      'Continuous overdue — facilities overdue for 3+ consecutive months.',
      'Incremental burden 12M / 24M — change in monthly EMI versus the peak in that window.',
      'Cumulative highest EMI — peak monthly burden across all facilities.',
    ],
  },

  // ── 9. Credit Cards ─────────────────────────────────────────────────
  {
    title: 'Tab tour — Credit Cards',
    body: [
      'Per-card 6-metric summary:',
      '  • Consistent full payment — never rolled a balance',
      '  • Partial payment frequency — rolled but minimum met',
      '  • Missed minimum — short of the minimum at any point',
      '  • Limit utilization trend — rising / stable / falling',
      '  • Delinquency episodes — months with NPI ≥ 1',
      '  • Peak NPI — worst streak in window',
      '12-month delinquency bar — green / amber / red cells by month.',
    ],
  },

  // ── 10. Red Flags ───────────────────────────────────────────────────
  {
    title: 'Tab tour — Red Flags',
    body: [
      'Critical (red) — must review before approval:',
      '  • Live Defaulter / Bad-Loss / Written-Off facility',
      '  • Lawsuit filed',
      'Warning (amber) — elevated risk, not an auto-decline:',
      '  • Live SMA, historical SS/DF/BL/BLW',
      '  • Expired CIB (>60 days old)',
      '  • Unverified Name / NID (Bangladesh Bank marker = false)',
      'Count badge on the tab label — zero hides, non-zero shows red.',
    ],
  },

  // ── 11. Linked Entities ─────────────────────────────────────────────
  {
    title: 'Tab tour — Linked Entities',
    body: [
      'Sister concerns extracted from inside the CIB PDF itself (not uploaded files).',
      'Each linked proprietorship shows trade name + CIB code.',
      'For corporates: also shows directors, partners, and their individual CIB codes.',
      'Use this to plan which other CIBs to request for a full group picture.',
    ],
  },

  // ── 12. Export Tab ──────────────────────────────────────────────────
  {
    title: 'Tab tour — Export',
    body: [
      'Retail Lending Analytics (.xlsx, 9 sheets) — single-concern deep-dive in CRM-CD Dashboard V2 layout.',
      'Wholesale Lending Analytics (.xlsx, 12 sheets) — group-level workbook in Corporate Template layout. Needs 2+ reports loaded.',
      'Summary for Credit Committee (.docx) — one-page applying-concern + group liability tables.',
      'Technical Export (.xlsx) — legacy raw exporter; kept for power users.',
      'Print report — printable 1-page summary via the browser\'s print dialog.',
    ],
  },

  // ── 13. Group Detection Rule ────────────────────────────────────────
  {
    title: 'Key rule — Group detection',
    body: [
      'The applying concern is identified by filename, not by subject relationships.',
      'Rule:',
      '  1. Strip the .pdf extension; parse /^(\\d+)(-\\d+)?/',
      '  2. Applying concern — the file with no hyphen-suffix (bare base)',
      '  3. Sisters — files with hyphen suffix sharing the same base',
      '  4. Error — two or more bare bases → banner "upload one group at a time"',
      'Consequence: different ref-base = different group. No exceptions.',
    ],
  },

  // ── 14. KYC & Accuracy Checks ───────────────────────────────────────
  {
    title: 'Key rule — KYC + accuracy',
    body: [
      'KYC fields extracted per subject — Ref No, CIB Code, NID 17/10, TIN, Reg No, DOB, address, gender, sector.',
      'Bangladesh Bank verified markers — each KYC field surfaces the BB verified true/false flag.',
      'Summary vs facilities reconciliation — parse quality tier:',
      '  • OK — summary and facility totals match',
      '  • Minor — gap < 1% or < 10,000 BDT → yellow banner',
      '  • Major — gap ≥ threshold → red banner + score hidden + print disabled',
      '  • Unavailable — no summary block found → yellow banner',
    ],
  },

  // ── 15. Error Banners ───────────────────────────────────────────────
  {
    title: 'Error banners — what they mean',
    body: [
      'Parse quality: Minor (yellow) — verify before trusting totals.',
      'Parse quality: Major (red) — score hidden, print disabled, re-upload the PDF.',
      'Multiple root references — filename bases conflict; upload one group at a time.',
      'Expired CIB — inquiry date > 60 days old; request fresh report.',
      'Unverified Name / NID — Bangladesh Bank has not verified this field; confirm identity manually.',
      'Print: popup blocked — allow popups for cibxray.vercel.app.',
      'Print: report too large — reduce batch size or switch browser.',
    ],
  },

  // ── 16. Print Audit Measures ────────────────────────────────────────
  {
    title: 'Print report — audit measures',
    body: [
      'Audit stamp — printed on every report: date, time, signed-in user, app build version.',
      'Data tier note — prints whether the CIB had sufficient data for a full score or limited history.',
      'Stale-payload guard — the print tab must open within 10 seconds of click; otherwise errors out.',
      'Parse-quality lock — print disabled when parseQuality.tier === "major".',
      'Raw PDF text is stripped from the print payload before transfer — no leakage through localStorage.',
    ],
  },

  // ── 17. Scoring Methodology ─────────────────────────────────────────
  {
    title: 'Scoring — under the hood',
    body: [
      'Three positive factors (0–100 each) with fixed weights:',
      '  • Overdue History — 60%   • Utilization — 30%   • Facility Mix — 10%',
      'Weighted subtotal gives the base score.',
      'Classification penalty (up to −50 points) applied for adverse live classifications, weighted by each facility\'s outstanding share.',
      'Auto-decline override — any live BL / BLW / Written-Off forces an UNACCEPTABLE band regardless of score.',
      'Data tier note — when inquiry date is recent but history is short, the score is marked as "Limited data" for transparency.',
    ],
  },

  // ── 18. Data Privacy ────────────────────────────────────────────────
  {
    title: 'Data privacy',
    body: [
      'PDF parsing runs entirely in your browser. The PDF bytes never leave your machine.',
      'Scoring, analytics, and chart rendering — all client-side.',
      'Print handoff uses localStorage only — no network round-trip.',
      'Raw PDF text is stripped from the print payload before serialization.',
      'Excel and Word downloads are generated in-browser; no server-side compilation.',
    ],
  },
];

// ── Slide assembly ──────────────────────────────────────────────────────

function buildTitleSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: BRAND.darkBg.slice(1) };
  s.addText(slide.title, {
    x: 0.5, y: 2.3, w: 12.3, h: 1.2,
    fontSize: 60, bold: true, color: BRAND.white, align: 'center', fontFace: 'Calibri',
  });
  s.addText(slide.subtitle, {
    x: 0.5, y: 3.7, w: 12.3, h: 1.6,
    fontSize: 22, color: BRAND.sky, align: 'center', fontFace: 'Calibri',
  });
}

function buildContentSlide(pptx, slide) {
  const s = pptx.addSlide();
  s.background = { color: 'FFFFFF' };
  // Accent bar
  s.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.6, fill: { color: BRAND.navy.slice(1) } });
  s.addText(slide.title, {
    x: 0.4, y: 0.05, w: 12.5, h: 0.5,
    fontSize: 22, bold: true, color: BRAND.white, fontFace: 'Calibri',
  });
  // Body
  const body = Array.isArray(slide.body) ? slide.body : [slide.body];
  const text = body.map(line => ({
    text: line,
    options: line.trim().startsWith('•') || /^\s/.test(line)
      ? { bullet: false, indentLevel: 1, fontSize: 15, color: BRAND.slate }
      : { bullet: { code: '25CF' }, fontSize: 16, color: BRAND.ink, bold: false },
  }));
  s.addText(text, {
    x: 0.6, y: 1.0, w: 12.1, h: 5.8,
    fontFace: 'Calibri', paraSpaceAfter: 8,
  });
  // Footer
  s.addText('CIBxRay — Banker\'s User Manual', {
    x: 0.4, y: 6.85, w: 12.5, h: 0.3,
    fontSize: 9, color: BRAND.muted, italic: true, fontFace: 'Calibri',
  });
}

/**
 * Build the pptx.Presentation. Pure — no IO.
 * Uses pptxgenjs dynamic import so the library doesn't inflate the main bundle.
 * @returns {Promise<object>} pptxgenjs presentation instance
 */
export async function buildUserManualPptx() {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 inches
  pptx.title = 'CIBxRay User Manual';
  pptx.author = 'CIBxRay';
  pptx.company = 'IDLC Finance PLC';
  pptx.subject = 'Banker\'s User Manual';

  for (const slide of MANUAL_SLIDES) {
    if (slide.kind === 'title') buildTitleSlide(pptx, slide);
    else buildContentSlide(pptx, slide);
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
  // writeFile triggers a browser download natively
  await pptx.writeFile({ fileName });
}
