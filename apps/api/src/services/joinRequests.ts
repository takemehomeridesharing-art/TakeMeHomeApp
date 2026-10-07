/**
 * The request → accept → pay → booking state machine (see PLAN.md). Every transition is
 * checked with the shared state machine and applied in a transaction.
 */
import { randomInt, randomUUID } from 'node:crypto';
import {
  JOIN_REQUEST_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  assertTransition,
  computeContribution,
  formatRwf,
  round1,
  seatsAvailable,
  type JoinRequest as JoinRequestDto,
  type Payment as PaymentDto,
  type PassengerRequestItem,
} from '@tmh/shared';
import type { AuthUser } from '../auth';
import { prisma } from '../db';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { providers } from '../providers';
import { realtime } from '../realtime';
import { notify } from './notify';
import { joinRequestInclude, occupiedSegments, toJoinRequest, toPayment, toTripSummary, tripInclude } from './serialize';
import { assertCanSeeTrip, isBlockedBetween, refreshFullStatus } from './trips';

async function loadRequest(id: string) {
  const jr = await prisma.joinRequest.findUnique({ where: { id }, include: { ...joinRequestInclude, trip: { include: tripInclude } } });
  if (!jr) throw notFound('That request');
  return jr;
}

async function emitRequest(id: string) {
  const jr = await prisma.joinRequest.findUniqueOrThrow({ where: { id }, include: { ...joinRequestInclude, trip: { select: { driverId: true } } } });
  const dto = toJoinRequest(jr);
  realtime.toUsers([jr.passengerId, jr.trip.driverId], 'join_request:updated', dto);
  return dto;
}

const segmentLabel = (jr: { boardStop: { place: { name: string } }; alightStop: { place: { name: string } } }) =>
  `${jr.boardStop.place.name} → ${jr.alightStop.place.name}`;

export async function createJoinRequest(
  me: AuthUser,
  tripId: string,
  input: { boardStopId: string; alightStopId: string },
): Promise<JoinRequestDto> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  if (!trip) throw notFound('That trip');
  // Women-only is enforced here as well as in search: a crafted request gets a 403.
  assertCanSeeTrip(trip, me);
  if (trip.driverId === me.id) throw forbidden('You can’t request to join your own trip.');
  if (await isBlockedBetween(me.id, trip.driverId)) throw forbidden('You can’t join trips with this driver.', 'BLOCKED');
  if (trip.status !== 'published') throw conflict('This trip is no longer taking requests.', 'INVALID_TRANSITION');
  if (trip.departureTime.getTime() < Date.now()) throw conflict('This trip has already left.', 'INVALID_TRANSITION');

  const board = trip.stops.find((s) => s.id === input.boardStopId);
  const alight = trip.stops.find((s) => s.id === input.alightStopId);
  if (!board || !alight) throw badRequest('Pick your boarding and drop-off stops on this trip’s route.');
  if (board.order >= alight.order) throw badRequest('Your drop-off must come after your boarding stop — this trip drives the other way.');

  const existing = await prisma.joinRequest.findFirst({
    where: { tripId, passengerId: me.id, status: { in: ['pending', 'accepted'] } },
  });
  if (existing) throw conflict('You already have a request on this trip.', 'ALREADY_REQUESTED');

  const free = seatsAvailable(trip.seatsOffered, trip.stops.length, occupiedSegments(trip), board.order, alight.order);
  if (free <= 0) throw conflict('No seats left for that part of the route.', 'NO_SEATS');

  // The fare engine sets the amount. Nobody — driver or passenger — can.
  const segmentKm = round1(alight.cumulativeKm - board.cumulativeKm);
  const c = computeContribution({ segmentKm, seatsOffered: trip.seatsOffered, isEV: trip.isEV });

  const jr = await prisma.joinRequest.create({
    data: {
      tripId,
      passengerId: me.id,
      boardStopId: board.id,
      alightStopId: alight.id,
      segmentKm,
      contributionAmount: c.costShare,
      bookingFee: c.bookingFee,
    },
    include: joinRequestInclude,
  });
  await notify(trip.driverId, 'join_request', {
    title: 'New request to join',
    body: `${me.name} wants a seat ${segmentLabel(jr)} · cost share ${formatRwf(c.costShare)}.`,
    href: '/my-trip',
  });
  return emitRequest(jr.id);
}

