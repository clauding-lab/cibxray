import { buildSession, verifyPassword, renderLoginHtml } from '../lib/session.js';

export const config = { runtime: 'nodejs' };

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
