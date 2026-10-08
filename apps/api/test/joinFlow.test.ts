import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db';
import { SEED_PHONES } from '../src/seed';
import { client, freshApp, type Seeded } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;
let data: Seeded;
let tokens: { claudine: string; eric: string; grace: string; newbie: string; admin: string };

const stop = (placeId: string) => data.claudineTrip.stops.find((s) => s.placeId === placeId)!.id;
const tripId = () => data.claudineTrip.id;

beforeAll(async () => {
  ({ app, data } = await freshApp());
  api = client(app);
  tokens = {
    claudine: await api.login(SEED_PHONES.claudine),
    eric: await api.login(SEED_PHONES.eric),
    grace: await api.login(SEED_PHONES.grace),
    newbie: await api.login('0733000111'),
    admin: await api.login(SEED_PHONES.admin),
  };
  await api.patch('/me', tokens.newbie, { name: 'New Rider', gender: 'other' });
});
afterAll(() => app.close());

async function pay(requestId: string, token: string, approve = true) {
  const p = await api.post(`/join-requests/${requestId}/pay`, token);
  expect(p.status).toBe(200);
  expect(p.body.status).toBe('initiated');
  const r = await api.post(`/dev/momo/${p.body.providerRef}/respond`, undefined, { approve });
  expect(r.status).toBe(200);
  return (await api.get(`/payments/${p.body.id}`, token)).body as { status: string; bookingId: string | null; failureReason: string | null };
}

