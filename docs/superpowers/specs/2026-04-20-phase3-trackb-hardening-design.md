# Phase 3 Track B — Security Hardening — Design

**Date:** 2026-04-20
**Status:** Draft · pending user approval
**Context:** Track B of Phase 3 in `CIBxRay-Production-Roadmap.md`. Eight of the eleven original Track B items are in scope; B9 (login body cap), B10 (POST-only logout + CSRF), and B11 (KV-backed rate limiter) are deferred as accepted risks for the banker pilot. Track A hot-patches (A1, A2, A4) shipped on 2026-04-20 (commits `2dd67ee`, `e5292be`, `5151014`). A3 (SRI on PDF.js CDN script) is absorbed by B1, which removes the CDN dependency entirely.

---

## Problem

The 2026-04-19 security review (security-reviewer agent against HEAD `45c2896`) produced fifteen findings across Critical, High, Medium, and Low severities. Track A closed the three items that were remotely exploitable within a 2-hour window; the remaining items are phase-sized and together decide whether the tool can pass a bank CISO checklist.

Three concerns drive Track B:

1. **Supply-chain risk.** The app loads its PDF reader from `cdnjs.cloudflare.com` on every page load. Many bank firewalls block public CDNs outright; more importantly, a CDN compromise would silently inject JavaScript into every banker's browser while they're processing real CIB data. Separately, `xlsx@0.18.5` is end-of-life with two unpatched HIGH CVEs (prototype pollution, ReDoS).
2. **Defence-in-depth gaps.** No Content Security Policy. No HSTS. No `X-Content-Type-Options`. No `robots.txt`. No React error boundary. Service worker caches the authenticated app shell, which can be reloaded after session expiry. Password length timing oracle. None of these are single-point exploits, but an IT security questionnaire will flag every one.
3. **Client-side data lifetime.** Full parsed reports — including the raw text extracted from the PDF — remain in browser memory for the session, and the print handoff writes the complete report (with raw text) to `localStorage`. A banker walking away from a shared terminal leaves personal credit data sitting in memory and local storage.

After Track B, the tool should hand a CISO a one-page security summary and get ticks without follow-up.

## Non-goals

- **Login body size cap (B9).** Vercel's 4.5 MB platform cap is an adequate backstop; an 8 KB application-level cap is hygiene with no reachable exploit path.
- **POST-only logout + CSRF double-submit (B10).** Logout is idempotent and already uses a cookie that's `SameSite=Strict`, which blocks cross-origin submission. Full CSRF layer deferred until state-changing endpoints expand beyond login/logout.
- **KV-backed rate limiter (B11).** The in-memory per-instance limiter from Track A (commit `5151014`) is sufficient for a 5-banker internal pilot. Cross-region global limits only matter once traffic keeps many Vercel instances warm, which won't happen in the pilot. Upgraded before broader rollout.
- **Full strict CSP without `style-src 'unsafe-inline'`.** `App.jsx` uses inline `style={{...}}` props extensively, including runtime-computed styles (percent-width progress bars, score-dependent colors). Refactoring these to external stylesheets is a 2-3 day cosmetic refactor that adds no security delta in the absence of an untrusted-HTML surface. Deferred to Phase 4.
- **Persistent crash-log storage.** B5's crash-log endpoint writes to `console.error` with a `[crash]` tag, which lands in Vercel's log stream. No database or file store is introduced.
- **SRI on any external resource.** B1 removes the only CDN script; any future CDN dependencies will require SRI as a review gate.
- **Refactoring `App.jsx` into smaller components.** The file's size is a known concern but not in Track B's scope; structural refactor lives in Phase 4.

## Approach

Eight items delivered on a single `feat/phase3-track-b` branch via subagent-driven development, grouped into three waves by size and dependency:

### Wave 1 — Quick wins (half-day)

Low-risk, largely independent commits that close four findings with minimal code.

#### B4 — robots.txt + generic login title

- `public/robots.txt`: `User-agent: *` / `Disallow: /`
- `index.html` `<title>` changes from `CIBxRay` to `Portal`. Remove any `<meta name="description">`.
- Test: build passes.

#### B7 — Password length timing oracle

In `lib/session.js`, `verifyPassword` currently bails fast when input and expected have different lengths. That 1ms difference reveals the expected password's byte length.

- Pad both values to a fixed 256-byte buffer with a known filler byte before `crypto.timingSafeEqual`.
- Track length equality as a separate boolean. AND with the compare result after the compare completes.
- Test: `verifyPassword('short', 'longerpassword')` returns `false`; `verifyPassword('same-length-wrong-content!!', 'longerpassword...')` returns `false`. Timing is a code-shape assertion, not runtime-measured.

#### B8 — Service worker cache exclusion for HTML entry

