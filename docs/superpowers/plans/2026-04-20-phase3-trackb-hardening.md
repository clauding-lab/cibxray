# Phase 3 Track B — Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Medium-and-above finding from the 2026-04-19 security review on cibxray so the tool passes a bank CISO checklist before banker pilot.

**Architecture:** Eight items on a single `feat/phase3-track-b` branch via subagent-driven development, three waves (quick wins → concentrated work → CSP capstone). One subagent per task, one commit per task, single PR at end.

**Tech Stack:** React 18, Vite 8, Node 24, Vercel functions, `pdfjs-dist` 3.11.174 (replacing CDN), `exceljs` (replacing `xlsx@0.18.5`). Testing: node test runner.

**Spec:** `docs/superpowers/specs/2026-04-20-phase3-trackb-hardening-design.md`

**Baseline:** main at `5151014`, 72 tests pass, clean working tree.

---

## File Structure

**New files:**
- `public/robots.txt` — Wave 1 B4
- `vercel.json` — Wave 3 B6
- `lib/reportHygiene.js` + `lib/reportHygiene.test.js` — Wave 2 B3
- `src/parser/loadPdfjs.js` — Wave 2 B1 (replaces the CDN loader pattern)
- `src/components/ErrorBoundary.jsx` + `lib/errorBoundary.test.js` — Wave 1 B5
- `api/crash-log.js` + `lib/crashLog.test.js` — Wave 1 B5

**Modified files:**
- `index.html` — B4 (title)
- `lib/session.js` + `lib/session.test.js` — B7 (password padding)
- `public/sw.js` — B8 (HTML navigation bypass) + B1 (remove CDN cache logic)
- `src/main.jsx` — B5 (wrap App in ErrorBoundary)
- `src/parser/pdfLoader.js` — B1 (re-export from new loadPdfjs.js, remove CDN `<script>` injection)
- `src/parser/scanDetect.js` — B1 (swap `window.pdfjsLib` for import)
- `src/parser/pdfToText.js` — B1 (swap `window.pdfjsLib` for import)
- `src/export/excelExport.js` — B2 (xlsx → exceljs)
- `src/App.jsx` — B3 (stripRawText on print payload, try/finally, cleanup on close/new-upload)
- `package.json` — B1 (+pdfjs-dist) + B2 (-xlsx, +exceljs)

**Vault (separate repo):**
- `~/Projects/claude-second-brain/01_Projects/CIBXray/CIBxRay-Production-Roadmap.md` — mark items shipped
- `~/Projects/claude-second-brain/01_Projects/CIBXray/CIBxRay-CISO-Summary.md` — new file

---

## Task 0: Create branch

**Files:** none

- [ ] **Step 1: Create and switch to feature branch**

```bash
cd ~/Projects/cibxray
git checkout -b feat/phase3-track-b
git status
```

Expected: `On branch feat/phase3-track-b`, `nothing to commit, working tree clean`.

- [ ] **Step 2: Verify baseline tests pass**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected:
```
# tests 72
# pass 72
# fail 0
```

---

## Task 1 (B4): robots.txt + generic login title

**Files:**
- Create: `public/robots.txt`
- Modify: `index.html:12` (title)

- [ ] **Step 1: Create robots.txt**

```bash
cat > public/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF
```

- [ ] **Step 2: Change the page title in index.html**

Edit `index.html` line 12:

```html
    <title>Portal</title>
```

(Remove `CIBxRay — Credit Bureau Intelligence` descriptor. The manifest.json keeps the friendlier name for the PWA install card; only the HTML document title changes.)

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -3
```

Expected: `✓ built in` … ms, no errors.

- [ ] **Step 4: Verify robots.txt is in the dist**

```bash
cat dist/robots.txt
```

Expected: the two-line content above.

- [ ] **Step 5: Commit**

```bash
git add public/robots.txt index.html
git commit -m "fix(security): add robots.txt and use generic page title

B4 / Phase 3 Track B. Tells search engines to ignore the site and
drops the descriptive HTML title that leaks the tool's name from the
login page."
```

---

## Task 2 (B7): Password length timing oracle fix

**Files:**
- Modify: `lib/session.js:47-53` (verifyPassword)
- Modify: `lib/session.test.js` (add length-mismatch regression tests)

- [ ] **Step 1: Write failing test for length-mismatch returns false without short-circuit**

Append to `lib/session.test.js`:

```javascript
test('verifyPassword returns false on length mismatch (short input)', () => {
  assert.equal(verifyPassword('a', 'longerpassword'), false);
});

test('verifyPassword returns false on length mismatch (long input)', () => {
  assert.equal(verifyPassword('a'.repeat(100), 'short'), false);
});

test('verifyPassword returns true on exact match', () => {
  assert.equal(verifyPassword('Idlc2007$', 'Idlc2007$'), true);
});

test('verifyPassword returns false on same-length-wrong-content', () => {
  assert.equal(verifyPassword('wrongwrongwrong', 'rightrightright'), false);
});

test('verifyPassword returns false on empty inputs', () => {
  assert.equal(verifyPassword('', ''), false);
  assert.equal(verifyPassword('pwd', ''), false);
  assert.equal(verifyPassword('', 'pwd'), false);
});
```

Import `verifyPassword` at the top of the file if not already:

```javascript
import { buildSession, verifySession, verifyPassword } from './session.js';
```

- [ ] **Step 2: Run tests to verify the new ones pass with the current implementation**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected: `pass 77` (72 + 5 new). All pass because current implementation returns false correctly — we're capturing the expected behavior before refactoring to timing-safe form.

- [ ] **Step 3: Refactor verifyPassword to pad both buffers to a fixed length**

Replace `verifyPassword` in `lib/session.js`:

```javascript
const VERIFY_PAD_LEN = 256;