describe('request → accept → pay state machine', () => {
  let requestId: string;

  it('a passenger requests to join; the amount comes from the fare engine', async () => {
    const res = await api.post(`/trips/${tripId()}/join-requests`, tokens.eric, {
      boardStopId: stop('kimisagara'),
      alightStopId: stop('cbd'),
      contributionAmount: 1, // a crafted price is ignored
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'pending', segmentKm: 6.2, contributionAmount: 460, bookingFee: 150, total: 610 });
    requestId = res.body.id;
  });

  it('rejects duplicates, wrong direction and joining your own trip', async () => {
    expect((await api.post(`/trips/${tripId()}/join-requests`, tokens.eric, { boardStopId: stop('kimisagara'), alightStopId: stop('cbd') })).body.error).toBe('ALREADY_REQUESTED');
    const backwards = await api.post(`/trips/${tripId()}/join-requests`, tokens.newbie, { boardStopId: stop('cbd'), alightStopId: stop('kimisagara') });
    expect(backwards.status).toBe(400);
    expect((await api.post(`/trips/${tripId()}/join-requests`, tokens.claudine, { boardStopId: stop('kimisagara'), alightStopId: stop('cbd') })).status).toBe(403);
  });

  it('cannot be paid before the driver accepts', async () => {
    const res = await api.post(`/join-requests/${requestId}/pay`, tokens.eric);
    expect(res.status).toBe(409);
  });

  it('only the trip’s driver can accept', async () => {
    expect((await api.post(`/join-requests/${requestId}/accept`, tokens.eric)).status).toBe(403);
    expect((await api.post(`/join-requests/${requestId}/accept`, tokens.grace)).status).toBe(403);
    const res = await api.post(`/join-requests/${requestId}/accept`, tokens.claudine);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('illegal transitions are 409 INVALID_TRANSITION', async () => {
    for (const action of ['accept', 'decline']) {
      const res = await api.post(`/join-requests/${requestId}/${action}`, tokens.claudine);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INVALID_TRANSITION');
    }
  });

  it('a declined MoMo prompt fails the payment but keeps the seat; a retry confirms it', async () => {
    const failed = await pay(requestId, tokens.eric, false);
    expect(failed.status).toBe('failed');
    expect(failed.bookingId).toBeNull();
    expect((await prisma.joinRequest.findUniqueOrThrow({ where: { id: requestId } })).status).toBe('accepted');

    const ok = await pay(requestId, tokens.eric, true);
    expect(ok.status).toBe('confirmed');
    expect(ok.bookingId).toBeTruthy();
    const booking = await api.get(`/bookings/${ok.bookingId}`, tokens.eric);
    expect(booking.body.tripCode).toMatch(/^TMH-[A-Z2-9]{4}$/);
    expect(booking.body.status).toBe('confirmed');
    expect(booking.body.total).toBe(610);
  });

  it('webhooks are idempotent and a paid seat cannot be paid or cancelled again', async () => {
    const payment = await prisma.payment.findFirstOrThrow({ where: { joinRequestId: requestId, status: 'confirmed' } });
    await api.post(`/payments/webhook/mtn_momo`, undefined, { referenceId: payment.providerRef, status: 'SUCCESSFUL' });
    expect(await prisma.booking.count({ where: { joinRequestId: requestId } })).toBe(1);
    expect((await api.post(`/join-requests/${requestId}/pay`, tokens.eric)).status).toBe(409);
    expect((await api.post(`/join-requests/${requestId}/cancel`, tokens.eric)).status).toBe(409);
  });

  it('the driver sees the passenger, the board point and the ledger', async () => {
    const detail = await api.get(`/trips/${tripId()}`, tokens.claudine);
    expect(detail.body.viewerRole).toBe('driver');
    expect(detail.body.passengers).toHaveLength(1);
    expect(detail.body.passengers[0].boardStop.placeId).toBe('kimisagara');
    expect(detail.body.ledger).toMatchObject({ tripCost: 2610, recovered: 460, driverCarries: 2150 });
    // Passengers never see the driver's ledger or other passengers.
    const asPassenger = await api.get(`/trips/${tripId()}`, tokens.eric);
    expect(asPassenger.body.ledger).toBeNull();
    expect(asPassenger.body.joinRequests).toBeNull();
  });

  it('shares phone numbers only between the driver and a paid passenger', async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { joinRequestId: requestId } });
    const asPassenger = await api.get(`/bookings/${booking.id}`, tokens.eric);
    expect(asPassenger.body.counterpartPhone).toBe(SEED_PHONES.claudine);
    const asDriver = await api.get(`/bookings/${booking.id}`, tokens.claudine);
    expect(asDriver.body.counterpartPhone).toBe(SEED_PHONES.eric);
    const detail = await api.get(`/trips/${tripId()}`, tokens.claudine);
    expect(detail.body.passengers[0].passengerPhone).toBe(SEED_PHONES.eric);
    // Grace's request is unpaid: nothing about the trip exposes the driver's number to her.
    const asGrace = await api.get(`/trips/${tripId()}`, tokens.grace);
    expect(JSON.stringify(asGrace.body)).not.toContain(SEED_PHONES.claudine);
  });

  it('starting the trip expires unanswered requests', async () => {
    const pendingGrace = await prisma.joinRequest.findFirstOrThrow({ where: { tripId: tripId(), passengerId: data.grace.id } });
    expect(pendingGrace.status).toBe('pending');
    const res = await api.post(`/trips/${tripId()}/start`, tokens.claudine);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
    expect((await prisma.joinRequest.findUniqueOrThrow({ where: { id: pendingGrace.id } })).status).toBe('expired');
    // Can't request or rate an in-progress trip.
    expect((await api.post(`/trips/${tripId()}/join-requests`, tokens.newbie, { boardStopId: stop('kimisagara'), alightStopId: stop('cbd') })).status).toBe(409);
  });

  it('SOS records the event and texts the trusted contact', async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { joinRequestId: requestId } });
    const res = await api.post(`/bookings/${booking.id}/sos`, tokens.eric, { lat: -1.9637, lng: 30.0478 });
    expect(res.status).toBe(200);
    expect(res.body.notifiedContacts).toBe(true);
    const sms = await prisma.devOutbox.findFirst({ where: { channel: 'sms', to: '+250788100006' } });
    expect(sms?.body).toContain('SOS');
    const adminSos = await api.get('/admin/sos?status=open', tokens.admin);
    expect(adminSos.body).toHaveLength(1);
  });

  it('ratings open once the trip is completed, once per side', async () => {
    const booking = await prisma.booking.findFirstOrThrow({ where: { joinRequestId: requestId } });
    expect((await api.post(`/bookings/${booking.id}/ratings`, tokens.eric, { stars: 5 })).status).toBe(409);
    const done = await api.post(`/trips/${tripId()}/complete`, tokens.claudine);
    expect(done.body.status).toBe('completed');
    expect(done.body.passengers[0].status).toBe('completed');
    // Once the ride is over, numbers are no longer shared.
    expect(done.body.passengers[0].passengerPhone).toBeNull();
    expect((await api.get(`/bookings/${booking.id}`, tokens.eric)).body.counterpartPhone).toBeNull();
    expect((await api.post(`/bookings/${booking.id}/ratings`, tokens.eric, { stars: 5, tags: ['Punctual', 'Safe driving'] })).status).toBe(200);
    expect((await api.post(`/bookings/${booking.id}/ratings`, tokens.eric, { stars: 1 })).body.error).toBe('ALREADY_RATED');
    expect((await api.post(`/bookings/${booking.id}/ratings`, tokens.claudine, { stars: 4, tags: ['Friendly'] })).status).toBe(200);
    expect((await api.post(`/bookings/${booking.id}/ratings`, tokens.grace, { stars: 1 })).status).toBe(404);
    const driver = await prisma.user.findUniqueOrThrow({ where: { id: data.claudine.id } });
    expect(driver.ratingCount).toBe(38);
    const payout = await prisma.payout.findFirstOrThrow({ where: { tripId: tripId() } });
    expect(payout.amount).toBe(460); // cost shares only — booking fees stay with the platform
  });
});

