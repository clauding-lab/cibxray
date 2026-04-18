# Phase 2 (part 1) — Audit Trail + Print View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tamper-evident audit stamp to every CIBxRay report (SHA-256 PDF fingerprint + Dhaka timestamp + methodology version + git build SHA) and a dedicated 1-page A4 print view rendered at `/#print`, so reports can enter a regulated credit file.

**Architecture:** One pure function computes the stamp at upload, attached to the parsed `report` object. A shared `<AuditStamp/>` component renders it in both the screen footer and the print footer — same data, same component, guaranteed identical. The print view is a sibling route (`window.location.hash === '#print'`) reading from `sessionStorage`, auto-triggering `window.print()`. Three report fragments (score block, breakdown bars, facility table) get extracted from `App.jsx` so screen and print share rendering.

**Tech Stack:** React 19, Vite 8, pdfjs-dist (already present), `crypto.subtle.digest` for SHA-256 (native, no new deps), `Intl.DateTimeFormat` for Dhaka timestamps (native), `@media print` CSS, `node --test` for unit tests.

---

## File map

### New
- `src/constants/methodology.js` — `METHODOLOGY_VERSION`
- `src/stamp/formatDhaka.js` — Dhaka time formatter
- `src/stamp/computeStamp.js` — SHA-256 + stamp assembly
- `src/components/report/selectTopFacilities.js` — top-N sort helper
- `src/components/AuditStamp.jsx` — shared footer component
- `src/components/PrintReport.jsx` — full A4 layout
- `src/components/report/ScoreBlock.jsx` — extracted
- `src/components/report/BreakdownBars.jsx` — extracted
- `src/components/report/FacilityTable.jsx` — extracted, variant prop
- `src/styles/print.css` — `@page` + `@media print`
- `lib/formatDhaka.test.js` — 4 tests
- `lib/computeStamp.test.js` — 5 tests
- `lib/selectTopFacilities.test.js` — 5 tests

### Modified
- `src/App.jsx` — use extracted components; wire `computeStamp` into upload; render `<AuditStamp/>`; add "Print report" button; hash-check for `#print`; sessionStorage handoff.
- `vite.config.js` — inject `__APP_BUILD__` from `git rev-parse --short HEAD`; fallback `'dev'`.

### Untouched
- All Phase 1 modules (`src/parser/parseQuality.js`, `src/parser/scanDetect.js`, `src/parser/pdfToText.js`, `src/scoring/calcScore.js`, `src/constants/classifications.js`).

---

## Conventions

- **Test files live under `lib/`**, source files live under `src/`. This matches the Phase 1 pattern (`lib/parseQuality.test.js`, `src/parser/parseQuality.js`).
- **Explicit `.js` extensions on all imports** in files that are transitively imported by tests. Node's test runner ESM resolver requires them.
- **One commit per task.** Conventional-commit style: `feat(scope): ...` for new behaviour, `refactor(scope): ...` for extractions.
- **Run the full test suite after every implementation step** — `npm test` — and the build at task end — `npm run build`.

---

## Task 1: Vite config — inject `__APP_BUILD__` + methodology constant

**Files:**
- Modify: `vite.config.js`
- Create: `src/constants/methodology.js`

- [ ] **Step 1: Read current vite.config.js**

Run: `cat vite.config.js`

- [ ] **Step 2: Modify `vite.config.js` to inject `__APP_BUILD__` at build time**

The file currently exports a Vite config. Add a `define` block that reads the git short SHA at build time and falls back to `'dev'` when git isn't available.

Replace the existing `export default defineConfig(...)` block with:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'node:child_process';