export function verifyPassword(input, expected) {
  if (!input || !expected) return false;
  const inputBuf = Buffer.from(input, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (inputBuf.length > VERIFY_PAD_LEN || expectedBuf.length > VERIFY_PAD_LEN) {
    return false;
  }

  const padded1 = Buffer.alloc(VERIFY_PAD_LEN, 0);
  const padded2 = Buffer.alloc(VERIFY_PAD_LEN, 0);
  inputBuf.copy(padded1);
  expectedBuf.copy(padded2);

  const compareResult = crypto.timingSafeEqual(padded1, padded2);
  const lengthMatch = inputBuf.length === expectedBuf.length;
  return compareResult && lengthMatch;
}
```

- [ ] **Step 4: Run tests to verify all still pass**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected:
```
# tests 77
# pass 77
# fail 0
```

- [ ] **Step 5: Commit**

```bash
git add lib/session.js lib/session.test.js
git commit -m "fix(security): remove password length timing oracle

B7 / Phase 3 Track B. M-3 from the 2026-04-19 security review.

Previously verifyPassword returned early when Buffer.from(input).length
differed from the expected buffer, giving wrong-length guesses a ~1ms
speedup over wrong-content guesses. An attacker could brute-force the
password byte-length from timing alone.

Both buffers are now padded to 256 bytes before crypto.timingSafeEqual.
Length equality is tracked as a separate boolean and ANDed with the
compare result after the compare completes. +5 regression tests."
```

---

## Task 3 (B8): Service worker HTML navigation bypass + CDN cache removal

**Files:**
- Modify: `public/sw.js` (remove PDFJS_CACHE block, bypass HTML navigations)

**Note:** The CDN cache block is removed now, even though B1 hasn't swapped the loader yet, because after B1 lands the CDN will no longer be loaded. Removing it here avoids a dead code branch. Between this commit and B1, PDF.js will re-download from CDN on every session (cache miss). Acceptable — we're shipping B1 next wave.

- [ ] **Step 1: Rewrite public/sw.js**

Replace the entire content of `public/sw.js` with:

```javascript
const CACHE_NAME = 'cibxray-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache HTML navigations — the access gate runs in middleware
  // and must hit the network every time so an expired session sees the
  // login page, not a cached app shell.
  if (event.request.mode === 'navigate') {
    return; // default network handling
  }

  // Cache non-navigation same-origin assets (JS, CSS, fonts, icons)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
```

Changes:
- `CACHE_NAME` bumped `v1` → `v2` to force the activate handler to purge old caches (including the now-removed `pdfjs-cdn-v1`).
- Removed the entire `url.hostname === 'cdnjs.cloudflare.com'` block.
- New `event.request.mode === 'navigate'` early return before any caching logic — the HTML document itself is never served from cache.

- [ ] **Step 2: Verify build still emits the SW**

```bash
npm run build 2>&1 | tail -5
ls dist/sw.js
```

Expected: `dist/sw.js` exists and matches `public/sw.js` content.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js
git commit -m "fix(security): bypass service worker cache for HTML navigations

B8 / Phase 3 Track B. M-5 from the 2026-04-19 security review.

Previously the service worker cached the root HTML response with a
network-first strategy, which meant a user whose session cookie had
expired could reload on an offline device and see the cached app
shell instead of being bounced to the login page by middleware.

HTML navigations (request.mode === 'navigate') now bypass the SW
entirely and hit the network on every load. Non-navigation same-origin
assets continue to be cached.

Also drops the pdfjs-cdn-v1 cache block (dead after B1) and bumps
CACHE_NAME to v2 so the activate handler purges old caches on first
load."
```

---

## Task 4 (B5): Error boundary + crash-log endpoint

**Files:**
- Create: `src/components/ErrorBoundary.jsx`
- Create: `lib/errorBoundary.test.js`
- Create: `api/crash-log.js`
- Create: `lib/crashLog.test.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: Write failing tests for getDerivedStateFromError**

Create `lib/errorBoundary.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveErrorState } from '../src/components/ErrorBoundary.js';

test('deriveErrorState returns hasError: true with the error reference', () => {
  const err = new Error('boom');
  const next = deriveErrorState(err);
  assert.equal(next.hasError, true);
  assert.equal(next.error, err);
});

