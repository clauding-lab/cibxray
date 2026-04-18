# Phase 2 (part 1) — Audit Trail + Print View — Design

**Date:** 2026-04-18
**Status:** Draft · pending user approval
**Context:** Items 1 and 2 of Phase 2 in `CIBxRay-Production-Roadmap.md` (audit-trail stamp + 1-page A4 print view). Items 3 (view-source affordance) and 4 (headline reason above the fold) are deferred to a follow-up spec. The analyst-name sub-item of the audit stamp is explicitly deferred to Phase 6 (bank deployment), where the attribution model depends on the hosting decision (dedicated laptops vs shared terminals vs intranet SSO).

---

## Problem

Today every CIBxRay report is ephemeral. A banker looks at the score, closes the tab, and the artifact disappears. Two consequences:

1. **No defensible paper trail.** A printed report pulled from a credit file six months later can't answer *"when was this run, against which methodology, from which PDF?"* That makes it unsuitable for regulatory loan files under Bangladesh Bank CIB reporting practice.
2. **`Ctrl+P` produces an unreadable mess.** The screen layout is optimised for interactive exploration, not for a credit-memo attachment. Bankers fall back to screenshots, which is even worse as an artifact.

Both fail the same bar: the report is not portable across time. Until it is, the tool can't enter a regulated credit file.

## Non-goals

- **Analyst attribution on reports.** Prompt-once / confirm-per-session name stamping is deferred to Phase 6, which is where the deployment environment (dedicated laptops vs shared terminals vs intranet SSO) is settled; the right attribution UX differs materially between them. Roadmap updated accordingly.
- **Headline reason above the fold + greyed-out breakdown on override.** Phase 2 item 4, deferred to a follow-up spec. The print layout naturally places score + top-line reason side-by-side, so a reduced version of "headline reason" does appear on print — but the interactive on-screen relocation is out of scope here.
- **View-source affordance on numbers.** Phase 2 item 3, deferred to a follow-up spec.
- **PDF generation library** (`html2pdf`, `jspdf`). The browser's native print dialog already supports "Save as PDF," which is enough for the credit-memo workflow. Adding a JS PDF library would ship ~200KB of extra bundle for no banker-facing benefit.
- **Multi-browser print rendering coverage.** Unit tests cover pure logic; print CSS is verified visually on Chrome only for v1. Safari/Firefox divergence is an acceptable deferred risk.
- **Persisting reports or PDFs anywhere.** CIBxRay stays stateless. The fingerprint is a checksum, not a lookup key.

## Approach

Two user-visible surfaces. Both draw from the same stamp data, computed once at upload.

### Surface 1 — Audit stamp

At upload time, a new pure function `computeStamp(file, arrayBuffer)` produces:

```
{
  analyzedAt: '2026-04-18T08:32:00.000Z',   // UTC ISO, rendered in Dhaka TZ
  methodologyVersion: 'v1.0',                // hardcoded constant
  appBuild: 'a4f291c',                       // git short SHA, Vite-injected at build
  pdfFingerprint: '3f2a9c8b4d1e7a60'         // first 16 hex of SHA-256(pdf bytes)
}
```

This attaches to the parsed report as `report.stamp` — immutable for the session, zero persistence.

A single `<AuditStamp/>` component renders the four fields in a small footer row and is used in *both* the on-screen report and the print view. Same data, same component, so they can't drift.

Rendering format:

```
Analysed 18 Apr 2026 14:32 Asia/Dhaka     Methodology v1.0
App build a4f291c                         PDF 3f2a9c8b4d1e
```

Monospace for the two hashes; muted grey; two-column layout collapsing to one column below 600px.

**Why SHA-256 of full bytes:** this is the standard compliance auditors recognise. Cost is invisible in practice (~100ms on a typical CIB via `crypto.subtle.digest`, ~500ms on a 1000-page outlier). The fingerprint is never used to *look up* anything; an auditor who wants to verify a report matches an archived PDF re-runs the hash independently (`shasum -a 256`) and compares.

**Why Dhaka TZ rendering even though storage is UTC:** banker-facing strings never show browser-local time. `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', ... })` makes this deterministic regardless of where the laptop is.

### Surface 2 — Print view

