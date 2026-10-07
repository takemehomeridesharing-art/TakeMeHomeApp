import { KIGALI_UTC_OFFSET_MINUTES } from './constants';

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const OFFSET_MS = KIGALI_UTC_OFFSET_MINUTES * 60_000;
const DAY_MS = 24 * 60 * 60_000;

function toDate(d: Date | string | number): Date {
  return d instanceof Date ? d : new Date(d);
}

/** The Kigali calendar day of an instant, as `YYYY-MM-DD`. */
export function kigaliDayKey(d: Date | string | number): string {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instants bounding the Kigali calendar day containing `d`: [start, end). */
export function kigaliDayBounds(d: Date | string | number): { start: Date; end: Date } {
  const shifted = toDate(d).getTime() + OFFSET_MS;
  const startShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  return { start: new Date(startShifted - OFFSET_MS), end: new Date(startShifted - OFFSET_MS + DAY_MS) };
}

/** Kigali-local weekday code for an instant. */
export function kigaliWeekday(d: Date | string | number): Weekday {
  const day = new Date(toDate(d).getTime() + OFFSET_MS).getUTCDay(); // 0 = Sunday
  return WEEKDAYS[(day + 6) % 7]!;
}

/** Builds the UTC instant for a Kigali-local date (`YYYY-MM-DD`) and time (`HH:mm`). */
export function kigaliDateTime(dayKey: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const base = Date.parse(`${dayKey}T00:00:00.000Z`);
  return new Date(base + ((h ?? 0) * 60 + (m ?? 0)) * 60_000 - OFFSET_MS);
}

/** Kigali-local `HH:mm` of an instant. */
export function kigaliTime(d: Date | string | number): string {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** Adds whole days to a `YYYY-MM-DD` key. */
export function addDays(dayKey: string, days: number): string {
  return new Date(Date.parse(`${dayKey}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
