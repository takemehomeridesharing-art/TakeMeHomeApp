import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { env } from '../src/env';
import { SEED_PHONES } from '../src/seed';
import { client, freshApp, type Seeded } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;
let data: Seeded;
const previous = env.tripStartWindowMinutes;

beforeAll(async () => {
  ({ app, data } = await freshApp());
  api = client(app);
  env.tripStartWindowMinutes = 60; // production behaviour
});
afterAll(async () => {
  env.tripStartWindowMinutes = previous;
  await app.close();
});

describe('trip start window', () => {
  it('refuses to start a trip more than an hour before departure', async () => {
    const claudine = await api.login(SEED_PHONES.claudine);
    const tripId = data.claudineTrip.id; // tomorrow 07:00
    const detail = await api.get(`/trips/${tripId}`, claudine);
    expect(Date.parse(detail.body.departureTime) - Date.parse(detail.body.startableFrom)).toBe(60 * 60_000);
    const res = await api.post(`/trips/${tripId}/start`, claudine);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('TOO_EARLY');
    expect(res.body.message).toMatch(/06:00/);
  });

  it('allows starting within the window', async () => {
    const jp = await api.login(SEED_PHONES.jeanPaul);
    const { body } = await api.post('/trips', jp, {
      vehicleId: data.jeanPaul.vehicles[0]!.id,
      departureTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      seatsOffered: 2,
      stopPlaceIds: ['kacyiru', 'kimihurura', 'remera'],
    });
    const res = await api.post(`/trips/${body[0].id}/start`, jp);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });
});