async function respond(me: AuthUser, id: string, to: 'accepted' | 'declined'): Promise<JoinRequestDto> {
  const jr = await loadRequest(id);
  if (jr.trip.driverId !== me.id) throw forbidden('Only the driver can respond to this request.');
  assertTransition('join request', JOIN_REQUEST_TRANSITIONS, jr.status, to);

  if (to === 'accepted') {
    if (jr.trip.status !== 'published' && jr.trip.status !== 'full') throw conflict('This trip is no longer taking passengers.', 'INVALID_TRANSITION');
    await prisma.$transaction(
      async (tx) => {
        const trip = await tx.trip.findUniqueOrThrow({ where: { id: jr.tripId }, include: tripInclude });
        const free = seatsAvailable(trip.seatsOffered, trip.stops.length, occupiedSegments(trip), jr.boardStop.order, jr.alightStop.order);
        if (free <= 0) throw conflict('No seats left on that part of the route.', 'NO_SEATS');
        await tx.joinRequest.update({ where: { id }, data: { status: 'accepted', respondedAt: new Date() } });
        await refreshFullStatus(tx, jr.tripId);
      },
      { isolationLevel: 'Serializable' },
    );
    await notify(jr.passengerId, 'request_accepted', {
      title: `${me.name} accepted your request`,
      body: `Pay ${formatRwf(jr.contributionAmount + jr.bookingFee)} with MoMo to confirm your seat ${segmentLabel(jr)}.`,
      href: `/request/${id}`,
    });
  } else {
    await prisma.joinRequest.update({ where: { id }, data: { status: 'declined', respondedAt: new Date() } });
    await notify(jr.passengerId, 'request_declined', {
      title: 'Request declined',
      body: `${me.name} can’t take you ${segmentLabel(jr)} this time. Other drivers may be going your way.`,
      href: `/request/${id}`,
    });
  }
  return emitRequest(id);
}

export const acceptJoinRequest = (me: AuthUser, id: string) => respond(me, id, 'accepted');
export const declineJoinRequest = (me: AuthUser, id: string) => respond(me, id, 'declined');

export async function cancelJoinRequest(me: AuthUser, id: string): Promise<JoinRequestDto> {
  const jr = await loadRequest(id);
  if (jr.passengerId !== me.id) throw forbidden('Only the passenger can cancel this request.');
  if (jr.booking) throw conflict('This seat is already paid. Contact the driver through the trip chat.', 'INVALID_TRANSITION');
  assertTransition('join request', JOIN_REQUEST_TRANSITIONS, jr.status, 'cancelled');
  await prisma.$transaction(async (tx) => {
    await tx.joinRequest.update({ where: { id }, data: { status: 'cancelled', respondedAt: new Date() } });
    await refreshFullStatus(tx, jr.tripId);
  });
  await notify(jr.trip.driverId, 'request_cancelled', {
    title: 'Request withdrawn',
    body: `${me.name} withdrew their request ${segmentLabel(jr)}.`,
    href: '/my-trip',
  });
  return emitRequest(id);
}

export async function getPassengerRequest(me: AuthUser, id: string): Promise<PassengerRequestItem> {
  const jr = await loadRequest(id);
  if (jr.passengerId !== me.id && jr.trip.driverId !== me.id) throw notFound('That request');
  return { joinRequest: toJoinRequest(jr), trip: toTripSummary(jr.trip) };
}