A dedicated print entry point at `/#print`, activated by:

- **Trigger:** new "Print report" button near the score on the screen view. On click, writes `report` + `stamp` to `sessionStorage['cibxray.printPayload']`, opens `/#print` in a new tab.
- **Mount:** `PrintReport.jsx` reads from `sessionStorage`, renders the A4 layout, calls `window.print()` after 300ms (lets layout settle, fonts load).
- **Unload:** on `beforeunload`, clears the sessionStorage key. Nothing survives tab close.
- **Direct access:** if `/#print` is opened without a populated `sessionStorage`, redirect back to `/` with a toast: *"Re-upload the PDF — reports aren't stored."*

No router dependency; `window.location.hash === '#print'` is a one-line check at the top of `App.jsx` that conditionally renders `<PrintReport/>` instead of the main UI.

**Layout — 1-page A4 portrait, summary-first:**

```
┌───────────────── A4 PORTRAIT (188mm × 273mm usable) ──────────┐
│                                                                │
│ ACME CORPORATION LIMITED                                       │
│ CIB reporting date: 28 Feb 2026                                │
│ ───────────────────────────────────────────────────────────── │
│                                                                │
│                  ┌──────────────┐                              │
│                  │    42 /100   │   Live funded borrower       │
│                  └──────────────┘   Overdue    ████░░ 60%      │
│                                     Utilization ██░░░ 30%     │
│                                     Mix         ██░░░ 10%     │
│                                                                │
│   Adverse cap active: live SMA at ABC Bank                     │
│   Parse quality: reconciled (gap within threshold)             │
│                                                                │
│ ───────────────────────────────────────────────────────────── │
│                                                                │
│ TOP FACILITIES (by outstanding)                                │
│   Bank       Facility     Class  Outstanding   Overdue         │
│   ─────────  ──────────── ──────  ───────────  ────────────    │
│   ABC Bank   Cash Credit  SMA    BDT 12.40 Cr  BDT 0.45 Cr     │
│   XYZ Bank   Term Loan    STD    BDT  8.20 Cr  —               │
│   ...                                                          │
│   8 more facilities — see source CIB PDF                       │
│                                                                │
│ ───────────────────────────────────────────────────────────── │
│                                                                │
│ Analysed 18 Apr 2026 14:32 Asia/Dhaka      Methodology v1.0    │
│ App build a4f291c                          PDF 3f2a9c8b4d1e    │
└────────────────────────────────────────────────────────────────┘
```

**Truncation rule:** `selectTopFacilities(facilities, 10)` returns the top 10 by outstanding, descending. Tiebreak: live before historical, funded before non-funded, then stable. If ≤10 exist, all shown. If >10, the "N more facilities — see source CIB PDF" row is appended. The fingerprint binds the printed page back to the full CIB, so truncation is safe.

**Print states:**

| State | Print button | `/#print` behaviour |
|---|---|---|
| Normal (`parseQuality.tier === 'ok'` or `minor`, `dataTier === 'live'`) | Enabled | Full layout |
| `dataTier === 'first-timer'` | Enabled | Score block shows fixed 65 + blue tier note inline |
| `dataTier === 'historical-clean'` | Enabled | Score block shows fixed 80 + blue tier note inline |
| `parseQuality.tier === 'major'` | Disabled (tooltip: *"Score hidden due to parse mismatch. Print not available."*) | Never reached |
| `parseQuality.tier === 'unavailable'` | Enabled | Full layout, banner shown below score: *"Summary section unreadable — reconciliation skipped"* |
| No upload yet | Button absent (no report to print) | Redirect to `/` with toast |

**CSS:** `@page { size: A4 portrait; margin: 12mm; }` plus `@media print { body > *:not(.print-root) { display: none; } }`. The `.print-root` container is `188mm × 273mm` (A4 minus margins), matching what browser print preview shows.

### Surface 3 (internal) — Extraction

To avoid duplicating score/facility rendering between screen and print, and to pull `App.jsx` off its 1081-line cliff, three pieces move out:

```
src/components/report/
├── ScoreBlock.jsx       — large score display + dataTier note
├── BreakdownBars.jsx    — Overdue / Utilization / Mix bars
└── FacilityTable.jsx    — with `variant="screen" | "print"` prop
```

