# Phase 1 — Parse Trust + Scoring Edge Cases — Design

**Date:** 2026-04-18
**Status:** Draft · pending user approval
**Context:** Items 1, 2, and 4 of Phase 1 in `CIBxRay-Production-Roadmap.md`. Item 3 (methodology reconciliation to SMA 20% / DF 80%) was shipped earlier this session in commit `40a833d`.

---

## Problem

CIBxRay currently produces a confident-looking credit score for every file it accepts, whether or not the parse actually succeeded. Three concrete failure modes ship bad numbers to bankers today:

1. **Silent scanned-PDF "100/100".** A scanned CIB uploaded by mistake produces near-zero extracted text. The parser still completes, finds no facilities, and `calcScore` returns a high score (no overdue, no utilization, clean facility mix).
2. **Silent partial parse.** If the parser misses some facility rows — because of a new layout, a rendering glitch, or a regex gap — the facilities that WERE parsed are scored on their own. The banker sees a plausible number with no indication that it's based on incomplete data.
3. **Silent "no live funded" → high score.** A borrower with only historical or only non-funded facilities gets `os=100, us=100` and a base score in the 90s, which reads as *"clean, lend freely"* when the real signal is *"nothing to score here."*

All three have the same failure mode: the tool asserts confidence it hasn't earned. In SME credit, a fabricated score shows up in audit files and loan post-mortems.

## Non-goals

- Advanced OCR'd-scan detection (PDFs with both image content AND an embedded OCR text layer). Rare in practice; the reconciliation check in item (2) below is the backstop.
- Historical-clean dynamic scoring. Keeping fixed 80 per decision; can revisit after Phase 1 ships.
- Persisting parse-quality signals to exports / print view. That is Phase 2 (audit trail) scope.
- Retroactive re-scoring of already-loaded reports when parse-quality heuristics change. Out of scope; the banker can re-upload.

## Approach

Three user-visible surfaces. All three are independent of Bangladesh Bank's specific wording, so they survive format tweaks.

### Surface 1 — Upload-time scan refusal (item 2 of the roadmap)

Before `parseBBCIB` runs, inspect the PDF's operator list via PDF.js. If no page in the document contains a text-drawing operator (`showText`, `showSpacedText`), the file is a pure image PDF — refuse the upload with a banker-facing message:

> *"This looks like a scanned image. Please upload the text-based PDF from Bangladesh Bank, not a scan."*

This is format-independent (works for 2-page or 1000-page CIBs) and wording-independent (survives any BB layout change). It does NOT catch pre-OCR'd scans; the reconciliation check below is the backstop for those.

### Surface 2 — Parse-quality reconciliation (item 1 of the roadmap)

After `parseBBCIB` produces a `report`, a new pure function `assessParseQuality(report)` compares the PDF's summary header against the facility-level extractions. Two checks:

- **Outstanding.** `sum(facilityOutstanding where status=Live && nature=Funded)` vs `report.summary.totalOutstanding`.
- **Overdue.** `sum(facilityOverdue where status=Live && nature=Funded)` vs `report.summary.totalOverdue`.

Threshold per check:

- **Match** — gap ≤ **max(1% of summary value, BDT 1 lakh)**. No banner.
- **Minor mismatch** — gap > match threshold, ≤ 2x match threshold. Amber banner above the score, score still shown, with the specific numbers cited.
- **Major mismatch** — gap > 2x match threshold. Score hidden, red-state card in its place.

Tier is the **worst** tier across both checks. A major mismatch on either field is a major mismatch overall.

If the PDF's summary block could not be parsed at all (no `report.summary.totalOutstanding`), the reconciliation cannot run. In that case `assessParseQuality` returns `tier: 'unavailable'`, which renders as its own neutral banner (*"Could not locate summary section — reconciliation skipped."*) — not promoted to `major`, because we don't know whether the parse is actually wrong, and not demoted to `minor`, because no comparison was possible.

### Surface 3 — Tiered scoring for zero-live-funded cases (item 4 of the roadmap)

`calcScore` gains a `dataTier` field in its return value, classifying the borrower's data availability:

| `dataTier` | Condition | Score |
|---|---|---|
| `"live"` | Any live funded facility exists | Current math (unchanged) |
| `"historical-clean"` | No live funded, AND all historical funded are UC/STD | **Fixed 80** with note *"Based on historical repayment only. No current funded exposure."* |
| `"first-timer"` | No funded facilities at all (only non-funded OR completely empty) | **Fixed 65** with note *"First-time funded borrower / no repayment history. Use business judgment."* |

The existing adverse-override logic (live SS/DF/BL, live SMA, historical adverse) still applies and takes precedence over the `historical-clean` tier — a historical DF still caps at 59.

### Defensive clamps

Inside `calcScore`, any numeric facility input (`limit`, `outstanding`, `overdue`) is clamped to `max(0, value)` with `Number.isFinite` guarding against NaN. Silent bad-math protection; no user-visible behavior change for clean inputs.

## Architecture

### New files

- **`src/parser/scanDetect.js`** — single export `isScannedPdf(pdfDoc)`. Accepts a pdfjs-loaded `PDFDocumentProxy`, iterates pages, returns `true` if no page contains any text operator. ~30 lines.
- **`src/parser/parseQuality.js`** — single export `assessParseQuality(report)`. Pure function. Returns `{ tier: 'ok'|'minor'|'major'|'unavailable', issues: Array<{ field, summaryValue, computedValue, gap, gapPct, threshold }> }`. ~60 lines.

### Modified files

