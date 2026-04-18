# CIBxRay Access Gate — Design

**Date:** 2026-04-18
**Status:** Draft · pending user approval
**Author:** session with Claude
**Context:** Stopgap access control for the `cibxray.vercel.app` public URL, covering the period until bank-internal SSO deployment (Phase 6 of `PRODUCTION_ROADMAP.md`).

---

## Problem

CIBxRay is currently publicly reachable at `https://cibxray.vercel.app`. It is an unofficial pre-pilot deployment used by the owner and a small number of banker colleagues. Anyone with the URL can load the tool, which is inappropriate even for a pre-pilot — the app is associated with regulated CIB data and the URL will circulate among colleagues by Slack/WhatsApp/email.

We need to prevent non-authorised visitors from reaching the app, without building the full per-user auth + audit system that Phase 6 will need.

## Non-goals

- Per-user accounts, password reset, 2FA, audit log — deferred to Phase 6 (bank SSO).
- Fine-grained role-based access — not needed for a single-tenant pre-pilot.
- Rate limiting / brute-force lockout — acknowledged gap, deferred.
- In-app session management beyond "logged in / not logged in."

## Approach

A server-side HTTP gate in front of the SPA bundle. The Vite-built bundle is never delivered to unauthenticated visitors; instead, Vercel Middleware returns a branded inline HTML login page. A small Vercel Function validates the password and sets an HMAC-signed session cookie.

### Why not Vercel Deployment Protection (Password Protection)

Considered and rejected. It works, is one dashboard toggle, and requires zero code. Rejected because the user wants the first impression to be a branded CIBxRay login page, not a generic Vercel-hosted form, for credibility with banker colleagues being shown the tool.

### Why not a client-side React login gate

Rejected. The entire SPA bundle ships regardless of authentication, meaning the code is world-readable. The gate is bypassable in 10 seconds with devtools. Unacceptable for even a pre-pilot banking tool.

## Architecture

```
┌─────────────┐      ┌──────────────────────┐      ┌──────────────┐
│  Browser    │─────▶│  Vercel Middleware   │─────▶│  SPA Bundle  │
│             │      │  (cookie check)      │      │  (Vite dist) │
└─────────────┘      └──────────────────────┘      └──────────────┘
                              │ no cookie
                              ▼
                     ┌──────────────────────┐
                     │  Branded Login HTML  │
                     │  (inline, no JS)     │
                     └──────────────────────┘
                              │ POST /api/login
                              ▼
                     ┌──────────────────────┐
                     │  api/login.js        │
                     │  - constant-time cmp │
                     │  - set HMAC cookie   │
                     │  - 302 to /          │
                     └──────────────────────┘
```

**Invariant:** the Vite-built SPA bundle is never served to a request that does not carry a valid session cookie.

## Components

### 1. `middleware.js` (repo root, Node runtime)

- Runs on every request.
- Skips the gate for: `/api/login`, `/api/logout`, requests already carrying a valid signed cookie.
- On missing or invalid cookie (not the skip paths above): returns the inline login HTML with status `401` and `Cache-Control: no-store`.
- Cookie validation: reads `cibxray_session`, splits `value.signature`, recomputes HMAC-SHA256 over `value` with `CIBXRAY_SESSION_SECRET`, constant-time compares. Parses `value` as `{ iat: number, exp: number }` (JSON, base64url). Rejects if `exp < now`.

### 2. `api/login.js` (Vercel Function, Node runtime)

- Accepts `POST` with `application/x-www-form-urlencoded` body containing `password`.
- Reads `password` from the form body.
- Constant-time compares against `CIBXRAY_ACCESS_PASSWORD` env var.
- On success:
  - Builds `payload = { iat: nowSeconds, exp: nowSeconds + 48*3600 }`.
  - Encodes `payload` as base64url JSON.
  - Signs with HMAC-SHA256 using `CIBXRAY_SESSION_SECRET`.
  - Sets `Set-Cookie: cibxray_session=<payload>.<signature>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=172800`.
  - Responds `302 Location: /`.
- On failure: responds with the login HTML (same page as middleware serves) with a visible error banner, status `401`, no cookie set.
- Non-POST or missing `password`: `400`.

### 3. `api/logout.js` (Vercel Function, Node runtime)

- Any method. Clears the cookie by setting it with `Max-Age=0`. `302 Location: /`.
- Linked from a small "Sign out" link in the app header.

### 4. Login page (inline HTML)

Served by both the middleware (when unauthenticated) and `api/login.js` (on failed attempt). Must be zero-JS, single self-contained HTML document. Content:

- `<title>CIBxRay · Restricted access</title>`
- CIBxRay name and one-line tagline: *Credit Information Bureau report analyser · restricted access*.
- `<form method="POST" action="/api/login">` with a single `<input type="password" name="password" autofocus required>` and a submit button.
- Error region rendered when an error message is provided (failed login).
- Inline CSS using a muted, professional palette: slate-900 background, near-white text, accent navy for the button. No gradients, no startup aesthetic. Centered card layout. System font stack.
- No analytics, no fonts loaded from a CDN, no images from a CDN. Fully self-contained to preserve the zero-egress compliance stance.

### 5. Environment variables (Vercel project settings)

- `CIBXRAY_ACCESS_PASSWORD` — the shared access code. Set in Production and Preview.
- `CIBXRAY_SESSION_SECRET` — 32 bytes of random hex, used for HMAC-SHA256. Set in Production and Preview. Different value per environment is acceptable.

Both marked as **Sensitive** in Vercel.

