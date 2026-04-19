/**
 * Pure in-memory rate limiter. Tracks failure counts per key inside a
 * caller-owned Map. Split into check (read-only) + record (mutating) so
 * successful logins do not consume the budget.
 *
 * Per-serverless-instance only: Vercel may spawn multiple instances and
 * the limit is not shared across them. Acceptable for the pilot; replaced
 * by a KV-backed limiter in Phase 3 Track B (item B11).
 */

/**
 * @typedef {{ count: number, resetAt: number }} Entry
 * @typedef {Map<string, Entry>} Store
 */

/**
 * Check whether a key is currently over the failure limit.
 *
 * @param {Store} store
 * @param {string} key
 * @param {number} now epoch ms
 * @param {number} limit
 * @returns {{ limited: boolean, retryAfterMs: number }}
 */
export function isRateLimited(store, key, now, limit) {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    return { limited: false, retryAfterMs: 0 };
  }
  if (entry.count >= limit) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }
  return { limited: false, retryAfterMs: 0 };
}

/**
 * Record one failed attempt. Resets the window when the previous one
 * has elapsed.
 *
 * @param {Store} store
 * @param {string} key
 * @param {number} now epoch ms
 * @param {number} windowMs
 */
export function recordFailure(store, key, now, windowMs) {
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count += 1;
}

/**
 * Best-effort client IP extraction for rate-limit keying. Prefers
 * x-forwarded-for (Vercel sets this), then x-real-ip, then socket, then
 * a shared "unknown" bucket as a last resort.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  const xri = req.headers['x-real-ip'];
  if (typeof xri === 'string' && xri.length > 0) {
    return xri.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}