export async function listMyRequests(me: AuthUser): Promise<PassengerRequestItem[]> {
  const rows = await prisma.joinRequest.findMany({
    where: { passengerId: me.id },
    include: { ...joinRequestInclude, trip: { include: tripInclude } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((jr) => ({ joinRequest: toJoinRequest(jr), trip: toTripSummary(jr.trip) }));
}

// ─── payment ────────────────────────────────────────────────────────────────────

/** Passenger pays an accepted request: starts a MoMo collection. */
export async function payJoinRequest(me: AuthUser, id: string, msisdn?: string): Promise<PaymentDto> {
  const jr = await loadRequest(id);
  if (jr.passengerId !== me.id) throw forbidden('Only the passenger can pay for this seat.');
  if (jr.booking) throw conflict('This seat is already paid.', 'INVALID_TRANSITION');
  if (jr.status !== 'accepted') throw conflict('You can pay once the driver accepts your request.', 'INVALID_TRANSITION');
  if (jr.trip.status !== 'published' && jr.trip.status !== 'full') throw conflict('This trip is no longer taking payments.', 'INVALID_TRANSITION');

  const pending = await prisma.payment.findFirst({ where: { joinRequestId: id, status: 'initiated' }, orderBy: { createdAt: 'desc' } });
  if (pending && Date.now() - pending.createdAt.getTime() < 2 * 60_000) return toPayment(pending);
  if (pending) await prisma.payment.update({ where: { id: pending.id }, data: { status: 'failed', failureReason: 'Timed out' } });

  const passenger = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { phone: true } });
  const amount = jr.contributionAmount + jr.bookingFee;
  const paymentId = randomUUID();
  const provider = providers().payment;
  const payer = msisdn ?? passenger.phone;
  const { providerRef } = await provider.initiateCharge({
    externalId: paymentId,
    amount,
    currency: 'RWF',
    msisdn: payer,
    description: `Take Me Home ${segmentLabel(jr)}`,
    payerUserId: me.id,
  });
  const payment = await prisma.payment.create({
    data: { id: paymentId, joinRequestId: id, amount, provider: provider.name, providerRef, msisdn: payer },
  });
  await emitRequest(id);
  return toPayment(payment);
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function tripCode() {
  let s = 'TMH-';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/**
 * Applies a provider result (from the webhook, after `confirmCharge`). Idempotent: a payment
 * that already left `initiated` is not touched again.
 */
export async function applyPaymentResult(providerRef: string, status: 'confirmed' | 'failed', reason?: string) {
  const payment = await prisma.payment.findUnique({ where: { providerRef }, include: { joinRequest: { include: { trip: true, booking: true } } } });
  if (!payment) throw notFound('That payment');
  if (payment.status !== 'initiated') return payment;
  const jr = payment.joinRequest;

  if (status === 'failed') {
    assertTransition('payment', PAYMENT_TRANSITIONS, payment.status, 'failed');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: reason ?? 'Payment failed' } });
    await notify(jr.passengerId, 'payment_failed', {
      title: 'MoMo payment not completed',
      body: `${reason ?? 'The payment did not go through'}. Your seat is still held — try again.`,
      href: `/request/${jr.id}`,
    });
  } else {
    assertTransition('payment', PAYMENT_TRANSITIONS, payment.status, 'confirmed');
    const seatStillHeld = jr.status === 'accepted' && !jr.booking && (jr.trip.status === 'published' || jr.trip.status === 'full');
    if (seatStillHeld) {
      let created = false;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        try {
          await prisma.$transaction([
            prisma.payment.update({ where: { id: payment.id }, data: { status: 'confirmed', confirmedAt: new Date() } }),
            prisma.booking.create({ data: { joinRequestId: jr.id, paymentId: payment.id, tripCode: tripCode() } }),
          ]);
          created = true;
        } catch (e) {
          if ((e as { code?: string }).code !== 'P2002' || attempt === 4) throw e;
        }
      }
      const booking = await prisma.booking.findUniqueOrThrow({ where: { joinRequestId: jr.id }, include: { joinRequest: { include: { boardStop: { include: { place: true } }, alightStop: { include: { place: true } }, passenger: true } } } });
      await notify(jr.passengerId, 'booking_confirmed', {
        title: `Seat confirmed · ${booking.tripCode}`,
        body: `You’re riding ${segmentLabel(booking.joinRequest)}. Show your trip code to the driver.`,
        href: `/booking/${booking.id}`,
      });
      await notify(jr.trip.driverId, 'booking_confirmed', {
        title: `${booking.joinRequest.passenger.name} paid · ${booking.tripCode}`,
        body: `Boarding at ${booking.joinRequest.boardStop.place.name}. ${formatRwf(jr.contributionAmount)} goes towards your running cost.`,
        href: `/trip/${jr.tripId}`,
      });
      realtime.toAdmins('admin:changed', { kind: 'booking' });
    } else {
      // The seat lapsed while the payer was approving: take the money back at once.
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'confirmed', confirmedAt: new Date() } });
      await providers().payment.refund({ providerRef, amount: payment.amount });
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded', failureReason: 'Seat no longer available — refunded' } });
      await notify(jr.passengerId, 'payment_refunded', {
        title: 'Payment refunded',
        body: 'Your seat was no longer available, so we refunded your MoMo payment in full.',
        href: `/request/${jr.id}`,
      });
    }
  }

  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { booking: { select: { id: true } } } });
  realtime.toUser(jr.passengerId, 'payment:updated', { ...toPayment(fresh), bookingId: fresh.booking?.id ?? null });
  await emitRequest(jr.id);
  return fresh;
}

export async function getPayment(me: AuthUser, id: string) {
  const p = await prisma.payment.findUnique({ where: { id }, include: { booking: { select: { id: true } }, joinRequest: { select: { passengerId: true } } } });
  if (!p || p.joinRequest.passengerId !== me.id) throw notFound('That payment');
  return { ...toPayment(p), bookingId: p.booking?.id ?? null };
}
