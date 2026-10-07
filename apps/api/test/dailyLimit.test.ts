import { addDays, kigaliDateTime, kigaliDayKey } from '@tmh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../src/db';
import { SEED_PHONES } from '../src/seed';
import { client, freshApp, type Seeded } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;
let data: Seeded;
let claudine: string;

const tomorrow = () => addDays(kigaliDayKey(new Date()), 1);
const trip = (vehicleId: string, dayKey: string, time: string, extra: Record<string, unknown> = {}) => ({
  vehicleId,
  departureTime: kigaliDateTime(dayKey, time).toISOString(),
  seatsOffered: 3,
  stopPlaceIds: ['nyamirambo', 'kimisagara', 'cbd'],
  ...extra,
});

beforeAll(async () => {
  ({ app, data } = await freshApp());
  api = client(app);
  claudine = await api.login(SEED_PHONES.claudine);
});
afterAll(() => app.close());

describe('two trips per driver per day (server-side)', () => {
  it('rejects a third trip on a day that already has two', async () => {
    // Seed: Claudine is going out at 07:00 and back at 17:30 tomorrow.
    const meter = await api.get(`/driver/meter?day=${tomorrow()}`, claudine);
    expect(meter.body).toEqual({ dayKey: tomorrow(), used: 2, limit: 2 });
    const third = await api.post('/trips', claudine, trip(data.claudine.vehicles[0]!.id, tomorrow(), '12:00'));
    expect(third.status).toBe(409);
    expect(third.body.error).toBe('DAILY_TRIP_LIMIT');
    expect(third.body.message).toMatch(/one out, one back/);
  });

  it('allows two on another day and rejects the third', async () => {
    const day = addDays(tomorrow(), 2);
    const vehicleId = data.claudine.vehicles[0]!.id;
    expect((await api.post('/trips', claudine, trip(vehicleId, day, '07:00'))).status).toBe(200);
    expect((await api.post('/trips', claudine, trip(vehicleId, day, '17:00', { stopPlaceIds: ['cbd', 'kimisagara', 'nyamirambo'] }))).status).toBe(200);
    const third = await api.post('/trips', claudine, trip(vehicleId, day, '20:00'));
    expect(third.status).toBe(409);
    expect(third.body.error).toBe('DAILY_TRIP_LIMIT');
    expect(await prisma.trip.count({ where: { driverId: data.claudine.id, status: { not: 'cancelled' } } })).toBe(4);
  });

  it('checks every occurrence of a recurring publish and creates none if one day is full', async () => {
    const before = await prisma.trip.count();
    const everyDay = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const res = await api.post('/trips', claudine, trip(data.claudine.vehicles[0]!.id, tomorrow(), '12:00', { recurringDays: everyDay }));
    expect(res.status).toBe(409);
    expect(await prisma.trip.count()).toBe(before);
  });

  it('does not count cancelled trips', async () => {
    const day = addDays(tomorrow(), 4);
    const vehicleId = data.claudine.vehicles[0]!.id;
    const a = await api.post('/trips', claudine, trip(vehicleId, day, '07:00'));
    await api.post('/trips', claudine, trip(vehicleId, day, '17:00'));
    expect((await api.post(`/trips/${a.body[0].id}/cancel`, claudine)).status).toBe(200);
    expect((await api.post('/trips', claudine, trip(vehicleId, day, '18:00'))).status).toBe(200);
  });

  it('holds under concurrent publishes', async () => {
    const day = addDays(tomorrow(), 5);
    const vehicleId = data.claudine.vehicles[0]!.id;
    const results = await Promise.all(['06:00', '08:00', '10:00', '12:00'].map((t) => api.post('/trips', claudine, trip(vehicleId, day, t))));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  });

  it('creates dated occurrences for recurring weekday trips', async () => {
    const jp = await api.login(SEED_PHONES.jeanPaul);
    const res = await api.post('/trips', jp, {
      vehicleId: data.jeanPaul.vehicles[0]!.id,
      departureTime: kigaliDateTime(tomorrow(), '18:00').toISOString(),
      recurringDays: ['MO', 'TU', 'WE', 'TH', 'FR'],
      seatsOffered: 2,
      stopPlaceIds: ['kacyiru', 'kimihurura', 'remera'],
    });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(5);
    expect(new Set(res.body.map((t: { seriesId: string }) => t.seriesId)).size).toBe(1);
    expect(res.body[0].isEV).toBe(true); // comes from the vehicle, not the client
  });
});
