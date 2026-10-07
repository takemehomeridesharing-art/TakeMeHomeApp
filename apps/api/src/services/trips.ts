import { randomUUID } from 'node:crypto';
import {
  MAX_TRIPS_PER_DAY,
  RECURRING_HORIZON_DAYS,
  TRIP_TRANSITIONS,
  addDays,
  assertTransition,
  buildCorridor,
  isTripFull,
  kigaliDateTime,
  kigaliDayBounds,
  kigaliDayKey,
  kigaliTime,
  kigaliWeekday,
  matchTrips,
  type DailyMeter,
  type DriverDashboard,
  type PublishTripSchema,
  type SearchTripsQuerySchema,
  type TripDetail,
  type TripMatch,
  type TripSummary,
} from '@tmh/shared';
import type { TripStatus } from '@prisma/client';
import type { z } from 'zod';
import type { AuthUser } from '../auth';
import { prisma, type Tx } from '../db';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { realtime } from '../realtime';
import { notify } from './notify';
import { providers } from '../providers';
import {
  joinRequestInclude,
  occupiedSegments,
  toTripDetail,
  toTripSummary,
  tripInclude,
  tripPassengersInclude,
  type TripRow,
} from './serialize';

const DAY_LABEL = (dayKey: string) =>
  new Date(`${dayKey}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

export const ACTIVE_TRIP_STATUSES: TripStatus[] = ['published', 'full', 'in_progress'];

/** Trips that count towards the two-per-day limit: everything except cancelled ones. */
async function tripsOnDay(db: Tx | typeof prisma, driverId: string, dayKey: string) {
  const { start, end } = kigaliDayBounds(kigaliDateTime(dayKey, '12:00'));
  return db.trip.count({
    where: { driverId, status: { not: 'cancelled' }, departureTime: { gte: start, lt: end } },
  });
}

export async function dailyMeter(driverId: string, dayKey = kigaliDayKey(new Date())): Promise<DailyMeter> {
  return { dayKey, used: await tripsOnDay(prisma, driverId, dayKey), limit: MAX_TRIPS_PER_DAY };
}

/** The dated occurrences a publish creates: one, or every matching weekday in the horizon. */
export function occurrencesFor(departure: Date, recurringDays: readonly string[] | null | undefined): Date[] {
  if (!recurringDays?.length) return [departure];
  const firstDay = kigaliDayKey(departure);
  const time = kigaliTime(departure);
  const out: Date[] = [];
  for (let i = 0; i < RECURRING_HORIZON_DAYS; i++) {
    const day = addDays(firstDay, i);
    const at = kigaliDateTime(day, time);
    if (recurringDays.includes(kigaliWeekday(at))) out.push(at);
  }
  return out;
}

export async function publishTrip(me: AuthUser, input: z.output<typeof PublishTripSchema>): Promise<TripSummary[]> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
  if (!vehicle || vehicle.ownerId !== me.id) throw notFound('That vehicle');
  if (input.seatsOffered > vehicle.seats - 1) {
    throw badRequest(`Your ${vehicle.make} ${vehicle.model} has room for ${vehicle.seats - 1} passengers at most.`);
  }
  if (input.womenOnly && me.gender !== 'female') {
    throw forbidden('Women-only trips can only be offered by women drivers.', 'WOMEN_ONLY');
  }

  const departure = new Date(input.departureTime);
  if (departure.getTime() < Date.now() - 5 * 60_000) throw badRequest('Pick a departure time in the future.');
  if (departure.getTime() > Date.now() + 30 * 24 * 3600_000) throw badRequest('You can publish up to 30 days ahead.');

  let corridor;
  try {
    corridor = buildCorridor(input.stopPlaceIds);
  } catch (e) {
    throw badRequest((e as Error).message);
  }
  const totalKm = corridor[corridor.length - 1]!.cumulativeKm;
  if (totalKm <= 0) throw badRequest('Origin and destination must be different places.');

  const dates = occurrencesFor(departure, input.recurringDays);
  if (!dates.length) throw badRequest('None of the chosen days fall in the next week.');
  const seriesId = dates.length > 1 ? randomUUID() : null;

  const ids = await prisma.$transaction(
    async (tx) => {
      // Two trips per driver per calendar day — checked inside the write transaction.
      const perDay = new Map<string, number>();
      for (const d of dates) perDay.set(kigaliDayKey(d), (perDay.get(kigaliDayKey(d)) ?? 0) + 1);
      for (const [dayKey, adding] of perDay) {
        const used = await tripsOnDay(tx, me.id, dayKey);
        if (used + adding > MAX_TRIPS_PER_DAY) {
          throw conflict(
            `You already have ${used} trip${used === 1 ? '' : 's'} on ${DAY_LABEL(dayKey)}. Take Me Home allows ${MAX_TRIPS_PER_DAY} trips a day — one out, one back.`,
            'DAILY_TRIP_LIMIT',
          );
        }
      }
      const created: string[] = [];
      for (const departureTime of dates) {
        const trip = await tx.trip.create({
          data: {
            driverId: me.id,
            vehicleId: vehicle.id,
            seriesId,
            departureTime,
            recurringDays: input.recurringDays?.length ? input.recurringDays : undefined,
            seatsOffered: input.seatsOffered,
            womenOnly: input.womenOnly,
            isEV: vehicle.isEV,
            totalKm,
            stops: { create: corridor.map((s) => ({ placeId: s.placeId, order: s.order, cumulativeKm: s.cumulativeKm })) },
          },
        });
        created.push(trip.id);
      }
      return created;
    },
    { isolationLevel: 'Serializable' },
  );

  const trips = await prisma.trip.findMany({ where: { id: { in: ids } }, include: tripInclude, orderBy: { departureTime: 'asc' } });
  return trips.map(toTripSummary);
}

export async function loadTrip(id: string): Promise<TripRow> {
  const trip = await prisma.trip.findUnique({ where: { id }, include: tripInclude });
  if (!trip) throw notFound('That trip');
  return trip;
}

export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const n = await prisma.block.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return n > 0;
}

async function blockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
}

/** Women-only trips are invisible (403) to anyone but women and the driver. */
export function assertCanSeeTrip(trip: Pick<TripRow, 'womenOnly' | 'driverId'>, me: AuthUser) {
  if (trip.womenOnly && trip.driverId !== me.id && me.gender !== 'female') {
    throw forbidden('This is a women-only trip. Set your gender to female in your profile to join women-only trips.', 'WOMEN_ONLY');
  }
}

export async function getTripDetail(id: string, me: AuthUser): Promise<TripDetail> {
  const trip = await loadTrip(id);
  assertCanSeeTrip(trip, me);
  const isDriver = trip.driverId === me.id;
  const [myRequests, allRequests, passengers] = await Promise.all([
    prisma.joinRequest.findMany({ where: { tripId: id, passengerId: me.id }, include: joinRequestInclude, orderBy: { createdAt: 'desc' } }),
    isDriver
      ? prisma.joinRequest.findMany({ where: { tripId: id }, include: joinRequestInclude, orderBy: { createdAt: 'asc' } })
      : Promise.resolve(null),
    isDriver ? prisma.trip.findUnique({ where: { id }, include: tripPassengersInclude }) : Promise.resolve(null),
  ]);
  return toTripDetail(trip, me.id, { myRequests, allRequests, passengers });
}

/** Resolves `today | tomorrow | week | YYYY-MM-DD` into a departure window (never in the past). */
export function searchWindow(when: string, now = new Date()): { earliest: Date; latest: Date; dayKey: string | null } {
  const today = kigaliDayKey(now);
  let dayKey: string | null = null;
  if (when === 'today') dayKey = today;
  else if (when === 'tomorrow') dayKey = addDays(today, 1);
  else if (/^\d{4}-\d{2}-\d{2}$/.test(when)) dayKey = when;
  if (dayKey) {
    const { start, end } = kigaliDayBounds(kigaliDateTime(dayKey, '12:00'));
    return { earliest: new Date(Math.max(start.getTime(), now.getTime())), latest: new Date(end.getTime() - 1), dayKey };
  }
  return { earliest: now, latest: new Date(now.getTime() + 7 * 24 * 3600_000), dayKey: null };
}

async function candidateTrips(me: AuthUser, earliest: Date, latest: Date) {
  const blocked = await blockedUserIds(me.id);
  return prisma.trip.findMany({
    where: {
      status: 'published',
      departureTime: { gte: earliest, lte: latest },
      driverId: { notIn: [me.id, ...blocked] },
      driver: { status: 'active' },
    },
    include: tripInclude,
    orderBy: { departureTime: 'asc' },
    take: 500,
  });
}

export async function searchTrips(me: AuthUser, q: z.output<typeof SearchTripsQuerySchema>): Promise<TripMatch[]> {
  const { earliest, latest, dayKey } = searchWindow(q.when);
  const trips = await candidateTrips(me, earliest, latest);
  const desiredTime = q.time ? kigaliDateTime(dayKey ?? kigaliDayKey(earliest), q.time) : undefined;
  const matches = matchTrips(
    trips.map((t) => ({
      id: t.id,
      departureTime: t.departureTime,
      seatsOffered: t.seatsOffered,
      womenOnly: t.womenOnly,
      isEV: t.isEV,
      driverRating: t.driver.ratingAvg,
      status: t.status,
      stops: t.stops,
      occupied: occupiedSegments(t),
      row: t,
    })),
    {
      fromPlaceId: q.from || undefined,
      toPlaceId: q.to || undefined,
      earliest,
      latest,
      desiredTime,
      womenOnly: q.womenOnly === 'true',
      passengerGender: me.gender,
    },
  );
  return matches.map((m) => ({
    trip: toTripSummary(m.trip.row),
    boardStopId: m.trip.row.stops.find((s) => s.order === m.board.order)!.id,
    alightStopId: m.trip.row.stops.find((s) => s.order === m.alight.order)!.id,
    segmentKm: m.segmentKm,
    spareKm: m.spareKm,
    seatsAvailable: m.seatsAvailable,
    contribution: m.contribution,
  }));
}

/** Published trips for the home map pins (same visibility rules as search). */
export async function mapTrips(me: AuthUser, when: string): Promise<TripSummary[]> {
  const { earliest, latest } = searchWindow(when);
  const trips = await candidateTrips(me, earliest, latest);
  return trips.filter((t) => !t.womenOnly || me.gender === 'female').map(toTripSummary);
}

/** Keeps `published` ⇄ `full` in sync with segment-aware occupancy. */
export async function refreshFullStatus(tx: Tx, tripId: string) {
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId }, include: tripInclude });
  if (trip.status !== 'published' && trip.status !== 'full') return;
  const full = isTripFull(trip.seatsOffered, trip.stops.length, occupiedSegments(trip));
  const next = full ? 'full' : 'published';
  if (next !== trip.status) {
    assertTransition('trip', TRIP_TRANSITIONS, trip.status, next);
    await tx.trip.update({ where: { id: tripId }, data: { status: next } });
  }
}

async function tripAudience(tripId: string): Promise<{ driverId: string; passengerIds: string[] }> {
  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: { driverId: true, joinRequests: { select: { passengerId: true } } },
  });
  return { driverId: trip.driverId, passengerIds: trip.joinRequests.map((j) => j.passengerId) };
}

async function broadcastTrip(tripId: string, status: string) {
  const { driverId, passengerIds } = await tripAudience(tripId);
  realtime.toUsers([driverId, ...passengerIds], 'trip:updated', { tripId, status });
}

async function loadOwnTrip(id: string, me: AuthUser) {
  const trip = await prisma.trip.findUnique({ where: { id }, include: { stops: { include: { place: true }, orderBy: { order: 'asc' } } } });
  if (!trip) throw notFound('That trip');
  if (trip.driverId !== me.id) throw forbidden('Only the driver can do that.');
  return trip;
}

const routeLabel = (stops: { place: { name: string } }[]) => `${stops[0]?.place.name} → ${stops[stops.length - 1]?.place.name}`;

export async function startTrip(id: string, me: AuthUser): Promise<TripDetail> {
  const trip = await loadOwnTrip(id, me);
  assertTransition('trip', TRIP_TRANSITIONS, trip.status, 'in_progress');
  const expired = await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id }, data: { status: 'in_progress', startedAt: new Date() } });
    // Requests nobody answered, and accepted-but-unpaid seats, lapse when the car leaves.
    const lapsing = await tx.joinRequest.findMany({
      where: { tripId: id, OR: [{ status: 'pending' }, { status: 'accepted', booking: null }] },
      select: { id: true, passengerId: true },
    });
    await tx.joinRequest.updateMany({ where: { id: { in: lapsing.map((l) => l.id) } }, data: { status: 'expired', respondedAt: new Date() } });
    return lapsing;
  });
  const bookings = await prisma.booking.findMany({ where: { joinRequest: { tripId: id }, status: 'confirmed' }, include: { joinRequest: true } });
  await Promise.all([
    ...bookings.map((b) =>
      notify(b.joinRequest.passengerId, 'trip_started', {
        title: 'Your driver is on the way',
        body: `${me.name} started the ${routeLabel(trip.stops)} trip. Be at your stop on time.`,
        href: `/track/${b.id}`,
      }),
    ),
    ...expired.map((e) =>
      notify(e.passengerId, 'request_expired', {
        title: 'Request expired',
        body: `The ${routeLabel(trip.stops)} trip has left, so your request expired.`,
        href: `/request/${e.id}`,
      }),
    ),
  ]);
  await broadcastTrip(id, 'in_progress');
  return getTripDetail(id, me);
}

export async function completeTrip(id: string, me: AuthUser): Promise<TripDetail> {
  const trip = await loadOwnTrip(id, me);
  assertTransition('trip', TRIP_TRANSITIONS, trip.status, 'completed');
  const bookings = await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } });
    const confirmed = await tx.booking.findMany({
      where: { joinRequest: { tripId: id }, status: 'confirmed' },
      include: { joinRequest: true },
    });
    await tx.booking.updateMany({ where: { id: { in: confirmed.map((b) => b.id) } }, data: { status: 'completed' } });
    return confirmed;
  });

  // Pay the driver their recovered cost shares (booking fees stay with the platform).
  const recovered = bookings.reduce((sum, b) => sum + b.joinRequest.contributionAmount, 0);
  if (recovered > 0) {
    const driver = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { phone: true } });
    const provider = providers().payment;
    const payout = await provider.payout({ msisdn: driver.phone, amount: recovered, reference: `trip-${id}` });
    await prisma.payout.create({ data: { tripId: id, driverId: me.id, amount: recovered, provider: provider.name, providerRef: payout.providerRef } });
  }

  await Promise.all(
    bookings.map((b) =>
      notify(b.joinRequest.passengerId, 'rate_trip', {
        title: 'You made it home — rate your trip',
        body: `How was your ride with ${me.name}? Your rating keeps Take Me Home safe.`,
        href: `/rate/${b.id}`,
      }),
    ),
  );
  if (bookings.length) {
    await notify(me.id, 'rate_passengers', {
      title: 'Trip completed',
      body: `Thanks for sharing your ride. Rate your ${bookings.length === 1 ? 'passenger' : `${bookings.length} passengers`}.`,
      href: `/trip/${id}`,
    });
  }
  await broadcastTrip(id, 'completed');
  return getTripDetail(id, me);
}

export async function cancelTrip(id: string, me: AuthUser): Promise<TripDetail> {
  const trip = await loadOwnTrip(id, me);
  assertTransition('trip', TRIP_TRANSITIONS, trip.status, 'cancelled');
  const { lapsing, paid } = await prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id }, data: { status: 'cancelled' } });
    const lapsing = await tx.joinRequest.findMany({
      where: { tripId: id, OR: [{ status: 'pending' }, { status: 'accepted', booking: null }] },
      select: { id: true, passengerId: true },
    });
    await tx.joinRequest.updateMany({ where: { id: { in: lapsing.map((l) => l.id) } }, data: { status: 'expired', respondedAt: new Date() } });
    const paid = await tx.booking.findMany({
      where: { joinRequest: { tripId: id }, status: 'confirmed' },
      include: { payment: true, joinRequest: true },
    });
    return { lapsing, paid };
  });

  for (const b of paid) {
    await providers().payment.refund({ providerRef: b.payment.providerRef, amount: b.payment.amount });
    await prisma.$transaction([
      prisma.booking.update({ where: { id: b.id }, data: { status: 'refunded' } }),
      prisma.payment.update({ where: { id: b.paymentId }, data: { status: 'refunded' } }),
    ]);
    await notify(b.joinRequest.passengerId, 'trip_cancelled', {
      title: 'Your driver cancelled — full refund on its way',
      body: `${me.name} cancelled the ${routeLabel(trip.stops)} trip. RWF ${b.payment.amount} is being returned to your MoMo. Guaranteed Ride Home: open the app and we'll help you find another ride.`,
      href: `/booking/${b.id}`,
    });
  }
  await Promise.all(
    lapsing.map((l) =>
      notify(l.passengerId, 'trip_cancelled', {
        title: 'Trip cancelled',
        body: `${me.name} cancelled the ${routeLabel(trip.stops)} trip. Search again to find another ride.`,
        href: `/request/${l.id}`,
      }),
    ),
  );
  await broadcastTrip(id, 'cancelled');
  return getTripDetail(id, me);
}