function resolveAppBuild() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_BUILD__: JSON.stringify(resolveAppBuild()),
  },
});
```

If the existing config has additional options (e.g., `server`, `build`, `resolve`), preserve them — only add the `define` block and the `resolveAppBuild` helper. Do not delete existing plugins.

- [ ] **Step 3: Create `src/constants/methodology.js`**

```js
export const METHODOLOGY_VERSION = 'v1.0';
```

- [ ] **Step 4: Verify build still passes**

Run: `npm run build`
Expected: build succeeds, `__APP_BUILD__` replaced with the git short SHA in the bundled output. Search the output: `grep -r "__APP_BUILD__" dist/ || echo "no literal __APP_BUILD__ in dist — replacement worked"`.

- [ ] **Step 5: Commit**

```bash
git add vite.config.js src/constants/methodology.js
git commit -m "build: inject git short SHA as __APP_BUILD__ and add methodology constant"
```

---

## Task 2: `formatDhaka.js` + 4 tests

**Files:**
- Create: `src/stamp/formatDhaka.js`
- Create: `lib/formatDhaka.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `lib/formatDhaka.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDhakaTimestamp } from '../src/stamp/formatDhaka.js';

test('renders UTC input in Asia/Dhaka (+06:00) timezone', () => {
  const out = formatDhakaTimestamp('2026-04-18T08:32:00.000Z');
  assert.equal(out, '18 Apr 2026 14:32');
});

test('output is independent of process.env.TZ', () => {
  const prev = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  const out = formatDhakaTimestamp('2026-04-18T08:32:00.000Z');
  process.env.TZ = prev;
  assert.equal(out, '18 Apr 2026 14:32');
});

test('handles midnight-Dhaka boundary correctly', () => {
  const out = formatDhakaTimestamp('2026-04-17T18:00:00.000Z');
  assert.equal(out, '18 Apr 2026 00:00');
});

test('pads single-digit hour and preserves 24h format', () => {
  const out = formatDhakaTimestamp('2026-04-18T02:15:00.000Z');
  assert.equal(out, '18 Apr 2026 08:15');
});
```

- [ ] **Step 2: Run the tests — they must fail**

Run: `npm test`
Expected: 4 new tests fail with `Cannot find module '../src/stamp/formatDhaka.js'`.

- [ ] **Step 3: Create `src/stamp/formatDhaka.js`**

```js
const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDhakaTimestamp(isoString) {
  const parts = FORMATTER.formatToParts(new Date(isoString));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}`;
}
```

Note: `formatToParts` is used instead of `.format().replace(',', '')` because the Intl output separator varies by Node version; parts-based assembly is deterministic.

- [ ] **Step 4: Run the tests — all 4 must pass**

Run: `npm test`
Expected: suite shows `# pass 39` (was 35, now 35 + 4 new). No failures.

- [ ] **Step 5: Commit**

```bash
git add src/stamp/formatDhaka.js lib/formatDhaka.test.js
git commit -m "feat(stamp): add Dhaka timezone timestamp formatter"
```

---

## Task 3: `computeStamp.js` + 5 tests

**Files:**
- Create: `src/stamp/computeStamp.js`
- Create: `lib/computeStamp.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `lib/computeStamp.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStamp } from '../src/stamp/computeStamp.js';

function bytes(str) {
  return new TextEncoder().encode(str).buffer;
}

test('returns the four-field stamp shape', async () => {
  const stamp = await computeStamp(bytes('hello'));
  assert.ok(typeof stamp.analyzedAt === 'string');
  assert.ok(typeof stamp.methodologyVersion === 'string');
  assert.ok(typeof stamp.appBuild === 'string');
  assert.ok(typeof stamp.pdfFingerprint === 'string');
});

test('pdfFingerprint is exactly 16 hex chars', async () => {
  const stamp = await computeStamp(bytes('anything'));
  assert.equal(stamp.pdfFingerprint.length, 16);
  assert.match(stamp.pdfFingerprint, /^[0-9a-f]{16}$/);
});

test('deterministic: same bytes produce identical fingerprints', async () => {
  const a = await computeStamp(bytes('same content'));
  const b = await computeStamp(bytes('same content'));
  assert.equal(a.pdfFingerprint, b.pdfFingerprint);
});

test('different bytes produce different fingerprints', async () => {
  const a = await computeStamp(bytes('content one'));
  const b = await computeStamp(bytes('content two'));
  assert.notEqual(a.pdfFingerprint, b.pdfFingerprint);
});

test('analyzedAt is a valid ISO string near current time', async () => {
  const before = Date.now();
  const stamp = await computeStamp(bytes('x'));
  const after = Date.now();
  const parsed = Date.parse(stamp.analyzedAt);
  assert.ok(!Number.isNaN(parsed), 'analyzedAt must be ISO-parseable');
  assert.ok(parsed >= before && parsed <= after, 'analyzedAt must be within call window');
});
```

- [ ] **Step 2: Run the tests — they must fail**

Run: `npm test`
Expected: 5 new tests fail with `Cannot find module '../src/stamp/computeStamp.js'`.

- [ ] **Step 3: Create `src/stamp/computeStamp.js`**

```js
import { METHODOLOGY_VERSION } from '../constants/methodology.js';

