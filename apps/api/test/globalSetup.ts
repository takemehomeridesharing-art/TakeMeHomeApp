import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Fresh SQLite file per test run, migrated with the committed migrations. */
export default function setup() {
  const root = path.resolve(import.meta.dirname, '..');
  const db = path.join(root, 'prisma', 'test.db');
  for (const f of [db, `${db}-journal`]) fs.rmSync(f, { force: true });
  // Prisma's JS entry point via Node works on Windows too (no .cmd shims or npx needed).
  const cli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: `file:${db.replaceAll('\\', '/')}` },
  });
}