### 6. In-app logout link

Small change to the SPA: header gets a "Sign out" link that performs `GET /api/logout`. Minimal styling consistent with existing header.

## Data flow

### Unauthenticated visit

1. `GET /` → middleware reads cookie → missing → returns login HTML + `401`.
2. User types password → browser posts `application/x-www-form-urlencoded` to `/api/login`.
3. `api/login.js` validates → sets cookie → `302 /`.
4. `GET /` → middleware validates cookie → passes through → Vercel serves `dist/index.html` + bundle.

### Authenticated visit within 48-hour window

1. `GET /` → middleware validates cookie → passes through → bundle served.

### Expired cookie

1. `GET /` → middleware reads cookie → `exp < now` → returns login HTML + `401`. Same as unauthenticated.

### Logout

1. User clicks Sign out → `GET /api/logout` → clears cookie → `302 /`.
2. `GET /` → middleware → no valid cookie → login HTML.

## Security analysis

| Concern | Mitigation |
|---|---|
| Password timing side channel | Constant-time compare (`crypto.timingSafeEqual` on equal-length buffers). |
| Cookie forgery | HMAC-SHA256 over payload with server-side secret. No raw password or user data in cookie. |
| XSS stealing session | `HttpOnly` flag → JS cannot read. |
| Insecure transport | `Secure` flag → cookie not sent over HTTP. |
| CSRF on login | `SameSite=Strict`. Login is unauth-only so CSRF to `/api/login` has no authenticated context to abuse. |
| Bundle source leakage | Bundle never delivered without valid cookie. |
| Secret in repo | Secrets only in Vercel env vars. `.gitignore` already covers `.vercel/`. |
| Brute force | **Accepted risk for v1.** Single shared password, small known audience. Flag for follow-up. |
| Replay of stolen cookie | Cookie valid 48 hours; rotating the `CIBXRAY_SESSION_SECRET` invalidates all sessions. |
| Missing env vars in production | Middleware and `api/login.js` fail closed: if either `CIBXRAY_ACCESS_PASSWORD` or `CIBXRAY_SESSION_SECRET` is unset, login is impossible and the app is unreachable. A startup log line names the missing variable for the operator. |

## Testing

### Unit tests (Node test runner, colocated with middleware)

- HMAC sign/verify round-trip produces the same output.
- Verify rejects tampered payload.
- Verify rejects tampered signature.
- Verify rejects expired payload.
- Constant-time compare returns false on mismatch of same-length inputs.

### E2E (curl, scripted)

```bash
# 1. Unauthenticated root returns 401
curl -s -o /dev/null -w "%{http_code}" https://cibxray.vercel.app/
# → 401

# 2. Bad password returns 401, no cookie
curl -s -i -X POST https://cibxray.vercel.app/api/login \
  -d "password=wrong" | grep -E "HTTP|Set-Cookie"
# → HTTP 401, no Set-Cookie

# 3. Good password returns 302 + cookie
curl -s -i -X POST https://cibxray.vercel.app/api/login \
  -d "password=$REAL" -c /tmp/jar | grep -E "HTTP|Set-Cookie"
# → HTTP 302, Set-Cookie: cibxray_session=...

# 4. Request with cookie gets the bundle
curl -s -o /dev/null -w "%{http_code}" -b /tmp/jar https://cibxray.vercel.app/
# → 200
```

### Manual checks

- Two browsers: logged-in session persists across refresh.
- Devtools → Application → Cookies: `cibxray_session` shows `HttpOnly` ✓, `Secure` ✓, `SameSite=Strict` ✓.
- Logout link clears cookie and returns to login page.
- View source of the login page returns only the login HTML — no SPA bundle references.

## File inventory

| File | Status | Purpose |
|---|---|---|
| `middleware.js` | NEW | Cookie gate. |
| `api/login.js` | NEW | Password handler. |
| `api/logout.js` | NEW | Cookie clear. |
| `lib/session.js` | NEW | Shared HMAC sign/verify + login HTML renderer. |
| `lib/session.test.js` | NEW | Unit tests for the above. |
| `src/App.jsx` | MODIFIED | Add "Sign out" link to header. |
| `vercel.json` | NOT NEEDED v1 | Vite framework preset + default Node runtime is sufficient. Cache-Control is set inline in the function responses. Add only if a runtime mismatch surfaces later. |
| `PRODUCTION_ROADMAP.md` | MODIFIED | Note the gate and link to this spec. |
| Vercel env vars | NEW | `CIBXRAY_ACCESS_PASSWORD`, `CIBXRAY_SESSION_SECRET`. |

## Rollout

1. Generate `CIBXRAY_SESSION_SECRET` locally with `openssl rand -hex 32`.
2. Pick `CIBXRAY_ACCESS_PASSWORD` — something memorable enough to share verbally, strong enough to resist casual guessing.
3. Set both in Vercel (Production + Preview) as Sensitive env vars.
4. Merge PR → auto-deploy.
5. Run the curl script against the deployed URL.
6. Open in two browsers, confirm branded page, log in, confirm app loads.
7. Share password with colleagues via a channel separate from the URL.

## Open questions

None. All blockers resolved in brainstorming.

## References

- Session: `~/.claude/session-data/2026-04-15-cibxray-phase0-vercel-session.tmp`
- Roadmap: `~/Projects/cibxray/PRODUCTION_ROADMAP.md`
- Vercel Middleware docs: https://vercel.com/docs/routing-middleware
- Vercel Functions docs: https://vercel.com/docs/functions
