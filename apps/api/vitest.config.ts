import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: `file:${path.resolve(import.meta.dirname, 'prisma', 'test.db')}`,
      UPLOADS_DIR: path.resolve(import.meta.dirname, 'uploads', '.test'),
    },
    globalSetup: ['./test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
