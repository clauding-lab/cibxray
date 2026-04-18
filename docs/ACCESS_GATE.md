# CIBxRay Access Gate — Operator Notes

`cibxray.vercel.app` is gated. Unauthenticated visitors see a branded login page; the SPA bundle is never delivered until the visitor has a valid session cookie. This is a **stopgap** for the pre-pilot phase. Real per-user auth is the Phase 6 bank-SSO deliverable.

## How it works

- **Gate:** `middleware.js` at repo root runs on every request (except `/api/*`). Reads the `cibxray_session` cookie, verifies an HMAC-SHA256 signature using `CIBXRAY_SESSION_SECRET`. Invalid or missing → returns `401` with the inline login HTML.
- **Login:** `POST /api/login` (form-urlencoded `password`) constant-time compares against `CIBXRAY_ACCESS_PASSWORD` and on match issues a 48-hour HttpOnly cookie.
- **Logout:** `GET /api/logout` clears the cookie.
- **Sign-out link** is the power icon (⏻) in the app header.

## Required environment variables

Both set in the Vercel dashboard as **Sensitive**, on Production and Preview:

| Name | Purpose |
|---|---|
| `CIBXRAY_ACCESS_PASSWORD` | The shared access code. Share verbally with colleagues, never commit. |
| `CIBXRAY_SESSION_SECRET` | 32-byte random hex used for HMAC. Different value per environment is fine. |

If either is missing at runtime, the login page will show "Service misconfigured." and the Vercel function logs will name which variable is unset.

## Rotating the password

```bash
cd ~/Projects/cibxray
vercel env rm CIBXRAY_ACCESS_PASSWORD production --yes
vercel env add CIBXRAY_ACCESS_PASSWORD production --value "<new-password>" --sensitive --yes
# Repeat for preview:
vercel env rm CIBXRAY_ACCESS_PASSWORD preview --yes
vercel env add CIBXRAY_ACCESS_PASSWORD preview "" --value "<new-password>" --sensitive --yes
```

Then redeploy by pushing any commit (or via the Vercel dashboard). Existing sessions stay valid until the cookie expires.

## Invalidating all sessions immediately

Rotate `CIBXRAY_SESSION_SECRET`. Every cookie signed with the old secret will fail validation on the next request. Same procedure as above but for `CIBXRAY_SESSION_SECRET`.

## Verification commands

After any change to env vars or code, run this on production:

```bash
URL=https://cibxray.vercel.app
rm -f /tmp/jar
curl -s -c /tmp/jar -o /dev/null -w "unauth=%{http_code}\n" "$URL/"                                           # 401
curl -s -b /tmp/jar -X POST -d "password=wrong" -o /dev/null -w "bad=%{http_code}\n" "$URL/api/login"         # 401
curl -s -b /tmp/jar -c /tmp/jar -X POST -d 'password=<REAL>' -o /dev/null -w "good=%{http_code}\n" "$URL/api/login"  # 302
curl -s -b /tmp/jar -o /dev/null -w "authed=%{http_code}\n" "$URL/"                                           # 200
```

## Scope limits (explicit non-goals, deferred to Phase 6)

- No per-user accounts
- No audit log of who entered when
- No rate limiting / brute-force lockout
- No password reset flow
- No 2FA

Sharing the access code widely or with untrusted colleagues defeats the threat model. Rotate if you suspect leakage.

## References

- Design spec: `docs/superpowers/specs/2026-04-18-access-gate-design.md`
- Implementation plan: `docs/superpowers/plans/2026-04-18-access-gate.md`
