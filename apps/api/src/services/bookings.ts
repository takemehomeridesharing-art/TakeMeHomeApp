import {
  BOOKING_TRANSITIONS,
  assertTransition,
  type Booking as BookingDto,
  type ChatMessage as ChatMessageDto,
  type CreateRatingSchema,
  type HistoryItem,
  type Rating as RatingDto,
  type SosEvent as SosEventDto,
} from '@tmh/shared';
import type { ChatMessage, SosEvent } from '@prisma/client';
import type { z } from 'zod';
import type { AuthUser } from '../auth';
import { prisma } from '../db';
import { conflict, forbidden, notFound } from '../errors';
import { providers } from '../providers';
import { realtime } from '../realtime';
import { notify, notifyAdmins } from './notify';
import { bookingInclude, toBooking, toRating, toTripSummary, tripInclude, type BookingRow } from './serialize';
import { isBlockedBetween } from './trips';

/** Loads a booking the caller is part of (as passenger or driver). */
export async function loadBookingFor(me: AuthUser, id: string): Promise<BookingRow> {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!b) throw notFound('That booking');
  const isParty = b.joinRequest.passengerId === me.id || b.joinRequest.trip.driverId === me.id;
  if (!isParty && !me.isAdmin) throw notFound('That booking');
  return b;
}

const counterpartOf = (b: BookingRow, me: AuthUser) =>
  b.joinRequest.passengerId === me.id ? b.joinRequest.trip.driverId : b.joinRequest.passengerId;

export async function getBooking(me: AuthUser, id: string): Promise<BookingDto> {
  return toBooking(await loadBookingFor(me, id), me.id);
}

export async function listMyBookings(me: AuthUser): Promise<BookingDto[]> {
  const rows = await prisma.booking.findMany({
    where: { OR: [{ joinRequest: { passengerId: me.id } }, { joinRequest: { trip: { driverId: me.id } } }] },
    include: bookingInclude,
    orderBy: { joinRequest: { trip: { departureTime: 'desc' } } },
    take: 100,
  });
  return rows.map((b) => toBooking(b, me.id));
}

export async function markNoShow(me: AuthUser, id: string): Promise<BookingDto> {
  const b = await loadBookingFor(me, id);
  if (b.joinRequest.trip.driverId !== me.id) throw forbidden('Only the driver can mark a no-show.');
  if (b.joinRequest.trip.status !== 'in_progress') throw conflict('You can mark a no-show once the trip has started.', 'INVALID_TRANSITION');
  assertTransition('booking', BOOKING_TRANSITIONS, b.status, 'no_show');
  await prisma.booking.update({ where: { id }, data: { status: 'no_show' } });
  await notify(b.joinRequest.passengerId, 'no_show', {
    title: 'Marked as no-show',
    body: `${me.name} marked you as not at ${b.joinRequest.boardStop.place.name}. If that’s wrong, report it from the trip.`,
    href: `/booking/${id}`,
  });
  return getBooking(me, id);
}

// ─── chat ───────────────────────────────────────────────────────────────────────
const toMessage = (m: ChatMessage): ChatMessageDto => ({
  id: m.id,
  bookingId: m.bookingId,
  senderId: m.senderId,
  body: m.body,
  createdAt: m.createdAt.toISOString(),
});

export async function listMessages(me: AuthUser, bookingId: string): Promise<ChatMessageDto[]> {
  await loadBookingFor(me, bookingId);
  const rows = await prisma.chatMessage.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' }, take: 500 });
  return rows.map(toMessage);
}

export async function sendMessage(me: AuthUser, bookingId: string, body: string): Promise<ChatMessageDto> {
  const b = await loadBookingFor(me, bookingId);
  const other = counterpartOf(b, me);
  if (await isBlockedBetween(me.id, other)) throw forbidden('You can’t message this person.', 'BLOCKED');
  if (b.status !== 'confirmed' && b.status !== 'completed') throw conflict('This trip chat is closed.', 'INVALID_TRANSITION');
  const m = toMessage(await prisma.chatMessage.create({ data: { bookingId, senderId: me.id, body } }));
  realtime.toUsers([me.id, other], 'chat:message', m);
  return m;
}

// ─── ratings ────────────────────────────────────────────────────────────────────
export async function rateBooking(me: AuthUser, bookingId: string, input: z.output<typeof CreateRatingSchema>): Promise<RatingDto> {
  const b = await loadBookingFor(me, bookingId);
  if (b.status !== 'completed') throw conflict('You can rate once the trip is completed.', 'INVALID_TRANSITION');
  if (b.ratings.some((r) => r.raterId === me.id)) throw conflict('You already rated this trip.', 'ALREADY_RATED');
  const rateeId = counterpartOf(b, me);

  const rating = await prisma.$transaction(async (tx) => {
    const created = await tx.rating.create({
      data: { bookingId, raterId: me.id, rateeId, stars: input.stars, tags: input.tags, comment: input.comment ?? null },
    });
    const ratee = await tx.user.findUniqueOrThrow({ where: { id: rateeId }, select: { ratingAvg: true, ratingCount: true } });
    const count = ratee.ratingCount + 1;
    await tx.user.update({
      where: { id: rateeId },
      data: { ratingCount: count, ratingAvg: (ratee.ratingAvg * ratee.ratingCount + input.stars) / count },
    });
    return created;
  });
  await notify(rateeId, 'rated', {
    title: 'You received a rating',
    body: `${me.name} rated your trip ${b.tripCode}.`,
    href: `/booking/${bookingId}`,
  });
  return toRating(rating);
}

