import { buildSession, verifyPassword, renderLoginHtml } from '../lib/session.js';

export const config = { runtime: 'nodejs' };

const COOKIE_MAX_AGE_SECONDS = 48 * 3600;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    res.status(400).send('Bad Request');
    return;
  }

  const body = typeof req.body === 'string' ? req.body : await readBody(req);
  const params = new URLSearchParams(body);
  const password = params.get('password');

  if (!password) {
    return sendHtml(res, 400, renderLoginHtml('Enter the access code.'));
  }

  const expectedPassword = process.env.CIBXRAY_ACCESS_PASSWORD;
  const secret = process.env.CIBXRAY_SESSION_SECRET;

  if (!expectedPassword || !secret) {
    const missing = !expectedPassword ? 'CIBXRAY_ACCESS_PASSWORD' : 'CIBXRAY_SESSION_SECRET';
    console.error(`[cibxray] Auth disabled: missing env var ${missing}`);
    return sendHtml(res, 500, renderLoginHtml('Service misconfigured. Contact administrator.'));
  }

  if (!verifyPassword(password, expectedPassword)) {
    return sendHtml(res, 401, renderLoginHtml('Incorrect access code.'));
  }

  const token = buildSession(secret);
  res.setHeader('Set-Cookie', `cibxray_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', '/');
  res.status(302).end();
}

function sendHtml(res, status, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(html);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