`variant="screen"` shows all facilities with full columns (Bank, Facility Type, Classification, Nature, Status, Outstanding, Overdue, Limit, LC/BG details as applicable); `variant="print"` caps at 10 rows and shows only the five columns that fit A4 width: Bank, Facility, Classification, Outstanding, Overdue. Shared row-rendering logic; one component, two column sets.

**Scope:** only what's needed for reuse. Upload flow, banners, modals, parse-quality UI stay inline in `App.jsx`. Estimated net delta on `App.jsx`: **−170 lines** (−200 extracted, +30 for print button + hash check + sessionStorage). Lands near 910 lines — still over the 800 guideline but decisively moving in the right direction.

## Data flow

```
Upload PDF
 │
 ├─► parseBBCIB(file) ──────────► report
 ├─► assessParseQuality(report) ─► report.parseQuality
 └─► computeStamp(file, bytes) ──► report.stamp
 │
 ▼
Screen view
 ├─ existing sections (unchanged)
 ├─ <ScoreBlock/>      (extracted)
 ├─ <BreakdownBars/>   (extracted)
 ├─ <FacilityTable variant="screen"/>  (extracted)
 ├─ <AuditStamp/>      (new, footer)
 └─ "Print report" button (new)
         │
         │ click
         ▼
   sessionStorage.set('cibxray.printPayload', { report })
   window.open('/#print', '_blank')
         │
         ▼
/#print → <PrintReport/>
 ├─ sessionStorage.get + parse
 ├─ <ScoreBlock/>
 ├─ <BreakdownBars/>
 ├─ <FacilityTable variant="print"/>
 ├─ <AuditStamp/>       (same component, same data)
 └─ window.print() after 300ms
         │
         ▼
     beforeunload → sessionStorage.remove
```

## Files

### New

- `src/stamp/computeStamp.js` — pure; SHA-256 via `crypto.subtle.digest`; returns the four-field stamp.
- `src/stamp/formatDhaka.js` — pure; `formatDhakaTimestamp(isoString)` → `"18 Apr 2026 14:32"`.
- `src/constants/methodology.js` — exports `METHODOLOGY_VERSION = 'v1.0'`.
- `src/components/AuditStamp.jsx` — renders the stamp in both screen and print.
- `src/components/PrintReport.jsx` — full A4 layout container.
- `src/components/report/ScoreBlock.jsx` — extracted.
- `src/components/report/BreakdownBars.jsx` — extracted.
- `src/components/report/FacilityTable.jsx` — extracted, `variant` prop.
- `src/components/report/selectTopFacilities.js` — pure; top-N by outstanding with tiebreaks.
- `src/styles/print.css` — `@page` + `@media print` rules.
- `lib/computeStamp.test.js` — 5 tests.
- `lib/formatDhaka.test.js` — 4 tests.
- `lib/selectTopFacilities.test.js` — 5 tests.

### Modified

- `src/App.jsx` — call `computeStamp` after parse, attach to report; render `<AuditStamp/>` in footer; add "Print report" button; hash-check at the top for `#print` branch; swap inline score/facility JSX for the extracted components.
- `vite.config.js` — inject `__APP_BUILD__` from `git rev-parse --short HEAD` at build time; fallback `'dev'` for dev mode.

### Untouched

- `src/parser/*` — unchanged.
- `src/scoring/calcScore.js` — unchanged.
- Phase 1 components (`ParseQualityBanner`, tier notes) — unchanged.

## Decisions made

