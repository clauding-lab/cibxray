export const config = { runtime: 'nodejs' };

const MAX_BODY_BYTES = 4096;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const raw = typeof req.body === 'string'
    ? req.body
    : await readBody(req);

  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    res.status(413).send('Payload Too Large');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.status(400).send('Bad Request');
    return;
  }

  const safe = {
    message: String(parsed?.message || '').slice(0, 500),
    stack: String(parsed?.stack || '').slice(0, 2000),
    componentStack: String(parsed?.componentStack || '').slice(0, 2000),
    userAgent: String(parsed?.userAgent || '').slice(0, 300),
    timestamp: String(parsed?.timestamp || '').slice(0, 50),
  };

  console.error('[crash]', JSON.stringify(safe));
  res.status(204).end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on?.('data', (chunk) => { data += chunk; });
    req.on?.('end', () => resolve(data));
    req.on?.('error', reject);
    if (!req.on) resolve('');
  });
}
