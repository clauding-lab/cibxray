# Phase 1 — Parse Trust + Scoring Edge Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the scorer honest — refuse scanned PDFs at upload, surface parse/summary reconciliation mismatches to the banker, and handle zero-funded-facility edge cases with explicit tiers instead of a misleading high score.

**Architecture:** Two new pure modules in `src/parser/` (scan detection via PDF.js operator list, parse-quality cross-check of facility sums against summary header), a `dataTier` extension on `calcScore` with defensive input clamps and short-circuits for `first-timer` (fixed 65) and `historical-clean` (fixed 80), and three UI touch points in `src/App.jsx` (scan refusal on upload, parse-quality banner/red-card on the report, dataTier note near the score).

**Tech Stack:** Existing Vite + React 19 + vanilla JS + pdfjs. Tests via Node built-in `node --test` runner (same setup as the access-gate work).

Spec: `docs/superpowers/specs/2026-04-18-phase1-parse-trust-design.md`.

---

## File inventory

| File | Change |
|---|---|
| `lib/parseQuality.test.js` | NEW — unit tests |
| `src/parser/parseQuality.js` | NEW — `assessParseQuality(report)` pure function |
| `lib/calcScore.test.js` | NEW — unit tests for `calcScore` tier + clamp behavior |
| `src/scoring/calcScore.js` | MODIFIED — `dataTier` tiers + `first-timer` / `historical-clean` short-circuits + defensive clamps |
| `lib/scanDetect.test.js` | NEW — unit tests (mocked `PDFDocumentProxy`) |
| `src/parser/scanDetect.js` | NEW — `isScannedPdf(pdfDoc)` pure function |
| `src/parser/pdfToText.js` | MODIFIED — call `isScannedPdf` before extracting text, throw typed `SCANNED_PDF` error |
| `src/App.jsx` | MODIFIED — catch `SCANNED_PDF` on upload; render parse-quality banner, red-card, and dataTier note |

---

## Task 1: `assessParseQuality` — match + unavailable cases (TDD)

**Files:**
- Create: `src/parser/parseQuality.js`
- Create: `lib/parseQuality.test.js`

- [ ] **Step 1: Write the failing tests**

Create `lib/parseQuality.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessParseQuality } from '../src/parser/parseQuality.js';

test('returns ok when sums match summary exactly', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('returns unavailable when summary section is missing', () => {
  const report = { summary: {}, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});

test('returns unavailable when summary.totalOutstanding is null', () => {
  const report = { summary: { totalOutstanding: null, totalOverdue: null }, facilities: [] };
  assert.equal(assessParseQuality(report).tier, 'unavailable');
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `cd ~/Projects/cibxray && npm test`
Expected: FAIL — module `../src/parser/parseQuality.js` not found.

- [ ] **Step 3: Implement minimal version**

Create `src/parser/parseQuality.js`:

```js
const LAKH = 100_000;

export function assessParseQuality(report) {
  const summary = report?.summary;
  if (!summary || summary.totalOutstanding == null || summary.totalOverdue == null) {
    return { tier: 'unavailable', issues: [] };
  }

  const liveFunded = (report.facilities || []).filter(
    f => f.status === 'Live' && f.nature === 'Funded'
  );
  const facOutstanding = liveFunded.reduce((s, f) => s + (Number(f.outstanding) || 0), 0);
  const facOverdue = liveFunded.reduce((s, f) => s + (Number(f.overdue) || 0), 0);

  const issues = [];
  for (const check of [
    { field: 'outstanding', summaryValue: summary.totalOutstanding, computedValue: facOutstanding },
    { field: 'overdue', summaryValue: summary.totalOverdue, computedValue: facOverdue },
  ]) {
    const gap = Math.abs(check.summaryValue - check.computedValue);
    const threshold = Math.max(check.summaryValue * 0.01, LAKH);
    const gapPct = check.summaryValue > 0 ? (gap / check.summaryValue) * 100 : 0;
    let checkTier;
    if (gap <= threshold) checkTier = 'ok';
    else if (gap <= threshold * 2) checkTier = 'minor';
    else checkTier = 'major';
    if (checkTier !== 'ok') {
      issues.push({ ...check, gap, gapPct, threshold, tier: checkTier });
    }
  }

  let tier = 'ok';
  if (issues.some(i => i.tier === 'major')) tier = 'major';
  else if (issues.some(i => i.tier === 'minor')) tier = 'minor';
  return { tier, issues };
}
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm test`
Expected: PASS (16 tests — 13 pre-existing from session lib + 3 new).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/cibxray
git add src/parser/parseQuality.js lib/parseQuality.test.js
git commit -m "feat(parser): assessParseQuality — ok + unavailable base cases"
```