test('deriveErrorState is pure — called twice with the same input returns equal output', () => {
  const err = new Error('boom');
  const a = deriveErrorState(err);
  const b = deriveErrorState(err);
  assert.deepEqual(a, b);
});
```

(Named `errorBoundary.test.js` to match other lib tests even though the module lives under `src/components`. The test imports the pure helper from a plain `.js` sibling of the JSX component to keep the test runner DOM-free.)

- [ ] **Step 2: Verify test fails (module not yet created)**

```bash
npm test 2>&1 | tail -20
```

Expected: failure with `Cannot find module '../src/components/ErrorBoundary.js'`.

- [ ] **Step 3: Create the pure helper**

Create `src/components/ErrorBoundary.js`:

```javascript
export function deriveErrorState(error) {
  return { hasError: true, error };
}
```

- [ ] **Step 4: Create the React component**

Create `src/components/ErrorBoundary.jsx`:

```jsx
import React from 'react';
import { deriveErrorState } from './ErrorBoundary.js';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return deriveErrorState(error);
  }

  componentDidCatch(error, info) {
    const payload = {
      message: error?.message || 'Unknown error',
      stack: (error?.stack || '').slice(0, 2000),
      componentStack: (info?.componentStack || '').slice(0, 2000),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
    };
    try {
      fetch('/api/crash-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Swallow — a crash-in-crash must not cascade.
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: 480,
            padding: 32,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 18, color: '#0f172a' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
              The page hit an unexpected error and can't continue. A report was sent to the administrator. Please refresh to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                color: '#0f172a',
                fontSize: 14,
                cursor: 'pointer',
              }}>
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 5: Write failing tests for crash-log endpoint**

Create `lib/crashLog.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/crash-log.js';

function makeReq(method, body, headers = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body,
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    send(b) { this.body = b; return this; },
    end(b) { this.body = b; return this; },
  };
  return res;
}

test('crash-log: rejects GET with 405', async () => {
  const res = makeRes();
  await handler(makeReq('GET'), res);
  assert.equal(res.statusCode, 405);
});

test('crash-log: rejects body larger than 4096 bytes', async () => {
  const big = 'x'.repeat(5000);
  const res = makeRes();
  await handler(makeReq('POST', JSON.stringify({ message: big })), res);
  assert.equal(res.statusCode, 413);
});

test('crash-log: accepts valid POST body', async () => {
  const res = makeRes();
  const payload = { message: 'boom', stack: 'at foo', timestamp: '2026-04-20T00:00:00Z' };
  await handler(makeReq('POST', JSON.stringify(payload)), res);
  assert.equal(res.statusCode, 204);
});
```

- [ ] **Step 6: Verify crash-log tests fail**

```bash
npm test 2>&1 | tail -10
```

Expected: failure — `api/crash-log.js` doesn't exist yet.

- [ ] **Step 7: Implement crash-log endpoint**

Create `api/crash-log.js`:

```javascript
export const config = { runtime: 'nodejs' };

const MAX_BODY_BYTES = 4096;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const raw = typeof req.body === 'string'
    ? req.body
    : await readBody(req);

  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    res.status(413).send('Payload Too Large');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.status(400).send('Bad Request');
    return;
  }

  const safe = {
    message: String(parsed?.message || '').slice(0, 500),
    stack: String(parsed?.stack || '').slice(0, 2000),
    componentStack: String(parsed?.componentStack || '').slice(0, 2000),
    userAgent: String(parsed?.userAgent || '').slice(0, 300),
    timestamp: String(parsed?.timestamp || '').slice(0, 50),
  };

  console.error('[crash]', JSON.stringify(safe));
  res.status(204).end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on?.('data', (chunk) => { data += chunk; });
    req.on?.('end', () => resolve(data));
    req.on?.('error', reject);
    if (!req.on) resolve('');
  });
}
```

- [ ] **Step 8: Run all tests**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected:
```
# tests 82
# pass 82
# fail 0
```

(77 + 2 boundary + 3 crash-log.)

- [ ] **Step 9: Wrap App in ErrorBoundary in main.jsx**

Replace the body of `src/main.jsx`:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/print.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

- [ ] **Step 10: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: clean build, no errors.

- [ ] **Step 11: Commit**

```bash
git add src/components/ErrorBoundary.jsx src/components/ErrorBoundary.js lib/errorBoundary.test.js api/crash-log.js lib/crashLog.test.js src/main.jsx
git commit -m "feat(reliability): add React error boundary and crash-log endpoint

B5 / Phase 3 Track B. Previously, an uncaught React error rendered a
blank page with no user feedback and no server-side signal.

Adds src/components/ErrorBoundary.jsx with a friendly fallback card
('Something went wrong — Refresh') and a componentDidCatch hook that
POSTs a size-bounded crash payload to /api/crash-log. The endpoint
rejects non-POST, rejects bodies over 4 KB, and writes to console.error
with a [crash] tag so Vercel log drains pick it up. No persistent store.

+5 regression tests. Suite 77 → 82 pass."
```

---

## Task 5 (B3): Data-wipe hygiene — stripRawText + try/finally + React cleanup

**Files:**
- Create: `lib/reportHygiene.js`
- Create: `lib/reportHygiene.test.js`
- Modify: `src/App.jsx` (print handoff + close/upload cleanup)

- [ ] **Step 1: Write failing tests**

Create `lib/reportHygiene.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripRawText, clearPrintPayload } from './reportHygiene.js';

test('stripRawText removes rawText from every facility', () => {
  const input = {
    subject: { name: 'X' },
    facilities: [
      { contractCode: 'A', rawText: 'lots of pdf text' },
      { contractCode: 'B', rawText: 'more pdf text' },
    ],
  };
  const out = stripRawText(input);
  assert.equal(out.facilities[0].rawText, undefined);
  assert.equal(out.facilities[1].rawText, undefined);
  assert.equal(out.facilities[0].contractCode, 'A');
});

test('stripRawText does not mutate the input', () => {
  const input = { facilities: [{ contractCode: 'A', rawText: 'keep' }] };
  stripRawText(input);
  assert.equal(input.facilities[0].rawText, 'keep');
});

test('stripRawText preserves all non-rawText fields', () => {
  const input = {
    subject: { name: 'X', nid: '123' },
    reportNo: 'R1',
    facilities: [{ contractCode: 'A', rawText: 'x', outstanding: 100 }],
  };
  const out = stripRawText(input);
  assert.equal(out.subject.nid, '123');
  assert.equal(out.reportNo, 'R1');
  assert.equal(out.facilities[0].outstanding, 100);
});

test('stripRawText handles arrays of reports', () => {
  const input = [
    { facilities: [{ rawText: 'x', c: 1 }] },
    { facilities: [{ rawText: 'y', c: 2 }] },
  ];
  const out = stripRawText(input);
  assert.equal(out[0].facilities[0].rawText, undefined);
  assert.equal(out[1].facilities[0].rawText, undefined);
  assert.equal(out[0].facilities[0].c, 1);
});

test('stripRawText handles missing facilities array gracefully', () => {
  const input = { subject: { name: 'X' } };
  const out = stripRawText(input);
  assert.equal(out.subject.name, 'X');
});

test('clearPrintPayload removes cibxray_print_payload from a storage-like object', () => {
  const storage = {
    cibxray_print_payload: 'data',
    other_key: 'keep',
    removeItem(k) { delete this[k]; },
  };
  clearPrintPayload(storage);
  assert.equal(storage.cibxray_print_payload, undefined);
  assert.equal(storage.other_key, 'keep');
});

test('clearPrintPayload no-ops when the key is absent', () => {
  const storage = { other: 'x', removeItem(k) { delete this[k]; } };
  assert.doesNotThrow(() => clearPrintPayload(storage));
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npm test 2>&1 | tail -10
```

Expected: `Cannot find module './reportHygiene.js'`.

- [ ] **Step 3: Implement reportHygiene.js**

Create `lib/reportHygiene.js`:

```javascript
export const PRINT_PAYLOAD_KEY = 'cibxray_print_payload';

export function stripRawText(input) {
  if (Array.isArray(input)) {
    return input.map(stripRawText);
  }
  if (input && typeof input === 'object') {
    const copy = { ...input };
    if (Array.isArray(copy.facilities)) {
      copy.facilities = copy.facilities.map((f) => {
        const { rawText, ...rest } = f;
        return rest;
      });
    }
    return copy;
  }
  return input;
}

export function clearPrintPayload(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(PRINT_PAYLOAD_KEY);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected: `pass 89` (82 + 7 new).

- [ ] **Step 5: Locate the print handoff in App.jsx**

```bash
grep -n "cibxray_print_payload\|setItem.*print\|handlePrint\|window.open.*print" src/App.jsx | head -10
```

Confirm the existing print-handoff call site (single location per the Phase 2 spec — it writes to `localStorage` and opens `/#print`).

- [ ] **Step 6: Wrap print handoff in try/finally using stripRawText**

In `src/App.jsx`, locate the `handlePrint` function (or equivalent). The current pattern is roughly:

```javascript
// BEFORE (existing):
const handlePrint = () => {
  const payload = { report, writtenAt: Date.now() };
  localStorage.setItem('cibxray_print_payload', JSON.stringify(payload));
  window.open('/#print', '_blank');
};
```

Replace with:

```javascript
// AFTER:
const handlePrint = () => {
  try {
    const sanitized = stripRawText(report);
    const payload = { report: sanitized, writtenAt: Date.now() };
    localStorage.setItem(PRINT_PAYLOAD_KEY, JSON.stringify(payload));
    const win = window.open('/#print', '_blank');
    if (!win) {
      clearPrintPayload(localStorage);
    }
  } catch (err) {
    clearPrintPayload(localStorage);
    throw err;
  }
};
```

And at the top of `src/App.jsx`, import the helpers:

```javascript
import { stripRawText, clearPrintPayload, PRINT_PAYLOAD_KEY } from '../lib/reportHygiene.js';
```

(Adjust the relative path to match the actual location; `src/App.jsx` → `../lib/reportHygiene.js` is correct for the standard layout.)

**Note:** If `handlePrint` currently uses a hardcoded `'cibxray_print_payload'` string, replace it with the imported `PRINT_PAYLOAD_KEY` constant for consistency.

- [ ] **Step 7: Add report cleanup on close / new-upload**

In `src/App.jsx`, find the handlers that reset the report state (usually a "Close" or "Back to upload" button, and the file-drop/upload handler). Before these set `setReport(null)` or replace the report, add:

```javascript
clearPrintPayload(localStorage);
```

If there isn't already a handler for "close report," add one where the close UI is wired up. For example, if the close button currently does `onClick={() => setReport(null)}`, replace with:

```jsx
onClick={() => {
  clearPrintPayload(localStorage);
  setReport(null);
}}
```

For the upload handler that replaces the current report, add the same `clearPrintPayload(localStorage)` line before the `setReport(newReport)` call.

- [ ] **Step 8: Add unmount cleanup**

Still in `src/App.jsx`, inside the top-level `App` component function, add a `useEffect` near the existing state hooks:

```javascript
useEffect(() => {
  return () => {
    clearPrintPayload(localStorage);
  };
}, []);
```

(If `useEffect` is not already imported, add it to the React import.)

- [ ] **Step 9: Run build + tests**

```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected: clean build; `pass 89`.

- [ ] **Step 10: Commit**

```bash
git add lib/reportHygiene.js lib/reportHygiene.test.js src/App.jsx
git commit -m "fix(security): strip raw text from print payload and scrub on close

B3 / Phase 3 Track B. M-2 from the 2026-04-19 security review.

Previously the full parsed report — including per-facility rawText
(several KB of the original PDF text per facility, ~10-80 KB per
report total) — was written to localStorage during the print handoff
and left in React memory until the page closed. A banker walking away
from a shared terminal left personal credit data in local storage.

Three changes:

1. lib/reportHygiene.js with a pure stripRawText(report) that returns
   a deep-enough copy without rawText on any facility. Called before
   localStorage writes and before any other serialization boundary.

2. handlePrint wrapped in try/finally. localStorage is cleared on any
   error path or if window.open returns null (popup blocker). The
   print route's existing consume-on-read stays as the primary cleanup.

3. Explicit clearPrintPayload(localStorage) on close-report, on new
   batch upload, and on App unmount (useEffect cleanup).

+7 regression tests. Suite 82 → 89 pass."
```

---

## Task 6 (B1): Bundle PDF.js locally

**Files:**
- Create: `src/parser/loadPdfjs.js`
- Modify: `src/parser/pdfLoader.js` (re-export from loadPdfjs.js, remove CDN injection)
- Modify: `src/parser/pdfToText.js` (swap `window.pdfjsLib` for imported module)
- Modify: `src/parser/scanDetect.js` (swap `window.pdfjsLib` for imported module)
- Modify: `package.json` (+pdfjs-dist)

- [ ] **Step 1: Install pdfjs-dist pinned to the CDN version**

```bash
npm install pdfjs-dist@3.11.174
```

Expected: no errors, `package.json` now lists `pdfjs-dist` under dependencies.

- [ ] **Step 2: Create loadPdfjs.js**

Create `src/parser/loadPdfjs.js`:

```javascript
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export { pdfjsLib };
```

**Note:** `pdfjs-dist@3.x` ships its worker as `pdf.worker.min.mjs` (ES module). Vite's `?url` suffix emits it as a hashed asset in `dist/assets/` at build time. If the module resolution path differs, check `node_modules/pdfjs-dist/build/` and use the filename that exists there (e.g. `pdf.worker.min.js` in older builds).

- [ ] **Step 3: Rewrite pdfLoader.js as a thin async-compat shim**

Replace `src/parser/pdfLoader.js`:

```javascript
import { pdfjsLib } from './loadPdfjs.js';

export function loadPdf() {
  return Promise.resolve(true);
}

export { pdfjsLib };
```

The `loadPdf()` function is preserved with the same Promise shape so `pdfToText.js` (which currently awaits it) continues to work during the transition. The network fetch is now a no-op because Vite bundles the module at build time.

- [ ] **Step 4: Update pdfToText.js to use the imported module**

Replace the two CDN lines in `src/parser/pdfToText.js`:

```javascript
// BEFORE:
import { loadPdf } from './pdfLoader';

export async function pdfToText(arrayBuffer) {
  if (!await loadPdf()) throw new Error("PDF.js failed to load");
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  // ...
}

// AFTER:
import { pdfjsLib } from './loadPdfjs.js';

export async function pdfToText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  // ...
}
```

Read the file first to see the full body, then make the minimal change: replace the `loadPdf` import with `pdfjsLib` import, delete the `if (!await loadPdf())` line, and change `window.pdfjsLib` to `pdfjsLib`. Keep everything else.

- [ ] **Step 5: Update scanDetect.js similarly**

Open `src/parser/scanDetect.js` and locate the `window.pdfjsLib` usage (line 14-15 per baseline grep).

```javascript
// BEFORE:
const OPS = typeof window !== 'undefined' && window.pdfjsLib ? window.pdfjsLib.OPS : null;
if (!OPS) throw new Error('pdfjsLib not loaded');

