import { verifySession, renderLoginHtml } from './lib/session.js';

export const config = {
  matcher: '/((?!api/).*)',
  runtime: 'nodejs',
};

export default async function middleware(request) {
  const cookieHeader = request.headers.get('cookie') || '';
  const token = readCookie(cookieHeader, 'cibxray_session');
  const secret = process.env.CIBXRAY_SESSION_SECRET;

  if (token && secret && verifySession(token, secret)) {
    return new Response(null, {
      headers: { 'x-middleware-next': '1' },
    });
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
