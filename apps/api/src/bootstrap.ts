import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { API_ROOT } from './env';

/**
 * Runs the Prisma CLI with the current Node binary. Calling Prisma's JS entry point directly
 * (instead of `node_modules/.bin/prisma`, which is a `.cmd` shim on Windows) works on every OS.
 */
export function prismaCli(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const cli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  execFileSync(process.execPath, [cli, ...args], { cwd: API_ROOT, stdio: 'inherit', env });
}

/** Applies committed Prisma migrations (creates the SQLite file on first run). */
export function migrate() {
  prismaCli(['migrate', 'deploy']);
}
