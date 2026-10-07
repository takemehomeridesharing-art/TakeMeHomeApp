import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Fresh SQLite file per test run, migrated with the committed migrations. */
export default function setup() {
  const root = path.resolve(import.meta.dirname, '..');
  const db = path.join(root, 'prisma', 'test.db');
  for (const f of [db, `${db}-journal`]) fs.rmSync(f, { force: true });
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: root,
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: `file:${db}` },
  });
}
