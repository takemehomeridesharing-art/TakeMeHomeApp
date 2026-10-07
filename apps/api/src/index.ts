import { env } from './env';
import { buildApp } from './app';
import { migrate } from './bootstrap';
import { prisma } from './db';
import { seedIfEmpty } from './seed';

async function main() {
  migrate();
  if (await seedIfEmpty()) console.log('🌱 Seeded an empty database with Kigali places, demo users and trips.');

  const app = await buildApp({
    logger: env.isProd
      ? true
      : { level: 'info', transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname,reqId' } } },
  });
  await app.listen({ port: env.port, host: env.host });
  console.log(`\n🚗 Take Me Home API on http://localhost:${env.port}  (OTP in dev is always ${env.devOtpCode})\n`);

  const shutdown = async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
