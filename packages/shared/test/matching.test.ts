import { describe, expect, it } from 'vitest';
import { buildCorridor, computeContribution, matchTrip, matchTrips, type MatchableTrip } from '../src';

const TOMORROW_7 = '2026-10-08T05:00:00.000Z'; // 07:00 Kigali

function trip(id: string, stops: string[], over: Partial<MatchableTrip> = {}): MatchableTrip {
  return {
    id,
    departureTime: TOMORROW_7,
    seatsOffered: 3,
    womenOnly: false,
    isEV: false,
    driverRating: 4.5,
    status: 'published',
    stops: buildCorridor(stops),
    ...over,
  };
}

const claudine = trip('claudine', ['nyamirambo', 'kimisagara', 'nyabugogo', 'cbd']);
const kanombe = trip('kanombe', ['kanombe', 'giporoso', 'remera', 'kimihurura', 'cbd'], { womenOnly: true });
const kona = trip('kona', ['remera', 'kimihurura', 'kacyiru'], { isEV: true });
const rubavuBound = trip('cbd-to-nyamirambo', ['cbd', 'nyabugogo', 'kimisagara', 'nyamirambo']);
const all = [claudine, kanombe, kona, rubavuBound];

describe('matchTrips — corridor and direction', () => {
  it('finds a trip whose corridor covers the journey (Kimisagara → CBD)', () => {
    const matches = matchTrips(all, { fromPlaceId: 'kimisagara', toPlaceId: 'cbd', passengerGender: 'male' });
    expect(matches.map((m) => m.trip.id)).toEqual(['claudine']);
    const m = matches[0]!;
    expect(m.board.placeId).toBe('kimisagara');
    expect(m.alight.placeId).toBe('cbd');
    expect(m.segmentKm).toBe(6.2);
    expect(m.spareKm).toBe(2.5);
    expect(m.contribution).toEqual(computeContribution({ segmentKm: 6.2, seatsOffered: 3, isEV: false }));
  });

  it('rejects the wrong direction: board order must be before alight order', () => {
    // CBD → Kimisagara is on Claudine's corridor, but she is driving the other way.
    const matches = matchTrips(all, { fromPlaceId: 'cbd', toPlaceId: 'kimisagara', passengerGender: 'female' });
    expect(matches.map((m) => m.trip.id)).toEqual(['cbd-to-nyamirambo']);
    expect(matchTrip(claudine, { fromPlaceId: 'cbd', toPlaceId: 'nyamirambo' })).toBeNull();
  });

  it('never matches an outbound journey against a CBD-bound trip (Nyamirambo → Rubavu)', () => {
    expect(matchTrips(all, { fromPlaceId: 'nyamirambo', toPlaceId: 'rubavu' })).toEqual([]);
  });

  it('rejects partial overlap: Kimisagara → Kacyiru is not covered by a CBD-bound corridor', () => {
    // Claudine covers Kimisagara but ends at CBD; Kona reaches Kacyiru but starts at Remera.
    expect(matchTrips(all, { fromPlaceId: 'kimisagara', toPlaceId: 'kacyiru', passengerGender: 'female' })).toEqual([]);
  });

  it('matches Kimisagara → Kacyiru on a corridor that covers both, pricing only the segment', () => {
    const viaKinamba = trip('via-kinamba', ['nyamirambo', 'kimisagara', 'nyabugogo', 'kinamba', 'kacyiru']);
    const [m] = matchTrips([...all, viaKinamba], { fromPlaceId: 'kimisagara', toPlaceId: 'kacyiru' });
    expect(m?.trip.id).toBe('via-kinamba');
    expect(m!.segmentKm).toBeCloseTo(9.7, 5); // 2.5 → 12.2
    const full = computeContribution({ segmentKm: 12.2, seatsOffered: 3, isEV: false });
    expect(m!.contribution.costShare).toBeLessThan(full.costShare);
  });

  it('defaults missing endpoints to the corridor origin/destination', () => {
    expect(matchTrips(all, { toPlaceId: 'kacyiru' }).map((m) => m.trip.id)).toEqual(['kona']);
    const fromOnly = matchTrips(all, { fromPlaceId: 'kimihurura', passengerGender: 'female' });
    expect(fromOnly.map((m) => m.trip.id).sort()).toEqual(['kanombe', 'kona']);
    expect(matchTrips(all, { fromPlaceId: 'cbd' }).map((m) => m.trip.id)).toEqual(['cbd-to-nyamirambo']);
  });

  it('ignores unknown places and same-stop journeys', () => {
    expect(matchTrips(all, { fromPlaceId: 'cbd', toPlaceId: 'cbd' })).toEqual([]);
    expect(matchTrips(all, { fromPlaceId: 'nowhere', toPlaceId: 'cbd' })).toEqual([]);
  });
});

