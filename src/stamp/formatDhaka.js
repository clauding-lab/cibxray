const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Dhaka',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatDhakaTimestamp(isoString) {
  const parts = FORMATTER.formatToParts(new Date(isoString));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')} ${get('hour')}:${get('minute')}`;
}
