export const config = { runtime: 'nodejs' };

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
