# Access Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the public `cibxray.vercel.app` URL behind a branded login page so the Vite SPA bundle is never delivered to unauthenticated visitors.

**Architecture:** Vercel Middleware at repo root checks an HMAC-signed session cookie on every request. Missing or invalid cookie returns an inline branded HTML login page (zero-JS). `POST /api/login` validates the password against an env var, sets an HttpOnly cookie, redirects to `/`. 48-hour session. Spec: `docs/superpowers/specs/2026-04-18-access-gate-design.md`.

**Tech Stack:** Node.js Vercel Functions + Routing Middleware, Node built-in `crypto` for HMAC-SHA256, Node built-in test runner (`node --test`), existing Vite/React/Tailwind for the one header change.

---

## File inventory

| File | Change |
|---|---|
| `lib/session.js` | NEW — HMAC sign/verify, password verify, login HTML renderer |
| `lib/session.test.js` | NEW — unit tests |
| `api/login.js` | NEW — password handler |
| `api/logout.js` | NEW — cookie clear |
| `middleware.js` | NEW — HTTP gate |
| `src/App.jsx` | MODIFIED — add Sign out link (near reset button, line ~176) |
| `package.json` | MODIFIED — add `test` script |
| `PRODUCTION_ROADMAP.md` | MODIFIED — note the gate |

No `vercel.json` is needed: Vite framework preset + default Node runtime on functions is sufficient. If a runtime pin becomes necessary later, that's a follow-up.

---

## Task 1: Add test script + verify Node test runner

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the `test` script**

Read `package.json`, locate the `"scripts"` block, add `"test"` so it reads:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "lint": "eslint .",
  "preview": "vite preview",
  "test": "node --test --experimental-test-coverage lib"
}
```

- [ ] **Step 2: Smoke-test the runner**

Create a temporary file `lib/_smoke.test.js` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('sanity', () => {
  assert.equal(1 + 1, 2);
});
```

Run: `cd ~/Projects/cibxray && npm test`
Expected: PASS (1 test passed).

Delete the smoke file afterwards: `rm lib/_smoke.test.js`.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test script using node built-in test runner"
```

---

## Task 2: `lib/session.js` — HMAC build + verify (TDD)

**Files:**
- Create: `lib/session.js`
- Create: `lib/session.test.js`

- [ ] **Step 1: Write the failing test for build/verify round-trip**

Create `lib/session.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSession, verifySession } from './session.js';

const SECRET = 'test-secret-do-not-use-in-prod';

test('buildSession + verifySession round-trip succeeds', () => {
  const token = buildSession(SECRET);
  assert.equal(verifySession(token, SECRET), true);
});
```

- [ ] **Step 2: Run test — must fail**

Run: `npm test`
Expected: FAIL — module `./session.js` not found.

- [ ] **Step 3: Implement `lib/session.js` minimal version**

Create `lib/session.js`:

```js
import crypto from 'node:crypto';

const SESSION_TTL_SECONDS = 48 * 3600;

function b64urlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function b64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

export function buildSession(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + SESSION_TTL_SECONDS };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const signature = sign(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

export function verifySession(token, secret) {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, signature] = parts;

  const expected = sign(payloadB64, secret);
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const payload = JSON.parse(b64urlDecode(payloadB64));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < now) return false;
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test — must pass**

Run: `npm test`
Expected: PASS (1 test passed).

- [ ] **Step 5: Add tamper rejection tests**

Append to `lib/session.test.js`:

```js
test('verifySession rejects tampered payload', () => {
  const token = buildSession(SECRET);
  const [, sig] = token.split('.');
  const tamperedPayload = Buffer.from(JSON.stringify({ iat: 0, exp: 9999999999 }), 'utf8').toString('base64url');
  const forged = `${tamperedPayload}.${sig}`;
  assert.equal(verifySession(forged, SECRET), false);
});

test('verifySession rejects tampered signature', () => {
  const token = buildSession(SECRET);
  const [payload] = token.split('.');
  const forged = `${payload}.${'a'.repeat(43)}`;
  assert.equal(verifySession(forged, SECRET), false);
});

test('verifySession rejects wrong secret', () => {
  const token = buildSession(SECRET);
  assert.equal(verifySession(token, 'different-secret'), false);
});

test('verifySession rejects missing token', () => {
  assert.equal(verifySession(null, SECRET), false);
  assert.equal(verifySession('', SECRET), false);
  assert.equal(verifySession('not-two-parts', SECRET), false);
});
```

