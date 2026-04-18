import { METHODOLOGY_VERSION } from '../constants/methodology.js';

const APP_BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeStamp(arrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return {
    analyzedAt: new Date().toISOString(),
    methodologyVersion: METHODOLOGY_VERSION,
    appBuild: APP_BUILD,
    pdfFingerprint: toHex(hash).slice(0, 16),
  };
}
