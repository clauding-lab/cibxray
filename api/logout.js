export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', 'cibxray_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', '/');
  res.status(302).end();
}
