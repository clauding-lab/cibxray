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

export function verifyPassword(input, expected) {
  if (!input || !expected) return false;
  const a = Buffer.from(input, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

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
<title>CIBxRay - Restricted Access</title>
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;padding:1.5rem}
.card{width:100%;max-width:24rem;background:#1e293b;border:1px solid #334155;border-radius:0.75rem;padding:2rem;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5)}
h1{margin:0 0 0.35rem;font-size:1.75rem;font-weight:800;letter-spacing:-0.02em;line-height:1}
h1 .brand-cib{color:#e0f2fe}
h1 .brand-x{color:#0ea5e9;text-shadow:0 0 12px rgba(14,165,233,0.6)}
h1 .brand-ray{color:#38bdf8}
.eyebrow{margin:0 0 1.25rem;font-size:0.625rem;color:#7dd3fc;letter-spacing:0.15em;font-weight:500;text-transform:uppercase}
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
<h1><span class="brand-cib">CIB</span><span class="brand-x">x</span><span class="brand-ray">Ray</span></h1>
<p class="eyebrow">Credit Bureau Intelligence</p>
<p class="tagline">Credit Information Bureau Report Analyzer - Restricted Access</p>
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