export async function driverDashboard(me: AuthUser): Promise<DriverDashboard> {
  const [vehicleCount, active] = await Promise.all([
    prisma.vehicle.count({ where: { ownerId: me.id } }),
    prisma.trip.findMany({
      where: { driverId: me.id, status: { in: ACTIVE_TRIP_STATUSES } },
      include: tripInclude,
      orderBy: { departureTime: 'asc' },
    }),
  ]);
  const focus = active.find((t) => t.status === 'in_progress') ?? active[0] ?? null;
  const pendingRequestCount = await prisma.joinRequest.count({
    where: { status: 'pending', trip: { driverId: me.id, status: { in: ['published', 'full'] } } },
  });

  let returnTripDraft: DriverDashboard['returnTripDraft'] = null;
  if (focus) {
    const dayKey = kigaliDayKey(focus.departureTime);
    returnTripDraft = {
      vehicleId: focus.vehicleId,
      stopPlaceIds: [...focus.stops].reverse().map((s) => s.placeId),
      seatsOffered: focus.seatsOffered,
      womenOnly: focus.womenOnly,
      dayKey,
      meterForDay: await dailyMeter(me.id, dayKey),
    };
  }

  return {
    hasVehicle: vehicleCount > 0,
    dailyMeter: await dailyMeter(me.id),
    focusTrip: focus ? await getTripDetail(focus.id, me) : null,
    upcomingTrips: active.map(toTripSummary),
    pendingRequestCount,
    returnTripDraft,
  };
}

