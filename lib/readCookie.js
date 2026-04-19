/**
 * Parse a cookie value out of a Cookie header.
 * Returns null when the cookie is absent or its value cannot be
 * URI-decoded (malformed percent-encoding would otherwise throw and
 * crash the middleware, taking the access gate down for all users).
 *
 * @param {string} header
 * @param {string} name
 * @returns {string | null}
 */
export function readCookie(header, name) {
  if (!header || !name) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
