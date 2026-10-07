import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { client, freshApp } from './helpers';

let app: FastifyInstance;
let api: ReturnType<typeof client>;

beforeAll(async () => {
  ({ app } = await freshApp());
  api = client(app);
});
afterAll(() => app.close());

describe('phone + OTP auth', () => {
  it('rejects a wrong code and accepts the dev code 123456', async () => {
    const phone = '0781112233';
    expect((await api.post('/auth/otp/request', undefined, { phone })).body.phone).toBe('+250781112233');
    const bad = await api.post('/auth/otp/verify', undefined, { phone, code: '000000' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('INVALID_OTP');
    const ok = await api.post('/auth/otp/verify', undefined, { phone, code: '123456' });
    expect(ok.status).toBe(200);
    expect(ok.body.isNew).toBe(true);
    expect(ok.body.user.profileComplete).toBe(false);
    expect(ok.body.user.verification.phone).toBe('verified');
  });

  it('rejects invalid phone numbers', async () => {
    const res = await api.post('/auth/otp/request', undefined, { phone: '12345' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('requires a token for protected routes', async () => {
    expect((await api.get('/me')).status).toBe(401);
    expect((await api.get('/me', 'not-a-jwt')).status).toBe(401);
  });

  it('lets one account be both passenger and driver', async () => {
    const token = await api.login('+250788000006'); // Eric, seeded as a passenger
    const v = await api.post('/vehicles', token, { make: 'Suzuki', model: 'Swift', plate: 'rab 321 d', color: 'Red', seats: 5, isEV: false, photos: ['/uploads/x.jpg'] });
    expect(v.status).toBe(200);
    expect(v.body.plate).toBe('RAB 321 D');
    const me = await api.get('/me', token);
    expect(me.body.vehicles).toHaveLength(1);
  });

  it('lists seeded dev accounts', async () => {
    const res = await api.get('/dev/accounts');
    expect(res.body.map((a: { role: string }) => a.role)).toContain('admin');
  });
});
