import { verifySession, renderLoginHtml } from './lib/session.js';
import { readCookie } from './lib/readCookie.js';

export const config = {
  matcher: '/((?!api/|robots\\.txt).*)',
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