- **`src/parser/pdfToText.js`** — after opening the PDF and before extracting text, runs `isScannedPdf`. Throws a typed error `new Error('SCANNED_PDF')` that the upload handler catches and surfaces as a user-facing message. ~5-line change.
- **`src/scoring/calcScore.js`** — adds:
  - Defensive input clamps at the top.
  - `dataTier` computation.
  - Tier-based short-circuit for `historical-clean` and `first-timer` (return fixed score + tier + note, skipping base/penalty math).
  - New field in return: `dataTier` and `dataTierNote`.
- **`src/App.jsx`** — three touch points:
  - Upload handler catches `SCANNED_PDF` error → shows banker-facing message, does not add file to report list.
  - Report view renders the parse-quality banner (minor) or red-card (major) above the score block.
  - Report view renders the `dataTierNote` when present.

No new dependencies.

## Data flow

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  File upload  │────▶│  pdfToText    │────▶│  parseBBCIB   │────▶│  calcScore    │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
                             │                      │                      │
                             ▼                      ▼                      ▼
                      isScannedPdf           assessParseQuality       dataTier +
                             │                      │                   clamps
                             │ if true:             │
                             ▼                      ▼
                    throw SCANNED_PDF        { tier, issues }
                             │                      │
                             └──────────┐   ┌───────┘
                                        ▼   ▼
                                  App.jsx renders:
                                  · scan-refusal UI
                                  · minor banner
                                  · major red-card
                                  · dataTier note
```

## Error handling

- `SCANNED_PDF` error → caught in `App.jsx` upload handler, translated to a modal or inline banker message. File NOT added to report list.
- Parse failure inside `parseBBCIB` → existing "No subject or facility data extracted" error path (unchanged).
- `assessParseQuality` returning `unavailable` (summary section could not be parsed) → banner *"Could not locate summary section — reconciliation skipped."* but score still displayed.
- Negative / NaN numeric input → silently clamped to 0. No user message; this is defensive-programming territory.

## Testing

### Unit (using the same `node --test` setup added in the access-gate work)

- **`assessParseQuality`** — parameterized tests covering:
  - Exact match → `ok`.
  - Gap 0.5% of total → `ok` (under 1% threshold).
  - Gap exactly at threshold → `ok`.
  - Gap between 1x and 2x threshold → `minor`.
  - Gap > 2x threshold → `major`.
  - Small loan (BDT 5 lakh), gap of BDT 80,000 → `ok` (because absolute 1-lakh floor wins over 1%).
  - No summary section in report → `unavailable`.
  - Major on outstanding + ok on overdue → overall `major`.
  - Minor on outstanding + major on overdue → overall `major`.
- **`calcScore`**:
  - New: zero live funded + all historical UC/STD → tier `historical-clean`, total 80, note present.
  - New: zero funded facilities of any kind → tier `first-timer`, total 65, note present.
  - New: negative outstanding input → clamped, no NaN in output.
  - New: NaN outstanding input → clamped, no NaN in output.
  - Existing tests (if any) remain green. Penalty-weight change from this session's commit `40a833d` is already absorbed.
- **`isScannedPdf`** — mocked `PDFDocumentProxy` with:
  - No text operators on any page → `true`.
  - Text operators on one page → `false`.
  - Mixed (image page + text page) → `false`.

### Integration (manual, via `npm run dev`)

- Upload a known-good real CIB PDF → scored as before, no banner.
- Upload the same CIB with one facility row hand-removed from a copied text file → major banner appears.
- Upload a pure image PDF (any scan) → upload refused with scan message.
- Upload a report where the borrower has only terminated facilities → `historical-clean` tier, score 80, note.
- Upload a report where the borrower has only non-funded facilities → `first-timer` tier, score 65, note.

## File inventory

| File | Change |
|---|---|
| `src/parser/scanDetect.js` | NEW |
| `src/parser/parseQuality.js` | NEW |
| `src/parser/pdfToText.js` | MODIFIED — add scan check, throw `SCANNED_PDF` |
| `src/scoring/calcScore.js` | MODIFIED — clamps + `dataTier` + tier short-circuits |
| `src/App.jsx` | MODIFIED — upload handler catch + banner/red-card/note rendering |
| `lib/parseQuality.test.js` | NEW — unit tests |
| `lib/calcScore.test.js` | NEW — unit tests for new `calcScore` paths |
| `lib/scanDetect.test.js` | NEW — unit tests with mocked pdf doc |

Test files live under `lib/` to match the test script from the access-gate work: `node --test --experimental-test-coverage lib`.

## Out of scope for Phase 1 (explicit non-goals)

- OCR'd-scan detection (hybrid image + text-layer PDFs).
- Audit-trail stamping (analyst name, version, hash of source) — Phase 2.
- Print view — Phase 2.
- "View source" affordance on report numbers — Phase 2.
- `ScoreExplainer.jsx` updates to document `dataTier` tiers. Cosmetic doc addition; can slip to Phase 2 polish.

## References

- Roadmap: `~/Projects/claude-second-brain/01_Projects/CIBXray/CIBxRay-Production-Roadmap.md` (Phase 1 section).
- Methodology reconciliation commit: `40a833d` (this session).
- Parser: `src/parser/parseBBCIB.js`, `src/parser/pdfToText.js`.
- Scorer: `src/scoring/calcScore.js`.
- Prior session saves: `~/.claude/session-data/2026-04-18-access-gate-session.tmp`, `~/.claude/session-data/2026-04-15-cibxray-phase0-vercel-session.tmp`.