describe('matchTrips — women-only (engine level)', () => {
  const q = { fromPlaceId: 'remera', toPlaceId: 'kimihurura' };

  it('excludes women-only trips for male, other and unknown-gender passengers', () => {
    for (const passengerGender of ['male', 'other', null, undefined] as const) {
      expect(matchTrips(all, { ...q, passengerGender }).map((m) => m.trip.id)).toEqual(['kona']);
    }
  });

  it('includes women-only trips for female passengers', () => {
    expect(matchTrips(all, { ...q, passengerGender: 'female' }).map((m) => m.trip.id).sort()).toEqual(['kanombe', 'kona']);
  });

  it('filters to women-only trips when the passenger asks for them', () => {
    expect(matchTrips(all, { ...q, passengerGender: 'female', womenOnly: true }).map((m) => m.trip.id)).toEqual(['kanombe']);
  });
});

describe('matchTrips — availability and time window', () => {
  it('skips trips that are not published', () => {
    for (const status of ['full', 'in_progress', 'completed', 'cancelled']) {
      expect(matchTrip({ ...claudine, status }, { fromPlaceId: 'kimisagara', toPlaceId: 'cbd' })).toBeNull();
    }
  });

  it('respects segment-aware capacity', () => {
    const seats = { ...claudine, seatsOffered: 1, occupied: [{ boardOrder: 0, alightOrder: 2 }] };
    // Nyamirambo → Nyabugogo is taken, but the Nyabugogo → CBD leg is free.
    expect(matchTrip(seats, { fromPlaceId: 'kimisagara', toPlaceId: 'cbd' })).toBeNull();
    expect(matchTrip(seats, { fromPlaceId: 'nyabugogo', toPlaceId: 'cbd' })?.seatsAvailable).toBe(1);
  });

  it('filters by the departure window', () => {
    const q = { fromPlaceId: 'kimisagara', toPlaceId: 'cbd' };
    expect(matchTrips(all, { ...q, earliest: '2026-10-08T05:30:00.000Z' })).toEqual([]);
    expect(matchTrips(all, { ...q, latest: '2026-10-08T04:59:00.000Z' })).toEqual([]);
    expect(matchTrips(all, { ...q, earliest: '2026-10-08T00:00:00.000Z', latest: '2026-10-08T21:59:59.000Z' })).toHaveLength(1);
  });
});

describe('matchTrips — ranking', () => {
  const desiredTime = '2026-10-08T05:00:00.000Z';

  it('ranks by departure-time proximity first', () => {
    const early = trip('early', ['kimisagara', 'cbd'], { departureTime: '2026-10-08T04:00:00.000Z' });
    const close = trip('close', ['nyamirambo', 'kimisagara', 'cbd'], { departureTime: '2026-10-08T05:05:00.000Z' });
    const ids = matchTrips([early, close], { fromPlaceId: 'kimisagara', toPlaceId: 'cbd', desiredTime }).map((m) => m.trip.id);
    expect(ids).toEqual(['close', 'early']);
  });

  it('then by fewest spare km', () => {
    const long = trip('long', ['nyamirambo', 'kimisagara', 'nyabugogo', 'cbd'], { driverRating: 5 });
    const tight = trip('tight', ['kimisagara', 'nyabugogo', 'cbd'], { driverRating: 3 });
    const ids = matchTrips([long, tight], { fromPlaceId: 'kimisagara', toPlaceId: 'cbd', desiredTime }).map((m) => m.trip.id);
    expect(ids).toEqual(['tight', 'long']);
  });

  it('then by driver rating', () => {
    const low = trip('low', ['kimisagara', 'cbd'], { driverRating: 3.9 });
    const high = trip('high', ['kimisagara', 'cbd'], { driverRating: 4.8, departureTime: '2026-10-08T05:10:00.000Z' });
    const ids = matchTrips([low, high], { fromPlaceId: 'kimisagara', toPlaceId: 'cbd', desiredTime }).map((m) => m.trip.id);
    expect(ids).toEqual(['high', 'low']);
  });
});