---

## Task 2: `assessParseQuality` — minor / major threshold tiers (TDD)

**Files:**
- Modify: `lib/parseQuality.test.js` (append tests)

- [ ] **Step 1: Append failing tests**

Append to `lib/parseQuality.test.js`:

```js
test('returns ok when gap is below 1% and below 1 lakh', () => {
  const report = {
    summary: { totalOutstanding: 50_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 49_950_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('small loan: ok when gap is below 1 lakh even if above 1%', () => {
  const report = {
    summary: { totalOutstanding: 500_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 420_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});

test('returns minor when gap exceeds threshold by up to 2x', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 98_500_000, overdue: 0 },
    ],
  };
  const result = assessParseQuality(report);
  assert.equal(result.tier, 'minor');
  assert.equal(result.issues[0].field, 'outstanding');
});

test('returns major when gap exceeds 2x threshold', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 50_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('overdue mismatch alone elevates the tier', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 5_000_000 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 1_000_000 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('overall tier is worst of the two checks', () => {
  const report = {
    summary: { totalOutstanding: 100_000_000, totalOverdue: 5_000_000 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 98_500_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'major');
});

test('excludes historical and non-funded from computed sums', () => {
  const report = {
    summary: { totalOutstanding: 10_000_000, totalOverdue: 0 },
    facilities: [
      { status: 'Live', nature: 'Funded', outstanding: 10_000_000, overdue: 0 },
      { status: 'Live', nature: 'Non-Funded', outstanding: 5_000_000, overdue: 0 },
      { status: 'Terminated', nature: 'Funded', outstanding: 20_000_000, overdue: 0 },
    ],
  };
  assert.equal(assessParseQuality(report).tier, 'ok');
});
```

- [ ] **Step 2: Run tests — must pass**

The implementation from Task 1 already covers these paths. Run: `npm test`
Expected: PASS (23 tests total).

If any fail: re-inspect the threshold math. The implementation should naturally satisfy all seven new cases.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/cibxray
git add lib/parseQuality.test.js
git commit -m "test(parser): assessParseQuality — threshold tiers and field isolation"
```

---

## Task 3: `calcScore` — defensive clamps (TDD)

**Files:**
- Create: `lib/calcScore.test.js`
- Modify: `src/scoring/calcScore.js`

- [ ] **Step 1: Write the failing tests**

Create `lib/calcScore.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcScore } from '../src/scoring/calcScore.js';

test('clamps negative outstanding to 0', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 1_000_000, outstanding: -500_000, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tOut, 0);
});

test('clamps NaN outstanding to 0', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 1_000_000, outstanding: NaN, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tOut, 0);
});

test('clamps negative limit and overdue', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: -1_000_000, outstanding: 500_000, overdue: -10 },
  ];
  const result = calcScore(facs);
  assert.ok(Number.isFinite(result.total));
  assert.equal(result.agg.tLim, 0);
  assert.equal(result.agg.tOver, 0);
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm test`
Expected: FAIL — likely the third test fails because a negative limit passes through `f.limit || 0`, which keeps the negative value.

- [ ] **Step 3: Add the clamp helper and apply to inputs**

In `src/scoring/calcScore.js`, change the top of the function. Read the current file and replace the opening:

Current lines 4-9:
```js
export function calcScore(facs) {
  if (!facs.length) return {
    total: 0, override: null, bd: {},
    agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: 0, hist: 0, total: 0, util: 0, baseScore: 0 },
    flags: [],
  };