// ─── safety ─────────────────────────────────────────────────────────────────────
export const toSos = (s: SosEvent): SosEventDto => ({
  id: s.id,
  bookingId: s.bookingId,
  userId: s.userId,
  lat: s.lat,
  lng: s.lng,
  notifiedContacts: s.notifiedContacts,
  contactPhone: s.contactPhone,
  resolvedAt: s.resolvedAt?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
});

/**
 * SOS: records the event, texts the trusted contact (mock SMS → console + admin outbox) and
 * flags every admin in realtime.
 */
export async function triggerSos(me: AuthUser, bookingId: string, loc: { lat?: number; lng?: number }): Promise<SosEventDto> {
  const b = await loadBookingFor(me, bookingId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const trip = b.joinRequest.trip;
  const route = `${trip.stops[0]?.place.name} → ${trip.stops[trip.stops.length - 1]?.place.name}`;
  const vehicle = `${trip.vehicle.color} ${trip.vehicle.make} ${trip.vehicle.model} ${trip.vehicle.plate}`;

  let sos = await prisma.sosEvent.create({
    data: { bookingId, userId: me.id, lat: loc.lat ?? null, lng: loc.lng ?? null, contactPhone: user.trustedContactPhone },
  });

  if (user.trustedContactPhone) {
    const where = loc.lat !== undefined && loc.lng !== undefined ? ` Last location: https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=17/${loc.lat}/${loc.lng}.` : '';
    await providers().sms.send(
      user.trustedContactPhone,
      `TAKE ME HOME SOS: ${user.name} pressed SOS on trip ${b.tripCode} (${route}) in a ${vehicle} driven by ${trip.driver.name}.${where} Call ${user.name}: ${user.phone}. If in danger call 112.`,
    );
    sos = await prisma.sosEvent.update({ where: { id: sos.id }, data: { notifiedContacts: true } });
  }
  console.warn(`🚨 SOS ${sos.id} by ${user.name} (${user.phone}) on ${b.tripCode} ${route}`);
  await notifyAdmins('sos', {
    title: `🚨 SOS on ${b.tripCode}`,
    body: `${user.name} pressed SOS on ${route}.`,
  });
  realtime.toAdmins('admin:changed', { kind: 'sos' });
  return toSos(sos);
}

export async function createReport(
  me: AuthUser,
  input: { reportedUserId?: string; bookingId?: string; reason: string; body: string },
) {
  let reportedUserId = input.reportedUserId ?? null;
  if (input.bookingId) {
    const b = await loadBookingFor(me, input.bookingId);
    reportedUserId ??= counterpartOf(b, me);
  }
  if (reportedUserId === me.id) throw conflict('You can’t report yourself.');
  if (reportedUserId && !(await prisma.user.findUnique({ where: { id: reportedUserId } }))) throw notFound('That user');
  const report = await prisma.report.create({
    data: { reporterId: me.id, reportedUserId, bookingId: input.bookingId ?? null, reason: input.reason, body: input.body },
  });
  realtime.toAdmins('admin:changed', { kind: 'report' });
  return report;
}

// ─── history ────────────────────────────────────────────────────────────────────
export async function history(me: AuthUser): Promise<HistoryItem[]> {
  const [driven, ridden] = await Promise.all([
    prisma.trip.findMany({
      where: { driverId: me.id, status: { in: ['completed', 'cancelled'] } },
      include: {
        ...tripInclude,
        joinRequests: {
          where: { status: 'accepted' },
          select: {
            contributionAmount: true,
            boardStop: { select: { order: true } },
            alightStop: { select: { order: true } },
            booking: { select: { status: true } },
          },
        },
      },
      orderBy: { departureTime: 'desc' },
      take: 100,
    }),
    prisma.booking.findMany({
      where: { joinRequest: { passengerId: me.id }, status: { not: 'confirmed' } },
      include: { joinRequest: { include: { trip: { include: tripInclude } } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  const items: (HistoryItem & { at: number })[] = [
    ...driven.map((t) => ({
      role: 'driver' as const,
      trip: toTripSummary(t),
      bookingId: null,
      status: t.status,
      amount: t.joinRequests
        .filter((jr) => jr.booking && (jr.booking.status === 'completed' || jr.booking.status === 'confirmed'))
        .reduce((sum, jr) => sum + jr.contributionAmount, 0),
      at: t.departureTime.getTime(),
    })),
    ...ridden.map((b) => ({
      role: 'passenger' as const,
      trip: toTripSummary(b.joinRequest.trip),
      bookingId: b.id,
      status: b.status,
      amount: b.joinRequest.contributionAmount + b.joinRequest.bookingFee,
      at: b.joinRequest.trip.departureTime.getTime(),
    })),
  ];
  return items.sort((a, b) => b.at - a.at).map(({ at: _at, ...rest }) => rest);
}