// AFTER:
import { pdfjsLib } from './loadPdfjs.js';
// ... (inside the function where OPS was previously derived):
const OPS = pdfjsLib.OPS;
```

Add the import at the top of the file. Remove the `typeof window` check — the module is now imported unconditionally.

- [ ] **Step 6: Run tests**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected: `pass 89` — existing parser tests remain green.

**If scanDetect.test.js fails** because the test previously relied on `window.pdfjsLib` being absent to trigger a specific branch, update the test to use `pdfjsLib.OPS` directly. Commit this as part of the same task.

- [ ] **Step 7: Build and check bundle size**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean build. New bundle chunks include a `pdf.worker` asset (~300 KB gzipped) and an updated main chunk. Compare vs the previous `build ... ms` number — build time should stay under 2s.

- [ ] **Step 8: Grep to confirm no remaining CDN references**

```bash
grep -rn "cdnjs.cloudflare.com\|cdnjs\b" --include="*.js" --include="*.jsx" --include="*.html" . | grep -v node_modules | grep -v dist
```

Expected: no matches (or only the `dist/` build output, which regenerates from source).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/parser/loadPdfjs.js src/parser/pdfLoader.js src/parser/pdfToText.js src/parser/scanDetect.js
git commit -m "fix(security): bundle PDF.js locally instead of loading from CDN

B1 / Phase 3 Track B. H-1 (long-term) from the 2026-04-19 security
review. Absorbs A3 (SRI stopgap) which is now unnecessary.

Previously the parser injected a <script> tag at runtime pointing at
cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js on every
page load. Two consequences:
- Bank firewalls that block cdnjs break the tool entirely.
- A CDN compromise would silently inject JS into every banker's
  browser while they're processing real CIB data.

Adds pdfjs-dist@3.11.174 (pinned to the previous CDN version for
zero behavioral change). New src/parser/loadPdfjs.js imports the lib
and registers the worker via Vite's ?url suffix. pdfLoader.js
collapses to a compat shim; pdfToText.js and scanDetect.js import
the module directly instead of reading from window.pdfjsLib.

Bundle: +~300 KB gzipped (worker chunk, code-split). Acceptable for
banker-internal workflow."
```

