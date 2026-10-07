import { kigaliDayKey, kigaliTime, type TripStop } from '@tmh/shared';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Kigali-local day label: `Today`, `Tomorrow`, or `Thu 9 Oct`. */
export function formatDay(iso: string | Date, now: Date = new Date()): string {
  const key = kigaliDayKey(iso);
  if (key === kigaliDayKey(now)) return 'Today';
  if (key === kigaliDayKey(now.getTime() + DAY_MS)) return 'Tomorrow';
  if (key === kigaliDayKey(now.getTime() - DAY_MS)) return 'Yesterday';
  const d = new Date(`${key}T00:00:00.000Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

/** Kigali-local departure label, e.g. `Tomorrow · 07:30`. */
export function formatDeparture(iso: string | Date, now: Date = new Date()): string {
  return `${formatDay(iso, now)} · ${kigaliTime(iso)}`;
}

/** Short relative time for feeds: `just now`, `5 min ago`, `3 h ago`, else the day label. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - Date.parse(iso);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)} h ago`;
  return formatDay(iso, now);
}

/** `Nyamirambo → Remera` from a corridor's stops (first → last). */
export function routeLabel(stops: readonly Pick<TripStop, 'place'>[]): string {
  if (stops.length === 0) return '';
  return `${stops[0]!.place.name} → ${stops[stops.length - 1]!.place.name}`;
}

/** Initials for an avatar: `Aline Uwase` → `AU`. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0], parts[0]?.[1]];
  return letters.filter(Boolean).join('').toUpperCase() || '?';
}

/** `+250788123456` → `+250 788 123 456`. */
export function formatPhone(phone: string): string {
  const m = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+250 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
