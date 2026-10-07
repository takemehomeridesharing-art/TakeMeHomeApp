import { RUNNING_COST_PER_KM } from '@tmh/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { SEED_PHONES } from '../src/seed';
import { client, freshApp, type Seeded } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;
let data: Seeded;

beforeAll(async () => {
  ({ app, data } = await freshApp());
  api = client(app);
});
afterAll(() => app.close());

describe('no-profit invariant through the API', () => {
  it('a driver cannot set a price — extra fields are ignored and the engine prices the trip', async () => {
    const claudine = await api.login(SEED_PHONES.claudine);
    const res = await api.post('/trips', claudine, {
      vehicleId: data.claudine.vehicles[0]!.id,
      departureTime: new Date(Date.now() + 4 * 24 * 3600_000).toISOString(),
      seatsOffered: 4,
      stopPlaceIds: ['nyamirambo', 'kimisagara', 'cbd'],
      pricePerSeat: 5000,
      contribution: 5000,
    });
    expect(res.status).toBe(200);
    const t = res.body[0];
    // 300 × 5.1 km ÷ (4 + 1) = 306 → 300
    expect(t.fullRouteContribution).toEqual({ costShare: 300, bookingFee: 150, total: 450 });
  });

  it('even with every seat sold for the whole route, the driver recovers less than the trip costs', async () => {
    const claudine = await api.login(SEED_PHONES.claudine);
    const { body } = await api.post('/trips', claudine, {
      vehicleId: data.claudine.vehicles[0]!.id,
      departureTime: new Date(Date.now() + 5 * 24 * 3600_000).toISOString(),
      seatsOffered: 4,
      stopPlaceIds: ['nyamirambo', 'kimisagara', 'nyabugogo', 'cbd'],
    });
    const trip = body[0];
    const origin = trip.stops[0].id;
    const dest = trip.stops[trip.stops.length - 1].id;
    for (let i = 0; i < 4; i++) {
      const rider = await api.login(`07890000${10 + i}`);
      await api.patch('/me', rider, { name: `Rider ${i}` });
      const jr = await api.post(`/trips/${trip.id}/join-requests`, rider, { boardStopId: origin, alightStopId: dest });
      expect(jr.status).toBe(200);
      await api.post(`/join-requests/${jr.body.id}/accept`, claudine);
      const p = await api.post(`/join-requests/${jr.body.id}/pay`, rider);
      await api.post(`/dev/momo/${p.body.providerRef}/respond`, undefined, { approve: true });
    }
    const detail = await api.get(`/trips/${trip.id}`, claudine);
    expect(detail.body.status).toBe('full');
    expect(detail.body.passengers).toHaveLength(4);
    const { tripCost, recovered, driverCarries } = detail.body.ledger;
    expect(tripCost).toBe(Math.round(RUNNING_COST_PER_KM * trip.totalKm));
    expect(recovered).toBeLessThan(tripCost);
    expect(driverCarries).toBeGreaterThanOrEqual(tripCost / 5);
  });
});