---

## Task 7 (B2): xlsx → exceljs

**Files:**
- Modify: `package.json` (-xlsx, +exceljs)
- Modify: `src/export/excelExport.js` (full rewrite)

- [ ] **Step 1: Swap packages**

```bash
npm uninstall xlsx
npm install exceljs
```

Expected: `xlsx` gone from `package.json`, `exceljs` added.

- [ ] **Step 2: Rewrite src/export/excelExport.js**

Replace the entire content:

```javascript
import { calcScore } from '../scoring/calcScore';
import { getBand } from '../constants/bands';

export async function doExport(reports, mode, groupLabel) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();

  const sumRows = reports.map((r, i) => {
    const s = calcScore(r.facilities.filter(f => f.role === 'Borrower' || f.role === 'CoBorrower'));
    const b = getBand(s.total, s.override);
    return {
      Report: r.reportNo || 'CIB-' + (i + 1), File: r.fileName || '',
      Name: r.subject.displayName || '', Type: r.subject.subjectType || '',
      NID: r.subject.nid || '', Reg: r.subject.regNo || '',
      CIB_Code: r.subject.cibSubjectCode || '',
      Live: s.agg.live, Hist: s.agg.hist, Limit: s.agg.tLim,
      Outstanding: s.agg.tOut, Overdue: s.agg.tOver,
      Util: (s.agg.util * 100).toFixed(1) + '%', Base: s.agg.baseScore,
      Penalty: s.bd['Classification Penalty']?.pts,
      Score: s.total, Risk: b.label, Override: s.override || 'None',
    };
  });
  addSheet(wb, 'Summary', sumRows);

  if (mode === 'linked' && reports.length > 1) {
    const allFacs = reports.flatMap(r => r.facilities.filter(f => f.role === 'Borrower' || f.role === 'CoBorrower'));
    const gs = calcScore(allFacs);
    addSheet(wb, 'Group', [
      { F: 'Group', V: groupLabel }, { F: 'Reports', V: reports.length },
      { F: 'Score', V: gs.total }, { F: 'Risk', V: getBand(gs.total, gs.override).label },
      { F: 'Override', V: gs.override || 'None' },
      { F: 'Limit', V: gs.agg.tLim }, { F: 'Outstanding', V: gs.agg.tOut },
      { F: 'Overdue', V: gs.agg.tOver },
    ]);
  }

  reports.forEach((r, i) => {
    const rows = r.facilities.map((f, j) => ({
      Sl: j + 1, Contract: f.contractCode, Role: f.role, Institution: f.institution,
      Type: f.type, Nature: f.nature, Status: f.status, Limit: f.limit,
      Outstanding: f.outstanding, Overdue: f.overdue, Classification: f.classification,
      Start: f.startDate, End: f.endDate,
      Rescheduled: f.rescheduled ? 'Yes (' + f.rescheduledCount + 'x)' : 'No',
      Reorganized: f.reorganized ? 'Yes' : 'No',
      Default: f.defaultStatus, Willful_Default: f.willfulDefault ? 'Yes' : 'No',
      WD_Remarks: f.wdRemarks || '', Lawsuit: f.lawsuit || '',
    }));
    addSheet(wb, (r.reportNo || 'R' + (i + 1)).slice(0, 28), rows);

    const flagged = r.facilities.filter(f =>
      f.defaultStatus === 'Yes' || f.defaultStatus === 'WD' || f.willfulDefault ||
      f.rescheduled || f.reorganized || f.lawsuit ||
      ['SS', 'DF', 'BL', 'BLW'].includes(f.classification) ||
      (f.classification === 'SMA' && f.status === 'Live')
    );
    if (flagged.length > 0) {
      const flagRows = flagged.map((f, j) => {
        const reasons = [];
        if (f.defaultStatus === 'Yes') reasons.push('Defaulter');
        if (f.willfulDefault || f.defaultStatus === 'WD') reasons.push('Willful Default');
        if (f.rescheduled) reasons.push('Rescheduled ' + f.rescheduledCount + 'x');
        if (f.reorganized) reasons.push('Reorganized');
        if (f.lawsuit) reasons.push('Lawsuit: ' + f.lawsuit);
        if (['SS', 'DF', 'BL', 'BLW'].includes(f.classification)) reasons.push('Classification: ' + f.classification);
        if (f.classification === 'SMA' && f.status === 'Live') reasons.push('Live SMA');
        return {
          Sl: j + 1, Contract: f.contractCode, Role: f.role, Type: f.type,
          Status: f.status, Classification: f.classification,
          Outstanding: f.outstanding, Overdue: f.overdue,
          Red_Flags: reasons.join('; '),
        };
      });
      addSheet(wb, ('Flags-' + (r.reportNo || 'R' + (i + 1))).slice(0, 28), flagRows);
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (mode === 'batch' ? 'CIBxRay_Batch' : mode === 'linked' ? 'CIBxRay_Linked' : 'CIBxRay_' + (reports[0]?.reportNo || 'Report')) + '.xlsx';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
}

function addSheet(wb, name, rows) {
  const sheet = wb.addWorksheet(sanitizeSheetName(name));
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map(h => ({ header: h, key: h }));
  sheet.addRows(rows);
}

function sanitizeSheetName(name) {
  // Excel disallows : \ / ? * [ ] and caps at 31 chars. xlsx.json_to_sheet
  // silently truncated/sanitized; exceljs throws, so we do it explicitly.
  return String(name).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
}
```

