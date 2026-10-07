import { seatsAvailable, type OccupiedSegment } from './capacity';
import { computeContribution, type Contribution } from './fare';
import type { CorridorStop } from './places';
import { round1 } from './places';

export type PassengerGender = 'female' | 'male' | 'other';

export interface MatchableTrip {
  id: string;
  departureTime: Date | string;
  seatsOffered: number;
  womenOnly: boolean;
  isEV: boolean;
  /** Driver's average rating (0 when unrated). */
  driverRating: number;
  /** Only `published` trips are joinable. Omit to skip the status check. */
  status?: string;
  /** The corridor, any order — the engine sorts by `order`. */
  stops: readonly CorridorStop[];
  /** Seats already promised (accepted or paid). Omit when unknown. */
  occupied?: readonly OccupiedSegment[];
}

export interface MatchQuery {
  fromPlaceId?: string;
  toPlaceId?: string;
  /** Inclusive departure window. */
  earliest?: Date | string;
  latest?: Date | string;
  /** Departure time the passenger would like; ranking is by proximity to it. Defaults to `earliest`. */
  desiredTime?: Date | string;
  /** Passenger asked to see women-only trips only. */
  womenOnly?: boolean;
  /** Passenger's gender as recorded on their profile. Women-only trips require `female`. */
  passengerGender?: PassengerGender | null;
}

export interface CorridorMatch<T extends MatchableTrip = MatchableTrip> {
  trip: T;
  board: CorridorStop;
  alight: CorridorStop;
  segmentKm: number;
  /** Corridor km the passenger is not riding (detour/waste measure; lower = better fit). */
  spareKm: number;
  seatsAvailable: number;
  contribution: Contribution;
  /** |departure − desired| in minutes, or minutes from the window start. */
  timeDeltaMinutes: number;
}

/** Departure proximity is compared in 15-minute buckets so km and rating can break near-ties. */
export const TIME_BUCKET_MINUTES = 15;

const ms = (d: Date | string) => (d instanceof Date ? d.getTime() : Date.parse(d));

/** True when this passenger may see and join a women-only trip. */
export function canJoinWomenOnly(passengerGender: PassengerGender | null | undefined): boolean {
  return passengerGender === 'female';
}

/**
 * Finds where a passenger's journey sits on a trip's corridor. Direction matters: the
 * boarding stop must come strictly before the alighting stop. Missing endpoints default to
 * the corridor's origin/destination.
 */
export function locateSegment(
  stops: readonly CorridorStop[],
  fromPlaceId?: string,
  toPlaceId?: string,
): { board: CorridorStop; alight: CorridorStop } | null {
  const ordered = [...stops].sort((a, b) => a.order - b.order);
  if (ordered.length < 2) return null;
  const board = fromPlaceId ? ordered.find((s) => s.placeId === fromPlaceId) : ordered[0];
  const alight = toPlaceId ? ordered.find((s) => s.placeId === toPlaceId) : ordered[ordered.length - 1];
  if (!board || !alight || board.order >= alight.order) return null;
  return { board, alight };
}

/** Evaluates one trip against a query. Returns null when it does not match. */
export function matchTrip<T extends MatchableTrip>(trip: T, query: MatchQuery): CorridorMatch<T> | null {
  if (trip.status !== undefined && trip.status !== 'published') return null;
  if (trip.womenOnly && !canJoinWomenOnly(query.passengerGender)) return null;
  if (query.womenOnly && !trip.womenOnly) return null;

  const dep = ms(trip.departureTime);
  if (query.earliest !== undefined && dep < ms(query.earliest)) return null;
  if (query.latest !== undefined && dep > ms(query.latest)) return null;

  const seg = locateSegment(trip.stops, query.fromPlaceId, query.toPlaceId);
  if (!seg) return null;
  const ordered = [...trip.stops].sort((a, b) => a.order - b.order);
  const totalKm = ordered[ordered.length - 1]!.cumulativeKm;
  const segmentKm = round1(seg.alight.cumulativeKm - seg.board.cumulativeKm);

  const free = seatsAvailable(trip.seatsOffered, ordered.length, trip.occupied ?? [], seg.board.order, seg.alight.order);
  if (free <= 0) return null;

  const reference = query.desiredTime ?? query.earliest;
  const timeDeltaMinutes = reference === undefined ? 0 : Math.abs(dep - ms(reference)) / 60_000;

  return {
    trip,
    board: seg.board,
    alight: seg.alight,
    segmentKm,
    spareKm: round1(totalKm - segmentKm),
    seatsAvailable: free,
    contribution: computeContribution({ segmentKm, seatsOffered: trip.seatsOffered, isEV: trip.isEV }),
    timeDeltaMinutes,
  };
}

/**
 * Ranked matches: departure-time proximity (15-min buckets), then fewest spare km, then
 * driver rating, then earliest departure.
 */
export function matchTrips<T extends MatchableTrip>(trips: readonly T[], query: MatchQuery): CorridorMatch<T>[] {
  const matches = trips.map((t) => matchTrip(t, query)).filter((m): m is CorridorMatch<T> => m !== null);
  const bucket = (m: CorridorMatch<T>) => Math.floor(m.timeDeltaMinutes / TIME_BUCKET_MINUTES);
  return matches.sort(
    (a, b) =>
      bucket(a) - bucket(b) ||
      a.spareKm - b.spareKm ||
      b.trip.driverRating - a.trip.driverRating ||
      ms(a.trip.departureTime) - ms(b.trip.departureTime) ||
      a.trip.id.localeCompare(b.trip.id),
  );
}
