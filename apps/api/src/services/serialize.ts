/**
 * Prisma includes + mappers from rows to the shared API contract (packages/shared/src/api.ts).
 */
import {
  computeContribution,
  costSharingLedger,
  legOccupancy,
  seatsAvailable,
  RUNNING_COST_PER_KM,
  type Booking as BookingDto,
  type JoinRequest as JoinRequestDto,
  type Me,
  type Payment as PaymentDto,
  type PublicUser,
  type Rating as RatingDto,
  type TripDetail,
  type TripStop as TripStopDto,
  type TripSummary,
  type Vehicle as VehicleDto,
  type VerificationChips,
  type VerificationRequest as VerificationRequestDto,
  type Weekday,
} from '@tmh/shared';
import type { Payment, Place, Prisma, Rating, TripStop, Vehicle, VerificationRequest } from '@prisma/client';
import { env } from '../env';

// ─── includes ───────────────────────────────────────────────────────────────────
export const userInclude = {
  vehicles: { select: { verifiedAt: true } },
  verificationRequests: { where: { status: 'pending' }, select: { type: true } },
} satisfies Prisma.UserInclude;
export type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export const stopInclude = { place: true } satisfies Prisma.TripStopInclude;
type StopRow = TripStop & { place: Place };

export const tripInclude = {
  stops: { include: stopInclude, orderBy: { order: 'asc' } },
  driver: { include: userInclude },
  vehicle: true,
  joinRequests: {
    where: { status: 'accepted' },
    select: { boardStop: { select: { order: true } }, alightStop: { select: { order: true } } },
  },
} satisfies Prisma.TripInclude;
export type TripRow = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

export const joinRequestInclude = {
  passenger: { include: userInclude },
  boardStop: { include: stopInclude },
  alightStop: { include: stopInclude },
  booking: { select: { id: true } },
  payments: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.JoinRequestInclude;
export type JoinRequestRow = Prisma.JoinRequestGetPayload<{ include: typeof joinRequestInclude }>;

export const bookingInclude = {
  joinRequest: {
    include: {
      trip: { include: tripInclude },
      passenger: { include: userInclude },
      boardStop: { include: stopInclude },
      alightStop: { include: stopInclude },
    },
  },
  payment: true,
  ratings: true,
} satisfies Prisma.BookingInclude;
export type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

// ─── users ──────────────────────────────────────────────────────────────────────
export function verificationChips(u: UserRow): VerificationChips {
  const pending = new Set(u.verificationRequests.map((v) => v.type));
  const chip = (verified: boolean, type: string) => (verified ? 'verified' : pending.has(type as never) ? 'pending' : 'none');
  return {
    phone: u.phoneVerifiedAt ? 'verified' : 'none',
    email: chip(!!u.emailVerifiedAt, 'email'),
    id: chip(!!u.idVerifiedAt, 'id'),
    licence: chip(!!u.driverVerifiedAt, 'licence'),
    vehicle: chip(
      u.vehicles.some((v) => v.verifiedAt),
      'vehicle',
    ),
  };
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    name: u.name || 'New member',
    photoUrl: u.photoUrl,
    ratingAvg: Math.round(u.ratingAvg * 10) / 10,
    ratingCount: u.ratingCount,
    verification: verificationChips(u),
    memberSince: u.createdAt.toISOString(),
  };
}

export function toVehicle(v: Vehicle): VehicleDto {
  return {
    id: v.id,
    make: v.make,
    model: v.model,
    plate: v.plate,
    color: v.color,
    seats: v.seats,
    isEV: v.isEV,
    photos: Array.isArray(v.photos) ? (v.photos as string[]) : [],
    verified: !!v.verifiedAt,
  };
}

export function toVerificationRequest(v: VerificationRequest): VerificationRequestDto {
  return {
    id: v.id,
    type: v.type,
    status: v.status,
    documentUrl: v.documentUrl,
    email: v.email,
    vehicleId: v.vehicleId,
    note: v.note,
    createdAt: v.createdAt.toISOString(),
    reviewedAt: v.reviewedAt?.toISOString() ?? null,
  };
}