**Changes from the xlsx version:**
- `await import('xlsx')` → `(await import('exceljs')).default`.
- `XLSX.utils.book_new()` → `new ExcelJS.Workbook()`.
- `XLSX.utils.json_to_sheet(rows)` + `book_append_sheet` → `addSheet` helper that calls `wb.addWorksheet()` + `sheet.columns = ...` + `sheet.addRows(rows)`.
- `XLSX.write(wb, { bookType: 'xlsx', type: 'array' })` → `await wb.xlsx.writeBuffer()`.
- Added `sanitizeSheetName` because exceljs throws on invalid sheet names; xlsx was lenient.

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -8
```

Expected: clean build. The `dist/assets/xlsx-*.js` chunk is replaced by an `exceljs-*.js` chunk (larger, ~600 KB gzipped, code-split behind the dynamic import so landing-page JS is unchanged).

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
```

Expected: `pass 89` (no test changes — export is a live-smoke concern, not unit-test-friendly because it touches `document` and creates blobs).

- [ ] **Step 5: Smoke test the export locally**

```bash
npm run dev &
sleep 3
echo "Open http://localhost:5173/, upload a test PDF, click the xlsx export button, verify the file downloads and opens cleanly in Excel or Numbers."
```

Kill the dev server (`kill %1`) once the manual check passes.

- [ ] **Step 6: Verify audit**

```bash
npm audit 2>&1 | grep -A1 "xlsx\|exceljs" | head -5
```

Expected: no `xlsx` entry. `exceljs` either absent or with no HIGH/CRITICAL findings.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/export/excelExport.js
git commit -m "fix(security): replace xlsx with exceljs for Excel export

