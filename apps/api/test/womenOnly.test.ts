import { addDays, kigaliDateTime, kigaliDayKey } from '@tmh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db';
import { SEED_PHONES } from '../src/seed';
import { client, freshApp, type Seeded } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;
let data: Seeded;
let alineTrip: { id: string; stops: { id: string; placeId: string }[] };

beforeAll(async () => {
  ({ app, data } = await freshApp());
  api = client(app);
  alineTrip = await prisma.trip.findFirstOrThrow({ where: { driverId: data.aline.id, womenOnly: true }, include: { stops: true } });
});
afterAll(() => app.close());

const stop = (placeId: string) => alineTrip.stops.find((s) => s.placeId === placeId)!.id;

describe('women-only trips', () => {
  it('are excluded from search for a male passenger', async () => {
    const eric = await api.login(SEED_PHONES.eric);
    const res = await api.get('/trips/search?from=remera&to=cbd&when=tomorrow', eric);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { trip: { womenOnly: boolean } }) => m.trip.womenOnly)).not.toContain(true);
    const map = await api.get('/trips/map?when=tomorrow', eric);
    expect(map.body.some((t: { id: string }) => t.id === alineTrip.id)).toBe(false);
  });

  it('return 403 to a crafted join request from a male passenger', async () => {
    const eric = await api.login(SEED_PHONES.eric);
    const res = await api.post(`/trips/${alineTrip.id}/join-requests`, eric, { boardStopId: stop('remera'), alightStopId: stop('cbd') });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WOMEN_ONLY');
    expect((await api.get(`/trips/${alineTrip.id}`, eric)).status).toBe(403);
    expect(await prisma.joinRequest.count({ where: { tripId: alineTrip.id } })).toBe(0);
  });

  it('return 403 to a passenger who has not set a gender', async () => {
    const newbie = await api.login('0722000123');
    await api.patch('/me', newbie, { name: 'No Gender' });
    const res = await api.post(`/trips/${alineTrip.id}/join-requests`, newbie, { boardStopId: stop('remera'), alightStopId: stop('cbd') });
    expect(res.status).toBe(403);
  });

  it('are visible and joinable for a female passenger', async () => {
    const grace = await api.login(SEED_PHONES.grace);
    const search = await api.get('/trips/search?from=remera&to=cbd&when=tomorrow&womenOnly=true', grace);
    expect(search.body.map((m: { trip: { id: string } }) => m.trip.id)).toEqual([alineTrip.id]);
    const res = await api.post(`/trips/${alineTrip.id}/join-requests`, grace, { boardStopId: stop('remera'), alightStopId: stop('cbd') });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
  });

  it('can only be published by women drivers', async () => {
    const jp = await api.login(SEED_PHONES.jeanPaul);
    const res = await api.post('/trips', jp, {
      vehicleId: data.jeanPaul.vehicles[0]!.id,
      departureTime: kigaliDateTime(addDays(kigaliDayKey(new Date()), 3), '06:30').toISOString(),
      seatsOffered: 2,
      womenOnly: true,
      stopPlaceIds: ['remera', 'kimihurura'],
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('WOMEN_ONLY');
  });
});