Audit the build to identify the service worker source (Vite PWA plugin, custom `sw.js`, or none). If one is present, exclude the HTML entry from runtime/precache so a reload after session expiry falls through to the middleware and hits the login page.

- Vite PWA: add `workbox.navigateFallbackDenylist: [/^\/$/]`.
- Custom SW: exclude `/` from runtime cache, set `fetch` handler to bypass cache for navigation requests.
- Test: live smoke — clear session cookie, reload while offline, expect login HTML, not cached app shell.

#### B5 — Error boundary + crash-log endpoint

- `src/components/ErrorBoundary.jsx`: classic class-based boundary. `getDerivedStateFromError` sets `hasError`; `componentDidCatch` fires an async POST to `/api/crash-log` with `{ message, stack, userAgent, timestamp }`, silently failing on network error.
- Fallback UI: a single card with "Something went wrong. Please refresh." + a "Refresh" button calling `window.location.reload()`. Uses `S.bo` button style to match app vocabulary.
- `api/crash-log.js`: POST only, reject body > 4 KB, `console.error('[crash]', body)`. No storage.
- Wrap `<App />` in `<ErrorBoundary>` in `src/main.jsx`.
- Test: unit test the boundary's static `getDerivedStateFromError` directly (no DOM needed — the existing node test runner handles it). Separately, mock-req/res test of `api/crash-log.js` — reject non-POST, reject oversized body, accept valid body.

### Wave 2 — Concentrated work (2 days)

Structural changes that reshape bundle and data lifetime.

#### B3 — Data-wipe hygiene

Three changes, all in `src/`:

1. **New `lib/reportHygiene.js`** exports `stripRawText(report)`, a pure function that returns a deep copy of the report with `rawText` removed from every facility. Called before any `localStorage` write in the print handoff and before any serialization that crosses a boundary.
2. **Print handoff in `App.jsx`** wraps the existing localStorage-write in `try/finally`. The `finally` clears `cibxray_print_payload` on any exit path, covering the case where the print tab fails to open or the user aborts mid-flow.
3. **React-memory scrub.** On "close report" (user returns to upload screen) and on "new batch upload" (user swaps to a fresh PDF), call `setReport(null)` explicitly and delete any `cibxray_*` keys from `localStorage`. An `useEffect` cleanup in the `App` root handles the unmount path.
- Test: unit test `stripRawText` recursively removes `rawText` from facilities. Unit test that `localStorage.getItem('cibxray_print_payload')` is `null` after simulated print-handoff error. Integration test that `setReport(null)` clears payload.

#### B1 — Bundle PDF.js locally

- `npm install pdfjs-dist@3.11.174` (pin to current CDN version for zero-behavior-change).
- Replace the `<script src="https://cdnjs.cloudflare.com/...">` tag in `index.html` with module import in a new `src/parser/loadPdfjs.js`:
  ```js
  import * as pdfjsLib from 'pdfjs-dist';
  import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url';
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  export { pdfjsLib };
  ```
- Vite's `?url` suffix emits the worker as a hashed asset under `dist/assets/`.
- Update `parseBBCIB.js` and any other parser entry points to import from `loadPdfjs.js` instead of relying on a global.
- Bundle impact: +~300 KB gzipped. Acceptable — the app is banker-internal, not anonymous-traffic-facing.
- Test: existing `parseBBCIB` test suite remains green. Live smoke: upload the CITY LUBE PDF on the preview deployment, confirm 427 facilities parsed identically.

#### B2 — xlsx → exceljs swap

- `npm uninstall xlsx && npm install exceljs`.
- Identify call sites (currently `src/export/*` or inline in the facility-table component — confirm during implementation).
- Port to `exceljs`:
  ```js
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Facilities');
  sheet.columns = [...];
  sheet.addRows(rows);
  const buffer = await wb.xlsx.writeBuffer();
  // blob-download unchanged
  ```
