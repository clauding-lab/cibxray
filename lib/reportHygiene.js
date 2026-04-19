export const PRINT_PAYLOAD_KEY = 'cibxray.printPayload';

export function stripRawText(input) {
  if (Array.isArray(input)) {
    return input.map(stripRawText);
  }
  if (input && typeof input === 'object') {
    const copy = { ...input };
    if (Array.isArray(copy.facilities)) {
      copy.facilities = copy.facilities.map((f) => {
        const { rawText, ...rest } = f;
        return rest;
      });
    }
    return copy;
  }
  return input;
}

export function clearPrintPayload(storage) {
  if (!storage || typeof storage.removeItem !== 'function') return;
  storage.removeItem(PRINT_PAYLOAD_KEY);
}