export const meInclude = {
  vehicles: { orderBy: { createdAt: 'asc' } },
  verificationRequests: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.UserInclude;
export type MeRow = Prisma.UserGetPayload<{ include: typeof meInclude }>;

export function toMe(u: MeRow): Me {
  const asUserRow: UserRow = {
    ...u,
    vehicles: u.vehicles.map((v) => ({ verifiedAt: v.verifiedAt })),
    verificationRequests: u.verificationRequests.filter((v) => v.status === 'pending').map((v) => ({ type: v.type })),
  };
  return {
    ...toPublicUser(asUserRow),
    // The caller sees their real (possibly empty) name so profile setup isn't skipped.
    name: u.name,
    phone: u.phone,
    email: u.email,
    gender: u.gender,
    homeArea: u.homeArea,
    trustedContactPhone: u.trustedContactPhone,
    isAdmin: u.isAdmin,
    status: u.status,
    profileComplete: u.name.trim().length >= 2,
    vehicles: u.vehicles.map(toVehicle),
    verificationRequests: u.verificationRequests.map(toVerificationRequest),
  };
}

// ─── trips ──────────────────────────────────────────────────────────────────────
export function toStop(s: StopRow): TripStopDto {
  return {
    id: s.id,
    placeId: s.placeId,
    order: s.order,
    cumulativeKm: s.cumulativeKm,
    place: { id: s.place.id, name: s.place.name, lat: s.place.lat, lng: s.place.lng, landmark: s.place.landmark },
  };
}

export function occupiedSegments(trip: Pick<TripRow, 'joinRequests'>) {
  return trip.joinRequests.map((jr) => ({ boardOrder: jr.boardStop.order, alightOrder: jr.alightStop.order }));
}

export function toTripSummary(t: TripRow): TripSummary {
  return {
    id: t.id,
    seriesId: t.seriesId,
    departureTime: t.departureTime.toISOString(),
    recurringDays: Array.isArray(t.recurringDays) ? (t.recurringDays as Weekday[]) : null,
    seatsOffered: t.seatsOffered,
    seatsLeft: seatsAvailable(t.seatsOffered, t.stops.length, occupiedSegments(t)),
    womenOnly: t.womenOnly,
    isEV: t.isEV,
    status: t.status,
    totalKm: t.totalKm,
    stops: t.stops.map(toStop),
    driver: toPublicUser(t.driver),
    vehicle: toVehicle(t.vehicle),
    fullRouteContribution: computeContribution({ segmentKm: t.totalKm, seatsOffered: t.seatsOffered, isEV: t.isEV }),
  };
}

export function toPayment(p: Payment): PaymentDto {
  return {
    id: p.id,
    joinRequestId: p.joinRequestId,
    amount: p.amount,
    provider: p.provider,
    providerRef: p.providerRef,
    msisdn: p.msisdn,
    status: p.status,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toJoinRequest(jr: JoinRequestRow): JoinRequestDto {
  return {
    id: jr.id,
    tripId: jr.tripId,
    passenger: toPublicUser(jr.passenger),
    boardStop: toStop(jr.boardStop),
    alightStop: toStop(jr.alightStop),
    status: jr.status,
    segmentKm: jr.segmentKm,
    contributionAmount: jr.contributionAmount,
    bookingFee: jr.bookingFee,
    total: jr.contributionAmount + jr.bookingFee,
    createdAt: jr.createdAt.toISOString(),
    respondedAt: jr.respondedAt?.toISOString() ?? null,
    bookingId: jr.booking?.id ?? null,
    latestPayment: jr.payments[0] ? toPayment(jr.payments[0]) : null,
  };
}

export const tripPassengersInclude = {
  joinRequests: {
    where: { booking: { isNot: null } },
    include: {
      passenger: { include: userInclude },
      boardStop: { include: stopInclude },
      alightStop: { include: stopInclude },
      booking: { include: { ratings: { select: { raterId: true } } } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.TripInclude;
type TripPassengersRow = Prisma.TripGetPayload<{ include: typeof tripPassengersInclude }>;

const PAID_BOOKING_STATUSES = new Set(['confirmed', 'completed']);

/** Drivers can start a trip at most `tripStartWindowMinutes` before departure. */
export function startableFrom(departure: Date): Date | null {
  return env.tripStartWindowMinutes === null ? null : new Date(departure.getTime() - env.tripStartWindowMinutes * 60_000);
}

/**
 * Phone numbers are shared only between a driver and a paid passenger, and only while the ride is
 * still ahead or under way — never before payment, and not after the trip ends.
 */
export function phonesShared(bookingStatus: string, tripStatus: string): boolean {
  return bookingStatus === 'confirmed' && ['published', 'full', 'in_progress'].includes(tripStatus);
}

export function toTripDetail(
  t: TripRow,
  viewerId: string,
  extra: {
    myRequests: JoinRequestRow[];
    allRequests: JoinRequestRow[] | null;
    passengers: TripPassengersRow | null;
  },
): TripDetail {
  const isDriver = t.driverId === viewerId;
  const myJoinRequest =
    extra.myRequests.find((r) => r.status === 'pending' || r.status === 'accepted') ?? extra.myRequests[0] ?? null;
  const bookings = extra.passengers?.joinRequests ?? [];
  const paidShares = bookings
    .filter((jr) => jr.booking && PAID_BOOKING_STATUSES.has(jr.booking.status))
    .map((jr) => jr.contributionAmount);
  const ledger = costSharingLedger({ totalKm: t.totalKm, seatsOffered: t.seatsOffered }, paidShares);

  return {
    ...toTripSummary(t),
    legOccupancy: legOccupancy(t.stops.length, occupiedSegments(t)),
    startableFrom: startableFrom(t.departureTime)?.toISOString() ?? null,
    viewerRole: isDriver ? 'driver' : extra.myRequests.length ? 'passenger' : 'viewer',
    myJoinRequest: myJoinRequest ? toJoinRequest(myJoinRequest) : null,
    joinRequests: isDriver && extra.allRequests ? extra.allRequests.map(toJoinRequest) : null,
    ledger: isDriver ? { ...ledger, runningCostPerKm: RUNNING_COST_PER_KM } : null,
    passengers: isDriver
      ? bookings.map((jr) => ({
          bookingId: jr.booking!.id,
          status: jr.booking!.status,
          tripCode: jr.booking!.tripCode,
          passenger: toPublicUser(jr.passenger),
          boardStop: toStop(jr.boardStop),
          alightStop: toStop(jr.alightStop),
          contributionAmount: jr.contributionAmount,
          driverRated: jr.booking!.ratings.some((r) => r.raterId === viewerId),
          passengerPhone: phonesShared(jr.booking!.status, t.status) ? jr.passenger.phone : null,
        }))
      : null,
  };
}

// ─── bookings ───────────────────────────────────────────────────────────────────
export function toRating(r: Rating): RatingDto {
  return {
    id: r.id,
    bookingId: r.bookingId,
    raterId: r.raterId,
    rateeId: r.rateeId,
    stars: r.stars,
    tags: Array.isArray(r.tags) ? (r.tags as RatingDto['tags']) : [],
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toBooking(b: BookingRow, viewerId: string): BookingDto {
  const jr = b.joinRequest;
  const trip = jr.trip;
  const viewerRole = trip.driverId === viewerId ? 'driver' : 'passenger';
  const mine = b.ratings.find((r) => r.raterId === viewerId);
  const theirs = b.ratings.find((r) => r.raterId !== viewerId);
  return {
    id: b.id,
    tripCode: b.tripCode,
    status: b.status,
    viewerRole,
    trip: toTripSummary(trip),
    boardStop: toStop(jr.boardStop),
    alightStop: toStop(jr.alightStop),
    segmentKm: jr.segmentKm,
    contributionAmount: jr.contributionAmount,
    bookingFee: jr.bookingFee,
    total: jr.contributionAmount + jr.bookingFee,
    passenger: toPublicUser(jr.passenger),
    driver: toPublicUser(trip.driver),
    payment: toPayment(b.payment),
    myRating: mine ? toRating(mine) : null,
    counterpartRated: !!theirs,
    counterpartPhone: phonesShared(b.status, trip.status) ? (viewerRole === 'passenger' ? trip.driver.phone : jr.passenger.phone) : null,
    trustedContactPhone: viewerRole === 'passenger' ? jr.passenger.trustedContactPhone : trip.driver.trustedContactPhone,
    createdAt: b.createdAt.toISOString(),
  };
}