B2 / Phase 3 Track B. H-2 from the 2026-04-19 security review.

Previously the export used xlsx@0.18.5, which is end-of-life with two
unpatched HIGH-severity CVEs: prototype pollution (GHSA-4r6h-8v6p-xvw6)
and ReDoS (GHSA-5pgg-2g8v-p4x9). The publisher stopped maintenance;
there is no upgrade path.

Swaps to exceljs — actively maintained, no open CVEs. Porting was
mechanical: workbook construction uses wb.addWorksheet + sheet.columns
+ sheet.addRows instead of XLSX.utils.json_to_sheet. Cell values, sheet
names, and download filename format are unchanged. Added explicit sheet
name sanitization because exceljs throws on invalid characters that
xlsx silently stripped.

Bundle: exceljs chunk is ~600KB gzipped vs xlsx's ~140KB, code-split
behind the existing dynamic import so landing-page JS is unaffected.

Closes H-2. npm audit now reports zero HIGH/CRITICAL in deps."
```

---

## Task 8 (B6): CSP + security headers

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Confirm no existing vercel.json**

```bash
ls vercel.json 2>&1
```

Expected: `ls: vercel.json: No such file or directory`. If one exists, read it and merge the headers block below into the existing JSON.

- [ ] **Step 2: Create vercel.json**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), usb=()"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Start dev server and verify no CSP violations on local preview**

Note: `vercel.json` headers only apply on Vercel deployments, not `vite dev`. So local CSP validation must be done against a preview deployment after Vercel CLI or a `git push` to a branch.

Instead, verify the JSON is valid:

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json'))"
echo "Exit code: $?"
```

Expected: exit code 0.

- [ ] **Step 4: Run tests and build**

```bash
npm test 2>&1 | grep -E "# (tests|pass|fail)"
npm run build 2>&1 | tail -5
```

Expected: tests still `pass 89`; build clean.

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "feat(security): add CSP and defense-in-depth headers

B6 / Phase 3 Track B. M-1 from the 2026-04-19 security review.

Adds vercel.json with a headers block applied to all routes:
- Content-Security-Policy — default-src 'self', script-src 'self'
  (clean after B1 removed the CDN), style-src 'self' 'unsafe-inline'
  (documented exception: inline React style props, tracked for
  Phase 4 refactor; no XSS vector exists in current codebase).
  worker-src 'self' blob: for PDF.js. frame-ancestors 'none'.
- Strict-Transport-Security — 2-year max-age, includeSubDomains,
  preload.
- X-Content-Type-Options: nosniff.
- Referrer-Policy: strict-origin-when-cross-origin.
- Permissions-Policy: camera/microphone/geolocation/usb denied.

Live verification pending preview deployment."
```

---

## Task 9: Update roadmap + create CISO summary (vault repo)

**Files:**
- Modify: `~/Projects/claude-second-brain/01_Projects/CIBXray/CIBxRay-Production-Roadmap.md`
- Create: `~/Projects/claude-second-brain/01_Projects/CIBXray/CIBxRay-CISO-Summary.md`

**Note:** The vault is a separate git repo. This task happens in `~/Projects/claude-second-brain`, not the cibxray repo.

- [ ] **Step 1: Open the vault roadmap**

```bash
cd ~/Projects/claude-second-brain
git pull
```

- [ ] **Step 2: Update the Phase 3 section with shipped commit SHAs**

In `01_Projects/CIBXray/CIBxRay-Production-Roadmap.md`, locate the "Security findings log (2026-04-19 review, HEAD `45c2896`)" table. For each row that has a Track B fix, replace the "Phase 3 #" column value with the commit SHA once the `feat/phase3-track-b` branch is merged into main (look up after merge). Before merge, mark them "branch:feat/phase3-track-b".

Update the Phase 3 narrative:
- Track A items mark "shipped 2026-04-20": A1 `e5292be`, A2 `5151014`, A3 absorbed by B1, A4 `2dd67ee`.
- Track B scope-reduction note: "Shipped 8 of 11 items. B9 (login body cap), B10 (POST-only logout + CSRF), B11 (KV-backed rate limiter) deferred as accepted risks for the banker pilot. Documented in the CISO summary."

- [ ] **Step 3: Create CISO summary**

Create `01_Projects/CIBXray/CIBxRay-CISO-Summary.md` with the following structure:

```markdown
# CIBxRay — Security Summary for Bank CISO

**Version:** 1.0 · **Date:** 2026-04-XX · **Prepared for:** [Bank IT/CISO]

## One-page summary

CIBxRay is a browser-side tool that parses Bangladesh Bank CIB reports and
produces scored credit summaries for internal banker use. It is stateless:
no customer data is transmitted off the banker's device during analysis.

Security posture as of this version:

| Control | Status |
|---|---|
| Transport encryption | TLS 1.3 via Vercel. HSTS with 2-year preload. |
| Access control | Shared secret with HMAC-signed session cookie (HttpOnly, Secure, SameSite=Strict). Per-IP rate limit (5 attempts / 15 min). |
| Content Security Policy | default-src 'self' with a documented inline-styles exception (no XSS vector in codebase). |
| Supply chain | PDF reader bundled locally (no CDN dependency). All dependencies npm-audit clean at HIGH+ severity. |
| Data lifetime | Parsed reports stripped of raw PDF text before any serialization. Cleared on close/new-upload. |
| Logging | No persistent logs. Crash events go to the Vercel function log stream. |
| Infrastructure | Vercel Pro; single region (fra1); Node.js 24. |

## Accepted risks for pilot

