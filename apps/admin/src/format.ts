import { kigaliDayKey, kigaliTime } from '@tmh/shared';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kigali',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const yearFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Kigali',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `Today 07:30`, `Tomorrow 17:45` or `Wed 8 Oct, 07:30` — always in Kigali time. */
export function formatDateTime(iso: string): string {
  const day = kigaliDayKey(iso);
  const now = Date.now();
  const time = kigaliTime(iso);
  if (day === kigaliDayKey(now)) return `Today ${time}`;
  if (day === kigaliDayKey(now + 86_400_000)) return `Tomorrow ${time}`;
  if (day === kigaliDayKey(now - 86_400_000)) return `Yesterday ${time}`;
  return `${dateFmt.format(new Date(iso))}, ${time}`;
}

/** `8 Oct 2026` in Kigali time. */
export function formatDate(iso: string): string {
  return yearFmt.format(new Date(iso));
}

/** `3 min ago`, `2 h ago`, falling back to the date. */
export function formatAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)} h ago`;
  return formatDateTime(iso);
}

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

/** `in_progress` → `In progress`. */
export function humanize(value: string): string {
  const s = value.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

/** `1 trip`, `3 trips`. */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