describe('segment-aware seats', () => {
  it('fills a leg and answers NO_SEATS only for journeys that need it', async () => {
    const vehicleId = data.aline.vehicles[0]!.id;
    const aline = await api.login(SEED_PHONES.aline);
    const { body: trips } = await api.post('/trips', aline, {
      vehicleId,
      departureTime: new Date(Date.now() + 3 * 24 * 3600_000).toISOString(),
      seatsOffered: 1,
      stopPlaceIds: ['kanombe', 'giporoso', 'remera', 'kimihurura'],
    });
    const t = trips[0];
    const s = (p: string) => t.stops.find((x: { placeId: string }) => x.placeId === p).id;
    const a = await api.post(`/trips/${t.id}/join-requests`, tokens.grace, { boardStopId: s('kanombe'), alightStopId: s('remera') });
    await api.post(`/join-requests/${a.body.id}/accept`, aline);
    const blocked = await api.post(`/trips/${t.id}/join-requests`, tokens.newbie, { boardStopId: s('giporoso'), alightStopId: s('kimihurura') });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('NO_SEATS');
    const later = await api.post(`/trips/${t.id}/join-requests`, tokens.newbie, { boardStopId: s('remera'), alightStopId: s('kimihurura') });
    expect(later.status).toBe(200);
    const accepted = await api.post(`/join-requests/${later.body.id}/accept`, aline);
    expect(accepted.status).toBe(200);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('full');
    // Withdrawing frees the leg and reopens the trip.
    await api.post(`/join-requests/${later.body.id}/cancel`, tokens.newbie);
    expect((await prisma.trip.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('published');
  });
});

describe('suspension', () => {
  it('blocks every write with 403 ACCOUNT_SUSPENDED but keeps reads working', async () => {
    const newbieId = (await api.get('/me', tokens.newbie)).body.id;
    expect((await api.post(`/admin/users/${newbieId}/suspend`, tokens.eric)).status).toBe(403); // admins only
    expect((await api.post(`/admin/users/${newbieId}/suspend`, tokens.admin)).body.status).toBe('suspended');
    const kona = await prisma.trip.findFirstOrThrow({ where: { driverId: data.jeanPaul.id, status: 'published' }, include: { stops: true } });
    const res = await api.post(`/trips/${kona.id}/join-requests`, tokens.newbie, {
      boardStopId: kona.stops[0]!.id,
      alightStopId: kona.stops[2]!.id,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ACCOUNT_SUSPENDED');
    expect(res.body.message).toMatch(/suspended/);
    expect((await api.patch('/me', tokens.newbie, { name: 'Sneaky' })).status).toBe(403);
    expect((await api.get('/me', tokens.newbie)).status).toBe(200);
    await api.post(`/admin/users/${newbieId}/unsuspend`, tokens.admin);
    expect((await api.patch('/me', tokens.newbie, { name: 'Back Again' })).status).toBe(200);
  });
});
