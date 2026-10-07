import { describe, expect, it } from 'vitest';
import {
  BOOKING_TRANSITIONS,
  JOIN_REQUEST_TRANSITIONS,
  PhoneSchema,
  TRIP_TRANSITIONS,
  TransitionError,
  assertTransition,
  canTransition,
  formatRwf,
  isTripFull,
  kigaliDateTime,
  kigaliDayBounds,
  kigaliDayKey,
  kigaliTime,
  kigaliWeekday,
  seatsAvailable,
} from '../src';

describe('formatRwf', () => {
  it('formats as RWF 1,250', () => {
    expect(formatRwf(1250)).toBe('RWF 1,250');
    expect(formatRwf(150)).toBe('RWF 150');
    expect(formatRwf(1234567)).toBe('RWF 1,234,567');
    expect(formatRwf(0)).toBe('RWF 0');
  });
});

describe('Kigali time', () => {
  it('uses UTC+2 calendar days', () => {
    expect(kigaliDayKey('2026-10-07T21:59:00Z')).toBe('2026-10-07');
    expect(kigaliDayKey('2026-10-07T22:00:00Z')).toBe('2026-10-08');
    const { start, end } = kigaliDayBounds('2026-10-08T05:00:00Z');
    expect(start.toISOString()).toBe('2026-10-07T22:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-08T22:00:00.000Z');
    expect(kigaliDateTime('2026-10-08', '07:00').toISOString()).toBe('2026-10-08T05:00:00.000Z');
    expect(kigaliTime('2026-10-08T05:00:00Z')).toBe('07:00');
    expect(kigaliWeekday('2026-10-08T05:00:00Z')).toBe('TH');
  });
});

describe('state machine', () => {
  it('allows the happy path and blocks everything else', () => {
    expect(canTransition(JOIN_REQUEST_TRANSITIONS, 'pending', 'accepted')).toBe(true);
    expect(canTransition(JOIN_REQUEST_TRANSITIONS, 'declined', 'accepted')).toBe(false);
    expect(canTransition(JOIN_REQUEST_TRANSITIONS, 'accepted', 'declined')).toBe(false);
    expect(canTransition(BOOKING_TRANSITIONS, 'confirmed', 'completed')).toBe(true);
    expect(canTransition(BOOKING_TRANSITIONS, 'completed', 'refunded')).toBe(false);
    expect(canTransition(TRIP_TRANSITIONS, 'completed', 'in_progress')).toBe(false);
    expect(() => assertTransition('trip', TRIP_TRANSITIONS, 'published', 'completed')).toThrow(TransitionError);
  });
});

describe('capacity', () => {
  it('counts seats per leg', () => {
    const segs = [
      { boardOrder: 0, alightOrder: 2 },
      { boardOrder: 1, alightOrder: 3 },
    ];
    expect(seatsAvailable(2, 4, segs, 0, 3)).toBe(0);
    expect(seatsAvailable(2, 4, segs, 2, 3)).toBe(1);
    expect(isTripFull(1, 4, segs)).toBe(true);
    expect(isTripFull(2, 4, segs)).toBe(false);
  });
});

describe('PhoneSchema', () => {
  it('normalises Rwandan numbers', () => {
    expect(PhoneSchema.parse('078 123 4567')).toBe('+250781234567');
    expect(PhoneSchema.parse('250781234567')).toBe('+250781234567');
    expect(PhoneSchema.parse('+250 72 000 0001')).toBe('+250720000001');
    expect(PhoneSchema.safeParse('12345').success).toBe(false);
  });
});
