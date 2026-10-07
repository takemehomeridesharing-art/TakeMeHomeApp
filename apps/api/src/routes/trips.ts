import {
  BookingSchema,
  DailyMeterSchema,
  DriverDashboardSchema,
  JoinRequestSchema,
  JoinTripSchema,
  PassengerRequestItemSchema,
  PayJoinRequestSchema,
  PaymentSchema,
  PublishTripSchema,
  SearchTripsQuerySchema,
  TripDetailSchema,
  TripMatchSchema,
  TripSummarySchema,
  kigaliDayKey,
} from '@tmh/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth';
import { badRequest, out, parse } from '../errors';
import { providers } from '../providers';
import { markNoShow } from '../services/bookings';
import {
  acceptJoinRequest,
  applyPaymentResult,
  cancelJoinRequest,
  createJoinRequest,
  declineJoinRequest,
  getPassengerRequest,
  getPayment,
  listMyRequests,
  payJoinRequest,
} from '../services/joinRequests';
import {
  cancelTrip,
  completeTrip,
  dailyMeter,
  driverDashboard,
  getTripDetail,
  mapTrips,
  publishTrip,
  searchTrips,
  startTrip,
} from '../services/trips';

const IdParam = z.object({ id: z.string() });
const PaymentWithBooking = PaymentSchema.extend({ bookingId: z.string().nullable() });

export async function tripRoutes(app: FastifyInstance) {
  // ── driver ──
  app.post('/trips', async (request) => {
    const me = await requireUser(request);
    const trips = await publishTrip(me, parse(PublishTripSchema, request.body));
    return out(z.array(TripSummarySchema), trips);
  });

  app.get('/driver/dashboard', async (request) => {
    const me = await requireUser(request);
    return out(DriverDashboardSchema, await driverDashboard(me));
  });

  app.get('/driver/meter', async (request) => {
    const me = await requireUser(request);
    const { day } = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(request.query);
    return out(DailyMeterSchema, await dailyMeter(me.id, day ?? kigaliDayKey(new Date())));
  });

  for (const [action, fn] of [
    ['start', startTrip],
    ['complete', completeTrip],
    ['cancel', cancelTrip],
  ] as const) {
    app.post(`/trips/:id/${action}`, async (request) => {
      const me = await requireUser(request);
      const { id } = IdParam.parse(request.params);
      return out(TripDetailSchema, await fn(id, me));
    });
  }

  app.post('/join-requests/:id/accept', async (request) => {
    const me = await requireUser(request);
    return out(JoinRequestSchema, await acceptJoinRequest(me, IdParam.parse(request.params).id));
  });
  app.post('/join-requests/:id/decline', async (request) => {
    const me = await requireUser(request);
    return out(JoinRequestSchema, await declineJoinRequest(me, IdParam.parse(request.params).id));
  });
  app.post('/bookings/:id/no-show', async (request) => {
    const me = await requireUser(request);
    return out(BookingSchema, await markNoShow(me, IdParam.parse(request.params).id));
  });

  // ── passenger ──
  app.get('/trips/search', async (request) => {
    const me = await requireUser(request);
    const q = parse(SearchTripsQuerySchema, request.query);
    if (q.from && q.to && q.from === q.to) throw badRequest('Pick different places for From and To.');
    return out(z.array(TripMatchSchema), await searchTrips(me, q));
  });

  app.get('/trips/map', async (request) => {
    const me = await requireUser(request);
    const { when } = z.object({ when: z.string().default('tomorrow') }).parse(request.query);
    return out(z.array(TripSummarySchema), await mapTrips(me, when));
  });

  app.get('/trips/:id', async (request) => {
    const me = await requireUser(request);
    return out(TripDetailSchema, await getTripDetail(IdParam.parse(request.params).id, me));
  });

  app.post('/trips/:id/join-requests', async (request) => {
    const me = await requireUser(request);
    const { id } = IdParam.parse(request.params);
    return out(JoinRequestSchema, await createJoinRequest(me, id, parse(JoinTripSchema, request.body)));
  });

  app.get('/join-requests/mine', async (request) => {
    const me = await requireUser(request);
    return out(z.array(PassengerRequestItemSchema), await listMyRequests(me));
  });
  app.get('/join-requests/:id', async (request) => {
    const me = await requireUser(request);
    return out(PassengerRequestItemSchema, await getPassengerRequest(me, IdParam.parse(request.params).id));
  });
  app.post('/join-requests/:id/cancel', async (request) => {
    const me = await requireUser(request);
    return out(JoinRequestSchema, await cancelJoinRequest(me, IdParam.parse(request.params).id));
  });
  app.post('/join-requests/:id/pay', async (request) => {
    const me = await requireUser(request);
    const { msisdn } = parse(PayJoinRequestSchema, request.body ?? {});
    return out(PaymentSchema, await payJoinRequest(me, IdParam.parse(request.params).id, msisdn));
  });

  app.get('/payments/:id', async (request) => {
    const me = await requireUser(request);
    return out(PaymentWithBooking, await getPayment(me, IdParam.parse(request.params).id));
  });

  // ── provider callback ──
  app.post('/payments/webhook/:provider', async (request, reply) => {
    const { provider: name } = z.object({ provider: z.string() }).parse(request.params);
    const provider = providers().payment;
    if (name !== provider.name) return reply.status(404).send({ error: 'NOT_FOUND', message: 'Unknown provider' });
    const result = provider.parseWebhook(request.headers, request.body);
    // Never trust the callback alone: ask the provider for the authoritative status.
    const verified = await provider.confirmCharge(result.providerRef);
    if (verified.status === 'pending') return { ok: true };
    await applyPaymentResult(result.providerRef, verified.status, verified.reason ?? result.reason);
    return { ok: true };
  });
}