const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeStamp(arrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return {
    analyzedAt: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    appBuild: APP_BUILD,
    pdfFingerprint: toHex(hash).slice(0, 16),
  };
}
```

Note: `__APP_BUILD__` is replaced at build time by Vite. In the Node test environment, it's undefined, so the fallback `'dev'` is used. `crypto.subtle` is globally available in Node 20+ (the repo uses v20.20.1 per `package.json`).

- [ ] **Step 4: Run the tests — all 5 must pass**

Run: `npm test`
Expected: suite shows `# pass 44` (39 + 5). No failures.

- [ ] **Step 5: Commit**

```bash
git add src/stamp/computeStamp.js lib/computeStamp.test.js
git commit -m "feat(stamp): compute SHA-256 fingerprint + audit stamp"
```

---

## Task 4: `selectTopFacilities.js` + 5 tests

**Files:**
- Create: `src/components/report/selectTopFacilities.js`
- Create: `lib/selectTopFacilities.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `lib/selectTopFacilities.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTopFacilities } from '../src/components/report/selectTopFacilities.js';

const make = (os, extra = {}) => ({ outstanding: os, status: 'live', nature: 'funded', ...extra });

test('returns all facilities when count <= limit', () => {
  const input = [make(100), make(50), make(200)];
  const out = selectTopFacilities(input, 10);
  assert.equal(out.length, 3);
});

test('returns top 10 by outstanding descending when count > limit', () => {
  const input = Array.from({ length: 15 }, (_, i) => make((i + 1) * 10));
  const out = selectTopFacilities(input, 10);
  assert.equal(out.length, 10);
  assert.equal(out[0].outstanding, 150);
  assert.equal(out[9].outstanding, 60);
});

test('ties on outstanding: live status ranks above historical', () => {
  const input = [
    make(100, { status: 'historical', id: 'h' }),
    make(100, { status: 'live', id: 'l' }),
  ];
  const out = selectTopFacilities(input, 10);
  assert.equal(out[0].id, 'l');
  assert.equal(out[1].id, 'h');
});

test('ties on outstanding and status: funded ranks above non-funded', () => {
  const input = [
    make(100, { nature: 'non-funded', id: 'nf' }),
    make(100, { nature: 'funded', id: 'f' }),
  ];
  const out = selectTopFacilities(input, 10);
  assert.equal(out[0].id, 'f');
  assert.equal(out[1].id, 'nf');
});

