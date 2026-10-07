import type { FastifyInstance } from 'fastify';
import { buildApp, mockProviders } from '../src/app';
import { seed, wipe } from '../src/seed';

export type Seeded = Awaited<ReturnType<typeof seed>>;

export async function freshApp(): Promise<{ app: FastifyInstance; data: Seeded }> {
  await wipe();
  const data = await seed();
  const app = await buildApp({ providers: mockProviders(0) });
  await app.ready();
  return { app, data };
}

export function client(app: FastifyInstance) {
  const request = async (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, token?: string, payload?: unknown) => {
    const res = await app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: res.statusCode, body: res.json() };
  };
  return {
    request,
    get: (url: string, token?: string) => request('GET', url, token),
    post: (url: string, token?: string, body: unknown = {}) => request('POST', url, token, body),
    patch: (url: string, token?: string, body: unknown = {}) => request('PATCH', url, token, body),
    async login(phone: string) {
      await request('POST', '/auth/otp/request', undefined, { phone });
      const res = await request('POST', '/auth/otp/verify', undefined, { phone, code: '123456' });
      if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
      return res.body.token as string;
    },
  };
}