1. **Cross-region rate limit (B11).** The login rate limit is per-serverless-instance. An attacker distributing attempts across multiple Vercel regions could multiply allowed attempts. Not exploitable at pilot scale (5 users); upgraded to a shared-store limiter before broader rollout.
2. **Logout HTTP method (B10).** Logout accepts any HTTP method. The cookie is `SameSite=Strict` which blocks cross-origin submissions. Tightened before broader rollout.
3. **Login body cap (B9).** Vercel's 4.5 MB infra cap is the active backstop; no application-level 8 KB cap. Addressed before broader rollout.

## Mapping to 2026-04-19 security review

| Finding ID | Severity | Status |
|---|---|---|
| C-1 | Critical | Fixed in `e5292be` |
| H-1 | High | Fixed in <B1-commit-SHA> |
| H-2 | High | Fixed in <B2-commit-SHA> |
| H-3 | High | Fixed in `5151014` |
| H-4 | High | Fixed in `2dd67ee` |
| M-1 | Medium | Fixed in <B6-commit-SHA> |
| M-2 | Medium | Fixed in <B3-commit-SHA> |
| M-3 | Medium | Fixed in <B7-commit-SHA> |
| M-4 | Medium | Fixed in <B4-commit-SHA> |
| M-5 | Medium | Fixed in <B8-commit-SHA> |
| L-1 | Low | Deferred (B9) |
| L-2 | Low | No action (informational) |
| L-3 | Low | No action (informational) |
| L-4 | Low | Deferred (B10) |
| L-5 | Low | No action (informational) |

## Review history

- 2026-04-19 — full review by security-reviewer agent (15 findings)
- 2026-04-20 — Track A hot-patches (3 commits)
- 2026-04-XX — Track B full hardening phase (8 commits)

---
_Document to be updated as Track B commits land in main._
```

(Fill in the commit SHAs after the cibxray PR is merged.)

- [ ] **Step 4: Commit to vault**

```bash
cd ~/Projects/claude-second-brain
git add 01_Projects/CIBXray/CIBxRay-Production-Roadmap.md 01_Projects/CIBXray/CIBxRay-CISO-Summary.md
git commit -m "cibxray: phase 3 track B execution — roadmap + CISO summary"
git push
```

---

## Task 10: Push branch, open PR, preview smoke

**Files:** none (CI + live verification)

- [ ] **Step 1: Push the branch**

```bash
cd ~/Projects/cibxray
git push -u origin feat/phase3-track-b
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: phase 3 track B — security hardening (8 items)" --body "$(cat <<'EOF'
## Summary
- Closes every Medium-and-above finding from the 2026-04-19 security review (B1–B8).
- 8 items on this branch; B9, B10, B11 deferred as accepted pilot risks (see spec).

## Waves & commits
Wave 1 — quick wins:
- B4 robots.txt + generic login title
- B7 remove password length timing oracle
- B8 service worker bypasses HTML navigations
- B5 React error boundary + /api/crash-log

Wave 2 — concentrated work:
- B3 strip rawText from print payload + scrub on close/new-upload
- B1 bundle PDF.js locally (pdfjs-dist@3.11.174), drop CDN
- B2 replace xlsx@0.18.5 with exceljs

Wave 3 — capstone:
- B6 CSP + HSTS + nosniff + Referrer-Policy + Permissions-Policy via vercel.json

## Test plan
- [ ] `npm test` green (~89 tests)
- [ ] `npm run build` clean
- [ ] `npm audit` zero HIGH/CRITICAL in production dependencies
- [ ] Preview deploy smoke:
  - [ ] Upload CITY LUBE PDF → 427 facilities, reconciliation banner green
  - [ ] Export xlsx → opens cleanly in Excel and Numbers
  - [ ] Trigger error boundary via DevTools throw → fallback card renders, `[crash]` log appears in Vercel logs
  - [ ] Clear session cookie, reload → login page (SW does not serve cached app shell)
  - [ ] DevTools Network: no requests to cdnjs.cloudflare.com
  - [ ] DevTools Headers on `/`: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present
  - [ ] `/robots.txt` returns `User-agent: *` / `Disallow: /`
  - [ ] Close report → report state cleared from React memory and localStorage
  - [ ] 5 wrong login attempts → 429 + Retry-After (regression check for Track A)

## Deferred
- B9 (login body cap) — Vercel 4.5MB infra cap is backstop
- B10 (POST-only logout + CSRF) — SameSite=Strict cookie blocks cross-origin
- B11 (KV-backed rate limiter) — in-memory limiter is sufficient for 5-banker pilot

See spec `docs/superpowers/specs/2026-04-20-phase3-trackb-hardening-design.md` for the full design and CISO summary.
EOF
)"
```

- [ ] **Step 3: Run the preview smoke checklist**

Use the Vercel preview URL (printed by `gh pr view --web` or in PR comments). Run every box in the test plan above. If any fail, open fix commits on the branch.

- [ ] **Step 4: Merge**

After all smoke checks pass:

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 5: Verify production is healthy**

```bash
sleep 60
curl -I https://cibxray.vercel.app | grep -E "^(content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|permissions-policy)"
curl -I https://cibxray.vercel.app/robots.txt
```

Expected: every security header present; `/robots.txt` returns 200 with `Disallow: /`.

- [ ] **Step 6: Update vault CISO summary with final commit SHAs**

Go back to the vault, fill in `<B1-commit-SHA>` etc. with the merge commits from the PR, and commit + push the vault.

---

## Exit gate

All of:
1. `npm test` green (≥89 tests).
2. `npm run build` clean.
3. `npm audit` reports zero HIGH or CRITICAL in production dependencies.
4. Preview deployment has every security header, serves `/robots.txt`, parses the CITY LUBE PDF correctly, exports xlsx correctly, and falls back to login on offline reload.
5. Roadmap Phase 3 section has a commit SHA (or documented deferral) for every 2026-04-19 review finding.
6. CISO summary document exists in the vault.