```

Replace with:
```js
function clampNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function calcScore(facs) {
  if (!facs.length) return {
    total: 0, override: null, bd: {},
    agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: 0, hist: 0, total: 0, util: 0, baseScore: 0 },
    flags: [],
  };

  facs = facs.map(f => ({
    ...f,
    limit: clampNum(f.limit),
    outstanding: clampNum(f.outstanding),
    overdue: clampNum(f.overdue),
  }));
```

Also update the existing `const w = f.outstanding || f.limit || 1;` on line 45 of the original to rely on the clamped values — no change needed there because clamping already happened.

- [ ] **Step 4: Run tests — must pass**

Run: `npm test`
Expected: PASS (26 tests total).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/cibxray
git add src/scoring/calcScore.js lib/calcScore.test.js
git commit -m "fix(scoring): clamp negative / NaN facility numerics in calcScore"
```

---

## Task 4: `calcScore` — `first-timer` tier (TDD)

**Files:**
- Modify: `lib/calcScore.test.js` (append)
- Modify: `src/scoring/calcScore.js`

- [ ] **Step 1: Append failing tests**

Append to `lib/calcScore.test.js`:

```js
test('returns first-timer tier at fixed 65 when no funded facilities of any kind', () => {
  const facs = [
    { status: 'Live', nature: 'Non-Funded', classification: 'STD', limit: 1_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'first-timer');
  assert.equal(result.total, 65);
  assert.ok(result.dataTierNote.includes('First-time'));
});

test('returns first-timer tier at fixed 65 when facilities array is empty', () => {
  const result = calcScore([]);
  assert.equal(result.dataTier, 'first-timer');
  assert.equal(result.total, 65);
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm test`
Expected: FAIL — `dataTier` is undefined on the result.

- [ ] **Step 3: Implement the tier logic**

In `src/scoring/calcScore.js`, replace the empty-facilities early return and add the tier computation right after the clamping step.

Replace:
```js
  if (!facs.length) return {
    total: 0, override: null, bd: {},
    agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: 0, hist: 0, total: 0, util: 0, baseScore: 0 },
    flags: [],
  };

  facs = facs.map(f => ({
    ...f,
    limit: clampNum(f.limit),
    outstanding: clampNum(f.outstanding),
    overdue: clampNum(f.overdue),
  }));
```

With:
```js
  const FIRST_TIMER_NOTE = 'First-time funded borrower / no repayment history. Use business judgment.';

  if (!facs.length) return {
    total: 65, override: null, bd: {},
    agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: 0, hist: 0, total: 0, util: 0, baseScore: 65 },
    flags: [],
    dataTier: 'first-timer', dataTierNote: FIRST_TIMER_NOTE,
  };

  facs = facs.map(f => ({
    ...f,
    limit: clampNum(f.limit),
    outstanding: clampNum(f.outstanding),
    overdue: clampNum(f.overdue),
  }));

  const liveFundedEarly = facs.filter(f => f.nature === 'Funded' && f.status === 'Live');
  const histFundedEarly = facs.filter(f => f.nature === 'Funded' && f.status !== 'Live');

  if (liveFundedEarly.length === 0 && histFundedEarly.length === 0) {
    return {
      total: 65, override: null, bd: {},
      agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: facs.filter(f => f.status === 'Live').length, hist: facs.filter(f => f.status !== 'Live').length, total: facs.length, util: 0, baseScore: 65 },
      flags: [],
      dataTier: 'first-timer', dataTierNote: FIRST_TIMER_NOTE,
    };
  }
```