- Bundle impact: exceljs is ~600 KB gzipped (vs xlsx's ~140 KB). The current build already code-splits xlsx into its own chunk (`dist/assets/xlsx-*.js`); the same chunking applies to exceljs so the landing-page JS budget is unaffected.
- Test: parity snapshot — generate xlsx from a fixture report using the new lib, compare cell values and sheet name against a baseline.

### Wave 3 — Capstone (1 day)

#### B6 — CSP + security headers

After B1 lands (no more CDN dependency), add a headers block to `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), usb=()" }
      ]
    }
  ]
}
```

Notes:
- `frame-ancestors 'none'` replaces legacy `X-Frame-Options: DENY`.
- `worker-src 'self' blob:` is required for PDF.js's worker (Vite emits it as a blob URL in dev and a `self`-origin URL in production).
- `style-src 'self' 'unsafe-inline'` is the documented exception — CISO summary explains this.
- `connect-src 'self'` permits the crash-log POST and login POST; no external fetches.
- Test: integration — fetch `/` on a Vercel preview deployment, assert every header is present with the expected value. Manual: open the app, exercise every flow (upload, export, print, crash-trigger) and confirm zero CSP violations in DevTools console.

## Data flow

No persistent data stores change. Track B affects three flow points:

1. **On PDF upload** → `loadPdfjs.js` (new) instead of global `pdfjsLib`. Parser behavior unchanged.
2. **On print** → `stripRawText(report)` applied before `localStorage.setItem`. Print tab reads same key, receives a lighter payload.
3. **On close / new-upload / unmount** → explicit memory clear and `localStorage` key removal.

## Error handling

- **PDF.js load failure** (B1): surfaced by existing parser error path; unchanged.
- **exceljs write failure** (B2): existing `try/catch` around export persists; error toast reuses existing `S.err` banner.
- **CSP violation in production** (B6): violation is browser-logged to the console. No `report-uri` because we don't have a collector; added only if production usage reveals a violation we missed.
- **Error boundary catch** (B5): fallback UI rendered; crash-log POST silently swallows its own network errors to avoid a crash-in-crash loop.

## Testing strategy

- **Unit tests** (node test runner, existing pattern):
  - `stripRawText` — recursive removal, idempotence, doesn't mutate input.
  - `verifyPassword` — length-mismatch still returns false, no short-circuit return before compare.
  - ErrorBoundary — `getDerivedStateFromError` returns the expected next-state object (DOM-free).
  - crash-log handler — rejects non-POST, rejects oversized body, accepts valid body.
- **Integration tests**:
  - `parseBBCIB` suite unchanged (proves B1 is behavior-preserving).
  - xlsx export parity snapshot (proves B2 is behavior-preserving).
- **Live smoke on Vercel preview** before merging:
  - Upload CITY LUBE PDF → 427 facilities, reconciliation green.
  - Export xlsx → opens cleanly in Excel and Numbers.
  - Trigger error boundary via devtools throw → fallback UI renders, crash log appears in Vercel logs.
  - Reload with cleared cookie → login page (SW doesn't serve app shell).
  - Check DevTools Network: no requests to `cdnjs.cloudflare.com` or similar.
  - Check DevTools Headers on `/`: CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy all present.
  - Check `/robots.txt`: served with `Disallow: /`.
  - Trigger 5 wrong logins → 429 + Retry-After still works (regression check for Track A).

Suite target: 72 → ~85+ tests pass, no regressions. Coverage target: ≥96% on new modules (matches current baseline).

## Delivery

- **Branch:** `feat/phase3-track-b` off current `main` (HEAD `5151014`).
- **Execution:** subagent-driven. One subagent per item (8 total), each commits directly to the branch. Each subagent sees only its own task, the current state of `main`, and the relevant files for its item.
- **PR:** single PR to `main` at the end, holistic review by the controller.
- **Post-merge:**
  - Vault roadmap `CIBxRay-Production-Roadmap.md` Phase 3 section updated — each B-item marked "shipped with commit `<sha>`", B9/B10/B11 tagged "accepted risks for pilot."
  - CISO summary document (new file in vault: `CIBxRay-CISO-Summary.md`) drafted off the findings-log table, ready for bank handover.

## Exit gate

All of the following true simultaneously:

1. `npm test` green (≥85 tests, no new failures).
2. `npm run build` clean.
3. Vercel preview deployment shows:
   - No requests to `cdnjs.cloudflare.com` (or any CDN) in DevTools Network.
   - No `xlsx` in `package.json` dependencies.
   - CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` all present on every response.
   - Reload after clearing session cookie shows login page, not cached app.
   - `/robots.txt` returns `Disallow: /`.
   - Closing a report clears report state from React memory and `localStorage`.
   - Triggering a child-component error shows the error-boundary fallback and records a crash log.
4. `npm audit` reports zero HIGH or CRITICAL findings in production dependencies.
5. Roadmap Phase 3 section has a findings-log row for each of the 2026-04-19 review items with either a commit SHA or a documented deferral.

---

## Open questions

None at design time. Implementation may surface SW-source ambiguity (B8 — "is there actually a SW in the build?") and xlsx call-site count (B2 — "one export flow or several?"); both are resolved by reading the code before executing each wave.

## Dependencies between items

- **B1 before B6.** CSP `script-src 'self'` is clean only after the CDN dependency is removed.
- **B3 before B2.** `stripRawText` establishes the hygiene pattern that the xlsx export path will reuse.
- **All of Wave 1 independent** — any order works, execute serially for simplicity.
- **B11 not in scope** — Track A's in-memory rate limiter remains untouched.

## Rollback

Each item is a standalone commit on the branch. If a single item regresses during live smoke, revert that commit without affecting the others. If the PR is catastrophically wrong, `main` is untouched — rebuild the branch.
