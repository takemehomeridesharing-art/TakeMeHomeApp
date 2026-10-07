import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController, type FastifyServerOptions } from 'fastify';
import fs from 'node:fs';
import { env } from './env';
import { registerErrorHandler } from './errors';
import { setProviders, type Providers } from './providers';
import { MockMomoProvider } from './providers/mockMomo';
import { MockPushProvider } from './providers/push';
import { MockSmsProvider } from './providers/sms';
import { realtime } from './realtime';
import { adminRoutes } from './routes/admin';
import { authRoutes } from './routes/auth';
import { bookingRoutes } from './routes/bookings';
import { meRoutes } from './routes/me';
import { tripRoutes } from './routes/trips';

export function mockProviders(momoPromptDelayMs = env.momoPromptDelayMs): Providers {
  return {
    sms: new MockSmsProvider(),
    push: new MockPushProvider(),
    payment: new MockMomoProvider({
      promptDelayMs: momoPromptDelayMs,
      showPrompt: (userId, prompt) => realtime.toUser(userId, 'momo:prompt', prompt),
    }),
  };
}

export async function buildApp(opts: { logger?: FastifyServerOptions['logger']; providers?: Providers } = {}) {
  const app = Fastify({
    logger: opts.logger ?? false,
    bodyLimit: 1024 * 1024,
    forceCloseConnections: true,
    // One compact line per request (onResponse hook below) instead of two JSON blobs.
    logController: new LogController({ disableRequestLogging: true }),
  });
  // Treat an empty JSON body as `{}` — many clients send the header on body-less POSTs.
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body.trim() : '';
    if (!text) return done(null, {});
    try {
      done(null, JSON.parse(text));
    } catch {
      done(Object.assign(new Error('The request body is not valid JSON.'), { statusCode: 400, code: 'BAD_REQUEST' }), undefined);
    }
  });
  app.addHook('onResponse', async (request, reply) => {
    if (request.url !== '/health') request.log.info(`${request.method} ${request.url} → ${reply.statusCode} (${Math.round(reply.elapsedTime)}ms)`);
  });
  const providers = opts.providers ?? mockProviders();
  setProviders(providers);

  await app.register(cors, { origin: true, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] });
  await app.register(jwt, { secret: env.jwtSecret });
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  await app.register(fastifyStatic, { root: env.uploadsDir, prefix: '/uploads/', decorateReply: false });
  registerErrorHandler(app);

  app.get('/health', async () => ({ ok: true, service: 'take-me-home-api', time: new Date().toISOString() }));
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(tripRoutes);
  await app.register(bookingRoutes);
  await app.register(adminRoutes);
  providers.payment.registerRoutes?.(app);

  realtime.attach(app.server, (token) => app.jwt.verify<{ sub: string }>(token));
  app.addHook('onClose', async () => realtime.close());
  return app;
}
