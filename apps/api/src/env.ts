import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Defaults make `pnpm dev` work on a fresh clone with no .env. */
// Forward slashes keep the SQLite URL valid on Windows too (C:/Users/... rather than C:\\Users\\...).
process.env.DATABASE_URL ??= `file:${path.join(API_ROOT, 'prisma', 'dev.db').replaceAll('\\', '/')}`;

const nodeEnv = process.env.NODE_ENV ?? 'development';

function startWindow(raw: string | undefined, fallback: number | null): number | null {
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'off') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error('TRIP_START_WINDOW_MINUTES must be a number of minutes or "off"');
  return n;
}

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  databaseUrl: process.env.DATABASE_URL,
  uploadsDir: process.env.UPLOADS_DIR ?? path.join(API_ROOT, 'uploads'),
  /** Mock providers (OTP/SMS/push/MoMo) — the only option until the real integrations land. */
  useMockProviders: (process.env.PROVIDERS ?? 'mock') === 'mock',
  /** Fixed OTP in dev and test. */
  devOtpCode: '123456',
  /** Delay before the mock MoMo "USSD push" reaches the payer. */
  momoPromptDelayMs: Number(process.env.MOMO_PROMPT_DELAY_MS ?? 2000),
  /**
   * How early (minutes before departure) a driver may start a trip. Production defaults to 60.
   * Local dev defaults to off so the demo walkthrough can run tomorrow's seeded trip today;
   * set TRIP_START_WINDOW_MINUTES=60 to try the real behaviour locally.
   */
  tripStartWindowMinutes: startWindow(process.env.TRIP_START_WINDOW_MINUTES, nodeEnv === 'production' ? 60 : null),
  /** Validate every response against its Zod schema (dev + test). */
  validateResponses: nodeEnv !== 'production',
};

if (env.isProd && env.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