- **SHA-256, first 16 hex chars on display.** Full hash computed, displayed truncated for readability. Recognised by auditors, perf is invisible in practice. Fingerprint is a checksum, not a lookup key — CIBxRay never stores anything.
- **Stateless model.** No persistence of reports, PDFs, fingerprints, or stamps beyond the current session. Aligns with Phase 3's data-wipe goal (pull-forward, not deferred).
- **Dhaka TZ rendering, UTC storage.** Deterministic banker-facing output regardless of browser locale.
- **Methodology version = hardcoded constant.** Bumped manually when penalty weights or tier thresholds change. First shipped value: `v1.0` (covers the Phase 1 reconciliation: SMA 20%, DF 80%, SS 50%, BL/BLW 100%; plus first-timer 65 / historical-clean 80 tiers).
- **App build = git short SHA, Vite-injected at build.** Auto-updates every deploy, zero maintenance.
- **Dedicated `/#print` route via hash check, no router dependency.** Simplest glue; no new npm package.
- **sessionStorage for data handoff, cleared on unload.** No URL params carry PDF data; no persistence across reloads.
- **Summary-first layout, 10-facility truncation.** The printed page is a decision summary, not a CIB transcript. The fingerprint binds it back to the full PDF.
- **Native browser print, not JS PDF library.** "Save as PDF" from the browser print dialog covers the credit-memo workflow without a bundle-size hit.
- **Targeted extraction (ScoreBlock, BreakdownBars, FacilityTable) as part of Phase 2.** Serves the current goal (avoid duplication between screen and print, keep App.jsx from spiraling). Upload flow, banners, and unrelated UI stay inline.
- **`FacilityTable` uses a `variant` prop** rather than two separate components. One row-rendering source of truth; variant differences (row cap, column set) are pure config.
- **Print button disabled on `parseQuality.tier === 'major'`.** Consistent with the screen's score-hiding behaviour from Phase 1 — if the score isn't shown, there's nothing to print.
- **Analyst name deferred to Phase 6.** Roadmap updated to call out that the attribution UX depends on the deployment environment.

## Testing

**Unit tests** (Node `node --test`, same convention as Phase 1):

| File | Tests | Coverage |
|---|---|---|
| `lib/computeStamp.test.js` | 5 | mocked `crypto.subtle` → correct SHA-256 hex slice; deterministic output for same bytes; different bytes → different fingerprints; stamp shape; version + build wired from injected constants |
| `lib/formatDhaka.test.js` | 4 | UTC input → Dhaka string regardless of `process.env.TZ`; 00:00 Dhaka boundary; format `"18 Apr 2026 14:32"`; edge-case midnight rollover |
| `lib/selectTopFacilities.test.js` | 5 | ≤10 → all returned; >10 → top 10 by outstanding descending; tiebreak live > historical, funded > non-funded; stable sort under ties; empty input → empty output |

Target: **14 new tests**, suite total **49** (35 existing + 14 new).

**Visual / manual checks** (recorded in post-merge session notes):

- `npm run dev` → upload a real CIB → click "Print report" → browser print preview shows a single A4 page, nothing cut off, audit stamp visible at the bottom.
- On-screen audit stamp string === print-view audit stamp string (byte-identical).
- Same PDF uploaded in two separate sessions → identical fingerprint.
- `shasum -a 256 <pdf> | cut -c1-16` in terminal matches the displayed fingerprint.
- `parseQuality.tier === 'major'` case → "Print report" button disabled, tooltip visible.
- First-timer / historical-clean PDFs → score block shows fixed 65 / 80 with blue tier note.

**Build + deploy verification** (pattern from Phase 1):

- `npm run build` passes locally.
- Vercel build passes; preview deploy reflects the changes.
- Post-deploy curl of the authed root still returns the access-gated shell.
- Manual smoke on the deployed URL: login → upload → print.

## Out-of-scope risks (documented, not addressed)

- Chrome print renders correctly; Safari and Firefox may show minor spacing differences. Acceptable for v1.
- A 1000-page CIB would hash in ~500ms. If any real CIB exceeds this and becomes a UX concern, revisit with a web-worker-based hash. Not a Phase 2 blocker.
- If a banker uploads two PDFs that differ only in metadata (author, timestamp) but produce identical content, the fingerprints will differ. This is the correct behaviour — bytes are the source of truth, not content.
- "Share link to report" is out of scope. There is nothing to link to because nothing is stored.

## Exit gate

1. Unit test suite reports `# tests 49 / pass 49 / fail 0`.
2. Uploading a real CIB to `cibxray.vercel.app`, clicking "Print report," and pressing **Save as PDF** in the browser print dialog produces a 1-page A4 file with the audit stamp, score, top-10 facility table, and no visible chrome or upload UI.
3. Opening the saved PDF six months later and running `shasum -a 256` on the *original* CIB PDF matches the fingerprint on the printed footer.
4. `App.jsx` line count strictly decreases.
5. No new npm dependencies added.