Also: at the end of `calcScore`, the existing `return { total: raw, ... }` must include `dataTier: 'live', dataTierNote: null`. Locate the final `return` block (around line 106 in the current file) and change:

```js
  return {
    total: raw, override,
    bd: {
      "Overdue History": { s: os, w: 60, pts: Math.round(os * 0.60) },
      "Utilization (high utilization=low score)": { s: us, w: 30, pts: Math.round(us * 0.30) },
      "Facility Mix": { s: ms, w: 10, pts: Math.round(ms * 0.10) },
      "Classification Penalty": { s: -Math.round(ap * 100), w: -50, pts: -pp, isPenalty: true },
    },
    agg: { tLim, tOut, tOver, funded: funded.length, live: live.length, hist: hist.length, total: facs.length, util: tLim > 0 ? tOut / tLim : 0, baseScore },
    flags,
  };
```

to append `dataTier` and `dataTierNote`:

```js
  return {
    total: raw, override,
    bd: {
      "Overdue History": { s: os, w: 60, pts: Math.round(os * 0.60) },
      "Utilization (high utilization=low score)": { s: us, w: 30, pts: Math.round(us * 0.30) },
      "Facility Mix": { s: ms, w: 10, pts: Math.round(ms * 0.10) },
      "Classification Penalty": { s: -Math.round(ap * 100), w: -50, pts: -pp, isPenalty: true },
    },
    agg: { tLim, tOut, tOver, funded: funded.length, live: live.length, hist: hist.length, total: facs.length, util: tLim > 0 ? tOut / tLim : 0, baseScore },
    flags,
    dataTier: 'live', dataTierNote: null,
  };
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm test`
Expected: PASS (28 tests total).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/cibxray
git add src/scoring/calcScore.js lib/calcScore.test.js
git commit -m "feat(scoring): first-timer tier at fixed 65 when no funded facilities"
```

---

## Task 5: `calcScore` — `historical-clean` tier (TDD)

**Files:**
- Modify: `lib/calcScore.test.js` (append)
- Modify: `src/scoring/calcScore.js`

- [ ] **Step 1: Append failing tests**

Append to `lib/calcScore.test.js`:

```js
test('returns historical-clean tier at fixed 80 when only historical clean funded', () => {
  const facs = [
    { status: 'Terminated', nature: 'Funded', classification: 'STD', limit: 10_000_000, outstanding: 0, overdue: 0 },
    { status: 'Closed', nature: 'Funded', classification: 'UC', limit: 5_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'historical-clean');
  assert.equal(result.total, 80);
  assert.ok(result.dataTierNote.includes('historical'));
});

test('historical with adverse classification falls through to live math with override', () => {
  const facs = [
    { status: 'Terminated', nature: 'Funded', classification: 'DF', limit: 10_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'live');
  assert.ok(result.total <= 59);
});

test('live funded takes precedence over historical-clean', () => {
  const facs = [
    { status: 'Live', nature: 'Funded', classification: 'STD', limit: 10_000_000, outstanding: 5_000_000, overdue: 0 },
    { status: 'Terminated', nature: 'Funded', classification: 'STD', limit: 5_000_000, outstanding: 0, overdue: 0 },
  ];
  const result = calcScore(facs);
  assert.equal(result.dataTier, 'live');
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm test`
Expected: FAIL — `dataTier` is not `historical-clean` for the first test; currently falls through to the live math.

- [ ] **Step 3: Add the historical-clean short-circuit**

In `src/scoring/calcScore.js`, immediately after the `first-timer` short-circuit block, add the `historical-clean` branch. The section should look like:

```js
  if (liveFundedEarly.length === 0 && histFundedEarly.length === 0) {
    return {
      total: 65, override: null, bd: {},
      agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: facs.filter(f => f.status === 'Live').length, hist: facs.filter(f => f.status !== 'Live').length, total: facs.length, util: 0, baseScore: 65 },
      flags: [],
      dataTier: 'first-timer', dataTierNote: FIRST_TIMER_NOTE,
    };
  }

  const HISTORICAL_CLEAN_NOTE = 'Based on historical repayment only. No current funded exposure.';
  if (liveFundedEarly.length === 0 && histFundedEarly.every(f => f.classification === 'UC' || f.classification === 'STD')) {
    return {
      total: 80, override: null, bd: {},
      agg: { tLim: 0, tOut: 0, tOver: 0, funded: histFundedEarly.length, live: 0, hist: histFundedEarly.length, total: facs.length, util: 0, baseScore: 80 },
      flags: [{ ok: true, t: 'Historical clean', d: 'All past funded facilities closed with standard classification.' }],
      dataTier: 'historical-clean', dataTierNote: HISTORICAL_CLEAN_NOTE,
    };
  }
```

- [ ] **Step 4: Run tests — must pass**

Run: `npm test`
Expected: PASS (31 tests total). All three new tests green.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/cibxray
git add src/scoring/calcScore.js lib/calcScore.test.js
git commit -m "feat(scoring): historical-clean tier at fixed 80 when no live funded"
```

---

## Task 6: `isScannedPdf` — text-operator check (TDD)

**Files:**
- Create: `lib/scanDetect.test.js`
- Create: `src/parser/scanDetect.js`

- [ ] **Step 1: Write the failing tests**

Create `lib/scanDetect.test.js`:

```js
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
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm test`
Expected: FAIL — module `../src/parser/scanDetect.js` not found.

- [ ] **Step 3: Implement**

Create `src/parser/scanDetect.js`:

```js
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
```

The second parameter lets tests inject op codes without touching `window.pdfjsLib`. Production callers (`pdfToText.js`) will omit it and the function falls back to the real `pdfjsLib.OPS`.

- [ ] **Step 4: Run tests — must pass**

Run: `npm test`
Expected: PASS (35 tests total).

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/cibxray
git add src/parser/scanDetect.js lib/scanDetect.test.js
git commit -m "feat(parser): isScannedPdf via PDF.js operator list inspection"
```

---

## Task 7: Wire scan detection into `pdfToText`

**Files:**
- Modify: `src/parser/pdfToText.js`

- [ ] **Step 1: Read the current file**

The current contents (confirmed — do not re-read):

```js
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
```

- [ ] **Step 2: Add the scan check**

Replace the file's contents with:

```js
import { loadPdf } from './pdfLoader';
import { isScannedPdf } from './scanDetect';

export async function pdfToText(file) {
  if (!await loadPdf()) throw new Error("PDF.js failed to load");
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;

  if (await isScannedPdf(pdf)) {
    throw new Error('SCANNED_PDF');
  }

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
```

- [ ] **Step 3: Verify the build still compiles**

Run: `cd ~/Projects/cibxray && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/cibxray
git add src/parser/pdfToText.js
git commit -m "feat(parser): reject scanned PDFs at extraction time"
```

---

## Task 8: Catch `SCANNED_PDF` in the App upload handler

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the upload handler**

In `src/App.jsx`, find the code that calls `pdfToText`. Grep for it:

```bash
cd ~/Projects/cibxray
grep -n "pdfToText\|catch" src/App.jsx | head -20
```

The handler is the `processFile` path or the file-drop handler. The specific line that calls `pdfToText(file)` is where we need to add error classification.

- [ ] **Step 2: Wrap the call**

Find the `try { ... } catch (e) { ... }` block that currently catches errors from `pdfToText`. Inside the catch (or the handler that populates `fileLog`), add a check for `e.message === 'SCANNED_PDF'`. When matched, push a `fileLog` entry with `status: 'failed'` and a user-facing message:

Example pattern to apply (exact integration depends on the handler shape):

```js
try {
  const text = await pdfToText(file);
  // ... existing processing
} catch (e) {
  const userMessage = e.message === 'SCANNED_PDF'
    ? 'This looks like a scanned image. Please upload the text-based PDF from Bangladesh Bank, not a scan.'
    : e.message;
  setFileLog(log => [...log, {
    name: file.name,
    status: 'failed',
    error: userMessage,
  }]);
}
```

If the existing handler doesn't already construct an `error` field on failed entries, add it. The existing "X failed" count in the sidebar (`src/App.jsx:194`) should already surface the failure; the new message just has to be stored where the UI reads error text.

Read the current handler first with `grep -nA 20 "async function processFile\|const processFile\|onChange" src/App.jsx` to see its exact shape, then adapt the pattern to fit.

- [ ] **Step 3: Manually verify via dev server**

Run: `cd ~/Projects/cibxray && npm run dev`
- Open `http://localhost:5173` in a browser.
- Upload a known scanned PDF (any image-only PDF will do).
- Expected: file appears in the upload log marked as failed with the "scanned image" message. No score is produced.
- Upload a real text-based CIB PDF.
- Expected: file processes normally.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/cibxray
git add src/App.jsx
git commit -m "feat(app): show banker-facing message for SCANNED_PDF uploads"
```

---

## Task 9: Run `assessParseQuality` on parsed reports and store the result

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the new function**

In `src/App.jsx`, add near the existing parser import:

```js
import { assessParseQuality } from './parser/parseQuality';
```

- [ ] **Step 2: Call it after `parseBBCIB` and attach to the report**

Find the spot in `processFile` / the upload handler where `parseBBCIB` is called and its result (`parsed`) is pushed into `reports`. Before pushing, attach `parseQuality`:

```js
const parsed = parseBBCIB(text, file.name);
parsed.parseQuality = assessParseQuality(parsed);
// ... existing validation + push
```

Do NOT change the existing "No subject or facility data extracted" validation — that still runs and still throws, independent of `parseQuality`.

- [ ] **Step 3: Verify the dev server still runs**

Run: `npm run dev` → upload a real CIB → open devtools → inspect the loaded report in React devtools or log it. Confirm `parseQuality` is populated with `{ tier: 'ok', issues: [] }`.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/cibxray
git add src/App.jsx
git commit -m "feat(app): attach parseQuality assessment to every parsed report"
```

---

## Task 10: Render parse-quality banner and red-card in the report view

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the report-rendering section**

The report view renders under `view === "report"` or similar. Find the score display and identify where the `<Gauge>` / score number is drawn.

```bash
cd ~/Projects/cibxray
grep -n 'Gauge\|total\|score' src/App.jsx | head -20
```

- [ ] **Step 2: Render banner / red-card / note**

Insert, directly above the score display, a conditional block reading from `active.parseQuality` and `active.scoreResult.dataTierNote`. Use inline styles consistent with the existing app (header uses `#0ea5e9` / `#7dd3fc`; keep banners on amber or red tokens).

Paste the following component definition near the top of the JSX return — it is self-contained and does not need external CSS files:

```jsx
const ParseQualityBanner = ({ pq }) => {
  if (!pq || pq.tier === 'ok') return null;
  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n);
  const describe = (issue) =>
    `${issue.field === 'outstanding' ? 'Outstanding' : 'Overdue'}: summary says BDT ${fmt(issue.summaryValue)}, facilities total BDT ${fmt(issue.computedValue)} (gap BDT ${fmt(issue.gap)}).`;

  if (pq.tier === 'unavailable') {
    return (
      <div style={{ margin: '12px 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, color: '#78350f', fontSize: 13 }}>
        Could not locate summary section in this PDF. Cross-check with the facility table skipped.
      </div>
    );
  }

  if (pq.tier === 'minor') {
    return (
      <div style={{ margin: '12px 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, color: '#78350f', fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Minor parse mismatch — score shown but verify</div>
        {pq.issues.map((i, idx) => <div key={idx}>{describe(i)}</div>)}
      </div>
    );
  }

  // major
  return (
    <div style={{ margin: '12px 0', padding: '16px 18px', background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 8, color: '#7f1d1d' }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Cannot score — parse incomplete</div>
      {pq.issues.map((i, idx) => <div key={idx} style={{ fontSize: 13, marginBottom: 2 }}>{describe(i)}</div>)}
      <div style={{ fontSize: 12, marginTop: 8, color: '#991b1b' }}>Please re-upload the PDF or verify manually with the original CIB.</div>
    </div>
  );
};
```

Then, in the report view, above the score display:

```jsx
<ParseQualityBanner pq={active.parseQuality} />

{active.parseQuality?.tier === 'major' ? null : (
  /* existing score / gauge block */
)}
```

If `parseQuality.tier === 'major'`, the score block is replaced by the red-card. Otherwise the score renders normally (possibly with a minor banner above).

- [ ] **Step 3: Manually verify**

Run: `npm run dev`. Upload a real CIB → score displays, no banner. To simulate a major mismatch without a hand-edited PDF, temporarily override `parseQuality` in React devtools or inject a test object via the browser console. Expected: red-card replaces score; re-setting tier to ok restores score.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/cibxray
git add src/App.jsx
git commit -m "feat(app): render parse-quality banner and red-card on reports"
```

---

## Task 11: Render `dataTierNote` near the score

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add note rendering**

Immediately below the score display (or alongside the `active.score.override` label), render the tier note when present:

```jsx
{active.score?.dataTierNote && (
  <div style={{ margin: '8px 0', padding: '10px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, color: '#1e40af', fontSize: 12 }}>
    {active.score.dataTierNote}
  </div>
)}
```

The field name on `active.score` (or whatever the score-holder object is called) must match what `calcScore` returns — it is `dataTierNote`. Confirm the score object is accessible in this scope; the existing `bd` / `agg` / `flags` accessors tell you the same variable path.

- [ ] **Step 2: Manually verify**

Run: `npm run dev`. 
- Upload a real CIB with live funded facilities → score displays, NO tier note.
- In devtools, override the report's score with `dataTier: 'first-timer', dataTierNote: 'First-time funded borrower / no repayment history. Use business judgment.', total: 65` to simulate — the note should render.

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/cibxray
git add src/App.jsx
git commit -m "feat(app): render dataTier note near score for first-timer / historical-clean"
```

---

## Task 12: Final sweep — full build, full tests, manual upload check

**Files:** none (verification pass)

- [ ] **Step 1: Run the full test suite**

Run: `cd ~/Projects/cibxray && npm test`
Expected: all tests pass (~35+ tests).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build completes without errors; `dist/` populated.

- [ ] **Step 3: Full manual integration pass**

Run: `npm run dev` and in the browser:
- Upload a known-good real CIB → scored normally, no banners, no tier note.
- Upload a PDF that's actually a scanned image → upload rejected with scan message.
- (Optional) Upload a hand-edited CIB text with one facility row removed to force a reconciliation mismatch → confirm amber or red banner fires.

Stop the dev server.

- [ ] **Step 4: Push**

```bash
cd ~/Projects/cibxray
git push
```

Production auto-deploys via Vercel. Verify `cibxray.vercel.app` still loads the login page (access gate unaffected) and a post-login upload still scores normally.

- [ ] **Step 5: Commit — none needed**

No code changes in this task; it is a verification gate.

---

## Out of scope (explicit non-goals)

- Advanced OCR'd-scan detection (hybrid image + text layer PDFs). Reconciliation check is the backstop.
- Historical-clean dynamic scoring. Fixed 80; revisit in a later phase.
- Audit-trail stamping / print view / "view source" affordance on report numbers — Phase 2.
- `ScoreExplainer.jsx` updates explaining `dataTier` tiers. Optional doc polish; not blocking.