test('empty input returns empty output', () => {
  assert.deepEqual(selectTopFacilities([], 10), []);
});
```

- [ ] **Step 2: Run the tests — they must fail**

Run: `npm test`
Expected: 5 new tests fail with `Cannot find module '../src/components/report/selectTopFacilities.js'`.

- [ ] **Step 3: Create `src/components/report/selectTopFacilities.js`**

```js
export function selectTopFacilities(facilities, limit = 10) {
  return [...facilities]
    .sort((a, b) => {
      const diff = (b.outstanding || 0) - (a.outstanding || 0);
      if (diff !== 0) return diff;
      const aLive = a.status === 'live' ? 0 : 1;
      const bLive = b.status === 'live' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      const aFunded = a.nature === 'funded' ? 0 : 1;
      const bFunded = b.nature === 'funded' ? 0 : 1;
      return aFunded - bFunded;
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the tests — all 5 must pass**

Run: `npm test`
Expected: suite shows `# pass 49` (44 + 5). No failures.

- [ ] **Step 5: Commit**

```bash
git add src/components/report/selectTopFacilities.js lib/selectTopFacilities.test.js
git commit -m "feat(report): add top-N facility selector with live+funded tiebreaks"
```

---

## Task 5: `<AuditStamp/>` component

**Files:**
- Create: `src/components/AuditStamp.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { formatDhakaTimestamp } from '../stamp/formatDhaka.js';

const containerStyle = {
  borderTop: '1px solid #e2e8f0',
  marginTop: 24,
  paddingTop: 12,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px 24px',
  fontSize: 11,
  color: '#64748b',
};

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

export default function AuditStamp({ stamp }) {
  if (!stamp) return null;
  return (
    <div style={containerStyle} data-testid="audit-stamp">
      <span>Analysed {formatDhakaTimestamp(stamp.analyzedAt)} Asia/Dhaka</span>
      <span>Methodology {stamp.methodologyVersion}</span>
      <span>App build <span style={mono}>{stamp.appBuild}</span></span>
      <span>PDF <span style={mono}>{stamp.pdfFingerprint}</span></span>
    </div>
  );
}
```

No unit test — this is a pure render of already-tested data. Visual verification happens in Task 10 (screen integration) and Task 11 (print integration).

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build succeeds. The component is not yet imported anywhere, so it's tree-shaken out of the bundle, but syntax is verified.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuditStamp.jsx
git commit -m "feat(ui): add shared AuditStamp component for screen and print footers"
```

---

## Task 6: Extract `<ScoreBlock/>` from `App.jsx`

**Files:**
- Create: `src/components/report/ScoreBlock.jsx`
- Modify: `src/App.jsx` (remove the inline JSX, replace with `<ScoreBlock/>`)

- [ ] **Step 1: Locate the score card block in `App.jsx`**

Run: `grep -n "Score card" src/App.jsx`
Expected: finds the comment near line 486 (`{/* Score card — only show if there are borrower facilities */}`).

Read from that comment down through the next JSX block (the big score number + band label + `.agg` stat grid). The region ends where the breakdown section begins — look for `{/* Score breakdown`.

- [ ] **Step 2: Create `src/components/report/ScoreBlock.jsx`**

The component receives the score-calc result and the band, and renders the same JSX currently in `App.jsx`. The exact shape depends on what the current JSX reads — copy all JSX verbatim, move helper constants/styles along with it, expose only props for the dynamic values.

Template:

```jsx
export default function ScoreBlock({ score, band, dataTierNote, variant = 'screen' }) {
  // Paste the inline score-card JSX from App.jsx here, unchanged.
  // Props to wire:
  //   score       — scActive object from calcScore(...)
  //   band        — getBand(score.total, score.override)
  //   dataTierNote — score.dataTierNote (if present, render below score)
  //   variant     — 'screen' | 'print'; only used to toggle a className for print CSS
  // Return JSX.
}
```

Rules:
- Preserve all inline styles byte-for-byte.
- If the JSX references helpers (`fmt`, `getBand`) defined in `App.jsx`, import them from their current module or move them to `src/components/report/helpers.js` — but only if more than one extracted component uses them. For this task, inline-import what's needed.
- Add a `data-testid="score-block"` on the root container for easier visual verification.

- [ ] **Step 3: Replace the inline JSX in `App.jsx`**

Remove the original score card JSX region. Add the import at the top of `App.jsx`:

```jsx
import ScoreBlock from './components/report/ScoreBlock.jsx';
```

Replace the removed region with:

```jsx
<ScoreBlock score={scActive} band={band} dataTierNote={scActive?.dataTierNote} variant="screen" />
```

Use the same variable names that the original JSX used. If the original referenced `active`, `scActive`, etc., preserve those references in the new props.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: `# pass 49 / fail 0`. No behavioural change — this is a pure extraction.

- [ ] **Step 5: Run the build + quick visual check**

Run: `npm run build`
Expected: build passes.

Run: `npm run dev` in the background, open `http://localhost:5173/`, upload a sample CIB, confirm the score card renders byte-identically to before. Then stop dev.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/report/ScoreBlock.jsx
git commit -m "refactor(ui): extract ScoreBlock from App.jsx"
```

---

## Task 7: Extract `<BreakdownBars/>` from `App.jsx`

**Files:**
- Create: `src/components/report/BreakdownBars.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the score breakdown region**

Run: `grep -n "Score breakdown\|3-Factor" src/App.jsx`
Expected: finds the comment near line 552 (`{/* Score breakdown + flags — only with borrower facilities */}`) and the section header `Score Breakdown (3-Factor + Penalty)`.

Read the full block — it renders the three bars (Overdue, Utilization, Facility Mix) plus any penalty/flag rows. Stop before the next major section (look for the next top-level comment or `<div style={S.card}>`).

- [ ] **Step 2: Create `src/components/report/BreakdownBars.jsx`**

```jsx
export default function BreakdownBars({ score, variant = 'screen' }) {
  // Paste the breakdown-bars JSX from App.jsx here, unchanged.
  // Props:
  //   score    — scActive (exposes score.factors.overdue, .utilization, .mix, .penalty, etc.)
  //   variant  — 'screen' | 'print'; used to toggle a className for print CSS
  // Return JSX.
}
```

Rules:
- Preserve every inline style and exact class name. Do not re-theme during extraction.
- If the original referenced `S.sec`, `S.card`, `S.bar` or similar style objects, import those from wherever they're defined, or move them alongside the component. Prefer leaving them imported rather than redefining.
- Root container carries `data-testid="breakdown-bars"`.

- [ ] **Step 3: Replace the inline JSX in `App.jsx`**

Remove the original region. Add import at top of `App.jsx`:

```jsx
import BreakdownBars from './components/report/BreakdownBars.jsx';
```

Replace with:

```jsx
<BreakdownBars score={scActive} variant="screen" />
```

- [ ] **Step 4: Run tests + build**

Run: `npm test && npm run build`
Expected: tests pass (49/49), build passes.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/report/BreakdownBars.jsx
git commit -m "refactor(ui): extract BreakdownBars from App.jsx"
```

---

## Task 8: Extract `<FacilityTable/>` with variant prop

**Files:**
- Create: `src/components/report/FacilityTable.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the facility table region in `App.jsx`**

Run: `grep -n "f\.overdue\|facilities\.map\|facilities\.sort" src/App.jsx`
Expected: finds the per-facility rendering loop, likely around line 791 (the `fmt(f.overdue)` reference) within a larger `facilities.map(...)` or similar iteration.

Read the region: the container, the headers, the row rendering, the empty state.

- [ ] **Step 2: Create `src/components/report/FacilityTable.jsx`**

```jsx
import { selectTopFacilities } from './selectTopFacilities.js';

const SCREEN_COLUMNS = ['Bank', 'Facility Type', 'Classification', 'Nature', 'Status', 'Outstanding', 'Overdue', 'Limit'];
const PRINT_COLUMNS = ['Bank', 'Facility', 'Classification', 'Outstanding', 'Overdue'];

export default function FacilityTable({ facilities, variant = 'screen' }) {
  const rows = variant === 'print' ? selectTopFacilities(facilities, 10) : facilities;
  const columns = variant === 'print' ? PRINT_COLUMNS : SCREEN_COLUMNS;
  const truncated = variant === 'print' && facilities.length > rows.length;

  // Paste the table-rendering JSX from App.jsx here, adapted:
  // - Iterate over `rows` (not the full `facilities`).
  // - Iterate over `columns` for the header and per-row cells.
  // - If `truncated`, render a final "N more facilities — see source CIB PDF" row.
  // - Preserve existing inline styles for `variant === 'screen'` (unchanged from today).
  //
  // Return JSX. Root container has data-testid="facility-table".
}
```

Implementation notes:
- The screen variant must look byte-identical to today. When picking cells, map column names to the same fields the original JSX reads (e.g., "Outstanding" → `f.outstanding` formatted with the existing `fmt`).
- The print variant uses a simpler table (no action buttons, no hover effects). Inline styles are fine — print CSS in Task 12 provides the A4-friendly shell.
- Truncation row example:
  ```jsx
  {truncated && (
    <tr><td colSpan={columns.length} style={{ fontStyle: 'italic', color: '#64748b', padding: '8px 4px' }}>
      {facilities.length - rows.length} more facilities — see source CIB PDF
    </td></tr>
  )}
  ```

- [ ] **Step 3: Replace the inline JSX in `App.jsx`**

```jsx
import FacilityTable from './components/report/FacilityTable.jsx';
```

Replace the removed region with:

```jsx
<FacilityTable facilities={facilitiesForActive} variant="screen" />
```

Use whatever local variable the current code uses for "facilities for the active report" (likely `getBorrowerFacs(active)` or similar). If the current code computes this inline inside the JSX, hoist it to a const above the return.

- [ ] **Step 4: Run tests + build + visual check**

Run: `npm test && npm run build`
Expected: 49/49 pass, build passes.

Manual: `npm run dev`, upload a real CIB, confirm the facility table renders identically to today.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/report/FacilityTable.jsx
git commit -m "refactor(ui): extract FacilityTable with screen/print variant"
```

---

## Task 9: Wire `computeStamp` into `App.jsx` upload handler

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Locate the upload handler**

Run: `grep -n "parsed.parseQuality\|assessParseQuality" src/App.jsx`
Expected: finds the line where `parsed.parseQuality = assessParseQuality(parsed);` is set — that's inside the upload handler after `parseBBCIB` resolves.

- [ ] **Step 2: Import `computeStamp` and attach the stamp to the parsed report**

Add near the other imports in `App.jsx`:

```jsx
import { computeStamp } from './stamp/computeStamp.js';
```

In the upload handler, locate the block where `arrayBuffer` (the PDF bytes) is available and `parsed` has been produced. Just after `parsed.parseQuality = assessParseQuality(parsed);`, add:

```jsx
parsed.stamp = await computeStamp(arrayBuffer);
```

If the handler doesn't currently `await` inside a `for` loop but does elsewhere, make sure the function is `async` (it already is, since `parseBBCIB` returns a promise).

If `arrayBuffer` isn't currently retained after the parse completes (e.g., the handler reads bytes, parses, and discards), hoist `const buf = await file.arrayBuffer();` to be used by both `parseBBCIB(buf)` and `computeStamp(buf)`. Do not read the file twice.

- [ ] **Step 3: Verify the stamp is available in component tree**

Add a temporary `console.log('stamp', parsed.stamp)` after the assignment. Run `npm run dev`, upload a CIB, check the browser console for the stamp object with all four fields populated. Then remove the `console.log` before committing.

- [ ] **Step 4: Run tests + build**

Run: `npm test && npm run build`
Expected: 49/49 pass, build passes.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): compute audit stamp after parse and attach to report"
```

---

## Task 10: Render `<AuditStamp/>` in the screen footer

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import AuditStamp**

Add near the top of `App.jsx`:

```jsx
import AuditStamp from './components/AuditStamp.jsx';
```

- [ ] **Step 2: Render the stamp inside the active-report view**

Locate the end of the active-report view's main content block (after the facility table region, before the view closes). The right spot is the bottom of the same `<div>` that contains the score + breakdown + facility table for the `active` report.

Add:

```jsx
{active?.stamp && <AuditStamp stamp={active.stamp} />}
```

- [ ] **Step 3: Visual check**

Run: `npm run dev`. Upload a real CIB. Confirm the audit stamp appears below the facility table, showing: "Analysed DD MMM YYYY HH:MM Asia/Dhaka · Methodology v1.0 · App build dev · PDF 16hexchars".

Since `__APP_BUILD__` is replaced only at build time, `npm run dev` shows `'dev'` as the build string — that's expected. Run `npm run build && npm run preview` to see the real git SHA.

- [ ] **Step 4: Run tests + build**

Run: `npm test && npm run build`
Expected: 49/49, build passes.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(app): render audit stamp footer on active report view"
```

---

## Task 11: `<PrintReport/>` component — 1-page A4 layout

**Files:**
- Create: `src/components/PrintReport.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useEffect, useState } from 'react';
import ScoreBlock from './report/ScoreBlock.jsx';
import BreakdownBars from './report/BreakdownBars.jsx';
import FacilityTable from './report/FacilityTable.jsx';
import AuditStamp from './AuditStamp.jsx';

const SESSION_KEY = 'cibxray.printPayload';

const pageStyle = {
  width: '188mm',
  minHeight: '273mm',
  margin: '0 auto',
  padding: '0',
  background: 'white',
  color: '#0f172a',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  paddingBottom: 12,
  borderBottom: '2px solid #0f172a',
  marginBottom: 16,
};

const borrowerNameStyle = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
};

const dateStyle = {
  fontSize: 11,
  color: '#64748b',
  marginTop: 4,
};

const sectionGapStyle = { marginBottom: 16 };

export default function PrintReport() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        setError('No report to print. Re-upload the PDF.');
        return;
      }
      setPayload(JSON.parse(raw));
    } catch (e) {
      setError('Could not load report data.');
    }
  }, []);

  useEffect(() => {
    if (!payload) return;
    const handleBeforeUnload = () => sessionStorage.removeItem(SESSION_KEY);
    window.addEventListener('beforeunload', handleBeforeUnload);
    const timer = setTimeout(() => window.print(), 300);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(timer);
    };
  }, [payload]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h2>Print unavailable</h2>
        <p>{error}</p>
        <p><a href="/">Return to CIBxRay</a></p>
      </div>
    );
  }

  if (!payload) return null;

  const { report, score, band } = payload;

  return (
    <div className="print-root" style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={borrowerNameStyle}>{report?.subject?.name ?? 'Unknown borrower'}</h1>
        <div style={dateStyle}>
          CIB reporting date: {report?.summary?.reportingDate ?? '—'}
        </div>
      </header>

      <section style={sectionGapStyle}>
        <ScoreBlock score={score} band={band} dataTierNote={score?.dataTierNote} variant="print" />
      </section>

      <section style={sectionGapStyle}>
        <BreakdownBars score={score} variant="print" />
      </section>

      <section style={{ ...sectionGapStyle, flex: 1 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px 0' }}>Top facilities (by outstanding)</h2>
        <FacilityTable facilities={report?.facilities ?? []} variant="print" />
      </section>

      <AuditStamp stamp={report?.stamp} />
    </div>
  );
}
```

Implementation notes:
- The payload written to sessionStorage in Task 13 includes `{ report, score, band }`. Keep this shape consistent.
- `report.subject.name`, `report.summary.reportingDate`, `report.facilities` — use the actual paths from the current parsed-report shape. If they differ, adjust accordingly; grep the existing App.jsx for how `active` is used to find the correct paths.
- Do not read from `window.location` or URL params. The hash is for routing only.

- [ ] **Step 2: Verify the component builds in isolation**

Run: `npm run build`
Expected: build passes. The component isn't yet reachable from the running app (Task 13 wires the `#print` hash).

- [ ] **Step 3: Commit**

```bash
git add src/components/PrintReport.jsx
git commit -m "feat(print): add PrintReport component for 1-page A4 layout"
```

---

## Task 12: Print CSS

**Files:**
- Create: `src/styles/print.css`
- Modify: `src/main.jsx` (add the CSS import)

- [ ] **Step 1: Create `src/styles/print.css`**

```css
@page {
  size: A4 portrait;
  margin: 12mm;
}

@media print {
  body {
    background: white !important;
    margin: 0;
  }
  body > #root > *:not(.print-root) {
    display: none !important;
  }
  .print-root {
    box-shadow: none !important;
    border: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
}

.print-root {
  box-sizing: border-box;
}
```

The `:not(.print-root)` selector hides every sibling of the print root inside `#root` when printing. If the print route is active, `.print-root` is the only visible element; if it's not, the screen UI prints (and browser-print would produce the current not-ideal layout — which is fine since we route bankers through the print button, not Ctrl+P directly).

- [ ] **Step 2: Import the CSS in `src/main.jsx`**

Run: `cat src/main.jsx` to see the existing imports.

Add a new import line alongside the existing CSS imports:

```js
import './styles/print.css';
```

Preserve the order of any existing imports.

- [ ] **Step 3: Run tests + build**

Run: `npm test && npm run build`
Expected: tests pass (49/49), build passes.

- [ ] **Step 4: Commit**

```bash
git add src/styles/print.css src/main.jsx
git commit -m "feat(print): add @page and @media print CSS for A4 layout"
```

---

## Task 13: Print button + hash routing + sessionStorage handoff + state gating

**Files:**
- Modify: `src/App.jsx`

This is the integration task. It wires the print entry point, the routing check, and the print-state gating that the spec requires.

- [ ] **Step 1: Import PrintReport and add the hash-route check**

Add near the top of `App.jsx`:

```jsx
import PrintReport from './components/PrintReport.jsx';
```

At the very top of the `App` function (before any hooks or JSX), add:

```jsx
if (typeof window !== 'undefined' && window.location.hash === '#print') {
  return <PrintReport />;
}
```

This short-circuits the regular UI when the hash is `#print`. Everything below this line continues to render as before for all other hash values.

- [ ] **Step 2: Add a "Print report" button near the score block**

Locate the JSX where `<ScoreBlock/>` is rendered for the active report. Immediately above or beside it, add a button. Use the existing button styles from `App.jsx` (search for any existing `<button>` to match the design language):

```jsx
{active?.stamp && (
  <button
    type="button"
    onClick={() => handlePrint(active, scActive, band)}
    disabled={active?.parseQuality?.tier === 'major'}
    title={active?.parseQuality?.tier === 'major'
      ? 'Score hidden due to parse mismatch. Print not available.'
      : 'Open printable 1-page summary'}
    style={{
      padding: '6px 14px',
      borderRadius: 6,
      border: '1px solid #0f172a',
      background: active?.parseQuality?.tier === 'major' ? '#e2e8f0' : '#0f172a',
      color: active?.parseQuality?.tier === 'major' ? '#64748b' : 'white',
      cursor: active?.parseQuality?.tier === 'major' ? 'not-allowed' : 'pointer',
      fontSize: 12,
      fontWeight: 500,
    }}
  >
    Print report
  </button>
)}
```

- [ ] **Step 3: Add the `handlePrint` helper inside the `App` component**

Place it alongside the other handlers (near the upload handler):

```jsx
const handlePrint = (report, score, band) => {
  const payload = JSON.stringify({ report, score, band });
  sessionStorage.setItem('cibxray.printPayload', payload);
  window.open('/#print', '_blank', 'noopener,noreferrer');
};
```

Note: `report` contains `report.stamp` already (attached in Task 9), so the stamp travels with it.

- [ ] **Step 4: Visual smoke test**

Run: `npm run dev`. Upload a real CIB. Click "Print report". A new tab opens at `/#print`, auto-triggers the browser print dialog, preview shows the 1-page layout with header, score, breakdown bars, top-10 facility table, and audit stamp footer. Cancel the print dialog.

Test the gating: upload a PDF that produces `parseQuality.tier === 'major'` (a partial-parse PDF); confirm the "Print report" button is disabled and shows the tooltip.

Test the redirect: open `/#print` directly in a new tab without uploading first. Expected: see the "Print unavailable — Re-upload the PDF" error state with a link back to `/`.

- [ ] **Step 5: Run final tests + build**

Run: `npm test && npm run build`
Expected: `# tests 49 / pass 49 / fail 0`. Build passes.

- [ ] **Step 6: Check `App.jsx` line count strictly decreased**

Run: `wc -l src/App.jsx`
Expected: line count is lower than the starting 1081. Record the new count. If it has not decreased, the extractions in Tasks 6–8 did not actually remove the original JSX (only added imports/components) — revisit.

- [ ] **Step 7: Final commit**

```bash
git add src/App.jsx
git commit -m "feat(app): add print button, #print hash route, and major-tier gating"
```

---

## Post-plan verification (run after all 13 tasks)

- [ ] **Full test run**

Run: `npm test`
Expected: `# tests 49 / pass 49 / fail 0`.

- [ ] **Production build**

Run: `npm run build`
Expected: clean build. Search `dist/` for `__APP_BUILD__` — should not appear (it was replaced).

- [ ] **Fingerprint round-trip**

Run: `shasum -a 256 <any-test-pdf> | cut -c1-16`
Compare to what the app displays after uploading the same PDF. They must match.

- [ ] **Push and merge**

```bash
git push -u origin feat/phase2-audit-print
```

Merge to main via feature branch (same pattern as Phase 1 — direct merge, no PR review cycle).

---

## Self-review (completed)

**Spec coverage:**
- Audit stamp data model → Tasks 1, 3. ✓
- Dhaka timezone rendering → Task 2. ✓
- Shared `<AuditStamp/>` → Task 5, rendered on screen (Task 10) + print (Task 11). ✓
- `/#print` hash routing → Task 13. ✓
- 1-page A4 layout → Task 11 (layout) + Task 12 (CSS). ✓
- Top-10 facility truncation → Task 4 helper + Task 8 wiring. ✓
- Print states (major tier disabled) → Task 13. ✓
- Extraction to reduce App.jsx → Tasks 6, 7, 8 + verification in Task 13. ✓
- Testing (14 new tests target) → Tasks 2, 3, 4 (4 + 5 + 5 = 14). ✓

**Placeholder scan:** No TBD/TODO. Code blocks present for every code step. Expected outputs specified for every run-test step.

**Type consistency:**
- `stamp` shape: `{ analyzedAt, methodologyVersion, appBuild, pdfFingerprint }` — consistent across Tasks 3, 5, 9, 10, 11.
- `selectTopFacilities(facilities, limit)` signature — consistent across Tasks 4, 8, 11.
- `SESSION_KEY = 'cibxray.printPayload'` — consistent across Tasks 11, 13.
- `variant` prop values `'screen' | 'print'` — consistent across ScoreBlock / BreakdownBars / FacilityTable / PrintReport.
- `handlePrint(report, score, band)` args match the payload shape PrintReport reads.

No gaps. No contradictions.