- [ ] **Step 6: Run tests — all pass**

Run: `npm test`
Expected: PASS (5 tests passed).

- [ ] **Step 7: Add expiry test**

Add `import crypto from 'node:crypto';` to the top of `lib/session.test.js` alongside the existing imports. Then append this test:

```js
test('verifySession rejects expired token', () => {
  const pastPayload = { iat: 0, exp: 1 };
  const payloadB64 = Buffer.from(JSON.stringify(pastPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
  const expired = `${payloadB64}.${sig}`;
  assert.equal(verifySession(expired, SECRET), false);
});
```

- [ ] **Step 8: Run tests — all pass**

Run: `npm test`
Expected: PASS (6 tests passed).

- [ ] **Step 9: Commit**

```bash
git add lib/session.js lib/session.test.js
git commit -m "feat(auth): HMAC session token build + verify with expiry"
```

---

## Task 3: `lib/session.js` — password verify (TDD)

**Files:**
- Modify: `lib/session.js`
- Modify: `lib/session.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib/session.test.js`:

```js
import { verifyPassword } from './session.js';

test('verifyPassword accepts matching password', () => {
  assert.equal(verifyPassword('hunter2', 'hunter2'), true);
});

test('verifyPassword rejects wrong password', () => {
  assert.equal(verifyPassword('hunter2', 'hunter3'), false);
});

test('verifyPassword rejects different lengths without crash', () => {
  assert.equal(verifyPassword('short', 'muchlongerstring'), false);
});

test('verifyPassword rejects empty inputs', () => {
  assert.equal(verifyPassword('', 'something'), false);
  assert.equal(verifyPassword('something', ''), false);
  assert.equal(verifyPassword('', ''), false);
});
```

- [ ] **Step 2: Run test — must fail**

Run: `npm test`
Expected: FAIL — `verifyPassword` is not exported.

- [ ] **Step 3: Implement `verifyPassword`**

Append to `lib/session.js`:

```js
export function verifyPassword(input, expected) {
  if (!input || !expected) return false;
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test`
Expected: PASS (10 tests passed).

- [ ] **Step 5: Commit**

```bash
git add lib/session.js lib/session.test.js
git commit -m "feat(auth): constant-time password verification"
```

---

## Task 4: `lib/session.js` — login HTML renderer

**Files:**
- Modify: `lib/session.js`
- Modify: `lib/session.test.js`

- [ ] **Step 1: Write the failing test**

Append to `lib/session.test.js`:

```js
import { renderLoginHtml } from './session.js';

test('renderLoginHtml returns a complete HTML document', () => {
  const html = renderLoginHtml();
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('<form method="POST" action="/api/login"'));
  assert.ok(html.includes('CIBxRay'));
  assert.ok(!html.includes('<script'));
});

test('renderLoginHtml renders error banner when message provided', () => {
  const html = renderLoginHtml('Incorrect access code.');
  assert.ok(html.includes('Incorrect access code.'));
  assert.ok(html.includes('role="alert"'));
});

test('renderLoginHtml escapes HTML in error message', () => {
  const html = renderLoginHtml('<script>alert(1)</script>');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
```

- [ ] **Step 2: Run tests — must fail**

Run: `npm test`
Expected: FAIL — `renderLoginHtml` not exported.

- [ ] **Step 3: Implement `renderLoginHtml`**

Append to `lib/session.js`:

```js
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderLoginHtml(errorMessage = null) {
  const errorHtml = errorMessage
    ? `<p class="error" role="alert">${escapeHtml(errorMessage)}</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CIBxRay \u00B7 Restricted access</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;padding:1.5rem}
.card{width:100%;max-width:24rem;background:#1e293b;border:1px solid #334155;border-radius:0.75rem;padding:2rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)}
h1{margin:0 0 0.25rem;font-size:1.375rem;font-weight:600;letter-spacing:-0.01em}
.tagline{margin:0 0 1.75rem;font-size:0.8125rem;color:#94a3b8}
label{display:block;font-size:0.8125rem;font-weight:500;margin-bottom:0.5rem;color:#cbd5e1}
input[type=password]{width:100%;padding:0.625rem 0.75rem;font-size:0.9375rem;background:#0f172a;color:#e2e8f0;border:1px solid #475569;border-radius:0.5rem;outline:none}
input[type=password]:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.25)}
button{margin-top:1rem;width:100%;padding:0.625rem;font-size:0.9375rem;font-weight:500;background:#1e3a8a;color:#f8fafc;border:1px solid #1e40af;border-radius:0.5rem;cursor:pointer;transition:background 150ms ease}
button:hover{background:#1e40af}
.error{margin:1rem 0 0;padding:0.625rem 0.75rem;background:#450a0a;border:1px solid #7f1d1d;border-radius:0.5rem;color:#fecaca;font-size:0.8125rem}
.footer{margin-top:1.5rem;font-size:0.75rem;color:#64748b;text-align:center}
</style>
</head>
<body>
<main class="card" role="main">
<h1>CIBxRay</h1>
<p class="tagline">Credit Information Bureau report analyser \u00B7 restricted access</p>
<form method="POST" action="/api/login" autocomplete="off">
<label for="password">Access code</label>
<input id="password" type="password" name="password" autofocus required>
<button type="submit">Enter</button>
${errorHtml}
</form>
<p class="footer">Authorised personnel only.</p>
</main>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test`
Expected: PASS (13 tests passed).

- [ ] **Step 5: Commit**

```bash
git add lib/session.js lib/session.test.js
git commit -m "feat(auth): inline branded login HTML renderer"
```

---

## Task 5: `api/login.js` — password POST handler

**Files:**
- Create: `api/login.js`

- [ ] **Step 1: Implement the handler**

Create `api/login.js`:

```js
import { buildSession, verifyPassword, renderLoginHtml } from '../lib/session.js';

const COOKIE_MAX_AGE_SECONDS = 48 * 3600;

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    return new Response('Bad Request', { status: 400 });
  }

  const body = await request.text();
  const params = new URLSearchParams(body);
  const password = params.get('password');

  if (!password) {
    return htmlResponse(renderLoginHtml('Enter the access code.'), 400);
  }

  const expectedPassword = process.env.CIBXRAY_ACCESS_PASSWORD;
  const secret = process.env.CIBXRAY_SESSION_SECRET;

  if (!expectedPassword || !secret) {
    const missing = !expectedPassword ? 'CIBXRAY_ACCESS_PASSWORD' : 'CIBXRAY_SESSION_SECRET';
    console.error(`[cibxray] Auth disabled: missing env var ${missing}`);
    return htmlResponse(renderLoginHtml('Service misconfigured. Contact administrator.'), 500);
  }

  if (!verifyPassword(password, expectedPassword)) {
    return htmlResponse(renderLoginHtml('Incorrect access code.'), 401);
  }

  const token = buildSession(secret);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': `cibxray_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
      'Cache-Control': 'no-store',
    },
  });
}

function htmlResponse(html, status) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/login.js
git commit -m "feat(auth): POST /api/login handler with HMAC cookie"
```

---

## Task 6: `api/logout.js` — cookie clear

**Files:**
- Create: `api/logout.js`

- [ ] **Step 1: Implement the handler**

Create `api/logout.js`:

```js
export default async function handler(request) {
  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'cibxray_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/logout.js
git commit -m "feat(auth): GET /api/logout clears session cookie"
```

---

## Task 7: `middleware.js` — HTTP gate

**Files:**
- Create: `middleware.js`

- [ ] **Step 1: Implement the middleware**

Create `middleware.js` at repo root:

```js
import { verifySession, renderLoginHtml } from './lib/session.js';

export const config = {
  matcher: '/((?!api/).*)',
};

export default async function middleware(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = readCookie(cookieHeader, 'cibxray_session');
  const secret = process.env.CIBXRAY_SESSION_SECRET;

  if (token && secret && verifySession(token, secret)) {
    return;
  }

  return new Response(renderLoginHtml(), {
    status: 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function readCookie(header, name) {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.js
git commit -m "feat(auth): Vercel middleware gates SPA bundle"
```

---

## Task 8: Add Sign out link to header

**Files:**
- Modify: `src/App.jsx:176-177`

- [ ] **Step 1: Insert the Sign out link**

In `src/App.jsx`, locate the header button row (reset button at line 176, followed by the report-count span at line 177). Insert a new anchor before the `<span>` so the new element is the last button in the cluster:

Find this exact snippet (lines 176-177):

```jsx
          <button onClick={() => { setReports([]); setFileLog([]); setView("upload"); setActiveId(null); setTab("summary"); counter.current = 0; }} title="Reset — Clear all reports" style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{"\u21BB"}</button>
          <span style={{ fontSize: 11, color: "#7dd3fc" }}>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
```

Replace with:

```jsx
          <button onClick={() => { setReports([]); setFileLog([]); setView("upload"); setActiveId(null); setTab("summary"); counter.current = 0; }} title="Reset — Clear all reports" style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{"\u21BB"}</button>
          <span style={{ fontSize: 11, color: "#7dd3fc" }}>{reports.length} report{reports.length !== 1 ? "s" : ""}</span>
          <a href="/api/logout" title="Sign out" style={{ background: "rgba(14,165,233,0.15)", border: "1px solid rgba(56,189,248,0.3)", color: "#7dd3fc", width: 28, height: 28, borderRadius: "50%", textDecoration: "none", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{"\u23FB"}</a>
```

The Unicode character `\u23FB` is the IEC power symbol (⏻), which reads as "sign out" in the header's icon language.

- [ ] **Step 2: Verify build still passes**

Run: `npm run build`
Expected: `dist/` built with no TypeScript/build errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(auth): add Sign out link to header"
```

---

## Task 9: Set Vercel env vars

**Files:** none (dashboard-only action)

- [ ] **Step 1: Generate the signing secret**

```bash
openssl rand -hex 32
```

Copy the 64-character hex string.

- [ ] **Step 2: Pick the access code**

Something memorable enough to share verbally, strong enough to resist casual guessing (e.g. `cibxray-pilot-<4 random words>` or similar). Record it privately; it will not be in the repo.

- [ ] **Step 3: Add both to Vercel (Production + Preview environments)**

Dashboard path: https://vercel.com/clauding-labs-projects/cibxray/settings/environment-variables

- Name: `CIBXRAY_ACCESS_PASSWORD`
  - Value: the access code from Step 2
  - Environments: Production, Preview
  - Mark as **Sensitive**
- Name: `CIBXRAY_SESSION_SECRET`
  - Value: the 64-char hex from Step 1
  - Environments: Production, Preview
  - Mark as **Sensitive**

- [ ] **Step 4: Record the password location**

Save the access code in a private password manager (1Password/Bitwarden/etc.), not in the repo or the vault. Note the secret location in `PRODUCTION_ROADMAP.md` (Task 11).

---

## Task 10: Deploy and curl-verify on live URL

**Files:** none (deployment verification)

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

Watch Vercel for the deployment to reach READY on https://vercel.com/clauding-labs-projects/cibxray/deployments.

- [ ] **Step 2: Verify unauthenticated root returns 401**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://cibxray.vercel.app/
```

Expected: `401`

- [ ] **Step 3: Verify login HTML contents**

```bash
curl -s https://cibxray.vercel.app/ | head -20
```

Expected: HTML starting with `<!doctype html>`, title "CIBxRay · Restricted access", form action `/api/login`. No references to `index-*.js` bundle.

- [ ] **Step 4: Verify wrong password returns 401 and no cookie**

```bash
curl -s -i -X POST https://cibxray.vercel.app/api/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=definitely-wrong" | head -20
```

Expected: `HTTP/2 401`. No `Set-Cookie` header. Body contains "Incorrect access code."

- [ ] **Step 5: Verify correct password sets cookie**

```bash
curl -s -i -X POST https://cibxray.vercel.app/api/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "password=$REAL" -c /tmp/cibxray-jar | head -20
```

Replace `$REAL` with the real access code. Expected: `HTTP/2 302`, `Location: /`, `Set-Cookie: cibxray_session=...; HttpOnly; Secure; SameSite=Strict; Max-Age=172800`.

- [ ] **Step 6: Verify authenticated request gets the bundle**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -b /tmp/cibxray-jar https://cibxray.vercel.app/
curl -s -b /tmp/cibxray-jar https://cibxray.vercel.app/ | grep -o 'index-[^"]*\.js' | head -1
```

Expected: first command → `200`. Second command → the bundle filename (e.g. `index-BmwC-PlM.js`).

- [ ] **Step 7: Manual browser check**

Open https://cibxray.vercel.app/ in a fresh browser tab:
- Branded login card appears.
- Correct password → app loads.
- Devtools → Application → Cookies: `cibxray_session` has `HttpOnly ✓`, `Secure ✓`, `SameSite=Strict`.
- Click Sign out icon in header → redirected to login page; cookie cleared.

- [ ] **Step 8: Clean up test artefact**

```bash
rm -f /tmp/cibxray-jar
```

---

## Task 11: Document the gate in `PRODUCTION_ROADMAP.md`

**Files:**
- Modify: `PRODUCTION_ROADMAP.md`

- [ ] **Step 1: Add a short "Access Gate" note**

Add a new subsection (location: near the top of the roadmap, after the intro and before Phase 1) with this exact content:

```markdown
## Access gate (stopgap)

`cibxray.vercel.app` is gated by a shared access code and HMAC session cookie. Unauthenticated visitors see a branded login page; the SPA bundle is never delivered until authentication succeeds.

- Configuration: two Vercel env vars (`CIBXRAY_ACCESS_PASSWORD`, `CIBXRAY_SESSION_SECRET`), both marked Sensitive.
- Session: 48-hour HttpOnly cookie. Rotating `CIBXRAY_SESSION_SECRET` invalidates all sessions immediately.
- Password storage: shared access code lives only in the owner's password manager and in Vercel env vars. **Not** in the repo or in the vault.
- Scope: single shared code, no per-user accounts, no audit log, no rate limiting. This is the stopgap described here; real per-user identity is the Phase 6 bank-SSO deliverable.
- Design spec: `docs/superpowers/specs/2026-04-18-access-gate-design.md`.
- Implementation plan: `docs/superpowers/plans/2026-04-18-access-gate.md`.
```

- [ ] **Step 2: Commit**

```bash
git add PRODUCTION_ROADMAP.md
git commit -m "docs: note access gate in production roadmap"
```

---

## Task 12: Push the documentation commits

**Files:** none

- [ ] **Step 1: Push**

```bash
git push origin main
```

Expected: Vercel auto-deploys; live gate still works (docs-only change).

---

## Out of scope (explicit non-goals)

- Per-user accounts, password reset, 2FA, audit log — deferred to Phase 6 bank-SSO deliverable.
- Rate limiting / brute-force lockout — accepted risk for v1; flagged in the spec.
- A `vercel.json` runtime pin — not needed at time of plan writing; add only if a runtime mismatch surfaces.
- Rewriting the spec commit message if the Xcode license is not yet accepted — sort that before starting Task 1.
